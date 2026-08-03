import { createServer } from 'node:http'
import { createApp } from './app.js'
import { config } from './config.js'
import { CacheDatabase } from './database.js'
import { logger } from './logger.js'
import { loadMembers } from './members.js'
import { SyncScheduler } from './scheduler.js'

const members = await loadMembers(config.memberCsvPath)
const database = new CacheDatabase(config.databasePath)
database.replaceMembers(members)

const scheduler = new SyncScheduler(database, members, logger, {
  cronExpression: config.syncCron,
  timezone: config.timezone,
  requestIntervalMs: config.requestIntervalMs,
  requestTimeoutMs: config.requestTimeoutMs,
  syncDeadlineMs: config.syncDeadlineMs,
})
const app = createApp({ database, logger, allowedOrigins: config.allowedOrigins })
const server = createServer(app)

server.listen(config.port, '0.0.0.0', () => {
  logger.info({ port: config.port, members: members.length }, 'API server listening')
  scheduler.start()
})

let shuttingDown = false
function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'Graceful shutdown started')
  const closeServer = new Promise<void>((resolve) => server.close(() => resolve()))
  void Promise.all([scheduler.stop(), closeServer]).then(() => {
    database.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception')
  shutdown('uncaughtException')
})
process.on('unhandledRejection', (error) => {
  logger.fatal({ error }, 'Unhandled rejection')
  shutdown('unhandledRejection')
})
