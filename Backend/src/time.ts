export function parseStartDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const check = new Date(Date.UTC(year, month - 1, day))
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null
  }

  // 12:00 in Asia/Shanghai is 04:00 UTC.
  return Math.floor(Date.UTC(year, month - 1, day, 4, 0, 0) / 1000)
}

export function getNextTwentyMinuteRun(now = new Date()) {
  const next = new Date(now)
  const minutesToAdd = 20 - (next.getUTCMinutes() % 20)
  next.setUTCMinutes(next.getUTCMinutes() + minutesToAdd, 0, 0)
  return next.toISOString()
}
