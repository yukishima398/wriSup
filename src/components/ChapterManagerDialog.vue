<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Chapter } from '@/types/chapter'
import {
  createChapter,
  updateChapter,
  deleteChapter,
  moveChapterUp,
  moveChapterDown,
} from '@/repositories/chapterRepository'

// props
// chapters は親(WorkDetailView)が取得済みのものを受け取る(order 昇順)
const props = defineProps<{
  isOpen: boolean
  workId: number
  chapters: Chapter[]
}>()

// emit
// このダイアログは repository を直接呼ぶ設計のため submit は無い。
// 章が変化したことだけを changed で親に通知する(親は一覧・タブ表示を更新する)
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'changed'): void
}>()

// 連打防止フラグ
const isSaving = ref(false)

// 新規追加フォームの状態
const newTitle = ref('')

// インライン編集の状態(いま編集中の章は1件だけ)
const editingId = ref<number | null>(null)
const editingTitle = ref('')

// ダイアログが開かれたら状態を初期化する
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    newTitle.value = ''
    editingId.value = null
    editingTitle.value = ''
  }
})

function isFirst(chapter: Chapter): boolean {
  return props.chapters[0]?.id === chapter.id
}

function isLast(chapter: Chapter): boolean {
  return props.chapters[props.chapters.length - 1]?.id === chapter.id
}

// 章を1つ上に移動
async function handleMoveUp(chapter: Chapter) {
  if (chapter.id === undefined) return
  isSaving.value = true
  try {
    await moveChapterUp(chapter.id)
    emit('changed')
  } catch (e) {
    alert(e instanceof Error ? e.message : '移動に失敗しました')
  } finally {
    isSaving.value = false
  }
}

// 章を1つ下に移動
async function handleMoveDown(chapter: Chapter) {
  if (chapter.id === undefined) return
  isSaving.value = true
  try {
    await moveChapterDown(chapter.id)
    emit('changed')
  } catch (e) {
    alert(e instanceof Error ? e.message : '移動に失敗しました')
  } finally {
    isSaving.value = false
  }
}

// 名前の編集を開始
function startEdit(chapter: Chapter) {
  if (chapter.id === undefined) return
  editingId.value = chapter.id
  editingTitle.value = chapter.title
}

// 名前の編集をキャンセル
function cancelEdit() {
  editingId.value = null
  editingTitle.value = ''
}

// 名前を保存
async function saveEdit() {
  if (editingId.value === null) return
  if (!editingTitle.value.trim()) {
    alert('タイトルを入力してください')
    return
  }

  isSaving.value = true
  try {
    await updateChapter({ id: editingId.value, title: editingTitle.value.trim() })
    cancelEdit()
    emit('changed')
  } catch (e) {
    alert(e instanceof Error ? e.message : '保存に失敗しました')
  } finally {
    isSaving.value = false
  }
}

// 章を削除
async function handleDelete(chapter: Chapter) {
  if (chapter.id === undefined) return

  const confirmed = window.confirm(
    `章「${chapter.title}」を削除しますか?\n\nこの章に属するシーンは削除されず、「未分類」に戻ります`
  )
  if (!confirmed) return

  isSaving.value = true
  try {
    await deleteChapter(chapter.id)
    if (editingId.value === chapter.id) cancelEdit()
    emit('changed')
  } catch (e) {
    alert(e instanceof Error ? e.message : '削除に失敗しました')
  } finally {
    isSaving.value = false
  }
}

// 章を新規作成
async function handleCreate() {
  if (!newTitle.value.trim()) {
    alert('タイトルを入力してください')
    return
  }

  isSaving.value = true
  try {
    await createChapter({ workId: props.workId, title: newTitle.value.trim() })
    newTitle.value = ''
    emit('changed')
  } catch (e) {
    alert(e instanceof Error ? e.message : '作成に失敗しました')
  } finally {
    isSaving.value = false
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
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col dark:bg-slate-800">
      <!-- ヘッダー -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 rounded-t-lg shrink-0 dark:border-slate-700">
        <h3 class="text-lg font-semibold">章を編集</h3>
        <button
          type="button"
          class="text-slate-400 hover:text-slate-600 text-2xl leading-none dark:text-slate-500 dark:hover:text-slate-300"
          @click="handleClose"
        >
          ×
        </button>
      </div>

      <div class="px-6 py-4 space-y-5 flex-1 overflow-y-auto">
        <!-- 章一覧 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
            現在の章
          </label>
          <!-- 0件 -->
          <p
            v-if="chapters.length === 0"
            class="text-sm text-slate-500 italic dark:text-slate-400"
          >
            まだ章が登録されていません。下のフォームから追加できます。
          </p>
          <!-- 一覧 -->
          <div v-else class="space-y-2">
            <div
              v-for="chapter in chapters"
              :key="chapter.id"
              class="border border-slate-200 rounded-md p-3 bg-slate-50 dark:bg-slate-900 dark:border-slate-700"
            >
              <div class="flex items-center gap-2">
                <!-- 上下移動ボタン -->
                <button
                  type="button"
                  class="px-2 py-1 text-sm text-slate-600 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 dark:text-slate-300 dark:hover:bg-slate-700"
                  :disabled="isFirst(chapter) || isSaving"
                  title="上に移動"
                  @click="handleMoveUp(chapter)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-sm text-slate-600 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 dark:text-slate-300 dark:hover:bg-slate-700"
                  :disabled="isLast(chapter) || isSaving"
                  title="下に移動"
                  @click="handleMoveDown(chapter)"
                >
                  ↓
                </button>

                <!-- 章名(編集中でなければ表示のみ) -->
                <span
                  v-if="editingId !== chapter.id"
                  class="font-medium flex-1 min-w-0 truncate"
                >
                  {{ chapter.title }}
                </span>
                <input
                  v-else
                  v-model="editingTitle"
                  type="text"
                  class="flex-1 min-w-0 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600"
                  @keyup.enter="saveEdit"
                  @keyup.esc="cancelEdit"
                />

                <!-- 操作ボタン -->
                <template v-if="editingId === chapter.id">
                  <button
                    type="button"
                    class="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors shrink-0 dark:text-slate-300"
                    @click="cancelEdit"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1 text-xs bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors disabled:opacity-50 shrink-0"
                    :disabled="isSaving"
                    @click="saveEdit"
                  >
                    保存
                  </button>
                </template>
                <template v-else>
                  <button
                    type="button"
                    class="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors shrink-0 dark:text-slate-300"
                    @click="startEdit(chapter)"
                  >
                    名前を編集
                  </button>
                  <button
                    type="button"
                    class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0 dark:text-red-400 dark:hover:bg-red-950/40"
                    :disabled="isSaving"
                    @click="handleDelete(chapter)"
                  >
                    削除
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 新規章フォーム -->
        <div class="border-t border-slate-200 pt-4 dark:border-slate-700">
          <label class="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
            章を追加
          </label>
          <div class="flex gap-2">
            <input
              v-model="newTitle"
              type="text"
              class="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
              placeholder="例:第一章 出会い"
            />
            <button
              type="button"
              class="px-3 py-2 text-sm bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors disabled:opacity-50 shrink-0"
              :disabled="isSaving"
              @click="handleCreate"
            >
              + 新規章
            </button>
          </div>
        </div>
      </div>

      <!-- フッター -->
      <div class="flex items-center justify-end px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white rounded-b-lg dark:bg-slate-800 dark:border-slate-700">
        <button
          type="button"
          class="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors dark:text-slate-300 dark:hover:bg-slate-700"
          @click="handleClose"
        >
          閉じる
        </button>
      </div>
    </div>
  </div>
</template>
