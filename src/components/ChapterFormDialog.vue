<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Chapter, ChapterInput } from '@/types/chapter'

// props
const props = defineProps<{
  isOpen: boolean
  workId: number
  editingChapter?: Chapter
}>()

// emit
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', input: ChapterInput): void
}>()

// モード判定
const isEditMode = computed(() => !!props.editingChapter)

const dialogTitle = computed(() =>
  isEditMode.value ? '章を編集' : '新章を作成'
)

const submitLabel = computed(() =>
  isEditMode.value ? '更新' : '保存'
)

// フォーム状態
const title = ref('')

// isOpen が変わったら状態を初期化
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    title.value = props.editingChapter?.title ?? ''
  }
}, { immediate: true })

function handleSubmit() {
  if (!title.value.trim()) {
    alert('タイトルを入力してください')
    return
  }

  emit('submit', {
    workId: props.workId,
    title: title.value.trim(),
  })
}

function handleCancel() {
  emit('close')
}
</script>

<template>
  <!-- モーダル背景 -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
  >
    <!-- モーダル本体 -->
    <div class="bg-white rounded-lg shadow-xl w-full max-w-sm flex flex-col">
      <!-- ヘッダー -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 rounded-t-lg shrink-0">
        <h3 class="text-lg font-semibold">{{ dialogTitle }}</h3>
        <button
          type="button"
          class="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          @click="handleCancel"
        >
          ×
        </button>
      </div>

      <!-- 入力欄 -->
      <div class="px-6 py-4">
        <label class="block text-sm font-medium text-slate-700 mb-1">
          章タイトル <span class="text-red-500">*</span>
        </label>
        <input
          v-model="title"
          type="text"
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例:第一章 出会い"
          @keyup.enter="handleSubmit"
        />
      </div>

      <!-- フッター -->
      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 rounded-b-lg">
        <button
          type="button"
          class="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          @click="handleCancel"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors"
          @click="handleSubmit"
        >
          {{ submitLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
