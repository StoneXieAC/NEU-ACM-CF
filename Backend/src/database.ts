import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import type { Member, StatsRow, SyncOutcome } from './types.js'

interface MemberStatusRow extends Member {
  last_attempt_at: string | null
  last_success_at: string | null
  last_error: string | null
}

interface SyncStateRow {
  in_progress: number
  last_started_at: string | null
  last_completed_at: string | null
}

export class CacheDatabase {
  private readonly db: BetterSqlite3.Database

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new BetterSqlite3(path)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('busy_timeout = 5000')
    this.migrate()
    this.recoverInterruptedSync()
  }

  private migrate() {
    const version = this.db.pragma('user_version', { simple: true }) as number
    if (version >= 1) return

    this.db.transaction(() => {
      this.db.exec(`
        CREATE TABLE members (
          handle TEXT PRIMARY KEY COLLATE NOCASE,
          name TEXT NOT NULL
        );

        CREATE TABLE rating_changes (
          handle TEXT NOT NULL COLLATE NOCASE,
          contest_id INTEGER NOT NULL,
          rating_update_time_seconds INTEGER NOT NULL,
          new_rating INTEGER NOT NULL,
          PRIMARY KEY (handle, contest_id),
          FOREIGN KEY (handle) REFERENCES members(handle) ON DELETE CASCADE
        );

        CREATE INDEX rating_changes_handle_time
          ON rating_changes(handle, rating_update_time_seconds DESC);

        CREATE TABLE member_sync_status (
          handle TEXT PRIMARY KEY COLLATE NOCASE,
          last_attempt_at TEXT,
          last_success_at TEXT,
          last_error TEXT,
          FOREIGN KEY (handle) REFERENCES members(handle) ON DELETE CASCADE
        );

        CREATE TABLE sync_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          in_progress INTEGER NOT NULL DEFAULT 0,
          last_started_at TEXT,
          last_completed_at TEXT,
          updated_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO sync_state (id) VALUES (1);
        PRAGMA user_version = 1;
      `)
    })()
  }

  private recoverInterruptedSync() {
    this.db.prepare('UPDATE sync_state SET in_progress = 0 WHERE id = 1').run()
  }

  replaceMembers(members: Member[]) {
    const upsert = this.db.prepare(`
      INSERT INTO members (handle, name) VALUES (@handle, @name)
      ON CONFLICT(handle) DO UPDATE SET name = excluded.name
    `)
    const remove = this.db.prepare('DELETE FROM members WHERE lower(handle) = lower(?)')

    this.db.transaction(() => {
      const configured = new Set(members.map((member) => member.handle.toLowerCase()))
      const existing = this.db.prepare('SELECT handle FROM members').all() as Array<{ handle: string }>
      for (const row of existing) {
        if (!configured.has(row.handle.toLowerCase())) remove.run(row.handle)
      }
      for (const member of members) upsert.run(member)
    })()
  }

  startSync(startedAt: string) {
    this.db.prepare(`
      UPDATE sync_state
      SET in_progress = 1, last_started_at = ?, updated_count = 0, failed_count = 0
      WHERE id = 1
    `).run(startedAt)
  }

  publishSync(outcomes: Map<string, SyncOutcome>, completedAt: string) {
    const deleteChanges = this.db.prepare('DELETE FROM rating_changes WHERE handle = ?')
    const insertChange = this.db.prepare(`
      INSERT INTO rating_changes (
        handle, contest_id, rating_update_time_seconds, new_rating
      ) VALUES (?, ?, ?, ?)
    `)
    const markSuccess = this.db.prepare(`
      INSERT INTO member_sync_status (handle, last_attempt_at, last_success_at, last_error)
      VALUES (?, ?, ?, NULL)
      ON CONFLICT(handle) DO UPDATE SET
        last_attempt_at = excluded.last_attempt_at,
        last_success_at = excluded.last_success_at,
        last_error = NULL
    `)
    const markFailure = this.db.prepare(`
      INSERT INTO member_sync_status (handle, last_attempt_at, last_success_at, last_error)
      VALUES (?, ?, NULL, ?)
      ON CONFLICT(handle) DO UPDATE SET
        last_attempt_at = excluded.last_attempt_at,
        last_error = excluded.last_error
    `)

    this.db.transaction(() => {
      let updatedCount = 0
      let failedCount = 0
      for (const [handle, outcome] of outcomes) {
        if (outcome.ok) {
          deleteChanges.run(handle)
          for (const change of outcome.changes) {
            insertChange.run(
              handle,
              change.contestId,
              change.ratingUpdateTimeSeconds,
              change.newRating,
            )
          }
          markSuccess.run(handle, completedAt, completedAt)
          updatedCount += 1
        } else {
          markFailure.run(handle, completedAt, outcome.error)
          failedCount += 1
        }
      }

      this.db.prepare(`
        UPDATE sync_state
        SET in_progress = 0,
            last_completed_at = ?,
            updated_count = ?,
            failed_count = ?
        WHERE id = 1
      `).run(completedAt, updatedCount, failedCount)
    })()
  }

  isReady() {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count FROM member_sync_status WHERE last_success_at IS NOT NULL
    `).get() as { count: number }
    return row.count > 0
  }

  checkConnection() {
    this.db.prepare('SELECT 1').get()
  }

  getStats(cutoffTimestamp: number, nextRunAt: string) {
    const members = this.db.prepare(`
      SELECT m.name, m.handle, s.last_attempt_at, s.last_success_at, s.last_error
      FROM members m
      LEFT JOIN member_sync_status s ON s.handle = m.handle
      ORDER BY m.name, m.handle
    `).all() as MemberStatusRow[]
    const counts = this.db.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN rating_update_time_seconds > ? THEN 1 ELSE 0 END), 0) AS after
      FROM rating_changes WHERE handle = ?
    `)
    const current = this.db.prepare(`
      SELECT new_rating FROM rating_changes
      WHERE handle = ?
      ORDER BY rating_update_time_seconds DESC, contest_id DESC
      LIMIT 1
    `)

    const rows: StatsRow[] = members.map((member) => {
      const countRow = counts.get(cutoffTimestamp, member.handle) as { total: number; after: number }
      const currentRow = current.get(member.handle) as { new_rating: number } | undefined
      const hasData = member.last_success_at !== null
      const stale =
        member.last_success_at !== null &&
        member.last_error !== null &&
        member.last_attempt_at !== null &&
        member.last_attempt_at > member.last_success_at
      const freshness = !hasData ? 'unavailable' : stale ? 'stale' : 'fresh'

      return {
        name: member.name,
        handle: member.handle,
        total: countRow.total,
        after: countRow.after,
        currentRating: currentRow?.new_rating ?? null,
        dataUpdatedAt: member.last_success_at,
        freshness,
        message:
          freshness === 'fresh'
            ? null
            : freshness === 'stale'
              ? `本轮同步失败：${member.last_error}`
              : member.last_error ?? '等待首次同步',
      }
    })

    const state = this.db.prepare('SELECT * FROM sync_state WHERE id = 1').get() as SyncStateRow
    return {
      sync: {
        inProgress: Boolean(state.in_progress),
        lastStartedAt: state.last_started_at,
        lastCompletedAt: state.last_completed_at,
        nextRunAt,
        staleCount: rows.filter((row) => row.freshness !== 'fresh').length,
      },
      rows,
    }
  }

  close() {
    this.db.close()
  }
}
