import pino from 'pino'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { CacheDatabase } from './database.js'

const databases: CacheDatabase[] = []
function setup() {
  const database = new CacheDatabase(':memory:')
  databases.push(database)
  database.replaceMembers([{ name: '测试成员', handle: 'tester' }])
  const app = createApp({
    database,
    logger: pino({ level: 'silent' }),
    allowedOrigins: ['https://stonexieac.github.io'],
  })
  return { app, database }
}

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close()
})

describe('stats API', () => {
  it('returns 503 before the first cache is available', async () => {
    const { app } = setup()
    const response = await request(app).get('/api/stats?startDate=2026-03-01')
    expect(response.status).toBe(503)
    expect(response.body.code).toBe('CACHE_NOT_READY')
  })

  it('rejects invalid dates', async () => {
    const { app } = setup()
    const response = await request(app).get('/api/stats?startDate=2026-02-30')
    expect(response.status).toBe(400)
  })

  it('returns cached data and the allowed CORS origin', async () => {
    const { app, database } = setup()
    database.startSync('2026-08-03T00:00:00.000Z')
    database.publishSync(
      new Map([['tester', { ok: true as const, changes: [] }]]),
      '2026-08-03T00:02:00.000Z',
    )
    const response = await request(app)
      .get('/api/stats?startDate=2026-03-01')
      .set('Origin', 'https://stonexieac.github.io')

    expect(response.status).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe('https://stonexieac.github.io')
    expect(response.body.rows).toHaveLength(1)
  })

  it('rejects an untrusted browser origin', async () => {
    const { app } = setup()
    const response = await request(app)
      .get('/api/health/live')
      .set('Origin', 'https://example.com')
    expect(response.status).toBe(403)
    expect(response.body.code).toBe('CORS_FORBIDDEN')
  })
})
