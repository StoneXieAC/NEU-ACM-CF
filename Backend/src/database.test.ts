import { afterEach, describe, expect, it } from 'vitest'
import { CacheDatabase } from './database.js'
import type { SyncOutcome } from './types.js'

const databases: CacheDatabase[] = []
function createDatabase() {
  const database = new CacheDatabase(':memory:')
  databases.push(database)
  database.replaceMembers([{ name: '测试成员', handle: 'tester' }])
  return database
}

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close()
})

describe('CacheDatabase', () => {
  it('calculates arbitrary-date statistics from the latest rating history', () => {
    const database = createDatabase()
    database.startSync('2026-08-03T00:00:00.000Z')
    database.publishSync(
      new Map<string, SyncOutcome>([
        [
          'tester',
          {
            ok: true,
            changes: [
              { contestId: 1, ratingUpdateTimeSeconds: 100, newRating: 1300 },
              { contestId: 2, ratingUpdateTimeSeconds: 200, newRating: 1400 },
            ],
          },
        ],
      ]),
      '2026-08-03T00:02:00.000Z',
    )

    const result = database.getStats(150, '2026-08-03T00:20:00.000Z')
    expect(result.rows[0]).toMatchObject({
      total: 2,
      after: 1,
      currentRating: 1400,
      freshness: 'fresh',
    })
  })

  it('keeps the previous cache when a later sync fails', () => {
    const database = createDatabase()
    database.startSync('2026-08-03T00:00:00.000Z')
    database.publishSync(
      new Map([['tester', { ok: true as const, changes: [{ contestId: 1, ratingUpdateTimeSeconds: 100, newRating: 1300 }] }]]),
      '2026-08-03T00:02:00.000Z',
    )
    database.startSync('2026-08-03T00:20:00.000Z')
    database.publishSync(
      new Map([['tester', { ok: false as const, error: '上游超时', retryable: true }]]),
      '2026-08-03T00:22:00.000Z',
    )

    expect(database.getStats(0, '2026-08-03T00:40:00.000Z').rows[0]).toMatchObject({
      total: 1,
      currentRating: 1300,
      freshness: 'stale',
    })
  })
})
