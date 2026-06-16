<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWork } from '@/repositories/workRepository'
import {
  listScenesByWork,
  createScene,
  updateScene,
  deleteScene,
  moveSceneUp,
  moveSceneDown,
} from '@/repositories/sceneRepository'
import {
  listForeshadowsByWork,
  createForeshadow,
  updateForeshadow,
  deleteForeshadow,
} from '@/repositories/foreshadowRepository'
import type { Work } from '@/types/work'
import type { Scene, SceneInput } from '@/types/scene'
import type {
  Foreshadow,
  ForeshadowStatus,
  ForeshadowInput,
} from '@/types/foreshadow'
import SceneFormDialog from '@/components/SceneFormDialog.vue'
import ForeshadowFormDialog from '@/components/ForeshadowFormDialog.vue'
import {
  FORESHADOW_STATUS_LABELS,
  FORESHADOW_STATUS_COLORS,
} from '@/types/foreshadow'
import { formatScenesAsText,formatSceneAsText } from '@/utils/sceneFormatter'
import {
  listCharactersByWork,
  createCharacter,
  updateCharacter,
  deleteCharacter,
} from '@/repositories/characterRepository'
import type { Character, CharacterInput } from '@/types/character'
import CharacterFormDialog from '@/components/CharacterFormDialog.vue'
import CharacterAvatar from '@/components/CharacterAvatar.vue'
import {
  listSceneCharactersByWork,
  deleteSceneCharacter,
} from '@/repositories/sceneCharacterRepository'
import type { SceneCharacter } from '@/types/sceneCharacter'
import SceneCharacterManagerDialog from '@/components/SceneCharacterManagerDialog.vue'


//現在のURL情報を取得　route.paramsやqueryなど
const route = useRoute()
//ページ遷移のための操作　push、backなど
const router = useRouter()

// URL から作品 ID を取得(文字列で来るので数値に変換)
const workId = Number(route.params.id)

