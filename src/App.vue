<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type StatusTone = 'neutral' | 'loading' | 'success' | 'error'

interface User {
  name: string
  handle: string
}

interface UserStats extends User {
  total: number
  after: number
  cur: number | null
  error: string | null
}

const defaultDate = '2026-03-01'
const CONCURRENCY_LIMIT = 4
const RATE_LIMIT_MAX_RETRIES = 4
const RATE_LIMIT_RETRY_BASE_MS = 3000
const handleCsvUrl = new URL('handle.csv', import.meta.env.BASE_URL).toString()

const selectedDate = ref(defaultDate)
const rows = ref<UserStats[]>([])
const isLoading = ref(false)
const statusText = ref('点击上方按钮开始统计')
const statusTone = ref<StatusTone>('neutral')
const progress = ref({ done: 0, total: 0 })

let currentRunId = 0
let activeController: AbortController | null = null

const validRows = computed(() => rows.value.filter((row) => !row.error))
const ratingRows = computed(() =>
  validRows.value.filter((row) => row.cur !== null),
)
const maxRating = computed(() =>
  ratingRows.value.length === 0
    ? null
    : Math.max(...ratingRows.value.map((row) => row.cur ?? -1)),
)
const averageRating = computed(() =>
  ratingRows.value.length === 0
    ? null
    : Math.round(
        ratingRows.value.reduce((sum, row) => sum + (row.cur ?? 0), 0) /
          ratingRows.value.length,
      ),
)
const count1900Plus = computed(
  () => ratingRows.value.filter((row) => (row.cur ?? 0) >= 1900).length,
)
const count1600Plus = computed(
  () => ratingRows.value.filter((row) => (row.cur ?? 0) >= 1600).length,
)
const totalUsers = computed(() => progress.value.total || rows.value.length || null)
const sortedRows = computed(() =>
  [...rows.value].sort((left, right) => {
    if (Boolean(left.error) !== Boolean(right.error)) {
      return left.error ? 1 : -1
    }
    if (right.after !== left.after) {
      return right.after - left.after
    }
    if ((right.cur ?? -1) !== (left.cur ?? -1)) {
      return (right.cur ?? -1) - (left.cur ?? -1)
    }
    return left.handle.localeCompare(right.handle)
  }),
)

function getRatingClass(rating: number | null, totalContests: number) {
  if (rating === null) return 'rating-none'
  if (totalContests <= 5) return 'rating-newbie'
  if (rating < 1200) return 'rating-gray'
  if (rating < 1400) return 'rating-green'
  if (rating < 1600) return 'rating-cyan'
  if (rating < 1900) return 'rating-blue'
  if (rating < 2100) return 'rating-violet'
  if (rating < 2400) return 'rating-orange'
  return 'rating-red'
}

function getNoonTimestamp(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`)
  return Math.floor(date.getTime() / 1000)
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isCallLimitError(comment: unknown) {
  return typeof comment === 'string' && comment.includes('Call limit exceeded')
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (!signal) {
    await new Promise((resolve) => window.setTimeout(resolve, ms))
    return
  }

  const activeSignal = signal

  if (activeSignal.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      activeSignal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort() {
      window.clearTimeout(timer)
      activeSignal.removeEventListener('abort', onAbort)
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    }

    activeSignal.addEventListener('abort', onAbort, { once: true })
  })
}

async function loadHandleCsv(signal?: AbortSignal) {
  const response = await fetch(handleCsvUrl, { signal })

  if (!response.ok) {
    throw new Error('无法读取 handle.csv')
  }

  const text = await response.text()

  return text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.split(','))
    .filter((parts) => parts.length >= 2)
    .map(([name, handle]) => ({
      name: name.trim(),
      handle: handle.trim(),
    }))
}

async function fetchUserData(
  user: User,
  deadlineTimestamp: number,
  signal?: AbortSignal,
): Promise<UserStats> {
  const url = `https://codeforces.com/api/user.rating?handle=${encodeURIComponent(user.handle)}`

  try {
    for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
      const response = await fetch(url, { signal })
      const data = await response.json()

      if (data.status !== 'OK') {
        if (isCallLimitError(data.comment) && attempt < RATE_LIMIT_MAX_RETRIES) {
          const delay = RATE_LIMIT_RETRY_BASE_MS * (attempt + 1)
          await sleep(delay, signal)
          continue
        }

        return {
          ...user,
          total: 0,
          after: 0,
          cur: null,
          error: data.comment ?? 'API 错误',
        }
      }

      const contests = Array.isArray(data.result) ? data.result : []
      const totalContests = contests.length

      if (totalContests === 0) {
        return {
          ...user,
          total: 0,
          after: 0,
          cur: null,
          error: '无数据',
        }
      }

      const after = contests.filter(
        (contest: { ratingUpdateTimeSeconds: number }) =>
          contest.ratingUpdateTimeSeconds > deadlineTimestamp,
      ).length

      return {
        ...user,
        total: totalContests,
        after,
        cur: contests[totalContests - 1]?.newRating ?? null,
        error: null,
      }
    }

    return {
      ...user,
      total: 0,
      after: 0,
      cur: null,
      error: 'API 错误',
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }

    return {
      ...user,
      total: 0,
      after: 0,
      cur: null,
      error: '网络或跨域错误',
    }
  }
}

