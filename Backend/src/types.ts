export interface Member {
  name: string
  handle: string
}

export interface RatingChange {
  contestId: number
  ratingUpdateTimeSeconds: number
  newRating: number
}

export type SyncOutcome =
  | { ok: true; changes: RatingChange[] }
  | { ok: false; error: string; retryable: boolean }

export type DataFreshness = 'fresh' | 'stale' | 'unavailable'

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
