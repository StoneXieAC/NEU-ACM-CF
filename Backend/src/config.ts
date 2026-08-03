import { fileURLToPath } from 'node:url'

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  port: positiveInteger(process.env.PORT, 3000),
  databasePath: process.env.DATABASE_PATH ?? './data/cache.db',
  memberCsvPath:
    process.env.MEMBER_CSV_PATH ??
    fileURLToPath(new URL('../config/handle.csv', import.meta.url)),
  syncCron: process.env.SYNC_CRON ?? '*/20 * * * *',
  timezone: process.env.TZ ?? 'Asia/Shanghai',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  requestIntervalMs: positiveInteger(process.env.REQUEST_INTERVAL_MS, 2100),
  requestTimeoutMs: positiveInteger(process.env.REQUEST_TIMEOUT_MS, 10_000),
  syncDeadlineMs: positiveInteger(process.env.SYNC_DEADLINE_MS, 10 * 60_000),
  allowedOrigins: ['https://stonexieac.github.io', 'http://localhost:5173'],
} as const
