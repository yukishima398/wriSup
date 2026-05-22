<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listWorks, createWork, updateWork, deleteWork } from '@/repositories/workRepository'
import type { Work, WorkInput } from '@/types/work'
import WorkFormDialog from '@/components/WorkFormDialog.vue'

const router = useRouter()

// リアクティブな状態
const works = ref<Work[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const isDialogOpen = ref(false)
const editingWork = ref<Work | null>(null)

// 作品一覧を取得
async function fetchWorks() {
  try {
    works.value = await listWorks()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchWorks)

// 新規作成ダイアログを開く
function openCreateDialog() {
  editingWork.value = null
  isDialogOpen.value = true
}

// 編集ダイアログを開く
function openEditDialog(work: Work) {
  editingWork.value = work
  isDialogOpen.value = true
}

// ダイアログを閉じる
function closeDialog() {
  isDialogOpen.value = false
  editingWork.value = null
}

// フォーム送信処理(新規・編集の分岐)
async function handleSubmit(input: WorkInput) {
  try {
    if (editingWork.value && editingWork.value.id !== undefined) {
      await updateWork({
        id: editingWork.value.id,
        ...input,
      })
    } else {
      await createWork(input)
    }
    closeDialog()
    await fetchWorks()
  } catch (e) {
    alert(e instanceof Error ? e.message : '保存に失敗しました')
  }
}

// 削除処理
async function handleDelete(work: Work) {
  if (work.id === undefined) return

  const confirmed = window.confirm(
    `「${work.title}」を削除しますか?\n\nこの操作は取り消せません。`
  )
  if (!confirmed) return

  try {
    await deleteWork(work.id)
    await fetchWorks()
  } catch (e) {
    alert(e instanceof Error ? e.message : '削除に失敗しました')
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function goToDetail(work: Work) {
  if (work.id === undefined) return
  router.push(`/works/${work.id}`)
}

</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold">📚 あなたの作品</h2>
      <button
        type="button"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        @click="openCreateDialog"
      >
        + 新規作品
      </button>
    </div>

    <div v-if="isLoading" class="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
      読み込み中...
    </div>

    <div v-else-if="error" class="bg-red-50 rounded-lg border border-red-200 p-8 text-red-700">
      <p class="font-semibold">エラーが発生しました</p>
      <p class="text-sm mt-1">{{ error }}</p>
    </div>

    <div v-else-if="works.length === 0" class="bg-white rounded-lg border border-slate-200 p-8 text-center">
      <p class="text-slate-600 mb-2">まだ作品が登録されていません。</p>
      <p class="text-sm text-slate-500">右上の「+ 新規作品」から作品を追加してください。</p>
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="work in works"
        :key="work.id"
        class="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
        @click="goToDetail(work)"
      >
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="text-lg font-semibold">{{ work.title }}</h3>
          <div class="flex items-center gap-1 shrink-0" @click.stop>
            <button
              type="button"
              class="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              @click="openEditDialog(work)"
            >
              編集
            </button>
            <button
              type="button"
              class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
              @click="handleDelete(work)"
            >
              削除
            </button>
          </div>
        </div>

        <div class="space-y-1 text-sm">
          <p class="text-slate-600">
            <span class="text-slate-400">ゴール:</span>{{ work.goal || '未設定' }}
          </p>
          <p class="text-slate-600">
            <span class="text-slate-400">テーマ:</span>{{ work.theme || '未設定' }}
          </p>
          <p class="text-slate-400 text-xs mt-2">
            作成日:{{ formatDate(work.createdAt) }}
          </p>
        </div>
      </article>
    </div>

    <WorkFormDialog
      :is-open="isDialogOpen"
      :editing-work="editingWork ?? undefined"
      @close="closeDialog"
      @submit="handleSubmit"
    />
  </div>
</template>