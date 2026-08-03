<script setup lang="ts">
defineProps<{ isLoading: boolean }>()
const selectedDate = defineModel<string>({ required: true })
defineEmits<{ refresh: [] }>()
</script>

<template>
  <section class="hero-panel">
    <div class="hero-copy">
      <p class="eyebrow">NEU ACM CF Tracker</p>
      <h1><span>东北大学 ACM 队</span><span>Codeforces 训练统计</span></h1>
    </div>
    <div class="controls-card">
      <label class="field-label" for="start-time">统计起点</label>
      <input id="start-time" v-model="selectedDate" type="date" />
      <button class="primary-btn" type="button" :disabled="isLoading" @click="$emit('refresh')">
        {{ isLoading ? '正在读取' : '重新统计' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.hero-panel { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(300px, .85fr); gap: 24px; align-items: stretch; margin-bottom: 24px; }
.hero-copy, .controls-card { border: 1px solid var(--surface-border); background: var(--surface-background); backdrop-filter: blur(16px); box-shadow: var(--surface-shadow); }
.hero-copy { position: relative; overflow: hidden; border-radius: 28px; padding: 36px; }
.hero-copy::after { content: ''; position: absolute; inset: auto -10% -35% auto; width: 280px; height: 280px; border-radius: 50%; background: radial-gradient(circle, rgba(70,145,255,.22), transparent 65%); }
.eyebrow { margin: 0 0 14px; color: #2d6cdf; font-size: .82rem; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(2.4rem, 4vw, 4.6rem); line-height: .95; letter-spacing: -.05em; }
h1 span { display: block; white-space: nowrap; }
.controls-card { display: flex; flex-direction: column; justify-content: center; gap: 12px; border-radius: 24px; padding: 28px; }
.field-label { color: #5a6f89; font-size: .82rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
input, .primary-btn { width: 100%; min-height: 48px; border-radius: 14px; }
input { border: 1px solid rgba(103,128,159,.28); padding: 0 14px; background: rgba(246,249,253,.9); color: #10233f; }
.primary-btn { border: 0; background: linear-gradient(135deg,#1f72ff,#0fb4ff); box-shadow: 0 18px 28px rgba(31,114,255,.22); color: #fff; cursor: pointer; font-weight: 700; transition: transform .18s ease, opacity .18s ease; }
.primary-btn:hover:not(:disabled) { transform: translateY(-1px); }
.primary-btn:disabled { cursor: wait; opacity: .72; }
@media (max-width: 960px) { .hero-panel { grid-template-columns: 1fr; } .hero-copy, .controls-card { border-radius: 22px; } .hero-copy { padding: 28px; } h1 span { white-space: normal; } }
</style>
