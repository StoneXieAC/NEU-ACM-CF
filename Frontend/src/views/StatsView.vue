<script setup lang="ts">
import StatsSummary from '../components/StatsSummary.vue'
import StatsTable from '../components/StatsTable.vue'
import SyncStatusCard from '../components/SyncStatusCard.vue'
import TrackerHero from '../components/TrackerHero.vue'
import { useStats } from '../composables/useStats'

const {
  selectedDate,
  response,
  sortedRows,
  summary,
  isLoading,
  statusTone,
  statusText,
  loadStats,
} = useStats()
</script>

<template>
  <main class="page-shell">
    <TrackerHero v-model="selectedDate" :is-loading="isLoading" @refresh="loadStats" />
    <StatsSummary :summary="summary" :is-loading="isLoading" />
    <SyncStatusCard
      :sync="response?.sync ?? null"
      :tone="statusTone"
      :status-text="statusText"
    />
    <StatsTable :rows="sortedRows" :is-loading="isLoading" />
  </main>
</template>
