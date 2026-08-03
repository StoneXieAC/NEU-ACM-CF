export type DataFreshness = 'fresh' | 'stale' | 'unavailable'
export type StatusTone = 'neutral' | 'loading' | 'success' | 'warning' | 'error'

export interface StatsRow {
  name: string
  handle: string
  total: number
  after: number
  currentRating: number | null
  dataUpdatedAt: string | null
  freshness: DataFreshness
  message: string | null
}

export interface SyncStatus {
  inProgress: boolean
  lastStartedAt: string | null
  lastCompletedAt: string | null
  nextRunAt: string
  staleCount: number
}

export interface StatsResponse {
  startDate: string
  sync: SyncStatus
  rows: StatsRow[]
}

export interface StatsSummary {
  maxRating: number | null
  averageRating: number | null
  count1900Plus: number
  count1600Plus: number
  totalUsers: number
}
