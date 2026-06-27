<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWork } from '@/repositories/workRepository'
import { getCharacter } from '@/repositories/characterRepository'
import type { Work } from '@/types/work'
import type { Character } from '@/types/character'
import CharacterAvatar from '@/components/CharacterAvatar.vue'
import { listScenesByWork } from '@/repositories/sceneRepository'
import { listSceneCharactersByCharacter } from '@/repositories/sceneCharacterRepository'
import type { Scene } from '@/types/scene'
import type { SceneCharacter } from '@/types/sceneCharacter'

const route = useRoute()
const router = useRouter()

// URL からIDを取得
const workId = Number(route.params.workId)
const characterId = Number(route.params.characterId)

const work = ref<Work | null>(null)
const character = ref<Character | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
// この作品の全シーンえ
const scenes = ref<Scene[]>([])
// このキャラの紐付け一覧
const links = ref<SceneCharacter[]>([])

// このキャラの登場シーンを物語の順(order)で並べたもの
// scenes が listsenesbysortでorderソート済みなのを利用し、シーン側を軸にリンクを拾う。
// シーン削除で孤児になった紐付けは自然と表示されない
const appearances = computed(() => {
  const linkBySceneId = new Map<number, SceneCharacter>()
  for (const link of links.value) {
    linkBySceneId.set(link.sceneId, link)
  }

  const result: { scene: Scene; link: SceneCharacter }[] = []
  for (const scene of scenes.value) {
    if (scene.id === undefined) continue
    const link = linkBySceneId.get(scene.id)
    if (link) result.push({ scene, link })
  }
  return result
})

// 作品とキャラを並列取得
async function fetchAll() {
  try {
    if (isNaN(workId) || isNaN(characterId)) {
      error.value = '不正なIDです'
      return
    }

    const [workResult, characterResult, scenesResult, linksResult] = await Promise.all([
      getWork(workId),
      getCharacter(characterId),
      listScenesByWork(workId),
      listSceneCharactersByCharacter(characterId),
    ])

    if (!workResult) {
      error.value = '作品が見つかりませんでした'
      return
    }

    if (!characterResult) {
      error.value = 'キャラクターが見つかりませんでした'
      return
    }

    // キャラクターが本当にこの作品のものか確認(整合性チェック)
    if (characterResult.workId !== workId) {
      error.value = 'このキャラクターはこの作品のものではありません'
      return
    }

    work.value = workResult
    character.value = characterResult
    scenes.value = scenesResult
    links.value = linksResult
  } catch (e) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchAll)

// 作品詳細ページに戻る
function goBackToWork() {
  router.push(`/works/${workId}`)
}
</script>

<template>
  <div>
    <!-- 戻るボタン -->
    <button
      type="button"
      class="text-sm text-blue-600 hover:underline mb-4 inline-flex items-center gap-1"
      @click="goBackToWork"
    >
      ← 作品「{{ work?.title || '...' }}」に戻る
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

    <!-- キャラ情報 -->
    <div v-else-if="character">
        <!-- 名前 -->
        <header class="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div class="flex items-center gap-4">
            <CharacterAvatar
              :name="character.name"
              :photo="character.photo"
              size="lg"
            />
            <h2 class="text-2xl font-bold truncate">{{ character.name }}</h2>
          </div>
        </header>

      <!-- 可変フィールド一覧 -->
      <section class="mb-8">
        <h3 class="text-lg font-semibold mb-3">詳細項目</h3>

        <div
          v-if="character.customFields.length === 0"
          class="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500"
        >
          まだ詳細項目が登録されていません。
        </div>

        <div v-else class="bg-white rounded-lg border border-slate-200 p-6">
          <dl class="space-y-3">
            <div
              v-for="field in character.customFields"
              :key="field.id"
              class="flex flex-col sm:flex-row sm:gap-4 pb-3 border-b border-slate-100 last:border-b-0 last:pb-0"
            >
              <dt class="text-sm font-medium text-slate-500 sm:w-32 sm:shrink-0">
                {{ field.name || '(項目名未設定)' }}
              </dt>
              <dd class="text-slate-700 whitespace-pre-wrap flex-1">
                {{ field.value || '—' }}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- 行動の一元管理 -->
      <section>
              <h3 class="text-lg font-semibold mb-3">行動の一元管理</h3>

              <div
                v-if="appearances.length === 0"
                class="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500"
              >
                まだどのシーンにも登場していません。<br />
                作品詳細ページのシーンカードにある「+」から紐付けできます。
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="{ scene, link } in appearances"
                  :key="link.id"
                  class="bg-white rounded-lg border border-slate-200 p-4"
                >
                  <!-- シーン情報の行 -->
                  <div class="flex items-baseline gap-2 mb-1 flex-wrap">
                    <span class="text-sm font-semibold text-slate-400 shrink-0">
                      #{{ scene.order }}
                    </span>
                    <span class="font-medium truncate">{{ scene.title || '無題' }}</span>
                    <span
                      v-if="scene.worldDateTime"
                      class="text-xs text-slate-500 bg-slate-100 rounded px-2 py-0.5 shrink-0"
                    >
                      {{ scene.worldDateTime }}
                    </span>
                  </div>

                  <!-- このシーンでの思惑 -->
                  <p v-if="link.intent" class="text-sm text-slate-700 whitespace-pre-wrap">
                    {{ link.intent }}
                  </p>
                  <p v-else class="text-sm text-slate-400 italic">思惑は未記入です</p>
                </div>
              </div>
            </section>
    </div>
  </div>
</template>