<script setup lang="ts">
//編集画面
import { ref, watch, computed } from 'vue'
import type { Scene, SceneInput } from '@/types/scene'

// props。どの画面かはわかるようにしとく必要がある
const props = defineProps<{
  isOpen: boolean
  workId: number
  // 編集対象のシーン。undefined なら新規作成モード
  editingScene?: Scene
}>()

// emit
const emit = defineEmits<{
  (e: 'close'): void
  //sceneinputは親コンポーネントにorder以外を要求する
  //ここだけではなく、型を関数の最上流から下流まで一貫させる
  (e: 'submit', input: Omit<SceneInput, 'order'>): void
}>()

// モード判定
const isEditMode = computed(() => !!props.editingScene)

// ダイアログのタイトル
const dialogTitle = computed(() =>
  isEditMode.value ? 'シーンを編集' : '新規シーンを作成'
)

// 保存ボタンのラベル
const submitLabel = computed(() =>
  isEditMode.value ? '更新' : '保存'
)

// フォームの入力状態
const title = ref('')
const worldDateTime = ref('')
const summary = ref('')
const worldState = ref('')
const todoNotes = ref('')

// isOpen が変わったときに状態を初期化
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    title.value = props.editingScene?.title ?? ''
    worldDateTime.value = props.editingScene?.worldDateTime ?? ''
    summary.value = props.editingScene?.summary ?? ''
    worldState.value = props.editingScene?.worldState ?? ''
    todoNotes.value = props.editingScene?.todoNotes ?? ''
  }
})

// 保存処理
function handleSubmit() {
  if (!title.value.trim()) {
    alert('タイトルを入力してください')
    return
  }

  emit('submit', {
    workId: props.workId,
    //最初はシーンがないのでundefinedに
    chapterId: props.editingScene?.chapterId,
    title: title.value.trim(),
    worldDateTime: worldDateTime.value.trim(),
    summary: summary.value.trim(),
    worldState: worldState.value.trim(),
    todoNotes: todoNotes.value.trim(),
  })
}

// キャンセル処理
function handleCancel() {
  emit('close')
}
</script>

<template>
  <!-- モーダル背景 overflow-y-autoでモーダルの外側をスクロール可能に。小さい画面用 -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 flex z-50 p-4 overflow-y-auto"
  >
    <!-- モーダル本体 -->
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg m-auto">
      <!-- ヘッダー sticky top-0 / sticky bottom-0:ヘッダーとフッターを固定-->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-lg">
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
        <!-- タイトル placeholderで入力欄を書いておく -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            タイトル <span class="text-red-500">*</span>
          </label>
          <input
            v-model="title"
            type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例:主人公、覚醒する"
          />
        </div>

        <!-- 時系列 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            時系列(作品世界の日時)
          </label>
          <input
            v-model="worldDateTime"
            type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例:3月15日 14:00"
          />
          <p class="text-xs text-slate-500 mt-1">
            「帝国暦2000/1/1」など、時系列を整理する必要がある場合
          </p>
        </div>

        <!-- あらすじ -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            あらすじ
          </label>
          <textarea
            v-model="summary"
            rows="4"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="このシーンで起きることの要約"
          ></textarea>
        </div>

        <!-- 世界状態 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            🌐 作品世界の趨勢など
          </label>
          <textarea
            v-model="worldState"
            rows="2"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="このシーン終了時点での世界の状態(例:帝国が侵攻開始、人類のx％が死亡)"
          ></textarea>
          <p class="text-xs text-slate-500 mt-1">
            プロットの矛盾を防ぐためのメモ
          </p>
        </div>

        <!-- TODO -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            📌 TODO
          </label>
          <textarea
            v-model="todoNotes"
            rows="2"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="後で詰める箇所のメモ(例:[TODO: キャラAの動機を再考])"
          ></textarea>
        </div>
      </div>

      <!-- フッター -->
      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white rounded-b-lg">
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