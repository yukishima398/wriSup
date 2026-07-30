<script setup lang="ts">
//編集画面
import { ref, watch, computed, toRaw, onUnmounted, nextTick } from 'vue'
import type { Scene, SceneInput, SceneField, SceneHistoryEntry } from '@/types/scene'
import { createEmptySceneField, MAX_SUMMARY_HISTORY } from '@/types/scene'
import type { Chapter } from '@/types/chapter'
import { diffChars, type Change } from 'diff'
import { listScenesByWork, updateScene as updateSceneInDb } from '@/repositories/sceneRepository'

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
  // 一括置換で他のシーン(DB上)を書き換えたとき、親側のシーン一覧を更新してもらうために発火
  (e: 'scenes-bulk-updated'): void
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
// ストーリー編集専用ページ(フルスクリーン)を開いているか。summaryを直接編集するので入力は即座に反映される
const isStoryEditorOpen = ref(false)
let historyTimer: ReturnType<typeof setTimeout> | undefined

// ルビ機能:編集専用ページのテキストエリア本体への参照(選択範囲の取得・書き換えに使う)
const storyTextareaRef = ref<HTMLTextAreaElement | null>(null)
const isRubyDialogOpen = ref(false)
// ルビを振る対象として選択された文字列(ダイアログ内では読み取り専用表示)
const rubyBaseText = ref('')
// これから振るルビ(ふりがな)の入力値
const rubyReading = ref('')
// ダイアログを開いた時点の選択範囲(summary文字列内でのインデックス)
let rubySelectionRange: { start: number; end: number } | null = null

// 一括置換機能
const isReplaceDialogOpen = ref(false)
const replaceSearchText = ref('')
const replaceWithText = ref('')
// このシーンのみ書き換えるか、作品内の全シーンを書き換えるか(開くたびにデフォルト値に戻す)
const replaceScope = ref<'scene' | 'all'>('scene')

// 編集専用ページのテキストエリアの選択範囲を取得する。未選択・複数行選択ならアラートを出してnull
function getStorySelection(): { start: number; end: number; text: string } | null {
  const el = storyTextareaRef.value
  if (!el) return null

  const start = el.selectionStart
  const end = el.selectionEnd
  if (start === end) {
    alert('文字列を選択してください')
    return null
  }

  const text = summary.value.slice(start, end)
  if (text.includes('\n')) {
    alert('複数行にまたがる選択には振れません')
    return null
  }

  return { start, end, text }
}

// summaryの指定範囲を文字列に置き換え、カーソルを挿入直後の位置に戻す
function replaceStoryRange(start: number, end: number, text: string) {
  const before = summary.value.slice(0, start)
  const after = summary.value.slice(end)
  summary.value = `${before}${text}${after}`

  // DOM更新後にカーソルを挿入した文字列の直後へ戻す
  nextTick(() => {
    const el = storyTextareaRef.value
    if (!el) return
    const cursor = before.length + text.length
    el.focus()
    el.setSelectionRange(cursor, cursor)
  })
}

// ｜文字《ふりがな》の記法でsummaryの指定範囲を置き換える
function insertRubyNotation(start: number, end: number, base: string, reading: string) {
  replaceStoryRange(start, end, `｜${base}《${reading}》`)
}

// カーソル位置(選択があれば選択範囲を置き換えて)に文字列を挿入する
function insertAtCursor(text: string) {
  const el = storyTextareaRef.value
  if (!el) return
  replaceStoryRange(el.selectionStart, el.selectionEnd, text)
}

// 三点リーダー(……)をカーソル位置に挿入する
function insertEllipsis() {
  insertAtCursor('……')
}

// ダッシュ(――)をカーソル位置に挿入する
function insertDash() {
  insertAtCursor('――')
}

// 選択中の文字列に対してルビ入力ダイアログを開く
function openRubyDialog() {
  const selection = getStorySelection()
  if (!selection) return

  rubySelectionRange = { start: selection.start, end: selection.end }
  rubyBaseText.value = selection.text
  rubyReading.value = ''
  isRubyDialogOpen.value = true
}

// ルビダイアログをキャンセルして閉じる
function cancelRubyDialog() {
  isRubyDialogOpen.value = false
  rubySelectionRange = null
}

