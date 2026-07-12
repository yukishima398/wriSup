<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-emerald-50 via-stone-50 to-teal-100 text-slate-800">
    <header class="border-b border-emerald-100 bg-white/70 backdrop-blur-md">
      <div class="max-w-5xl mx-auto px-6 py-4">
        <h1 class="text-2xl font-bold text-emerald-900">さっかのアメ</h1>
        <p class="text-sm text-slate-500 mt-1">執筆・創作・シナリオ管理に</p>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-6 py-12">
      <RouterView />
    </main>
    <footer>
      <p style="text-align: center; color: gray;">
      問題があればこちらまでお願いします→ https://x.com/wrisupEX
      </p>
    </footer>
  </div>
</template>
