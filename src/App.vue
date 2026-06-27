<script setup lang="ts">
// import logoImage from './assets/hero.png'
// const imageUrl = logoImage
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="max-w-5xl mx-auto px-6 py-4">
        <h1 class="text-2xl font-bold">さっかのあめ(🍬)</h1>
        <p class="text-sm text-slate-500 mt-1">だれでもストーリーを完結させられる</p>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-6 py-12">
      <RouterView />
    </main>
    <footer>
      <p style="text-align: center; color: gray;">
      ご要望、作って欲しいもの等はこちらに→ https://x.com/wrisupEX
      </p>
    </footer>
  </div>
</template>
