import { API_BASE_URL } from '../config/api'
import type { StatsResponse } from '../types/stats'

interface ApiErrorBody {
  code?: string
  message?: string
}

export class StatsApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function fetchStats(startDate: string, signal?: AbortSignal) {
  const url = new URL('/api/stats', API_BASE_URL)
  url.searchParams.set('startDate', startDate)

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new StatsApiError(
      body.message ?? '服务器暂时无法提供统计数据',
      response.status,
      body.code,
    )
  }

  return (await response.json()) as StatsResponse
}
