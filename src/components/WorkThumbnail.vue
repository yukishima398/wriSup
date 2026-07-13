<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps<{
  thumbnail?: Blob
}>()

// thumbnail を Object URL に変換して保持
const thumbnailUrl = ref<string | null>(null)

// thumbnail の変化を監視（第一引数）,Object URL を更新(第二引数)
watch(
  () => props.thumbnail,
  (newThumbnail) => {
    // 古い URL を解放
    if (thumbnailUrl.value) {
      URL.revokeObjectURL(thumbnailUrl.value)
      thumbnailUrl.value = null
    }
    // 新しい thumbnail があれば URL を生成
    if (newThumbnail) {
      thumbnailUrl.value = URL.createObjectURL(newThumbnail)
    }
  },
  { immediate: true }
)

// コンポーネントが破棄されるときも URL を解放
onUnmounted(() => {
  if (thumbnailUrl.value) {
    URL.revokeObjectURL(thumbnailUrl.value)
  }
})
</script>

<template>
  <!--
    専用のスペースは取らず、親要素いっぱいに敷く半透明の背景画像として表示する
    (親要素には position: relative と overflow-hidden が必要、テキストは z-10 などで前面に置く)
  -->
  <div
    v-if="thumbnailUrl"
    class="absolute inset-0 overflow-hidden pointer-events-none"
    aria-hidden="true"
  >
    <img
      :src="thumbnailUrl"
      alt=""
      class="w-full h-full object-cover opacity-25 dark:opacity-20"
    />
  </div>
</template>
