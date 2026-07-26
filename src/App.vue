<script setup lang="ts">
import AppMenu from '@/components/AppMenu.vue'
import uu from '../images/uu.jpeg'
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-emerald-50 via-stone-50 to-teal-100 text-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950 dark:text-slate-100">
    <header class="relative z-50 border-b border-emerald-100 bg-white/70 backdrop-blur-md dark:border-emerald-900 dark:bg-slate-900/70">
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
    <footer class="max-w-5xl mx-auto px-6 pb-12">
      <a
        href="https://marshmallow-qa.com/daj45kzxgeoynsa?t=YQrsmm&utm_medium=url_text&utm_source=promotion"
        class="group relative block h-40 sm:h-48 w-full max-w-1xl mx-auto overflow-hidden rounded-lg shadow-md"
      >
        <!-- 背景画像 -->
        <img
          :src="uu"
          alt="マシュマロ"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div class="absolute inset-0 bg-white/30 transition-colors group-hover:bg-white/20"></div>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4">
          <h2 class="text-xl sm:text-2xl font-bold">ご意見、ご要望、問題はこちらまで！</h2>
          <p class="mt-2 text-sm text-gray-200">クリックするとマシュマロに遷移します</p>
        </div>
      </a>
    </footer>
  </div>
</template>