async function runConcurrentStats(
  users: User[],
  deadlineTimestamp: number,
  runId: number,
  signal: AbortSignal,
) {
  let nextIndex = 0
  const workerCount = Math.min(CONCURRENCY_LIMIT, users.length)

  async function worker() {
    while (nextIndex < users.length) {
      if (runId !== currentRunId || signal.aborted) {
        return
      }

      const index = nextIndex
      nextIndex += 1

      const user = users[index]
      const result = await fetchUserData(user, deadlineTimestamp, signal)

      if (runId !== currentRunId || signal.aborted) {
        return
      }

      rows.value.push(result)
      progress.value.done += 1
      statusText.value = `查询中，已完成 ${progress.value.done}/${users.length} 人`
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

async function runStats() {
  activeController?.abort()
  currentRunId += 1
  const runId = currentRunId
  const controller = new AbortController()
  activeController = controller

  rows.value = []
  isLoading.value = true
  statusTone.value = 'loading'
  progress.value = { done: 0, total: 0 }

  const deadlineTimestamp = getNoonTimestamp(selectedDate.value)

  if (Number.isNaN(deadlineTimestamp)) {
    statusTone.value = 'error'
    statusText.value = '查询日期格式无效'
    isLoading.value = false
    return
  }

  try {
    const users = await loadHandleCsv(controller.signal)

    if (runId !== currentRunId) return

    progress.value.total = users.length
    statusText.value = `名单读取成功，共 ${users.length} 人，开始查询 Codeforces 数据`

    await runConcurrentStats(users, deadlineTimestamp, runId, controller.signal)

    if (runId !== currentRunId) return

    statusTone.value = 'success'
    statusText.value = `统计完成，已处理 ${progress.value.done} 人`
  } catch (error) {
    if (runId !== currentRunId) return
    if (isAbortError(error)) return

    statusTone.value = 'error'
    statusText.value =
      error instanceof Error ? error.message : '读取名单时发生未知错误'
  } finally {
    if (activeController === controller) {
      activeController = null
    }

    if (runId === currentRunId) {
      isLoading.value = false
    }
  }
}

onBeforeUnmount(() => {
  activeController?.abort()
})

onMounted(() => {
  void runStats()
})
</script>

<template>
  <main class="page-shell">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">NEU ACM CF Tracker</p>
        <h1>
          <span>东北大学 ACM 队</span>
          <span>Codeforces 训练统计</span>
        </h1>
      </div>

      <div class="controls-card">
        <label class="field-label" for="start-time">统计起点</label>
        <input id="start-time" v-model="selectedDate" type="date" />
        <button class="primary-btn" type="button" @click="runStats">
          {{ isLoading ? '正在统计' : '开始 / 刷新' }}
        </button>
      </div>
    </section>

    <section class="summary-grid">
      <article class="summary-card">
        <span class="summary-label">最高 Rating</span>
        <strong>{{ maxRating ?? '--' }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">平均 Rating</span>
        <strong>{{ averageRating ?? '--' }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">1900+ 人数</span>
        <strong>{{ count1900Plus }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">1600+ 人数</span>
        <strong>{{ count1600Plus }}</strong>
      </article>
      <article class="summary-card summary-card-status" :data-tone="statusTone" :data-finished="!isLoading && statusTone === 'success'">
        <template v-if="isLoading || statusTone === 'error' || statusTone === 'neutral'">
          <span class="summary-label">查询中</span>
          <strong class="status-value">{{ progress.done }} / {{ progress.total || '--' }}</strong>
        </template>
        <template v-else>
          <span class="summary-label">总人数</span>
          <strong>{{ totalUsers ?? '--' }}</strong>
        </template>
      </article>
    </section>

    <section class="table-card">
      <div class="table-head">
        <div>
          <h2>训练榜单</h2>
          <p>默认按统计场次降序排序，同场次下按当前 Rating 排序。</p>
        </div>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>姓名</th>
              <th>Handle</th>
              <th>Rating</th>
              <th>统计场次</th>
              <th>总参赛数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="sortedRows.length === 0">
              <td colspan="6" class="empty-row">暂无数据，请先执行一次统计。</td>
            </tr>
            <tr v-for="(row, index) in sortedRows" :key="`${row.name}-${row.handle}`">
              <td>{{ index + 1 }}</td>
              <td>{{ row.name }}</td>
              <td>
                <a
                  :href="`https://codeforces.com/profile/${row.handle}`"
                  target="_blank"
                  rel="noreferrer"
                  :class="getRatingClass(row.cur, row.total)"
                >
                  {{ row.handle }}
                </a>
              </td>
              <td :class="getRatingClass(row.cur, row.total)">
                {{ row.error ? '--' : row.cur }}
              </td>
              <td class="after-count">
                {{ row.error ? row.error : row.after }}
              </td>
              <td>{{ row.error ? '--' : row.total }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>
