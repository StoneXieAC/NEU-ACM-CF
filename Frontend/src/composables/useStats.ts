import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchStats } from '../api/stats'
import type { StatsResponse, StatsSummary, StatusTone } from '../types/stats'

const DEFAULT_DATE = '2026-03-01'

export function useStats() {
  const selectedDate = ref(DEFAULT_DATE)
  const response = ref<StatsResponse | null>(null)
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)
  let activeController: AbortController | null = null
  let requestId = 0

  const sortedRows = computed(() =>
    [...(response.value?.rows ?? [])].sort((left, right) => {
      if (left.freshness === 'unavailable' && right.freshness !== 'unavailable') return 1
      if (right.freshness === 'unavailable' && left.freshness !== 'unavailable') return -1
      if (right.after !== left.after) return right.after - left.after
      if ((right.currentRating ?? -1) !== (left.currentRating ?? -1)) {
        return (right.currentRating ?? -1) - (left.currentRating ?? -1)
      }
      return left.handle.localeCompare(right.handle)
    }),
  )

  const summary = computed<StatsSummary>(() => {
    const availableRows = (response.value?.rows ?? []).filter(
      (row) => row.freshness !== 'unavailable',
    )
    const ratings = availableRows
      .filter((row) => row.currentRating !== null)
      .map((row) => row.currentRating ?? 0)

    return {
      maxRating: ratings.length > 0 ? Math.max(...ratings) : null,
      averageRating:
        ratings.length > 0
          ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length)
          : null,
      count1900Plus: ratings.filter((rating) => rating >= 1900).length,
      count1600Plus: ratings.filter((rating) => rating >= 1600).length,
      totalUsers: response.value?.rows.length ?? 0,
    }
  })

  const statusTone = computed<StatusTone>(() => {
    if (isLoading.value) return 'loading'
    if (errorMessage.value) return 'error'
    if (!response.value) return 'neutral'
    if (response.value.sync.staleCount > 0) return 'warning'
    return 'success'
  })

  const statusText = computed(() => {
    if (isLoading.value) return '正在读取服务器缓存…'
    if (errorMessage.value) return errorMessage.value
    if (!response.value) return '等待加载统计数据'
    if (response.value.sync.staleCount > 0) {
      return `${response.value.sync.staleCount} 人本轮同步失败，当前继续使用最近成功数据`
    }
    if (response.value.sync.inProgress) return '数据已加载，服务器正在后台同步下一批数据'
    return '数据已从服务器缓存加载，页面未直接请求 Codeforces'
  })

  async function loadStats() {
    activeController?.abort()
    const controller = new AbortController()
    activeController = controller
    requestId += 1
    const currentRequestId = requestId
    isLoading.value = true
    errorMessage.value = null

    try {
      const result = await fetchStats(selectedDate.value, controller.signal)
      if (currentRequestId === requestId) response.value = result
    } catch (error) {
      if (controller.signal.aborted || currentRequestId !== requestId) return
      errorMessage.value = error instanceof Error ? error.message : '读取统计数据失败'
    } finally {
      if (currentRequestId === requestId) isLoading.value = false
      if (activeController === controller) activeController = null
    }
  }

  onMounted(() => void loadStats())
  onBeforeUnmount(() => activeController?.abort())

  return {
    selectedDate,
    response,
    sortedRows,
    summary,
    isLoading,
    statusTone,
    statusText,
    loadStats,
  }
}