// リアクティブな状態
const work = ref<Work | null>(null)
const scenes = ref<Scene[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const isSceneDialogOpen = ref(false)
// 編集対象のシーンか判別する　null なら新規作成モード
const editingScene = ref<Scene | null>(null)
// 伏線の状態
const foreshadows = ref<Foreshadow[]>([])
const statusFilter = ref<ForeshadowStatus | 'all'>('all')
// 伏線ダイアログの状態
const isForeshadowDialogOpen = ref(false)
// 編集対象の伏線　null なら新規作成モード
const editingForeshadow = ref<Foreshadow | null>(null)
// キャラクターの状態
const characters = ref<Character[]>([])
// シーン×キャラ紐付けの一覧(作品全体)
const sceneCharacters = ref<SceneCharacter[]>([])
// 開いているポップアップの ID(null なら全て閉)
const openPopoverId = ref<number | null>(null)
  // シーン×キャラ管理ダイアログの状態
const isSceneCharacterManagerOpen = ref(false)
const managingScene = ref<Scene | null>(null)

// 新規伏線ダイアログを開く
function openCreateForeshadowDialog() {
  editingForeshadow.value = null
  isForeshadowDialogOpen.value = true
}

// 編集伏線ダイアログを開く
function openEditForeshadowDialog(foreshadow: Foreshadow) {
  editingForeshadow.value = foreshadow
  isForeshadowDialogOpen.value = true
}

// ダイアログを閉じる
function closeForeshadowDialog() {
  isForeshadowDialogOpen.value = false
  editingForeshadow.value = null
}

// 伏線保存処理(新規・編集の分岐)
async function handleForeshadowSubmit(input: ForeshadowInput) {
  try {
    if (editingForeshadow.value && editingForeshadow.value.id !== undefined) {
      // 編集モード
      await updateForeshadow({
        id: editingForeshadow.value.id,
        ...input,
      })
    } else {
      // 新規作成モード
      await createForeshadow(input)
    }
    closeForeshadowDialog()
    await refreshForeshadows()
  } catch (e) {
    alert(e instanceof Error ? e.message : '保存に失敗しました')
  }
}

// 伏線削除処理
async function handleDeleteForeshadow(foreshadow: Foreshadow) {
  if (foreshadow.id === undefined) return

  const confirmed = window.confirm(
    `伏線「${foreshadow.title}」を削除しますか?\n\nこの操作は取り消せません　`
  )
  if (!confirmed) return

  try {
    await deleteForeshadow(foreshadow.id)
    await refreshForeshadows()
  } catch (e) {
    alert(e instanceof Error ? e.message : '削除に失敗しました')
  }
}

// 作品とシーン、伏線を並列取得
async function fetchAll() {
  try {
    if (isNaN(workId)) {
      error.value = '不正な作品IDです'
      return
    }

    // 作品・シーン・伏線・キャラを並列で取得
    const [workResult, scenesResult, foreshadowsResult, charactersResult] = await Promise.all([
      getWork(workId),
      listScenesByWork(workId),
      listForeshadowsByWork(workId),
      listCharactersByWork(workId),
    ])

    if (!workResult) {
      error.value = '作品が見つかりませんでした'
      return
    }

    work.value = workResult
    scenes.value = scenesResult
    foreshadows.value = foreshadowsResult
    characters.value = charactersResult

    // シーン取得後、sceneCharacters を一括取得
    await refreshSceneCharacters()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    isLoading.value = false
  }
}

// sceneCharacters を再取得(モーダルから戻った後などに使う)
async function refreshSceneCharacters() {
  const sceneIds = scenes.value
    .map((s) => s.id)
    .filter((id): id is number => id !== undefined)
  sceneCharacters.value = await listSceneCharactersByWork(sceneIds)
}

// シーン一覧だけ再取得(追加・編集・削除後に使う)
async function refreshScenes() {
  try {
    scenes.value = await listScenesByWork(workId)
  } catch (e) {
    alert(e instanceof Error ? e.message : 'シーンの再読み込みに失敗しました')
  }
}

// id → Character の Map(名前・画像を O(1) で引く)
const characterById = computed(() => {
  const map = new Map<number, Character>()
  for (const c of characters.value) {
    if (c.id !== undefined) map.set(c.id, c)
  }
  return map
})

// sceneId → 紐付け配列 の Map(シーンカードごとの登場キャラを O(1) で引く)
const linksBySceneId = computed(() => {
  const map = new Map<number, SceneCharacter[]>()
  for (const link of sceneCharacters.value) {
    const list = map.get(link.sceneId)
    if (list) {
      list.push(link)
    } else {
      map.set(link.sceneId, [link])
    }
  }
  return map
})

// 伏線一覧だけ再取得
async function refreshForeshadows() {
  try {
    foreshadows.value = await listForeshadowsByWork(workId)
  } catch (e) {
    alert(e instanceof Error ? e.message : '伏線の再読み込みに失敗しました')
  }
}

// キャラクター一覧だけ再取得
async function refreshCharacters() {
  try {
    characters.value = await listCharactersByWork(workId)
  } catch (e) {
    alert(e instanceof Error ? e.message : 'キャラクターの再読み込みに失敗しました')
  }
}

// キャラ ID からキャラ情報を取得
function getCharacterById(characterId: number): Character | undefined {
  return characters.value.find((c) => c.id === characterId)
}

// ポップアップを開く
function togglePopover(sceneCharacterId: number) {
  if (openPopoverId.value === sceneCharacterId) {
    openPopoverId.value = null  // 同じアイコンをクリック → 閉じる
  } else {
    openPopoverId.value = sceneCharacterId  // 別のアイコンをクリック → そちらを開く
  }
}

// ポップアップを閉じる
function closePopover() {
  openPopoverId.value = null
}

// キャラ管理ダイアログを開く
function openSceneCharacterManager(scene: Scene) {
  managingScene.value = scene
  isSceneCharacterManagerOpen.value = true
}

// キャラ管理ダイアログを閉じる
function closeSceneCharacterManager() {
  isSceneCharacterManagerOpen.value = false
  managingScene.value = null
}

// 紐付けが変化したときの処理(ダイアログから通知される)
async function handleSceneCharactersChanged() {
  await refreshSceneCharacters()
}

// 紐付けを解除
async function handleUnlinkSceneCharacter(sc: SceneCharacter) {
  if (sc.id === undefined) return

  const character = getCharacterById(sc.characterId)
  const characterName = character?.name ?? '(削除されたキャラ)'

  const confirmed = window.confirm(
    `「${characterName}」をこのシーンから外しますか?\n\nこの操作は取り消せません。`
  )
  if (!confirmed) return

  try {
    await deleteSceneCharacter(sc.id)
    closePopover()
    await refreshSceneCharacters()
  } catch (e) {
    alert(e instanceof Error ? e.message : '削除に失敗しました')
  }
}

// キャラダイアログの状態
const isCharacterDialogOpen = ref(false)
const editingCharacter = ref<Character | null>(null)

// 新規キャラダイアログを開く
function openCreateCharacterDialog() {
  editingCharacter.value = null
  isCharacterDialogOpen.value = true
}

// 編集キャラダイアログを開く
function openEditCharacterDialog(character: Character) {
  editingCharacter.value = character
  isCharacterDialogOpen.value = true
}

// ダイアログを閉じる
function closeCharacterDialog() {
  isCharacterDialogOpen.value = false
  editingCharacter.value = null
}

// キャラ作成処理
async function handleCharacterSubmit(input: CharacterInput) {
  try {
    if (editingCharacter.value && editingCharacter.value.id !== undefined) {
      // 編集モード
      await updateCharacter({
        id: editingCharacter.value.id,
        ...input,
      })
    } else {
      // 新規作成モード
      await createCharacter(input)
    }
    closeCharacterDialog()
    await refreshCharacters()
  } catch (e) {
    alert(e instanceof Error ? e.message : '保存に失敗しました')
  }
}

// キャラ削除処理
async function handleDeleteCharacter(character: Character) {
  if (character.id === undefined) return

  const confirmed = window.confirm(
    `キャラクター「${character.name}」を削除しますか?\n\nこの操作は取り消せません。`
  )
  if (!confirmed) return

  try {
    await deleteCharacter(character.id)
    await refreshCharacters()
  } catch (e) {
    alert(e instanceof Error ? e.message : '削除に失敗しました')
  }
}

// キャラ詳細ページに遷移
function goToCharacterDetail(character: Character) {
  if (character.id === undefined) return
  router.push(`/works/${workId}/characters/${character.id}`)
}

// コピー状態管理(UIフィードバック用)
const copyState = ref<'idle' | 'success' | 'error'>('idle')

// シーンをテキストとしてコピー
async function copyScenesToClipboard() {
  if (!work.value) return

  if (scenes.value.length === 0) {
    alert('コピーするシーンがありません')
    return
  }

  try {
    const text = formatScenesAsText(work.value, scenes.value)
    await navigator.clipboard.writeText(text)
    copyState.value = 'success'

    // 2秒後に元に戻す
    setTimeout(() => {
      copyState.value = 'idle'
    }, 2000)
  } catch (e) {
    copyState.value = 'error'
    alert('コピーに失敗しました。ブラウザのクリップボード権限を確認してください。')

    setTimeout(() => {
      copyState.value = 'idle'
    }, 2000)
  }
}

// 個別コピー機能
async function copySceneToClipboard(scene: Scene) {
  try {
    const text = formatSceneAsText(scene)
    await navigator.clipboard.writeText(text)

  } catch (e) {
    copyState.value = 'error'
    alert('コピーに失敗しました。ブラウザのクリップボード権限を確認してください。')

    setTimeout(() => {
      copyState.value = 'idle'
    }, 2000)
  }
}

// コピーボタンの表示テキスト
const copyButtonLabel = computed(() => {
  switch (copyState.value) {
    case 'success': return '✅ コピーしました'
    case 'error': return '❌ コピー失敗'
    default: return '全シーンコピー'
  }
})

// シーン削除時には伏線も再取得が必要(参照外しの反映のため)
async function refreshScenesAndForeshadows() {
  await Promise.all([refreshScenes(), refreshForeshadows()])
}



// ステータスフィルタを適用した伏線一覧
const filteredForeshadows = computed(() => {
  if (statusFilter.value === 'all') {
    return foreshadows.value
  }
  return foreshadows.value.filter((f) => f.status === statusFilter.value)
})

// ステータス別の件数(タブの数字表示用)
const statusCounts = computed(() => {
  return {
    all: foreshadows.value.length,
    planned: foreshadows.value.filter((f) => f.status === 'planned').length,
    placed: foreshadows.value.filter((f) => f.status === 'placed').length,
    resolved: foreshadows.value.filter((f) => f.status === 'resolved').length,
  }
})

// シーンID からシーンタイトルを取得するヘルパー
function getSceneLabel(sceneId: number | undefined): string {
  if (sceneId === undefined) return '未設定'
  const scene = scenes.value.find((s) => s.id === sceneId)
  if (!scene) return '(削除されたシーン)'
  return `#${scene.order} ${scene.title || '無題'}`
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
    `「${scene.title || '無題'}」を削除しますか?\n\nこの操作は取り消せません　\nこのシーンに紐付いた伏線の参照は自動的に外れます　`
  )
  if (!confirmed) return

  try {
    await deleteScene(scene.id)
    // シーン削除で伏線の参照が外れるから、両方再取得
    await refreshScenesAndForeshadows()
  } catch (e) {
    alert(e instanceof Error ? e.message : '削除に失敗しました')
  }
}

