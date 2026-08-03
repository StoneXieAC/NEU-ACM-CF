import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { pinoHttp } from 'pino-http'
import type { Logger } from 'pino'
import { CacheDatabase } from './database.js'
import { getNextTwentyMinuteRun, parseStartDate } from './time.js'

interface AppDependencies {
  database: CacheDatabase
  logger: Logger
  allowedOrigins: readonly string[]
}

export function createApp({ database, logger, allowedOrigins }: AppDependencies) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(pinoHttp({ logger }))
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
        return callback(new Error('不允许的跨域来源'))
      },
      methods: ['GET', 'OPTIONS'],
      allowedHeaders: ['Accept', 'Content-Type'],
      maxAge: 600,
    }),
  )
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 60,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试' },
    }),
  )

  app.get('/api/health/live', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.get('/api/health/ready', (_request, response) => {
    try {
      database.checkConnection()
      if (!database.isReady()) {
        return response.status(503).json({ status: 'initializing' })
      }
      return response.json({ status: 'ready' })
    } catch {
      return response.status(503).json({ status: 'unavailable' })
    }
  })

  app.get('/api/stats', (request, response) => {
    const startDate = request.query.startDate
    const cutoffTimestamp = parseStartDate(startDate)
    if (cutoffTimestamp === null) {
      return response.status(400).json({
        code: 'INVALID_START_DATE',
        message: 'startDate 必须是有效的 YYYY-MM-DD 日期',
      })
    }
    if (!database.isReady()) {
      return response.status(503).json({
        code: 'CACHE_NOT_READY',
        message: '服务器正在进行首次数据同步，请稍后刷新',
      })
    }

    response.setHeader('Cache-Control', 'no-store')
    return response.json({
      startDate,
      ...database.getStats(cutoffTimestamp, getNextTwentyMinuteRun()),
    })
  })

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    logger.warn({ error: error.message }, 'Request rejected')
    if (error.message === '不允许的跨域来源') {
      return response.status(403).json({ code: 'CORS_FORBIDDEN', message: error.message })
    }
    response.status(500).json({ code: 'INTERNAL_ERROR', message: '服务器处理请求时发生错误' })
  })

  return app
}
