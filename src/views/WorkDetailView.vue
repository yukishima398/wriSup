<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWork } from '@/repositories/workRepository'
import {
  listScenesByWork,
  createScene,
  updateScene,
  deleteScene,
} from '@/repositories/sceneRepository'
import type { Work } from '@/types/work'
import type { Scene, SceneInput } from '@/types/scene'
import SceneFormDialog from '@/components/SceneFormDialog.vue'

//現在のURL情報を取得。route.paramsやqueryなど
const route = useRoute()
//ページ遷移のための操作。push、backなど
const router = useRouter()

// URL から作品 ID を取得(文字列で来るので数値に変換)
const workId = Number(route.params.id)

// リアクティブな状態
const work = ref<Work | null>(null)
const scenes = ref<Scene[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const isSceneDialogOpen = ref(false)
// 編集対象のシーンか判別する。null なら新規作成モード
const editingScene = ref<Scene | null>(null)

// 作品とシーンを並列取得
async function fetchAll() {
  try {
    if (isNaN(workId)) {
      error.value = '不正な作品IDです'
      return
    }

    // 作品とシーンを並列で取得
    const [workResult, scenesResult] = await Promise.all([
      getWork(workId),
      listScenesByWork(workId),
    ])

    if (!workResult) {
      error.value = '作品が見つかりませんでした'
      return
    }

    work.value = workResult
    scenes.value = scenesResult
  } catch (e) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    isLoading.value = false
  }
}

// シーン一覧だけ再取得(追加・編集・削除後に使う)
async function refreshScenes() {
  try {
    scenes.value = await listScenesByWork(workId)
  } catch (e) {
    alert(e instanceof Error ? e.message : 'シーンの再読み込みに失敗しました')
  }
}

onMounted(fetchAll)

// 一覧に戻る
function goBack() {
  router.push('/')
}



// シーン新規追加ダイアログを開く
function openCreateSceneDialog() {
  editingScene.value = null
  isSceneDialogOpen.value = true
}

// 編集シーンダイアログを開く
function openEditSceneDialog(scene: Scene) {
  editingScene.value = scene
  isSceneDialogOpen.value = true
}

// ダイアログを閉じる
function closeSceneDialog() {
  isSceneDialogOpen.value = false
  editingScene.value = null
}

// シーン保存処理
async function handleSceneSubmit(input: Omit<SceneInput, 'order'>) {
  try {
    if (editingScene.value && editingScene.value.id !== undefined) {
      // 編集モード
      await updateScene({
        id: editingScene.value.id,
        ...input,
      })
    } else {
      // 新規作成モード
      await createScene(input)
    }
    closeSceneDialog()
    await refreshScenes()
  } catch (e) {
    alert(e instanceof Error ? e.message : '保存に失敗しました')
  }
}
// シーン削除処理
async function handleDeleteScene(scene: Scene) {
  if (scene.id === undefined) return

  const confirmed = window.confirm(
    `「${scene.title || '無題'}」を削除しますか?\n\nこの操作は取り消せません。`
  )
  if (!confirmed) return

  try {
    await deleteScene(scene.id)
    await refreshScenes()
  } catch (e) {
    alert(e instanceof Error ? e.message : '削除に失敗しました')
  }
}


</script>

<template>
  <div>
    <!-- 戻るボタン -->
    <button
      type="button"
      class="text-sm text-blue-600 hover:underline mb-4 inline-flex items-center gap-1"
      @click="goBack"
    >
      ← 一覧に戻る
    </button>

    <!-- ローディング中 -->
    <div v-if="isLoading" class="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
      読み込み中...
    </div>

    <!-- エラー時 -->
    <div v-else-if="error" class="bg-red-50 rounded-lg border border-red-200 p-8 text-red-700">
      <p class="font-semibold">エラーが発生しました</p>
      <p class="text-sm mt-1">{{ error }}</p>
    </div>

    <!-- 作品の情報+シーン一覧 dlなどを活かした用語&説明をよりよく伝えるためのオブジェクト -->
    <div v-else-if="work">
      <!-- 作品ヘッダー -->
      <header class="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h2 class="text-2xl font-bold mb-3">{{ work.title }}</h2>
        <dl class="space-y-2 text-sm">
          <div class="flex gap-3">
            <dt class="text-slate-400 shrink-0 w-16">ゴール:</dt>
            <dd class="text-slate-700">{{ work.goal || '未設定' }}</dd>
          </div>
          <div class="flex gap-3">
            <dt class="text-slate-400 shrink-0 w-16">テーマ:</dt>
            <dd class="text-slate-700">{{ work.theme || '未設定' }}</dd>
          </div>
        </dl>
      </header>

    <!-- シーン一覧 -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">📝 シーン一覧</h3>
          <div class="flex items-center gap-3">
            <span class="text-sm text-slate-500">全{{ scenes.length }}シーン</span>
            <button
              type="button"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              @click="openCreateSceneDialog"
            >
              + 新規シーン
            </button>
          </div>
        </div>

        <!-- シーンが0件の時 -->
        <div
          v-if="scenes.length === 0"
          class="bg-white rounded-lg border border-slate-200 p-8 text-center"
        >
          <p class="text-slate-600 mb-2">まだシーンが登録されていません。</p>
          <p class="text-sm text-slate-500">右上の「+ 新規シーン」から追加してください。</p>
        </div>

        <!-- 　シーンカード一覧 -->
        <div v-else class="space-y-4">
          <article
            v-for="scene in scenes"
            :key="scene.id"
            class="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md transition-shadow"
          >
            <!-- ヘッダー部分:番号 + タイトル + 時系列 -->
            <div class="mb-3">
              <div class="flex items-start justify-between gap-2 mb-1">
                <div class="flex items-baseline gap-3 flex-1 min-w-0">
                  <span class="text-sm font-mono text-slate-400 shrink-0">#{{ scene.order }}</span>
                  <h4 class="text-lg font-semibold truncate">{{ scene.title || '無題' }}</h4>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    class="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                    @click="openEditSceneDialog(scene)"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    @click="handleDeleteScene(scene)"
                  >
                    削除
                  </button>
                </div>
              </div>
              <p v-if="scene.worldDateTime" class="text-sm text-slate-500 ml-8">
                🕐 {{ scene.worldDateTime }}
              </p>
            </div>

            <!-- あらすじ -->
            <div v-if="scene.summary" class="mb-3">
              <p class="text-sm text-slate-400 mb-1">あらすじ:</p>
              <p class="text-slate-700 whitespace-pre-wrap">{{ scene.summary }}</p>
            </div>

            <!-- 補足情報(世界状態・TODO) -->
            <div v-if="scene.worldState || scene.todoNotes" class="space-y-1 pt-3 border-t border-slate-100">
              <p v-if="scene.worldState" class="text-xs text-slate-600">
                <span class="text-slate-400">🌐 世界状態:</span> {{ scene.worldState }}
              </p>
              <p v-if="scene.todoNotes" class="text-xs text-amber-700">
                <span class="text-amber-600">📌 TODO:</span> {{ scene.todoNotes }}
              </p>
            </div>
          </article>
        </div>
      </section>

      <!-- シーン追加・編集ダイアログ -->
      <SceneFormDialog
        :is-open="isSceneDialogOpen"
        :work-id="workId"
        @close="closeSceneDialog"
        @submit="handleSceneSubmit"
      />

    </div>
  </div>
</template>