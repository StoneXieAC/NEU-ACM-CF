<script setup lang="ts">
import type { StatsSummary } from '../types/stats'
import { getRatingTierClass } from '../utils/rating'
defineProps<{ summary: StatsSummary; isLoading: boolean }>()
</script>

<template>
  <section class="summary-grid" aria-label="统计摘要">
    <article class="summary-card"><span>最高 Rating</span><strong :class="getRatingTierClass(summary.maxRating)">{{ summary.maxRating ?? '--' }}</strong></article>
    <article class="summary-card"><span>平均 Rating</span><strong :class="getRatingTierClass(summary.averageRating)">{{ summary.averageRating ?? '--' }}</strong></article>
    <article class="summary-card"><span>1900+ 人数</span><strong :class="getRatingTierClass(1900)">{{ summary.count1900Plus }}</strong></article>
    <article class="summary-card"><span>1600+ 人数</span><strong :class="getRatingTierClass(1600)">{{ summary.count1600Plus }}</strong></article>
    <article class="summary-card summary-card-total"><span>{{ isLoading ? '读取中' : '总人数' }}</span><strong>{{ isLoading && summary.totalUsers === 0 ? '--' : summary.totalUsers }}</strong></article>
  </section>
</template>

<style scoped>
.summary-grid { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 16px; margin-bottom: 16px; }
.summary-card { min-width: 0; border: 1px solid var(--surface-border); border-radius: 20px; padding: 22px 20px; background: var(--surface-background); backdrop-filter: blur(16px); box-shadow: var(--surface-shadow); }
.summary-card span { color: #5a6f89; font-size: .82rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.summary-card strong { display: block; margin-top: 10px; font-size: clamp(1.2rem,2.3vw,2rem); line-height: 1.1; }
.summary-card-total { border-color: rgba(30,118,255,.24); background: rgba(238,246,255,.88); }
@media (max-width: 960px) { .summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 520px) { .summary-grid { grid-template-columns: 1fr; } .summary-card strong { font-size: 1.4rem; } }
</style>
