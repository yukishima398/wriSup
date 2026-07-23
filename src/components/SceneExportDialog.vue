<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Work } from '@/types/work'
import type { Scene } from '@/types/scene'
import {
  NOVEL_SITE_LABELS,
  downloadEpisodesAsZip,
  printEpisodesForPdf,
  type NovelSite,
  type ExportFormat,
} from '@/utils/novelSiteExporter'

// props
const props = defineProps<{
  isOpen: boolean
  work: Work
  scenes: Scene[]
}>()

// emit
const emit = defineEmits<{
  (e: 'close'): void
}>()

const SITES: NovelSite[] = ['narou', 'kakuyomu', 'hameln', 'pixiv']

const selectedSite = ref<NovelSite | null>(null)
const format = ref<ExportFormat>('txt')
const isExporting = ref(false)

// ダイアログが開かれたら状態を初期化する
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    selectedSite.value = null
    format.value = 'txt'
  }
})

function selectSite(site: NovelSite) {
  selectedSite.value = site
}

async function handleExport() {
  if (props.scenes.length === 0) {
    alert('書き出すシーンがありません')
    return
  }
  if (!selectedSite.value) {
    alert('投稿サイトを選択してください')
    return
  }

  isExporting.value = true
  try {
    if (format.value === 'txt') {
      await downloadEpisodesAsZip(props.work, props.scenes, selectedSite.value)
    } else {
      printEpisodesForPdf(props.work, props.scenes, selectedSite.value)
    }
    emit('close')
  } catch (e) {
    alert(e instanceof Error ? e.message : '変換に失敗しました')
  } finally {
    isExporting.value = false
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <!-- モーダル背景 -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 dark:bg-black/70"
  >
    <!-- モーダル本体 -->
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col dark:bg-slate-800">
      <!-- ヘッダー -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 rounded-t-lg shrink-0 dark:border-slate-700">
        <h3 class="text-lg font-semibold">テキストファイル変換</h3>
        <button
          type="button"
          class="text-slate-400 hover:text-slate-600 text-2xl leading-none dark:text-slate-500 dark:hover:text-slate-300"
          @click="handleClose"
        >
          ×
        </button>
      </div>

      <div class="px-6 py-4 space-y-5">
        <p class="text-sm text-slate-500 dark:text-slate-400">
          全{{ scenes.length }}話を1話ずつのファイルに分けて書き出します。
        </p>

        <!-- 投稿サイト選択 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
            投稿サイトを選択（ルビの形式をサイトに合わせて変換します）
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="site in SITES"
              :key="site"
              type="button"
              class="px-3 py-2 text-sm rounded-md border transition-colors"
              :class="selectedSite === site
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700'"
              @click="selectSite(site)"
            >
              {{ NOVEL_SITE_LABELS[site] }}
            </button>
          </div>
          <p v-if="selectedSite === 'pixiv'" class="text-xs text-slate-500 mt-2 dark:text-slate-400">
            pixiv記法(「[[rb:文字 &gt; ふりがな]]」)に自動変換します。
          </p>
        </div>

        <!-- ファイル形式トグル -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
            ファイル形式
          </label>
          <div class="inline-flex rounded-md border border-slate-200 overflow-hidden dark:border-slate-600">
            <button
              type="button"
              class="px-4 py-2 text-sm transition-colors"
              :class="format === 'txt'
                ? 'bg-emerald-700 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'"
              @click="format = 'txt'"
            >
              txt(ZIP)
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm transition-colors border-l border-slate-200 dark:border-slate-600"
              :class="format === 'pdf'
                ? 'bg-emerald-700 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'"
              @click="format = 'pdf'"
            >
              pdf(印刷)
            </button>
          </div>
          <p v-if="format === 'pdf'" class="text-xs text-slate-500 mt-2 dark:text-slate-400">
            話ごとに改ページした印刷画面が開きます。印刷ダイアログで「PDFとして保存」を選んでください。
          </p>
        </div>
      </div>

      <!-- フッター -->
      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 rounded-b-lg dark:border-slate-700">
        <button
          type="button"
          class="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors dark:text-slate-300 dark:hover:bg-slate-700"
          @click="handleClose"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors disabled:opacity-50"
          :disabled="isExporting || !selectedSite"
          @click="handleExport"
        >
          {{ format === 'txt' ? 'ダウンロード' : '印刷画面を開く' }}
        </button>
      </div>
    </div>
  </div>
</template>
