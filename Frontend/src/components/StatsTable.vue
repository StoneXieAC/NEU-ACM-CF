<script setup lang="ts">
import type { StatsRow } from '../types/stats'
import { getRatingClass } from '../utils/rating'
defineProps<{ rows: StatsRow[]; isLoading: boolean; emptyMessage?: string | null }>()
</script>

<template>
  <section class="table-card">
    <div class="table-head"><div><h2>训练榜单</h2><p>按统计场次降序排序，同场次下按当前 Rating 排序。</p></div></div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>排名</th><th>姓名</th><th>Handle</th><th>Rating</th><th>统计场次</th><th>总参赛数</th></tr></thead>
        <tbody>
          <tr v-if="rows.length === 0"><td colspan="6" class="empty-row">{{ isLoading ? '正在读取统计数据…' : (emptyMessage ?? '暂无可用统计数据。') }}</td></tr>
          <tr v-for="(row,index) in rows" :key="`${row.name}-${row.handle}`" :class="{ 'row-stale': row.freshness === 'stale' }">
            <td>{{ index + 1 }}</td>
            <td>{{ row.name }}</td>
            <td><a :href="`https://codeforces.com/profile/${row.handle}`" target="_blank" rel="noreferrer" :class="getRatingClass(row.currentRating,row.total)">{{ row.handle }}</a></td>
            <td :class="getRatingClass(row.currentRating,row.total)">{{ row.freshness === 'unavailable' ? '--' : (row.currentRating ?? '--') }}</td>
            <td class="after-count">
              <template v-if="row.freshness === 'unavailable'">{{ row.message ?? '暂无缓存' }}</template>
              <template v-else>{{ row.after }}<span v-if="row.freshness === 'stale'" class="stale-badge" :title="row.message ?? ''">旧值</span></template>
            </td>
            <td>{{ row.freshness === 'unavailable' ? '--' : row.total }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.table-card { border: 1px solid var(--surface-border); border-radius: 28px; padding: 24px; background: var(--surface-background); backdrop-filter: blur(16px); box-shadow: var(--surface-shadow); }
.table-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.table-head h2 { margin: 0; font-size: 1.45rem; }
.table-head p { margin: 6px 0 0; color: #60758e; }
.table-wrapper { overflow-x: auto; }
table { width: 100%; min-width: 760px; border-collapse: collapse; }
th, td { border-bottom: 1px solid rgba(127,149,180,.16); padding: 14px 12px; text-align: center; }
th { color: #5a6f89; font-size: .82rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
tbody tr { transition: background-color .18s ease; }
tbody tr:hover { background: rgba(235,244,255,.72); }
.row-stale { background: rgba(255,248,229,.48); }
.empty-row { padding: 40px 16px; color: #698099; }
.after-count { color: #173b67; font-weight: 800; }
.stale-badge { display: inline-block; margin-left: 6px; border-radius: 999px; padding: 2px 7px; background: #fff0c2; color: #8a5b08; font-size: .72rem; font-weight: 700; vertical-align: 1px; }
@media (max-width: 960px) { .table-card { border-radius: 22px; } }
@media (max-width: 640px) { th, td { padding: 12px 10px; } }
</style>
