<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Scene } from '@/types/scene'
import type { Character } from '@/types/character'
import type { SceneCharacter } from '@/types/sceneCharacter'
import {
  createSceneCharacter,
  listSceneCharactersByScene,
  updateSceneCharacter,
  deleteSceneCharacter,
} from '@/repositories/sceneCharacterRepository'
import CharacterAvatar from '@/components/CharacterAvatar.vue'

// props
// characters は親(WorkDetailView)が取得済みのものを受け取る(二重フェッチ防止)
const props = defineProps<{
  isOpen: boolean
  scene: Scene | null
  characters: Character[]
}>()

// emit
// このダイアログは repository を直接呼ぶ設計のため submit は無い。
// 紐付けが変化したことだけを changed で親に通知する(親はシーンカード表示を更新する)
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'changed'): void
}>()

// ===== 状態 =====

// このシーンの紐付け一覧(DB から読み込む)
const links = ref<SceneCharacter[]>([])

// 読み込み中フラグ
const isLoading = ref(false)

// 新規追加フォームの状態
// number ではなく '' を初期値にするのは、select の「選択してください」状態を表すため
const selectedCharacterId = ref<number | ''>('')
const newIntent = ref('')

// インライン編集の状態
// 「いま編集中の紐付けは1件だけ」を editingId で保証する
const editingId = ref<number | null>(null)
const editingIntent = ref('')

// 連打防止フラグ
const isSaving = ref(false)

// ===== computed =====

// id → Character の Map。links から名前や画像を引くとき O(1) で取れる
const characterById = computed(() => {
  const map = new Map<number, Character>()
  for (const c of props.characters) {
    if (c.id !== undefined) map.set(c.id, c)
  }
  return map
})

// 紐付け済みキャラ ID の集合
const linkedIds = computed(() => new Set(links.value.map((l) => l.characterId)))

// まだ紐付けていないキャラ(追加用 select の選択肢)
const availableCharacters = computed(() =>
  props.characters.filter((c) => c.id !== undefined && !linkedIds.value.has(c.id))
)

// ===== 読み込み =====

// 紐付け一覧を DB から読み直す
async function loadLinks() {
  if (!props.scene || props.scene.id === undefined) return
  isLoading.value = true
  try {
    links.value = await listSceneCharactersByScene(props.scene.id)
  } finally {
    isLoading.value = false
  }
}

// ダイアログが開かれたら状態を初期化して読み込む
watch(
  () => props.isOpen,
  async (newValue) => {
    if (newValue) {
      selectedCharacterId.value = ''
      newIntent.value = ''
      editingId.value = null
      editingIntent.value = ''
      await loadLinks()
    }
  }
)

// ===== 操作 =====

// キャラを紐付ける
async function handleAdd() {
  if (!props.scene || props.scene.id === undefined) return
  if (selectedCharacterId.value === '') {
    alert('キャラクターを選択してください')
    return
  }

  isSaving.value = true
  try {
    await createSceneCharacter({
      sceneId: props.scene.id,
      characterId: selectedCharacterId.value,
      intent: newIntent.value.trim(),
    })
    // フォームをリセットして一覧を更新
    selectedCharacterId.value = ''
    newIntent.value = ''
    await loadLinks()
    emit('changed')
  } catch (e) {
    // repository の重複チェック例外もここで拾われる
    alert(e instanceof Error ? e.message : '紐付けに失敗しました')
  } finally {
    isSaving.value = false
  }
}

// 思惑の編集を開始(該当行を textarea に切り替える)
function startEdit(link: SceneCharacter) {
  if (link.id === undefined) return
  editingId.value = link.id
  editingIntent.value = link.intent
}

// 思惑の編集をキャンセル
function cancelEdit() {
  editingId.value = null
  editingIntent.value = ''
}

// 思惑を保存
async function saveIntent() {
  if (editingId.value === null) return

  isSaving.value = true
  try {
    await updateSceneCharacter({
      id: editingId.value,
      intent: editingIntent.value.trim(),
    })
    cancelEdit()
    await loadLinks()
    emit('changed')
  } catch (e) {
    alert(e instanceof Error ? e.message : '保存に失敗しました')
  } finally {
    isSaving.value = false
  }
}