// 入力されたふりがなを｜文字《ふりがな》の記法でsummaryに書き戻す
function confirmRuby() {
  const reading = rubyReading.value.trim()
  if (!reading || !rubySelectionRange) return

  insertRubyNotation(rubySelectionRange.start, rubySelectionRange.end, rubyBaseText.value, reading)
  isRubyDialogOpen.value = false
  rubySelectionRange = null
}

// 傍点:ダイアログなしで選択範囲に文字数分の「・」のルビを振る
function applyBouten() {
  const selection = getStorySelection()
  if (!selection) return

  const dots = '・'.repeat(selection.text.length)
  insertRubyNotation(selection.start, selection.end, selection.text, dots)
}

// 文字列中に search が何件含まれるか(空文字なら0件扱い)
function countOccurrences(text: string, search: string): number {
  if (search === '') return 0
  return text.split(search).length - 1
}

// text 中の search を全て replacement に置き換える
function replaceAllOccurrences(text: string, search: string, replacement: string): string {
  if (search === '') return text
  return text.split(search).join(replacement)
}

// 履歴配列に現在値をチェックポイントとして積んだ新しい配列を返す(checkpointSummaryHistoryのDB版)
function withCheckpoint(history: SceneHistoryEntry[], currentValue: string): SceneHistoryEntry[] {
  const value = currentValue.trim()
  if (value === '') return history
  if (history[history.length - 1]?.value === value) return history

  const next = [...history, { value, savedAt: new Date() }]
  if (next.length > MAX_SUMMARY_HISTORY) {
    next.splice(0, next.length - MAX_SUMMARY_HISTORY)
  }
  return next
}

// 一括置換ダイアログを開く(毎回「このシーンのみ」から始める)
function openReplaceDialog() {
  replaceSearchText.value = ''
  replaceWithText.value = ''
  replaceScope.value = 'scene'
  isReplaceDialogOpen.value = true
}

function cancelReplaceDialog() {
  isReplaceDialogOpen.value = false
}

// 一括置換を実行する。対象が「全てのストーリー」の場合、開いている以外のシーンはDBを直接更新する
async function executeReplace() {
  const search = replaceSearchText.value
  if (search === '') {
    alert('検索する文字列を入力してください')
    return
  }

  if (replaceScope.value === 'scene') {
    const count = countOccurrences(summary.value, search)
    if (count === 0) {
      alert('このシーン内には見つかりませんでした')
      return
    }

    clearHistoryTimer()
    checkpointSummaryHistory()
    summary.value = replaceAllOccurrences(summary.value, search, replaceWithText.value)
    isReplaceDialogOpen.value = false
    // alert()はJS実行をブロックするため、先にDOM更新(ダイアログを閉じる)を確定させてから呼ぶ
    await nextTick()
    alert(`このシーン内で${count}件を置換しました`)
    return
  }

  // 対象:作品内の全ストーリー
  const currentCount = countOccurrences(summary.value, search)
  if (currentCount > 0) {
    clearHistoryTimer()
    checkpointSummaryHistory()
    summary.value = replaceAllOccurrences(summary.value, search, replaceWithText.value)
  }

  const otherScenes = (await listScenesByWork(props.workId)).filter(
    (s) => s.id !== props.editingScene?.id
  )

  let updatedSceneCount = currentCount > 0 ? 1 : 0
  let totalCount = currentCount

  for (const scene of otherScenes) {
    const count = countOccurrences(scene.summary, search)
    if (count === 0) continue

    await updateSceneInDb({
      id: scene.id!,
      summary: replaceAllOccurrences(scene.summary, search, replaceWithText.value),
      summaryHistory: withCheckpoint(scene.summaryHistory, scene.summary),
    })
    updatedSceneCount++
    totalCount += count
  }

  isReplaceDialogOpen.value = false
  await nextTick()

  if (updatedSceneCount === 0) {
    alert('見つかりませんでした')
    return
  }

  emit('scenes-bulk-updated')
  alert(`${updatedSceneCount}件のシーンで、合計${totalCount}件を置換しました`)
}

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

// 履歴の1件を復元する前に、差分確認ダイアログを開く対象(nullなら非表示)
const historyDiffEntry = ref<SceneHistoryEntry | null>(null)

