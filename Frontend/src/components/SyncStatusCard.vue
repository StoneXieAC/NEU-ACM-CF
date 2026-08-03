<script setup lang="ts">
import type { StatusTone, SyncStatus } from '../types/stats'
import { formatLocalTime } from '../utils/rating'
defineProps<{ sync: SyncStatus | null; tone: StatusTone; statusText: string }>()
</script>

<template>
  <section class="status-card" :data-tone="tone" aria-live="polite">
    <div><span class="status-title">服务器缓存</span><p class="status-text">{{ statusText }}</p></div>
    <div class="status-meta">
      <span>{{ sync?.inProgress ? '后台同步中' : '上次同步' }}</span>
      <strong>{{ sync?.inProgress ? '进行中' : formatLocalTime(sync?.lastCompletedAt ?? null) }}</strong>
    </div>
  </section>
</template>

<style scoped>
.status-card { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 16px; border: 1px solid rgba(30,118,255,.22); border-radius: 20px; padding: 18px 24px; background: rgba(238,246,255,.88); box-shadow: var(--surface-shadow); transition: border-color .2s ease, background-color .2s ease; }
.status-card[data-tone='success'] { border-color: rgba(33,160,98,.24); background: rgba(236,249,242,.92); }
.status-card[data-tone='warning'] { border-color: rgba(219,142,26,.3); background: rgba(255,248,229,.94); }
.status-card[data-tone='error'] { border-color: rgba(214,76,76,.24); background: rgba(255,241,241,.92); }
.status-title, .status-meta span { color: #5a6f89; font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.status-text { margin: 6px 0 0; color: #36506f; font-size: .95rem; }
.status-meta { min-width: 205px; text-align: right; }
.status-meta strong { display: block; margin-top: 4px; color: #173b67; font-size: .96rem; }
@media (max-width: 720px) { .status-card { align-items: flex-start; flex-direction: column; gap: 12px; } .status-meta { min-width: 0; text-align: left; } }
</style>
