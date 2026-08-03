import { setTimeout as delay } from 'node:timers/promises'
import cron, { type ScheduledTask } from 'node-cron'
import type { Logger } from 'pino'
import { CacheDatabase } from './database.js'
import { FetchError, fetchRatingHistory } from './codeforces.js'
import type { Member, SyncOutcome } from './types.js'

interface SchedulerOptions {
  cronExpression: string
  timezone: string
  requestIntervalMs: number
  requestTimeoutMs: number
  syncDeadlineMs: number
}

const RETRY_DELAYS = [5_000, 15_000]

export class SyncScheduler {
  private task: ScheduledTask | null = null
  private currentRun: Promise<void> | null = null
  private activeController: AbortController | null = null
  private lastRequestStartedAt = 0

  constructor(
    private readonly database: CacheDatabase,
    private readonly members: Member[],
    private readonly logger: Logger,
    private readonly options: SchedulerOptions,
  ) {}

  start() {
    this.task = cron.schedule(
      this.options.cronExpression,
      () => this.startRun('scheduled'),
      { timezone: this.options.timezone },
    )
    this.startRun('startup')
  }

  async stop() {
    this.task?.stop()
    this.activeController?.abort()
    await this.currentRun
  }

  private startRun(trigger: 'startup' | 'scheduled') {
    if (this.currentRun) {
      this.logger.info({ trigger }, 'Skip overlapping sync')
      return
    }
    this.currentRun = this.run(trigger).finally(() => {
      this.currentRun = null
    })
  }

  private async waitForRateSlot(signal: AbortSignal) {
    const waitMs = Math.max(
      0,
      this.options.requestIntervalMs - (Date.now() - this.lastRequestStartedAt),
    )
    if (waitMs > 0) await delay(waitMs, undefined, { signal })
    this.lastRequestStartedAt = Date.now()
  }

  private async fetchOne(member: Member, signal: AbortSignal): Promise<SyncOutcome> {
    try {
      await this.waitForRateSlot(signal)
      const changes = await fetchRatingHistory(
        member.handle,
        this.options.requestTimeoutMs,
        signal,
      )
      return { ok: true, changes }
    } catch (error) {
      if (signal.aborted) {
        return { ok: false, error: '本轮同步超过时间上限', retryable: false }
      }
      if (error instanceof FetchError) {
        return { ok: false, error: error.message, retryable: error.retryable }
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : '未知抓取错误',
        retryable: true,
      }
    }
  }

  private async fetchBatch(
    members: Member[],
    outcomes: Map<string, SyncOutcome>,
    signal: AbortSignal,
  ) {
    const retryable: Member[] = []
    for (const member of members) {
      const outcome = await this.fetchOne(member, signal)
      outcomes.set(member.handle, outcome)
      if (!outcome.ok) {
        this.logger.warn(
          { handle: member.handle, retryable: outcome.retryable, error: outcome.error },
          'Codeforces member sync failed',
        )
        if (outcome.retryable && !signal.aborted) retryable.push(member)
      }
    }
    return retryable
  }

  private async run(trigger: 'startup' | 'scheduled') {
    this.lastRequestStartedAt = 0
    const startedAt = new Date().toISOString()
    const controller = new AbortController()
    this.activeController = controller
    const deadline = setTimeout(() => controller.abort(), this.options.syncDeadlineMs)
    const outcomes = new Map<string, SyncOutcome>()
    this.database.startSync(startedAt)
    this.logger.info({ trigger, members: this.members.length }, 'Codeforces sync started')

    try {
      let retryable = await this.fetchBatch(this.members, outcomes, controller.signal)
      for (let round = 0; round < RETRY_DELAYS.length && retryable.length > 0; round += 1) {
        await delay(RETRY_DELAYS[round], undefined, { signal: controller.signal }).catch(() => undefined)
        if (controller.signal.aborted) break
        this.logger.info({ round: round + 1, members: retryable.length }, 'Retry sync batch')
        retryable = await this.fetchBatch(retryable, outcomes, controller.signal)
      }

      for (const member of this.members) {
        if (!outcomes.has(member.handle)) {
          outcomes.set(member.handle, {
            ok: false,
            error: '本轮同步超过时间上限',
            retryable: false,
          })
        }
      }
    } finally {
      clearTimeout(deadline)
      const completedAt = new Date().toISOString()
      this.database.publishSync(outcomes, completedAt)
      const failed = [...outcomes.values()].filter((outcome) => !outcome.ok).length
      this.logger.info(
        { trigger, updated: outcomes.size - failed, failed, completedAt },
        'Codeforces sync completed',
      )
      this.activeController = null
    }
  }
}
