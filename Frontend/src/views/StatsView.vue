<script setup lang="ts">
import StatsSummary from '../components/StatsSummary.vue'
import StatsTable from '../components/StatsTable.vue'
import TrackerHero from '../components/TrackerHero.vue'
import { useStats } from '../composables/useStats'

const {
  selectedDate,
  sortedRows,
  summary,
  isLoading,
  errorMessage,
  loadStats,
} = useStats()
</script>

<template>
  <main class="page-shell">
    <TrackerHero v-model="selectedDate" :is-loading="isLoading" @refresh="loadStats" />
    <StatsSummary :summary="summary" :is-loading="isLoading" />
    <StatsTable :rows="sortedRows" :is-loading="isLoading" :empty-message="errorMessage" />
  </main>
</template>
