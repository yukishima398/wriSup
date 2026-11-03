<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, type LocationQueryValue, type RouteLocationRaw } from 'vue-router'
import { loadSearchSource } from '@/repositories/searchRepository'
import {
  searchTexts,
  SEARCH_KINDS,
  SEARCH_KIND_LABELS,
  type SearchKind,
  type SearchResultItem,
  type SearchSource,
} from '@/utils/textSearch'
import type { Work } from '@/types/work'

const route = useRoute()
const router = useRouter()

// 種類バッジの色
const KIND_COLORS: Record<SearchKind, string> = {
  scene: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  character: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  foreshadow: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  chapter: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
  work: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
}

// 一致部分のハイライト
const HIT_CLASS = 'rounded-sm bg-amber-200 px-0.5 font-semibold text-slate-900 dark:bg-amber-400/30 dark:text-amber-100'

function firstQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value
  return v ?? ''
}

// 検索条件はURLのクエリにも持たせ、結果を開いて「戻る」したときに同じ検索結果へ戻れるようにする
const initialKind = firstQueryValue(route.query.type)
const initialWorkId = Number(firstQueryValue(route.query.work))

const query = ref(firstQueryValue(route.query.q))
const caseSensitive = ref(firstQueryValue(route.query.case) === '1')
const kindFilter = ref<SearchKind | 'all'>(
  (SEARCH_KINDS as string[]).includes(initialKind) ? (initialKind as SearchKind) : 'all'
)
const workFilter = ref<number | 'all'>(Number.isInteger(initialWorkId) && initialWorkId > 0 ? initialWorkId : 'all')

const source = ref<SearchSource | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
// 折りたたんでいる作品の ID
const collapsedWorkIds = ref(new Set<number>())

// 入力のたびに全件を走査しないよう、打鍵が止まってから検索する
const debouncedQuery = ref(query.value)
let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = value
  }, 150)
})
onBeforeUnmount(() => clearTimeout(debounceTimer))

watch([debouncedQuery, caseSensitive, kindFilter, workFilter], () => {
  router.replace({
    query: {
      q: debouncedQuery.value || undefined,
      case: caseSensitive.value ? '1' : undefined,
      type: kindFilter.value === 'all' ? undefined : kindFilter.value,
      work: workFilter.value === 'all' ? undefined : workFilter.value,
    },
  })
})

