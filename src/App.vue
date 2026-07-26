<script setup lang="ts">
import AppMenu from '@/components/AppMenu.vue'
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-emerald-50 via-stone-50 to-teal-100 text-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950 dark:text-slate-100">
    <header class="border-b border-emerald-100 bg-white/70 backdrop-blur-md dark:border-emerald-900 dark:bg-slate-900/70">
      <div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-emerald-900 dark:text-emerald-200">さっかのアメ</h1>
          <p class="text-sm text-slate-500 mt-1 dark:text-slate-400">執筆・創作・シナリオ管理に</p>
        </div>
        <AppMenu />
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-6 py-12">
      <RouterView />
    </main>
    <footer>
      <p class="text-center text-gray-500 dark:text-slate-400">
      問題があればこちらまでお願いします→ https://x.com/wrisupEX
      </p>
    </footer>
  </div>
</template>
