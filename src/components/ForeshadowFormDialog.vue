<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type {
  Foreshadow,
  ForeshadowInput,
  ForeshadowStatus,
} from '@/types/foreshadow'
import type { Scene } from '@/types/scene'
import {
  FORESHADOW_STATUS_LABELS,
  FORESHADOW_STATUS_COLORS,
} from '@/types/foreshadow'


// props
const props = defineProps<{
  isOpen: boolean
  workId: number
  scenes: Scene[]
  editingForeshadow?: Foreshadow
}>()

// emit
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', input: ForeshadowInput): void
}>()

// モード判定
const isEditMode = computed(() => !!props.editingForeshadow)

const dialogTitle = computed(() =>
  isEditMode.value ? '伏線を編集' : '新規伏線を作成'
)

const submitLabel = computed(() =>
  isEditMode.value ? '更新' : '保存'
)

// フォーム状態
const title = ref('')
const description = ref('')
const status = ref<ForeshadowStatus>('planned')
const placedSceneId = ref<number | undefined>(undefined)
const resolvedSceneId = ref<number | undefined>(undefined)

// isOpen が変わったら状態を初期化
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    // 編集モードなら editingForeshadow から、新規モードなら初期値
    const ef = props.editingForeshadow
    title.value = ef?.title ?? ''
    description.value = ef?.description ?? ''
    status.value = ef?.status ?? 'planned'
    placedSceneId.value = ef?.placedSceneId
    resolvedSceneId.value = ef?.resolvedSceneId
  }
}, { immediate: true })

// ステータス別のヒントメッセージ
const statusHint = computed(() => {
  switch (status.value) {
    case 'planned':
      return 'まだ書いていない、これから張る予定の段階'
    case 'placed':
      return 'すでに本文に書いた、まだ回収していない段階'
    case 'resolved':
      return '物語内で回収まで完了した段階'
  }
})

// ステータス選択肢
const statusOptions: ForeshadowStatus[] = ['planned', 'placed', 'resolved']

function handleSubmit() {
  if (!title.value.trim()) {
    alert('タイトルを入力してください')
    return
  }

  emit('submit', {
    workId: props.workId,
    title: title.value.trim(),
    description: description.value.trim(),
    status: status.value,
    placedSceneId: placedSceneId.value,
    resolvedSceneId: resolvedSceneId.value,
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
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
  >
    <!-- モーダル本体 -->
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg my-8">
      <!-- ヘッダー -->
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
        <!-- タイトル -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            タイトル <span class="text-red-500">*</span>
          </label>
          <input
            v-model="title"
            type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例:主人公の左腕の傷"
          />
        </div>

        <!-- 説明 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            説明
          </label>
          <textarea
            v-model="description"
            rows="3"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="伏線の詳細、関連するキャラや出来事のメモ"
          ></textarea>
        </div>

        <!-- ステータス -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">
            ステータス <span class="text-red-500">*</span>
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="s in statusOptions"
              :key="s"
              type="button"
              class="px-3 py-2 text-sm rounded-md transition-all border-2"
              :class="status === s
                ? FORESHADOW_STATUS_COLORS[s] + ' border-current font-medium'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'"
              @click="status = s"
            >
              {{ FORESHADOW_STATUS_LABELS[s] }}
            </button>
          </div>
          <p class="text-xs text-slate-500 mt-2">{{ statusHint }}</p>
        </div>

        <!-- シーンが0件の場合の注意 -->
        <div
          v-if="scenes.length === 0"
          class="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800"
        >
          ⚠️ このシーンの作品にはまだシーンが登録されていません。シーン紐付けは後から編集できます
        </div>

        <!-- 張ったシーン -->
        <div v-if="scenes.length > 0">
          <label class="block text-sm font-medium text-slate-700 mb-1">
            張ったシーン
          </label>
          <select
            v-model="placedSceneId"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option :value="undefined">未設定</option>
            <option v-for="scene in scenes" :key="scene.id" :value="scene.id">
              #{{ scene.order }} {{ scene.title || '無題' }}
            </option>
          </select>
          <p class="text-xs text-slate-500 mt-1">
            この伏線が実際に書かれる(または書かれた)シーン
          </p>
        </div>

        <!-- 回収予定/回収済みシーン -->
        <div v-if="scenes.length > 0">
          <label class="block text-sm font-medium text-slate-700 mb-1">
            回収予定/回収済みシーン
          </label>
          <select
            v-model="resolvedSceneId"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option :value="undefined">未設定</option>
            <option v-for="scene in scenes" :key="scene.id" :value="scene.id">
              #{{ scene.order }} {{ scene.title || '無題' }}
            </option>
          </select>
          <p class="text-xs text-slate-500 mt-1">
            この伏線が回収される(または回収された)シーン
          </p>
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