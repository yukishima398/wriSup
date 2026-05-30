<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWork } from '@/repositories/workRepository'
import { getCharacter } from '@/repositories/characterRepository'
import type { Work } from '@/types/work'
import type { Character } from '@/types/character'

const route = useRoute()
const router = useRouter()

// URL からIDを取得
const workId = Number(route.params.workId)
const characterId = Number(route.params.characterId)

// リアクティブな状態
const work = ref<Work | null>(null)
const character = ref<Character | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

// 作品とキャラを並列取得
async function fetchAll() {
  try {
    if (isNaN(workId) || isNaN(characterId)) {
      error.value = '不正なIDです'
      return
    }

    const [workResult, characterResult] = await Promise.all([
      getWork(workId),
      getCharacter(characterId),
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
        <h2 class="text-2xl font-bold">{{ character.name }}</h2>
      </header>

      <!-- 可変フィールド一覧 -->
      <section class="mb-8">
        <h3 class="text-lg font-semibold mb-3">📋 詳細項目</h3>

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

      <!-- 行動の一元管理(Day 8 で実装予定) -->
      <section>
        <h3 class="text-lg font-semibold mb-3">📍 行動の一元管理</h3>
        <div class="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-8 text-center">
          <p class="text-slate-600 mb-1">この機能は今後実装予定です。</p>
          <p class="text-sm text-slate-500">
            このキャラクターが登場する全シーンと、各シーンでの思惑をまとめて表示します。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>