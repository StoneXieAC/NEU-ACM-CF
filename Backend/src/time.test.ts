import { describe, expect, it } from 'vitest'
import { getNextTwentyMinuteRun, parseStartDate } from './time.js'

describe('time helpers', () => {
  it('uses noon in Asia/Shanghai as the cutoff', () => {
    expect(parseStartDate('2026-03-01')).toBe(Date.UTC(2026, 2, 1, 4) / 1000)
  })

  it('rejects impossible dates', () => {
    expect(parseStartDate('2026-02-30')).toBeNull()
    expect(parseStartDate('03/01/2026')).toBeNull()
  })

  it('returns the next wall-clock twenty minute boundary', () => {
    expect(getNextTwentyMinuteRun(new Date('2026-08-03T04:21:45Z'))).toBe(
      '2026-08-03T04:40:00.000Z',
    )
  })
})
