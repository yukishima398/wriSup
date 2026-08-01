<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { exportBackup, parseBackupFile, restoreBackup } from '@/utils/backup'

const { isDark, toggle } = useDarkMode()

// メニューの開閉状態
const isOpen = ref(false)
// バックアップ/復元処理中フラグ(連打防止)
const isBusy = ref(false)
// 復元用の非表示ファイル入力への参照
const restoreFileInput = ref<HTMLInputElement | null>(null)
// メニューを開くボタンへの参照(座標計算用)
const menuButtonRef = ref<HTMLButtonElement | null>(null)
// メニュー本体をbodyへteleportするため、ボタンの位置から算出した固定配置スタイル
const menuStyle = ref({ top: '0px', right: '0px' })
// タップするたびにアメのアイコンを90度ずつ回転させる(見た目の演出用。開閉ロジックとは無関係)
const iconRotation = ref(0)

function toggleMenu() {
  iconRotation.value += 90
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    // ボタンのDOM更新(開閉クラスなど)後に正確な位置を取るため次のtickで計算する
    nextTick(() => {
      const rect = menuButtonRef.value?.getBoundingClientRect()
      if (!rect) return
      menuStyle.value = {
        top: `${rect.bottom + 8}px`,
        right: `${window.innerWidth - rect.right}px`,
      }
    })
  }
}

function closeMenu() {
  isOpen.value = false
}

function handleToggleDarkMode() {
  toggle()
  closeMenu()
}

// 全データをJSONファイルとしてダウンロード
async function handleExportBackup() {
  closeMenu()
  isBusy.value = true
  try {
    await exportBackup()
  } catch (e) {
    alert(e instanceof Error ? e.message : 'バックアップの作成に失敗しました')
  } finally {
    isBusy.value = false
  }
}

// 「復元」クリック:非表示のファイル入力を開く
function openRestoreFilePicker() {
  closeMenu()
  restoreFileInput.value?.click()
}

// ファイル選択後、確認の上で全データを置き換える
async function handleRestoreFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 同じファイルを連続選択できるようにリセット

  if (!file) return

  const confirmed = window.confirm(
    'バックアップから復元しますか?\n\n現在ブラウザに保存されている全ての作品・シーン・キャラクター・伏線が、このファイルの内容で上書きされます。\nこの操作は取り消せません。'
  )
  if (!confirmed) return

  isBusy.value = true
  try {
    const data = await parseBackupFile(file)
    await restoreBackup(data)
    alert('復元が完了しました。ページを再読み込みします。')
    // 各画面がすでに読み込み済みのデータを保持しているため、確実に反映させるためリロードする
    window.location.reload()
  } catch (e) {
    alert(e instanceof Error ? e.message : '復元に失敗しました')
    isBusy.value = false
  }
}
</script>

<template>
  <div class="relative">
    <button
      ref="menuButtonRef"
      type="button"
      class="shrink-0 w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      aria-label="メニュー"
      @click="toggleMenu"
    >
      <!-- アメ(飴)のマーク:キャンディの包み紙をイメージしたアイコン。タップごとに90度回転する -->
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        class="w-6 h-6 text-emerald-600 dark:text-emerald-400 transition-transform duration-300"
        :style="{ transform: `rotate(${iconRotation}deg)` }"
        aria-hidden="true"
      >
        <path d="M8.5 12 3 7.5v9L8.5 12Z" />
        <path d="M15.5 12 21 7.5v9L15.5 12Z" />
        <circle cx="12" cy="12" r="5.5" />
      </svg>
    </button>

    <!-- headerのbackdrop-blurがfixed/absolute要素の包含ブロックを作ってしまうため-->
    <!-- 背景・メニュー本体ともにbodyへteleportし、ボタンの実座標から位置を算出する -->
    <Teleport to="body">
      <div v-if="isOpen" class="fixed inset-0 z-40" @click="closeMenu" />
      <div
        v-if="isOpen"
        class="fixed w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-50 dark:bg-slate-800 dark:border-slate-700"
        :style="menuStyle"
      >
        <button
          type="button"
          class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-slate-700"
          @click="handleToggleDarkMode"
        >
          {{ isDark ? 'ライトモードに切替' : 'ダークモードに切替' }}
        </button>
        <button
          type="button"
          class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
          :disabled="isBusy"
          @click="handleExportBackup"
        >
          バックアップファイルをDL
        </button>
        <button
          type="button"
          class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
          :disabled="isBusy"
          @click="openRestoreFilePicker"
        >
          復元
        </button>
        <input
          ref="restoreFileInput"
          type="file"
          accept="application/json"
          class="hidden"
          @change="handleRestoreFileSelected"
        />
        <div class="my-1 border-t border-slate-200 dark:border-slate-700"></div>
        <a
          href="https://marshmallow-qa.com/daj45kzxgeoynsa?t=YQrsmm&utm_medium=url_text&utm_source=promotion"
          target="_blank"
          rel="noopener noreferrer"
          class="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-slate-700"
          @click="closeMenu"
        >
          マシュマロで意見を送る
        </a>
        <a
          href="https://x.com/wrisupEX"
          target="_blank"
          rel="noopener noreferrer"
          class="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-slate-700"
          @click="closeMenu"
        >
          Xで意見を送る
        </a>
      </div>
    </Teleport>
  </div>
</template>