async function fetchSource() {
  try {
    source.value = await loadSearchSource()
    // 指定された作品が削除済みなら絞り込みを外す
    if (workFilter.value !== 'all' && !source.value.works.some((w) => w.id === workFilter.value)) {
      workFilter.value = 'all'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  inputRef.value?.focus()
  fetchSource()
})

const trimmedQuery = computed(() => debouncedQuery.value.trim())

const allResults = computed(() => {
  if (!source.value) return []
  return searchTexts(source.value, debouncedQuery.value, { caseSensitive: caseSensitive.value })
})

// 作品の絞り込みだけを適用した結果(種類タブの件数はここから数える)
const resultsInWork = computed(() =>
  workFilter.value === 'all'
    ? allResults.value
    : allResults.value.filter((r) => r.workId === workFilter.value)
)

const kindCounts = computed(() => {
  const counts = Object.fromEntries(SEARCH_KINDS.map((k) => [k, 0])) as Record<SearchKind, number>
  for (const r of resultsInWork.value) counts[r.kind]++
  return counts
})

const visibleResults = computed(() =>
  kindFilter.value === 'all'
    ? resultsInWork.value
    : resultsInWork.value.filter((r) => r.kind === kindFilter.value)
)

const totalMatchCount = computed(() => visibleResults.value.reduce((sum, r) => sum + r.matchCount, 0))

// 作品ごとにまとめる(結果はすでに作品の並び順になっている)
const groups = computed(() => {
  const workById = new Map<number, Work>()
  for (const w of source.value?.works ?? []) {
    if (w.id !== undefined) workById.set(w.id, w)
  }

  const result: Array<{ work: Work; items: SearchResultItem[]; matchCount: number }> = []
  for (const item of visibleResults.value) {
    const last = result[result.length - 1]
    if (last && last.work.id === item.workId) {
      last.items.push(item)
      last.matchCount += item.matchCount
    } else {
      const work = workById.get(item.workId)
      if (work) result.push({ work, items: [item], matchCount: item.matchCount })
    }
  }
  return result
})

function clearQuery() {
  query.value = ''
  debouncedQuery.value = ''
  inputRef.value?.focus()
}

// Enter で待たずに検索する
function searchNow() {
  clearTimeout(debounceTimer)
  debouncedQuery.value = query.value
}

function toggleGroup(workId: number) {
  if (collapsedWorkIds.value.has(workId)) {
    collapsedWorkIds.value.delete(workId)
  } else {
    collapsedWorkIds.value.add(workId)
  }
}

// 結果から各画面へのリンク(作品詳細では該当のシーン・伏線までスクロールする)
function resultLink(item: SearchResultItem): RouteLocationRaw {
  switch (item.kind) {
    case 'character':
      return `/works/${item.workId}/characters/${item.targetId}`
    case 'scene':
      return { path: `/works/${item.workId}`, query: { scene: item.targetId } }
    case 'foreshadow':
      return { path: `/works/${item.workId}`, query: { foreshadow: item.targetId } }
    case 'chapter':
      return { path: `/works/${item.workId}`, query: { chapter: item.targetId } }
    case 'work':
      return `/works/${item.workId}`
  }
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <div>
    <!-- 戻るボタン -->
    <button
      type="button"
      class="text-sm text-slate-600 hover:bg-slate-100 rounded-md px-3 py-1 mb-4 inline-flex items-center gap-1 transition-colors dark:text-slate-300 dark:hover:bg-slate-700"
      @click="goBack"
    >
      ← 一覧に戻る
    </button>

    <h2 class="text-xl font-semibold mb-4">テキスト検索</h2>

    <!-- 検索ボックス -->
    <div class="flex items-center gap-1 bg-white rounded-lg border border-slate-200 pl-3 pr-1.5 shadow-sm transition-colors focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:bg-slate-800 dark:border-slate-700 dark:focus-within:border-emerald-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5 shrink-0 text-slate-400" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" stroke-linecap="round" />
      </svg>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        enterkeyhint="search"
        placeholder="登録した全てのテキストを検索できます"
        aria-label="検索語"
        class="flex-1 min-w-0 bg-transparent px-2 py-3 text-base outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
        @keydown.enter="searchNow"
        @keydown.esc="clearQuery"
      />
      <button
        v-if="query"
        type="button"
        class="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:bg-slate-700 dark:hover:text-slate-300"
        aria-label="検索語をクリア"
        @click="clearQuery"
      >
        ×
      </button>
      <button
        type="button"
        class="h-8 px-2 shrink-0 rounded-md text-sm font-medium transition-colors"
        :class="caseSensitive
          ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-700'
          : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'"
        :aria-pressed="caseSensitive"
        title="大文字と小文字を区別する"
        @click="caseSensitive = !caseSensitive"
      >
        Aa
      </button>
    </div>

    <!-- 作品の絞り込み -->
    <div class="flex items-center gap-2 mt-3 text-sm">
      <label for="search-work-filter" class="text-slate-500 shrink-0 dark:text-slate-400">作品:</label>
      <select
        id="search-work-filter"
        v-model="workFilter"
        class="min-w-0 max-w-full truncate bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
      >
        <option value="all">すべての作品</option>
        <option v-for="work in source?.works ?? []" :key="work.id" :value="work.id">
          {{ work.title || '無題' }}
        </option>
      </select>
    </div>

    <div class="mt-6">
      <!-- 読み込み中 -->
      <div v-if="isLoading" class="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
        読み込み中...
      </div>

      <!-- エラー時 -->
      <div v-else-if="error" class="bg-red-50 rounded-lg border border-red-200 p-8 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
        <p class="font-semibold">エラーが発生しました</p>
        <p class="text-sm mt-1">{{ error }}</p>
      </div>

      <!-- 未入力 -->
      <div v-else-if="trimmedQuery === ''" class="bg-white rounded-lg border border-slate-200 p-8 text-center dark:bg-slate-800 dark:border-slate-700">
        <p class="text-slate-600 mb-2 dark:text-slate-300">探したい言葉を入力してください</p>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          シーン(タイトル・ストーリー・世界状態・TODO・自由項目・登場キャラの行動)、キャラクター、伏線、章、作品のゴール・テーマから探します
        </p>
      </div>

      <!-- 一致なし -->
      <div v-else-if="resultsInWork.length === 0" class="bg-white rounded-lg border border-slate-200 p-8 text-center dark:bg-slate-800 dark:border-slate-700">
        <p class="text-slate-600 mb-2 dark:text-slate-300 break-all">「{{ trimmedQuery }}」に一致するテキストは見つかりませんでした</p>
        <p class="text-sm text-slate-500 dark:text-slate-400">言葉を短くするか、作品の絞り込みを「すべての作品」に戻してみてください</p>
      </div>

      <template v-else>
        <!-- 種類タブ -->
        <div class="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            class="px-3 py-1 text-sm rounded-md transition-colors"
            :class="kindFilter === 'all'
              ? 'bg-slate-800 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700'"
            @click="kindFilter = 'all'"
          >
            すべて ({{ resultsInWork.length }})
          </button>
          <button
            v-for="kind in SEARCH_KINDS"
            :key="kind"
            type="button"
            class="px-3 py-1 text-sm rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :class="kindFilter === kind
              ? 'bg-slate-800 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700'"
            :disabled="kindCounts[kind] === 0 && kindFilter !== kind"
            @click="kindFilter = kind"
          >
            {{ SEARCH_KIND_LABELS[kind] }} ({{ kindCounts[kind] }})
          </button>
        </div>

        <p class="text-sm text-slate-500 mb-3 dark:text-slate-400">
          {{ visibleResults.length.toLocaleString() }}件の項目・{{ totalMatchCount.toLocaleString() }}か所が一致
        </p>

        <div v-if="visibleResults.length === 0" class="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
          この種類には一致する項目がありません
        </div>

        <!-- 作品ごとの結果 -->
        <div v-else class="space-y-4">
          <section
            v-for="group in groups"
            :key="group.work.id"
            class="bg-white rounded-lg border border-slate-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700"
          >
            <button
              type="button"
              class="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-slate-50 hover:bg-slate-100 transition-colors dark:bg-slate-900/40 dark:hover:bg-slate-700/50"
              :class="collapsedWorkIds.has(group.work.id!) ? '' : 'border-b border-slate-200 dark:border-slate-700'"
              :aria-expanded="!collapsedWorkIds.has(group.work.id!)"
              @click="toggleGroup(group.work.id!)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="w-4 h-4 shrink-0 text-slate-400 transition-transform"
                :class="collapsedWorkIds.has(group.work.id!) ? '-rotate-90' : ''"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span class="font-semibold truncate">{{ group.work.title || '無題' }}</span>
              <span class="ml-auto shrink-0 text-xs text-slate-500 bg-slate-200/70 rounded-full px-2 py-0.5 dark:bg-slate-700 dark:text-slate-300">
                {{ group.items.length }}件・{{ group.matchCount }}か所
              </span>
            </button>

            <ul v-if="!collapsedWorkIds.has(group.work.id!)" class="divide-y divide-slate-100 dark:divide-slate-700">
              <li v-for="item in group.items" :key="item.key">
                <RouterLink
                  :to="resultLink(item)"
                  class="block px-4 py-3 hover:bg-emerald-50/60 transition-colors dark:hover:bg-slate-700/40"
                >
                  <!-- 種類 + タイトル -->
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="KIND_COLORS[item.kind]">
                      {{ SEARCH_KIND_LABELS[item.kind] }}
                    </span>
                    <span v-if="item.prefix" class="text-sm font-mono text-slate-400 shrink-0 dark:text-slate-500">{{ item.prefix }}</span>
                    <span class="font-medium truncate">
                      <template v-if="item.title.length > 0">
                        <template v-for="(seg, i) in item.title" :key="i">
                          <mark v-if="seg.match" :class="HIT_CLASS">{{ seg.text }}</mark>
                          <template v-else>{{ seg.text }}</template>
                        </template>
                      </template>
                      <template v-else>無題</template>
                    </span>
                    <span v-if="item.meta" class="text-xs text-slate-400 truncate hidden sm:inline dark:text-slate-500">{{ item.meta }}</span>
                    <span class="ml-auto shrink-0 text-xs text-slate-400 dark:text-slate-500">{{ item.matchCount }}か所</span>
                  </div>

                  <!-- 一致した欄の抜粋 -->
                  <dl v-if="item.fields.length > 0" class="mt-2 space-y-1.5">
                    <div v-for="(field, fieldIndex) in item.fields" :key="fieldIndex" class="sm:flex sm:gap-3 text-sm">
                      <dt class="sm:w-24 sm:shrink-0 text-xs text-slate-400 sm:pt-0.5 truncate dark:text-slate-500">{{ field.label }}</dt>
                      <dd class="flex-1 min-w-0 space-y-0.5 text-slate-600 dark:text-slate-300">
                        <p v-for="(snippet, snippetIndex) in field.snippets" :key="snippetIndex" class="break-all leading-relaxed">
                          <span v-if="snippet.truncatedStart" class="text-slate-400">…</span>
                          <template v-for="(seg, i) in snippet.segments" :key="i">
                            <mark v-if="seg.match" :class="HIT_CLASS">{{ seg.text }}</mark>
                            <template v-else>{{ seg.text }}</template>
                          </template>
                          <span v-if="snippet.truncatedEnd" class="text-slate-400">…</span>
                        </p>
                        <p v-if="field.hiddenCount > 0" class="text-xs text-slate-400 dark:text-slate-500">
                          他 {{ field.hiddenCount }} か所
                        </p>
                      </dd>
                    </div>
                  </dl>
                </RouterLink>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