// 紐付けを解除
async function handleUnlink(link: SceneCharacter) {
  if (link.id === undefined) return

  const character = characterById.value.get(link.characterId)
  const confirmed = window.confirm(
    `「${character?.name ?? '不明なキャラ'}」の紐付けを解除しますか?\n思惑の記録も削除されます`
  )
  if (!confirmed) return

  isSaving.value = true
  try {
    await deleteSceneCharacter(link.id)
    // 解除した行が編集中だった場合に備えて編集状態もリセット
    if (editingId.value === link.id) cancelEdit()
    await loadLinks()
    emit('changed')
  } catch (e) {
    alert(e instanceof Error ? e.message : '解除に失敗しました')
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
    v-if="isOpen && scene"
    class="fixed inset-0 bg-black/50 flex z-50 p-4 overflow-y-auto"
  >
    <!-- モーダル本体 -->
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg m-auto">
      <!-- ヘッダー -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-lg">
        <div class="min-w-0">
          <h3 class="text-lg font-semibold truncate">登場キャラクター管理</h3>
          <p class="text-sm text-slate-500 truncate">
            #{{ scene.order }} {{ scene.title || '無題' }}
          </p>
        </div>
        <button
          type="button"
          class="text-slate-400 hover:text-slate-600 text-2xl leading-none shrink-0"
          @click="handleClose"
        >
          ×
        </button>
      </div>

      <div class="px-6 py-4 space-y-5">
        <!-- ===== 紐付け済み一覧 ===== -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">
            このシーンに登場するキャラ
          </label>

          <!-- 読み込み中 -->
          <p v-if="isLoading" class="text-sm text-slate-500">読み込み中...</p>

          <!-- 0件 -->
          <p
            v-else-if="links.length === 0"
            class="text-sm text-slate-500 italic"
          >
            まだ登場キャラがいません。下のフォームから追加できます。
          </p>

          <!-- 一覧 -->
          <div v-else class="space-y-3">
            <div
              v-for="link in links"
              :key="link.id"
              class="border border-slate-200 rounded-md p-3 bg-slate-50"
            >
              <!-- キャラ情報 + 操作ボタン -->
              <div class="flex items-center gap-3 mb-2">
                <CharacterAvatar
                  :name="characterById.get(link.characterId)?.name ?? '?'"
                  :photo="characterById.get(link.characterId)?.photo"
                  size="sm"
                />
                <span class="font-medium flex-1 min-w-0 truncate">
                  {{ characterById.get(link.characterId)?.name ?? '(削除されたキャラ)' }}
                </span>
                <button
                  v-if="editingId !== link.id"
                  type="button"
                  class="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors shrink-0"
                  @click="startEdit(link)"
                >
                  思惑を編集
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0"
                  :disabled="isSaving"
                  @click="handleUnlink(link)"
                >
                  解除
                </button>
              </div>

              <!-- 思惑:編集中なら textarea、それ以外は表示のみ -->
              <div v-if="editingId === link.id">
                <textarea
                  v-model="editingIntent"
                  rows="3"
                  class="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="このシーンでのこのキャラの思惑・狙い・内心など"
                ></textarea>
                <div class="flex justify-end gap-1 mt-1">
                  <button
                    type="button"
                    class="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
                    @click="cancelEdit"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                    :disabled="isSaving"
                    @click="saveIntent"
                  >
                    保存
                  </button>
                </div>
              </div>
              <p
                v-else-if="link.intent"
                class="text-sm text-slate-700 whitespace-pre-wrap pl-11"
              >
                {{ link.intent }}
              </p>
              <p v-else class="text-xs text-slate-400 italic pl-11">
                思惑は未記入です
              </p>
            </div>
          </div>
        </div>

        <!-- ===== 新規紐付けフォーム ===== -->
        <div class="border-t border-slate-200 pt-4">
          <label class="block text-sm font-medium text-slate-700 mb-2">
            キャラを追加
          </label>

          <!-- 追加できるキャラがいない場合 -->
          <p
            v-if="availableCharacters.length === 0"
            class="text-sm text-slate-500 italic"
          >
            追加できるキャラがいません(全員登場済み、またはキャラ未作成)
          </p>

          <div v-else class="space-y-2">
            <select
              v-model="selectedCharacterId"
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">キャラクターを選択...</option>
              <option
                v-for="c in availableCharacters"
                :key="c.id"
                :value="c.id"
              >
                {{ c.name }}
              </option>
            </select>
            <textarea
              v-model="newIntent"
              rows="2"
              class="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="思惑(あとから編集できます)"
            ></textarea>
            <button
              type="button"
              class="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              :disabled="isSaving"
              @click="handleAdd"
            >
              + このシーンに追加
            </button>
          </div>
        </div>
      </div>

      <!-- フッター -->
      <div class="flex items-center justify-end px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white rounded-b-lg">
        <button
          type="button"
          class="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          @click="handleClose"
        >
          閉じる
        </button>
      </div>
    </div>
  </div>
</template>