import type { RatingChange } from './types.js'

interface CodeforcesResponse {
  status?: string
  comment?: string
  result?: unknown
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message)
  }
}

function isRetryableComment(comment: string) {
  const normalized = comment.toLowerCase()
  return (
    normalized.includes('call limit exceeded') ||
    normalized.includes('temporarily') ||
    normalized.includes('try again')
  )
}

export async function fetchRatingHistory(
  handle: string,
  timeoutMs: number,
  parentSignal: AbortSignal,
): Promise<RatingChange[]> {
  const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(timeoutMs)])
  const url = new URL('https://codeforces.com/api/user.rating')
  url.searchParams.set('handle', handle)

  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' }, signal })
  } catch (error) {
    if (parentSignal.aborted) throw error
    throw new FetchError(error instanceof Error ? error.message : '网络请求失败', true)
  }

  if (response.status === 429 || response.status >= 500) {
    throw new FetchError(`Codeforces HTTP ${response.status}`, true)
  }
  if (!response.ok) throw new FetchError(`Codeforces HTTP ${response.status}`, false)

  let body: CodeforcesResponse
  try {
    body = (await response.json()) as CodeforcesResponse
  } catch {
    throw new FetchError('Codeforces 返回了无效 JSON', true)
  }

  if (body.status !== 'OK') {
    const comment = body.comment ?? 'Codeforces API 返回失败状态'
    throw new FetchError(comment, isRetryableComment(comment))
  }
  if (!Array.isArray(body.result)) throw new FetchError('Codeforces 返回数据格式无效', true)

  return body.result.map((item) => {
    const change = item as Partial<RatingChange>
    if (
      !Number.isInteger(change.contestId) ||
      !Number.isInteger(change.ratingUpdateTimeSeconds) ||
      !Number.isInteger(change.newRating)
    ) {
      throw new FetchError('Codeforces RatingChange 字段无效', true)
    }
    return {
      contestId: change.contestId as number,
      ratingUpdateTimeSeconds: change.ratingUpdateTimeSeconds as number,
      newRating: change.newRating as number,
    }
  })
}
