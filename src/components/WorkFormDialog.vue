<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Work, WorkInput } from '@/types/work'

// props: 親コンポーネントから受け取る値
const props = defineProps<{
  isOpen: boolean
  // 編集対象の作品。undefined なら新規作成モード
  editingWork?: Work
}>()

// emit: 親コンポーネントにイベントを通知する
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', input: WorkInput): void
}>()

// 編集モードかどうかを判定
const isEditMode = computed(() => !!props.editingWork)

// ダイアログのタイトル
const dialogTitle = computed(() =>
  isEditMode.value ? '作品を編集' : '新規作品を作成'
)

// 保存ボタンのラベル
const submitLabel = computed(() =>
  isEditMode.value ? '更新' : '保存'
)

// フォームの入力状態
const title = ref('')
const goal = ref('')
const theme = ref('')

// isOpen が変わったときに状態を初期化
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    // 編集モードなら既存データを、新規モードなら空をセット
    title.value = props.editingWork?.title ?? ''
    goal.value = props.editingWork?.goal ?? ''
    theme.value = props.editingWork?.theme ?? ''
  }
})

// 保存処理
function handleSubmit() {
  if (!title.value.trim()) {
    alert('タイトルを入力してください')
    return
  }

  emit('submit', {
    title: title.value.trim(),
    goal: goal.value.trim(),
    theme: theme.value.trim(),
  })
}

// キャンセル処理
function handleCancel() {
  emit('close')
}
</script>

<template>
  <!-- モーダル背景 -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 flex z-50 p-4 overflow-y-auto"
  >
    <!-- モーダル本体 -->
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
      <!-- ヘッダー -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 m-auto">
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
      <div class="px-6 py-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            タイトル <span class="text-red-500">*</span>
          </label>
          <input
            v-model="title"
            type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例:転生したらペンでした"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            ゴール
          </label>
          <textarea
            v-model="goal"
            rows="2"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="最悪ここに着地させよう。例:主人公がAランクになる"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            テーマ
          </label>
          <textarea
            v-model="theme"
            rows="2"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="作品を通じて描きたい主題。例:成長と父性愛"
          ></textarea>
        </div>
      </div>

      <!-- フッター -->
      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
        <button
          type="button"
          class="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          @click="handleCancel"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          @click="handleSubmit"
        >
          {{ submitLabel }}
        </button>
      </div>
    </div>
  </div>
</template>