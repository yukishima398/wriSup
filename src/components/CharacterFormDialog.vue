<script setup lang="ts">
import { ref, watch, computed, toRaw } from 'vue'
import type {
  Character,
  CharacterInput,
  CharacterField,
} from '@/types/character'
import { createEmptyField } from '@/types/character'

// props
const props = defineProps<{
  isOpen: boolean
  workId: number
  editingCharacter?: Character
}>()

// emit
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', input: CharacterInput): void
}>()

// モード判定
const isEditMode = computed(() => !!props.editingCharacter)

const dialogTitle = computed(() =>
  isEditMode.value ? 'キャラクターを編集' : '新規キャラクターを作成'
)

const submitLabel = computed(() =>
  isEditMode.value ? '更新' : '保存'
)

// フォーム状態
const name = ref('')
const customFields = ref<CharacterField[]>([])

// isOpen が変わったら状態を初期化
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    name.value = props.editingCharacter?.name ?? ''
    // 編集モードは既存データを deep copy(親のデータを壊さないため)
    customFields.value = props.editingCharacter?.customFields
      ? structuredClone(toRaw(props.editingCharacter.customFields))
      : []
  }
})

// 項目を追加
function addField() {
  customFields.value.push(createEmptyField())
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
  if (!name.value.trim()) {
    alert('名前を入力してください')
    return
  }

  emit('submit', {
    workId: props.workId,
    name: name.value.trim(),
    customFields: customFields.value
      .filter((f) => f.name.trim() !== '' || f.value.trim() !== '')
      .map((f) => ({
        id: f.id,
        name: f.name.trim(),
        value: f.value.trim(),
      })),
  })
}

function handleCancel() {
  emit('close')
}
</script>

<template>
  <!-- モーダル背景 -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
    @click.self="handleCancel"
  >
    <!-- モーダル本体 -->
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg my-8">
      <!-- ヘッダー -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-lg">
        <h3 class="text-lg font-semibold">{{ dialogTitle }}</h3>
        <button
          type="button"
          class="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          @click="handleCancel"
        >
          ×
        </button>
      </div>

      <!-- 入力欄 -->
      <div class="px-6 py-4 space-y-4">
        <!-- 名前 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            名前 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="name"
            type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="名前を入力..."
          />
        </div>

        <!-- 可変フィールド -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">
            詳細項目
          </label>

          <!-- フィールドが0件の時 -->
          <p
            v-if="customFields.length === 0"
            class="text-sm text-slate-500 mb-3 italic"
          >
            まだ項目がありません。「+ 項目を追加」で項目を作成できます。
          </p>

          <!-- フィールド一覧 -->
          <div v-else class="space-y-3 mb-3">
            <div
              v-for="(field, index) in customFields"
              :key="field.id"
              class="border border-slate-200 rounded-md p-3 bg-slate-50"
            >
              <!-- 項目名 -->
              <div class="mb-2">
                <label class="block text-xs font-medium text-slate-600 mb-1">
                  項目名
                </label>
                <input
                  v-model="field.name"
                  type="text"
                  class="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="例:年齢、性格、好物"
                />
              </div>

              <!-- 値 -->
              <div class="mb-2">
                <label class="block text-xs font-medium text-slate-600 mb-1">
                  値
                </label>
                <textarea
                  v-model="field.value"
                  rows="2"
                  class="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="例:18 / 皮肉屋、内心は誠実"
                ></textarea>
              </div>

              <!-- 操作ボタン -->
              <div class="flex justify-end gap-1">
                <button
                  type="button"
                  class="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  :disabled="index === 0"
                  title="上に移動"
                  @click="moveFieldUp(index)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  :disabled="index === customFields.length - 1"
                  title="下に移動"
                  @click="moveFieldDown(index)"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  @click="removeField(field.id)"
                >
                  削除
                </button>
              </div>
            </div>
          </div>

          <!-- 項目追加ボタン -->
          <button
            type="button"
            class="w-full px-3 py-2 text-sm text-blue-600 border border-dashed border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
            @click="addField"
          >
            + 項目を追加
          </button>
        </div>
      </div>

      <!-- フッター -->
      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white rounded-b-lg">
        <button
          type="button"
          class="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          @click="handleCancel"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          @click="handleSubmit"
        >
          {{ submitLabel }}
        </button>
      </div>
    </div>
  </div>
</template>