// シーンを1つ上に移動
async function handleMoveUp(scene: Scene) {
  if (scene.id === undefined) return
  try {
    await moveSceneUp(scene.id)
    await refreshScenes()
  } catch (e) {
    alert(e instanceof Error ? e.message : '移動に失敗しました')
  }
}

// シーンを1つ下に移動
async function handleMoveDown(scene: Scene) {
  if (scene.id === undefined) return
  try {
    await moveSceneDown(scene.id)
    await refreshScenes()
  } catch (e) {
    alert(e instanceof Error ? e.message : '移動に失敗しました')
  }
}

// 「これ以上上に動かせない」かどうか　渡されたシーンaがシーンたちの先頭か確認
// オプショナルチュイニングを使っているので、scenes.valueが空配列の場合も安全にfalseを返す
function isFirst(scene: Scene): boolean {
  return scenes.value[0]?.id === scene.id
}

// 「これ以上下に動かせない」かどうか
function isLast(scene: Scene): boolean {
  return scenes.value[scenes.value.length - 1]?.id === scene.id
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
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h3 class="text-lg font-semibold">📝 シーン一覧</h3>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm text-slate-500">全{{ scenes.length }}シーン</span>
        <button
          type="button"
          class="px-3 py-2 text-sm font-medium rounded-md transition-colors"
          :class="copyState === 'success'
            ? 'bg-green-100 text-green-700'
            : copyState === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'"
          :disabled="scenes.length === 0"
          @click="copyScenesToClipboard"
        >
          {{ copyButtonLabel }}
        </button>
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
          <p class="text-slate-600 mb-2">まだシーンが登録されていません　</p>
          <p class="text-sm text-slate-500">右上の「+ 新規シーン」から追加してください　</p>
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
              <div class="flex items-baseline gap-3 flex-1 min-w-0">
                  <span class="text-sm font-mono text-slate-400 shrink-0">#{{ scene.order }}</span>
                  <h4 class="text-lg font-semibold truncate">{{ scene.title || '無題' }}</h4>
                </div>
              <div class="flex items-start justify-between gap-2 mb-1">
                <div class="flex items-center gap-1 shrink-0">
                  <button
                  type="button"
                  class="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  :disabled="isFirst(scene)"
                  title="上に移動"
                  @click="handleMoveUp(scene)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  :disabled="isLast(scene)"
                  title="下に移動"
                  @click="handleMoveDown(scene)"
                >
                  ↓
                </button>
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
                  <button
                    type="button"
                    class="px-2 py-2 text-sm font-medium rounded-md transition-colors bg-blue-600 active:scale-95 text-white"
                    @click="copySceneToClipboard(scene)"
                  >
                    {{ 'コピー' }}
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

            <!-- 登場キャラ -->
            <div class="flex items-center gap-2 flex-wrap pt-3 mt-3 border-t border-slate-100">
              <span class="text-xs text-slate-400 shrink-0">登場:</span>

              <!-- キャラアイコン(クリックでポップアップ) -->
              <div
                v-for="link in linksBySceneId.get(scene.id!) ?? []"
                :key="link.id"
                class="relative"
              >
                <button
                  type="button"
                  class="block rounded-full hover:ring-2 hover:ring-blue-300 transition-shadow"
                  @click="togglePopover(link.id!)"
                >
                  <CharacterAvatar
                    :name="characterById.get(link.characterId)?.name ?? '?'"
                    :photo="characterById.get(link.characterId)?.photo"
                    size="sm"
                  />
                </button>

                <!-- 吹き出しポップアップ(開いているのは1つだけ) -->
                <div
                  v-if="openPopoverId === link.id"
                  class="absolute z-10 top-10 left-0 w-64 bg-white border border-slate-200 rounded-lg shadow-lg p-3"
                >
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-medium text-sm truncate">
                      {{ characterById.get(link.characterId)?.name ?? '(削除されたキャラ)' }}
                    </span>
                    <button
                      type="button"
                      class="text-slate-400 hover:text-slate-600 leading-none shrink-0"
                      @click="closePopover"
                    >
                      ×
                    </button>
                  </div>
                  <p v-if="link.intent" class="text-xs text-slate-600 whitespace-pre-wrap mb-2">
                    {{ link.intent }}
                  </p>
                  <p v-else class="text-xs text-slate-400 italic mb-2">思惑は未記入です</p>
                  <div class="flex justify-end gap-1">
                    <button
                      type="button"
                      class="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                      @click="closePopover(); openSceneCharacterManager(scene)"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      @click="handleUnlinkSceneCharacter(link)"
                    >
                      解除
                    </button>
                  </div>
                </div>
              </div>

              <!-- キャラ追加ボタン -->
              <button
                type="button"
                class="w-8 h-8 rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm"
                title="登場キャラを追加"
                @click="openSceneCharacterManager(scene)"
              >
                +
              </button>
            </div>

          </article>
        </div>
        <div class="flex justify-end w-full">
          <button
            type="button"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium mt-4"
            @click="openCreateSceneDialog"
          >
            + 次のシーン
          </button>
        </div>
      </section>

      <!-- 伏線一覧 -->
      <section class="mt-10">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">🔗 伏線一覧</h3>
          <button
            type="button"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            @click="openCreateForeshadowDialog"
          >
            + 新規伏線
          </button>
        </div>

        <!-- ステータスフィルタ -->
        <div class="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            class="px-3 py-1 text-sm rounded-md transition-colors"
            :class="statusFilter === 'all'
              ? 'bg-slate-800 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'"
            @click="statusFilter = 'all'"
          >
            全て ({{ statusCounts.all }})
          </button>
          <button
            v-for="status in (['planned', 'placed', 'resolved'] as ForeshadowStatus[])"
            :key="status"
            type="button"
            class="px-3 py-1 text-sm rounded-md transition-colors"
            :class="statusFilter === status
              ? 'bg-slate-800 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'"
            @click="statusFilter = status"
          >
            {{ FORESHADOW_STATUS_LABELS[status] }} ({{ statusCounts[status] }})
          </button>
        </div>

        <!-- 伏線が0件の時 -->
        <div
          v-if="foreshadows.length === 0"
          class="bg-white rounded-lg border border-slate-200 p-8 text-center"
        >
          <p class="text-slate-600 mb-2">まだ伏線が登録されていません</p>
          <p class="text-sm text-slate-500">右上の「+ 新規伏線」から追加してください</p>
        </div>

        <!-- フィルタ結果が0件の時 -->
        <div
          v-else-if="filteredForeshadows.length === 0"
          class="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500"
        >
          このステータスの伏線はありません
        </div>

        <!-- 伏線カード一覧 -->
        <div v-else class="space-y-3">
          <article
            v-for="foreshadow in filteredForeshadows"
            :key="foreshadow.id"
            class="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <!-- タイトル + ステータスバッジ + ボタン -->
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <span
                  class="text-xs font-medium px-2 py-0.5 rounded shrink-0"
                  :class="FORESHADOW_STATUS_COLORS[foreshadow.status]"
                >
                  {{ FORESHADOW_STATUS_LABELS[foreshadow.status] }}
                </span>
                <h4 class="font-semibold truncate">{{ foreshadow.title }}</h4>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  class="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                  @click="openEditForeshadowDialog(foreshadow)"
                >
                  編集
                </button>
                <button
                  type="button"
                  class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  @click="handleDeleteForeshadow(foreshadow)"
                >
                  削除
                </button>
              </div>
            </div>

            <!-- 説明 -->
            <p
              v-if="foreshadow.description"
              class="text-sm text-slate-600 whitespace-pre-wrap mb-3"
            >
              {{ foreshadow.description }}
            </p>

            <!-- シーン紐付け情報 -->
            <div class="space-y-1 pt-2 border-t border-slate-100 text-xs">
              <p class="text-slate-600">
                <span class="text-slate-400">張ったシーン:</span>
                {{ getSceneLabel(foreshadow.placedSceneId) }}
              </p>
              <p class="text-slate-600">
                <span class="text-slate-400">回収予定シーン:</span>
                {{ getSceneLabel(foreshadow.resolvedSceneId) }}
              </p>
            </div>
          </article>
        </div>
      </section>

<!-- キャラクター一覧 -->
<section class="mt-10">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-semibold">👥 キャラクター一覧</h3>
    <button
      type="button"
      class="px-4 py-2 mb-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
      @click="openCreateCharacterDialog"
    >
      + 新規キャラ
    </button>
  </div>

  <!-- キャラが0件の時 -->
  <div
    v-if="characters.length === 0"
    class="bg-white rounded-lg border border-slate-200 p-8 text-center"
  >
    <p class="text-slate-600 mb-2">まだキャラクターが登録されていません</p>
    <p class="text-sm text-slate-500">右上の「+ 新規キャラ」から追加してください</p>
  </div>

  <!-- キャラクターカード一覧 -->
  <div v-else class="space-y-3">
    <article
      v-for="character in characters"
      :key="character.id"
      class="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
      @click="goToCharacterDetail(character)"
    >
      <!-- アバター + 名前 + ボタン -->
      <div class="flex items-start gap-3 mb-3">
        <!-- アバター -->
        <CharacterAvatar
          :name="character.name"
          :photo="character.photo"
          size="md"
        />

        <!-- 名前 -->
        <h4 class="text-lg font-semibold truncate flex-1 min-w-0 self-center">
          {{ character.name }}
        </h4>

        <!-- ボタン群 -->
        <div class="flex items-center gap-1 shrink-0" @click.stop>
          <button
            type="button"
            class="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            @click.stop="openEditCharacterDialog(character)"
          >
            編集
          </button>
          <button
            type="button"
            class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
            @click.stop="handleDeleteCharacter(character)"
          >
            削除
          </button>
        </div>
      </div>

      <!-- 可変フィールド一覧 -->
      <dl
        v-if="character.customFields.length > 0"
        class="space-y-1 text-sm"
      >
        <div
          v-for="field in character.customFields"
          :key="field.id"
          class="flex gap-3"
        >
          <dt class="text-slate-400 shrink-0">{{ field.name || '(項目名未設定)' }}:</dt>
          <dd class="text-slate-700 whitespace-pre-wrap flex-1">
            {{ field.value || '—' }}
          </dd>
        </div>
      </dl>

      <p v-else class="text-sm text-slate-500">
        まだ詳細が記載されていません。
      </p>
    </article>
  </div>
</section>

      <!-- シーン追加・編集ダイアログ -->
      <SceneFormDialog
        :is-open="isSceneDialogOpen"
        :work-id="workId"
        :editing-scene="editingScene ?? undefined"
        @close="closeSceneDialog"
        @submit="handleSceneSubmit"
      />
      <!-- 伏線追加・編集ダイアログ -->
      <ForeshadowFormDialog
        :is-open="isForeshadowDialogOpen"
        :work-id="workId"
        :scenes="scenes"
        :editing-foreshadow="editingForeshadow ?? undefined"
        @close="closeForeshadowDialog"
        @submit="handleForeshadowSubmit"
      />
      <!-- キャラクター追加・編集ダイアログ -->
      <CharacterFormDialog
        :is-open="isCharacterDialogOpen"
        :work-id="workId"
        :editing-character="editingCharacter ?? undefined"
        @close="closeCharacterDialog"
        @submit="handleCharacterSubmit"
      />

      <!-- シーン×キャラ管理ダイアログ -->
      <SceneCharacterManagerDialog
        :is-open="isSceneCharacterManagerOpen"
        :scene="managingScene"
        :characters="characters"
        @close="closeSceneCharacterManager"
        @changed="handleSceneCharactersChanged"
      />

    </div>
  </div>
</template>