// 今の内容 → 復元しようとしている履歴の内容、の文字単位の差分
const historyDiffParts = computed<Change[]>(() => {
  if (!historyDiffEntry.value) return []
  return diffChars(summary.value, historyDiffEntry.value.value)
})

// 履歴の1件をクリックしたら、上書き差分確認ダイアログを開く
function requestRestoreHistoryEntry(entry: SceneHistoryEntry) {
  historyDiffEntry.value = entry
}

function cancelRestoreHistoryEntry() {
  historyDiffEntry.value = null
}

// 差分確認ダイアログで「戻す」が押されたら復元を実行する。今の本文が失われないよう、復元前に今の内容もチェックポイントしておく
function confirmRestoreHistoryEntry() {
  const entry = historyDiffEntry.value
  if (!entry) return

  clearHistoryTimer()
  checkpointSummaryHistory()
  summary.value = entry.value
  historyDiffEntry.value = null
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
    isStoryEditorOpen.value = false
    isRubyDialogOpen.value = false
    rubySelectionRange = null
    historyDiffEntry.value = null
    isReplaceDialogOpen.value = false
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
          <div class="relative">
            <textarea
              v-model="summary"
              rows="4"
              class="w-full px-3 py-2 pb-8 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
              placeholder="本文や要約を入力"
            ></textarea>
            <!-- 右下:編集専用ページ(フルスクリーン)へ切り替え -->
            <button
              type="button"
              class="absolute bottom-2 right-2 px-2 py-1 text-xs bg-white/90 text-emerald-700 border border-emerald-300 rounded-md shadow-sm hover:bg-emerald-50 transition-colors dark:bg-slate-800/90 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
              title="編集専用ページを開く"
              @click="isStoryEditorOpen = true"
            >
              ⛶ 編集専用ページ
            </button>
          </div>

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
                @click="requestRestoreHistoryEntry(entry)"
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

    <!-- ストーリー編集専用ページ(フルスクリーン)。summaryを直接編集するのでダイアログ側に即座に反映される -->
    <div
      v-if="isStoryEditorOpen"
      class="fixed inset-0 bg-white z-[60] flex flex-col dark:bg-slate-900"
    >
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 dark:border-slate-700">
        <div class="min-w-0">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="text-lg font-semibold shrink-0">ストーリー編集</h3>
            <p class="text-sm text-slate-500 truncate dark:text-slate-400">{{ title || '無題' }}</p>
          </div>
          <div class="flex items-center gap-2 min-w-0">
            <button
              type="button"
              class="px-3 py-1 text-xs text-emerald-700 border border-emerald-300 rounded-md hover:bg-emerald-50 transition-colors shrink-0 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
              title="選択した文字列にルビを振る"
              @click="openRubyDialog"
            >
              ルビ
            </button>
            <button
              type="button"
              class="px-3 py-1 text-xs text-emerald-700 border border-emerald-300 rounded-md hover:bg-emerald-50 transition-colors shrink-0 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
              title="選択した文字列に傍点(・)を振る"
              @click="applyBouten"
            >
              傍点
            </button>
            <button
              type="button"
              class="px-3 py-1 text-xs text-emerald-700 border border-emerald-300 rounded-md hover:bg-emerald-50 transition-colors shrink-0 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
              title="カーソル位置に……を挿入する"
              @click="insertEllipsis"
            >
              ……
            </button>
            <button
              type="button"
              class="px-3 py-1 text-xs text-emerald-700 border border-emerald-300 rounded-md hover:bg-emerald-50 transition-colors shrink-0 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
              title="カーソル位置に――を挿入する"
              @click="insertDash"
            >
              ――
            </button>
            <button
              type="button"
              class="px-3 py-1 text-xs text-emerald-700 border border-emerald-300 rounded-md hover:bg-emerald-50 transition-colors shrink-0 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
              title="文字列を検索して置き換える"
              @click="openReplaceDialog"
            >
              一括置換
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-xs text-slate-400 dark:text-slate-500">{{ summary.length }}文字</span>
          <button
            type="button"
            class="px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors"
            @click="isStoryEditorOpen = false"
          >
            閉じる
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
        <textarea
          ref="storyTextareaRef"
          v-model="summary"
          autofocus
          class="w-full flex-1 min-h-[50vh] px-4 py-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600 leading-7"
          placeholder="本文や要約を入力"
          @keydown.esc="isStoryEditorOpen = false"
        ></textarea>

        <!-- ストーリー履歴 -->
        <div>
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
              @click="requestRestoreHistoryEntry(entry)"
            >
              <span class="text-xs text-slate-400 dark:text-slate-500">{{ formatHistoryTime(entry.savedAt) }}</span>
              <span class="block text-xs text-slate-600 truncate dark:text-slate-300">{{ entry.value }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ルビ入力ダイアログ -->
    <div
      v-if="isRubyDialogOpen"
      class="fixed inset-0 bg-black/50 flex z-[70] p-4 items-center justify-center dark:bg-black/70"
      @click.self="cancelRubyDialog"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-sm flex flex-col dark:bg-slate-800">
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold">ルビを振る</h3>
        </div>
        <div class="px-6 py-8 flex flex-col items-center gap-1">
          <!-- ルビ(ふりがな)の入力欄。実際のルビ表示のように対象文字の上に配置する -->
          <input
            v-model="rubyReading"
            type="text"
            required
            class="px-2 py-1 text-sm text-center border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
            placeholder="ふりがなを入力"
            @keyup.enter="confirmRuby"
          />
          <p class="text-xl px-2 text-slate-900 dark:text-slate-100">{{ rubyBaseText }}</p>
        </div>
        <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            class="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors dark:text-slate-300 dark:hover:bg-slate-700"
            @click="cancelRubyDialog"
          >
            キャンセル
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!rubyReading.trim()"
            @click="confirmRuby"
          >
            決定
          </button>
        </div>
      </div>
    </div>

    <!-- 一括置換ダイアログ -->
    <div
      v-if="isReplaceDialogOpen"
      class="fixed inset-0 bg-black/50 flex z-[70] p-4 items-center justify-center dark:bg-black/70"
      @click.self="cancelReplaceDialog"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-sm flex flex-col dark:bg-slate-800">
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold">ストーリーを一括置換</h3>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
              検索する文字列
            </label>
            <input
              v-model="replaceSearchText"
              type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
              placeholder="例:主人公"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
              置換後の文字列
            </label>
            <input
              v-model="replaceWithText"
              type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
              placeholder="例:ハルト(空にすると削除)"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
              対象範囲
            </label>
            <div class="flex flex-col gap-1">
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input v-model="replaceScope" type="radio" value="scene" />
                このシーンのみ
              </label>
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input v-model="replaceScope" type="radio" value="all" />
                作品内の全てのストーリー
              </label>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            class="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors dark:text-slate-300 dark:hover:bg-slate-700"
            @click="cancelReplaceDialog"
          >
            キャンセル
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!replaceSearchText"
            @click="executeReplace"
          >
            置換実行
          </button>
        </div>
      </div>
    </div>

    <!-- 履歴の上書き差分確認ダイアログ -->
    <div
      v-if="historyDiffEntry"
      class="fixed inset-0 bg-black/50 flex z-[70] p-4 items-center justify-center dark:bg-black/70"
      @click.self="cancelRestoreHistoryEntry"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col dark:bg-slate-800">
        <div class="px-6 py-4 border-b border-slate-200 shrink-0 dark:border-slate-700">
          <h3 class="text-lg font-semibold">{{ formatHistoryTime(historyDiffEntry.savedAt) }}の内容に戻しますか?</h3>
          <p class="text-xs text-slate-500 mt-1 dark:text-slate-400">
            今の内容は履歴に保存されます。赤字が消える内容、緑字が戻ってくる内容です。
          </p>
        </div>
        <div class="px-6 py-4 flex-1 overflow-y-auto">
          <p class="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 dark:text-slate-200">
            <span
              v-for="(part, index) in historyDiffParts"
              :key="index"
              :class="{
                'bg-red-100 text-red-700 line-through dark:bg-red-950/40 dark:text-red-300': part.removed,
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300': part.added,
              }"
            >{{ part.value }}</span>
          </p>
        </div>
        <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 shrink-0 dark:border-slate-700">
          <button
            type="button"
            class="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors dark:text-slate-300 dark:hover:bg-slate-700"
            @click="cancelRestoreHistoryEntry"
          >
            キャンセル
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors"
            @click="confirmRestoreHistoryEntry"
          >
            この内容に戻す
          </button>
        </div>
      </div>
    </div>
  </div>
</template>