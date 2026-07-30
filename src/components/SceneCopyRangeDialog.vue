<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Scene } from '@/types/scene'

// props。scenes は order 昇順の全シーン
const props = defineProps<{
  isOpen: boolean
  scenes: Scene[]
}>()

// emit
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'copy', payload: { startId: number; endId: number; titleAndSummaryOnly: boolean }): void
}>()

// コピー対象の最初/最後のシーンID
const startId = ref<number | undefined>(undefined)
const endId = ref<number | undefined>(undefined)
// チェックすると、最初のシーン=一番最初、最後のシーン=一番最後に固定される
const useAllScenes = ref(true)
// ストーリーとシーン名のみコピーするか
const titleAndSummaryOnly = ref(false)

// ダイアログが開かれたら、毎回「全シーン対象」の状態から始める
watch(() => props.isOpen, (newValue) => {
  if (!newValue) return
  useAllScenes.value = true
  titleAndSummaryOnly.value = false
  startId.value = props.scenes[0]?.id
  endId.value = props.scenes[props.scenes.length - 1]?.id
})

// 「全シーンを対象にする」がオンの間は、範囲を常に全シーンに追従させる
watch(useAllScenes, (isChecked) => {
  if (!isChecked) return
  startId.value = props.scenes[0]?.id
  endId.value = props.scenes[props.scenes.length - 1]?.id
})

function handleClose() {
  emit('close')
}

function handleCopy() {
  if (startId.value === undefined || endId.value === undefined) {
    alert('最初のシーンと最後のシーンを選択してください')
    return
  }

  emit('copy', {
    startId: startId.value,
    endId: endId.value,
    titleAndSummaryOnly: titleAndSummaryOnly.value,
  })
}
</script>

<template>
  <!-- モーダル背景 -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 dark:bg-black/70"
    @click.self="handleClose"
  >
    <!-- モーダル本体 -->
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col dark:bg-slate-800">
      <!-- ヘッダー -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 rounded-t-lg shrink-0 dark:border-slate-700">
        <h3 class="text-lg font-semibold">シーン選択コピー</h3>
        <button
          type="button"
          class="text-slate-400 hover:text-slate-600 text-2xl leading-none dark:text-slate-500 dark:hover:text-slate-300"
          @click="handleClose"
        >
          ×
        </button>
      </div>

      <div class="px-6 py-4 space-y-5">
        <!-- 全シーン対象チェック -->
        <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input v-model="useAllScenes" type="checkbox" />
          全シーンを対象にする(最初のシーン〜最後のシーン)
        </label>

        <!-- コピー範囲選択 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
              最初のシーン
            </label>
            <select
              v-model.number="startId"
              :disabled="useAllScenes"
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600 disabled:opacity-50"
            >
              <option v-for="scene in scenes" :key="scene.id" :value="scene.id">
                #{{ scene.order }} {{ scene.title || '無題' }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
              最後のシーン
            </label>
            <select
              v-model.number="endId"
              :disabled="useAllScenes"
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600 disabled:opacity-50"
            >
              <option v-for="scene in scenes" :key="scene.id" :value="scene.id">
                #{{ scene.order }} {{ scene.title || '無題' }}
              </option>
            </select>
          </div>
        </div>

        <!-- ストーリーとシーン名のみコピー トグル -->
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
            ストーリーとシーン名のみコピー
          </label>
          <button
            type="button"
            role="switch"
            :aria-checked="titleAndSummaryOnly"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
            :class="titleAndSummaryOnly ? 'bg-emerald-700' : 'bg-slate-300 dark:bg-slate-600'"
            @click="titleAndSummaryOnly = !titleAndSummaryOnly"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              :class="titleAndSummaryOnly ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
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
          class="px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors"
          @click="handleCopy"
        >
          コピー実行
        </button>
      </div>
    </div>
  </div>
</template>
