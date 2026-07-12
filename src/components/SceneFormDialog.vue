<script setup lang="ts">
//編集画面
import { ref, watch, computed, toRaw, onUnmounted } from 'vue'
import type { Scene, SceneInput, SceneField, SceneHistoryEntry } from '@/types/scene'
import { createEmptySceneField, MAX_SUMMARY_HISTORY } from '@/types/scene'
import type { Chapter } from '@/types/chapter'

// ストーリー欄の履歴チェックポイントを取るまでの入力停止時間
const HISTORY_DEBOUNCE_MS = 3000

// props。どの画面かはわかるようにしとく必要がある
const props = defineProps<{
  isOpen: boolean
  workId: number
  // 編集対象のシーン。undefined なら新規作成モード
  editingScene?: Scene
  // 章選択肢
  chapters: Chapter[]
  // 新規作成時に初期選択しておく章(章タブを絞り込んだ状態で「+ 新規シーン」した場合など)
  defaultChapterId?: number
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
const chapterId = ref<number | undefined>(undefined)
const customFields = ref<SceneField[]>([])
// 項目名をインライン編集中のフィールドID(null なら編集中のものはなし)
const editingFieldId = ref<string | null>(null)

// ストーリー欄の履歴(数秒入力が止まるたびにチェックポイントを積む。サーバー通信なし)
const summaryHistory = ref<SceneHistoryEntry[]>([])
const isHistoryOpen = ref(false)
let historyTimer: ReturnType<typeof setTimeout> | undefined

// 現在のストーリー本文を履歴に積む(直前のチェックポイントと同じなら何もしない)
function checkpointSummaryHistory() {
  const value = summary.value.trim()
  if (value === '') return
  const last = summaryHistory.value[summaryHistory.value.length - 1]
  if (last?.value === value) return

  summaryHistory.value.push({ value, savedAt: new Date() })
  // 直近 MAX_SUMMARY_HISTORY 件だけ残す(古いものから捨てる)
  if (summaryHistory.value.length > MAX_SUMMARY_HISTORY) {
    summaryHistory.value.splice(0, summaryHistory.value.length - MAX_SUMMARY_HISTORY)
  }
}

// ストーリー欄の入力が数秒止まったらチェックポイントを取る(デバウンス)
watch(summary, () => {
  clearTimeout(historyTimer)
  historyTimer = setTimeout(checkpointSummaryHistory, HISTORY_DEBOUNCE_MS)
})

// ダイアログを閉じるときは保留中のチェックポイントを破棄(閉じた後に発火させない)
function clearHistoryTimer() {
  clearTimeout(historyTimer)
  historyTimer = undefined
}
onUnmounted(clearHistoryTimer)

// 履歴の1件を復元する。今の本文が失われないよう、復元前に今の内容もチェックポイントしておく
function restoreHistoryEntry(entry: SceneHistoryEntry) {
  clearHistoryTimer()
  checkpointSummaryHistory()
  summary.value = entry.value
}

// 履歴の日時を「7/12 14:32」のような表記にする
function formatHistoryTime(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// isOpen が変わったときに状態を初期化
watch(() => props.isOpen, (newValue) => {
  clearHistoryTimer()
  if (newValue) {
    title.value = props.editingScene?.title ?? ''
    worldDateTime.value = props.editingScene?.worldDateTime ?? ''
    summary.value = props.editingScene?.summary ?? ''
    worldState.value = props.editingScene?.worldState ?? ''
    todoNotes.value = props.editingScene?.todoNotes ?? ''
    // 編集モードならそのシーンの章、新規モードなら絞り込み中の章を初期値に
    chapterId.value = props.editingScene?.chapterId ?? props.defaultChapterId
    customFields.value = props.editingScene?.customFields
      ? structuredClone(toRaw(props.editingScene.customFields))
      : []
    summaryHistory.value = props.editingScene?.summaryHistory
      ? structuredClone(toRaw(props.editingScene.summaryHistory))
      : []
    editingFieldId.value = null
    isHistoryOpen.value = false
  }
})

// 項目を追加(項目名をすぐ入力できるよう、追加した項目を編集状態にする)
function addField() {
  const field = createEmptySceneField()
  customFields.value.push(field)
  editingFieldId.value = field.id
}

// 項目を削除
function removeField(id: string) {
  customFields.value = customFields.value.filter((f) => f.id !== id)
}

// 項目を上に移動
function moveFieldUp(index: number) {
  if (index <= 0) return
  const arr = customFields.value
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
}

// 項目を下に移動
function moveFieldDown(index: number) {
  const arr = customFields.value
  if (index >= arr.length - 1) return
  ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
}

// 保存処理
function handleSubmit() {
  if (!title.value.trim()) {
    alert('タイトルを入力してください')
    return
  }

  // デバウンス待ちの間に保存された場合でも、最新の内容を履歴に残す
  clearHistoryTimer()
  checkpointSummaryHistory()

  emit('submit', {
    workId: props.workId,
    chapterId: chapterId.value,
    title: title.value.trim(),
    worldDateTime: worldDateTime.value.trim(),
    summary: summary.value.trim(),
    worldState: worldState.value.trim(),
    todoNotes: todoNotes.value.trim(),
    summaryHistory: summaryHistory.value.map((entry) => ({
      value: entry.value,
      savedAt: entry.savedAt,
    })),
    customFields: customFields.value
      .filter((f) => f.name.trim() !== '' || f.value.trim() !== '')
      .map((f) => ({
        id: f.id,
        name: f.name.trim(),
        value: f.value.trim(),
      })),
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
    class="fixed inset-0 bg-black/50 flex z-50 p-4 items-center justify-center dark:bg-black/70"
  >
    <!-- モーダル本体 -->
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col dark:bg-slate-800">
      <!-- ヘッダー sticky top-0 / sticky bottom-0:ヘッダーとフッターを固定-->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 rounded-t-lg shrink-0 dark:border-slate-700">
        <h3 class="text-lg font-semibold">{{ dialogTitle }}</h3>
        <button
          type="button"
          class="text-slate-400 hover:text-slate-600 text-2xl leading-none dark:text-slate-500 dark:hover:text-slate-300"
          @click="handleCancel"
        >
          ×
        </button>
      </div>

      <!-- 入力欄 -->
      <div class="px-6 py-4 space-y-4 flex-1 overflow-y-auto">
        <!-- タイトル placeholderで入力欄を書いておく -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
            タイトル <span class="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            v-model="title"
            type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
            placeholder="例:主人公、覚醒する"
          />
        </div>

        <!-- 章 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
            章
          </label>
          <select
            v-model="chapterId"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600"
          >
            <option :value="undefined">未分類</option>
            <option v-for="chapter in chapters" :key="chapter.id" :value="chapter.id">
              {{ chapter.title }}
            </option>
          </select>
        </div>

        <!-- 時系列 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
            🕐時系列(作品世界の日時)
          </label>
          <input
            v-model="worldDateTime"
            type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
            placeholder="例:3月15日 14:00"
          />
          <p class="text-xs text-slate-500 mt-1 dark:text-slate-400">
            「帝国暦2000/1/1」など、時系列を整理する必要がある場合
          </p>
        </div>

        <!-- あらすじ -->
        <div>
          <div class="flex items-baseline justify-between mb-1">
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
              ストーリー
            </label>
            <span class="text-xs text-slate-400 dark:text-slate-500">{{ summary.length }}文字</span>
          </div>
          <textarea
            v-model="summary"
            rows="4"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
            placeholder="このシーンで起きることの要約"
          ></textarea>

          <!-- ストーリー履歴 -->
          <div class="mt-1">
            <button
              type="button"
              class="text-xs text-slate-500 hover:text-slate-700 transition-colors dark:text-slate-400"
              @click="isHistoryOpen = !isHistoryOpen"
            >
              履歴({{ summaryHistory.length }}件) {{ isHistoryOpen ? '▲' : '▼' }}
            </button>
            <div
              v-if="isHistoryOpen"
              class="mt-2 max-h-40 overflow-y-auto border border-slate-200 rounded-md bg-slate-50 divide-y divide-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:divide-slate-700"
            >
              <p
                v-if="summaryHistory.length === 0"
                class="text-xs text-slate-400 italic p-2 dark:text-slate-500"
              >
                まだ履歴がありません(数秒手を止めると自動保存されます)
              </p>
              <button
                v-for="entry in [...summaryHistory].reverse()"
                :key="entry.savedAt.getTime()"
                type="button"
                class="w-full text-left px-2 py-1.5 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                title="クリックしてこの内容に戻す"
                @click="restoreHistoryEntry(entry)"
              >
                <span class="text-xs text-slate-400 dark:text-slate-500">{{ formatHistoryTime(entry.savedAt) }}</span>
                <span class="block text-xs text-slate-600 truncate dark:text-slate-300">{{ entry.value }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 世界状態 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
            🌐 作品世界の趨勢など
          </label>
          <textarea
            v-model="worldState"
            rows="2"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
            placeholder="このシーン終了時点での世界の状態(例:帝国が侵攻開始、人類のx％が死亡)"
          ></textarea>
        </div>

        <!-- TODO -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
            📌 TODO
          </label>
          <textarea
            v-model="todoNotes"
            rows="2"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
            placeholder="後で詰める箇所のメモ(例:[TODO: キャラAの動機を再考])"
          ></textarea>
        </div>

        <!-- 可変フィールド -->
        <div v-if="customFields.length > 0" class="space-y-4">
          <div
            v-for="(field, index) in customFields"
            :key="field.id"
          >
            <!-- 項目名:通常は他の項目と同じフォントのラベル表示、編集ボタンで入力に切り替え -->
            <div class="flex items-center justify-between gap-2 mb-1">
              <input
                v-if="editingFieldId === field.id"
                v-model="field.name"
                type="text"
                class="flex-1 min-w-0 text-sm font-medium text-slate-700 px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300"
                placeholder="項目名(例:視点キャラ、使用した伏線)"
                @keyup.enter="editingFieldId = null"
                @blur="editingFieldId = null"
              />
              <label v-else class="text-sm font-medium text-slate-700 truncate dark:text-slate-300">
                {{ field.name || '項目名未設定' }}
              </label>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  v-if="editingFieldId !== field.id"
                  type="button"
                  class="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors dark:text-slate-300"
                  title="項目名を編集"
                  @click="editingFieldId = field.id"
                >
                  編集
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed dark:text-slate-300"
                  :disabled="index === 0"
                  title="上に移動"
                  @click="moveFieldUp(index)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed dark:text-slate-300"
                  :disabled="index === customFields.length - 1"
                  title="下に移動"
                  @click="moveFieldDown(index)"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors dark:text-red-400 dark:hover:bg-red-950/40"
                  @click="removeField(field.id)"
                >
                  削除
                </button>
              </div>
            </div>
            <textarea
              v-model="field.value"
              rows="2"
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
              placeholder="値を入力..."
            ></textarea>
          </div>
        </div>

        <!-- 項目追加ボタン -->
        <button
          type="button"
          class="w-full px-3 py-2 text-sm text-emerald-700 border border-dashed border-emerald-300 rounded-md hover:bg-emerald-50 transition-colors dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
          @click="addField"
        >
          + 項目を追加
        </button>
      </div>

      <!-- フッター -->
      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white rounded-b-lg dark:bg-slate-800 dark:border-slate-700">
        <button
          type="button"
          class="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors dark:text-slate-300 dark:hover:bg-slate-700"
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