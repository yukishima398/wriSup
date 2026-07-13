<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Work, WorkInput } from '@/types/work'
import WorkThumbnail from '@/components/WorkThumbnail.vue'
import { compressThumbnailToBlob } from '@/utils/imageProcessor'

// props: 親コンポーネントから受け取る値
const props = defineProps<{
  isOpen: boolean
  // 編集対象の作品。undefined なら新規作成モード
  editingWork?: Work
}>()

// emit: 親コンポーネントにイベントを通知する
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', input: WorkInput): void
}>()

// 編集モードかどうかを判定
const isEditMode = computed(() => !!props.editingWork)

// ダイアログのタイトル
const dialogTitle = computed(() =>
  isEditMode.value ? '作品を編集' : '新規作品を作成'
)

// 保存ボタンのラベル
const submitLabel = computed(() =>
  isEditMode.value ? '更新' : '保存'
)

// フォームの入力状態
const title = ref('')
const goal = ref('')
const theme = ref('')
// サムネイル画像(Blob)
const thumbnail = ref<Blob | undefined>(undefined)
// 画像処理中フラグ(連打防止)
const isProcessingImage = ref(false)

// isOpen が変わったときに状態を初期化
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    // 編集モードなら既存データを、新規モードなら空をセット
    title.value = props.editingWork?.title ?? ''
    goal.value = props.editingWork?.goal ?? ''
    theme.value = props.editingWork?.theme ?? ''
    // thumbnail は Blob なので構造的にコピー不要(参照渡しでOK、変更しない)
    thumbnail.value = props.editingWork?.thumbnail
  }
})

// 画像ファイルを選択して圧縮
async function handleImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  isProcessingImage.value = true
  try {
    thumbnail.value = await compressThumbnailToBlob(file)
  } catch (e) {
    alert(e instanceof Error ? e.message : '画像の処理に失敗しました')
  } finally {
    isProcessingImage.value = false
    // input をリセット(同じファイルを再選択できるように)
    input.value = ''
  }
}

// 画像を削除
function removeImage() {
  thumbnail.value = undefined
}

// 保存処理
function handleSubmit() {
  if (!title.value.trim()) {
    alert('タイトルを入力してください')
    return
  }

  emit('submit', {
    title: title.value.trim(),
    goal: goal.value.trim(),
    theme: theme.value.trim(),
    thumbnail: thumbnail.value,
  })
}

// キャンセル処理
function handleCancel() {
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
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 dark:border-slate-700">
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
        <!-- サムネイル画像 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
            サムネイル画像
          </label>

          <div class="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-900 dark:border-slate-700">
            <!-- プレビュー(実際の表示と同じく、タイトルの背後に半透明で敷かれる) -->
            <div class="relative overflow-hidden rounded-md border border-slate-200 h-16 flex items-center px-4 bg-white dark:bg-slate-800 dark:border-slate-600">
              <WorkThumbnail :thumbnail="thumbnail" />
              <span class="relative font-semibold truncate">{{ title || '作品' }}</span>
            </div>

            <!-- 操作ボタン群 -->
            <div class="flex items-center gap-2">
              <!-- ファイル選択 -->
              <label
                class="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md cursor-pointer hover:bg-slate-100 transition-colors dark:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-700"
                :class="{ 'opacity-50 cursor-not-allowed': isProcessingImage }"
              >
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  :disabled="isProcessingImage"
                  @change="handleImageChange"
                />
                {{ isProcessingImage ? '処理中...' : (thumbnail ? '画像を変更' : '画像を選択') }}
              </label>

              <!-- 削除ボタン(画像があるときだけ) -->
              <button
                v-if="thumbnail"
                type="button"
                class="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                @click="removeImage"
              >
                画像を削除
              </button>
            </div>

            <!-- 説明 -->
            <p class="text-xs text-slate-500 dark:text-slate-400">
              ホーム画面の一覧、作品詳細画面のタイトルバナーに表示されます
            </p>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
            タイトル <span class="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            v-model="title"
            type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
            placeholder="例:転生したらペンでした"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
            ゴール
          </label>
          <textarea
            v-model="goal"
            rows="2"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
            placeholder="最悪ここに着地させよう。例:主人公がAランクになる"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
            テーマ
          </label>
          <textarea
            v-model="theme"
            rows="2"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:border-slate-600"
            placeholder="作品を通じて描きたい主題。例:成長と父性愛"
          ></textarea>
        </div>
      </div>

      <!-- フッター -->
      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 shrink-0 dark:border-slate-700">
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