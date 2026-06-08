<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

//sizeが指定されないときはmdサイズ
const props = withDefaults(
  defineProps<{
    name: string
    photo?: Blob
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'md',
  }
)

// photo を Object URL に変換して保持
const photoUrl = ref<string | null>(null)

// photo の変化を監視（第一引数）,Object URL を更新(第二引数)
watch(
  () => props.photo,
  (newPhoto) => {
    // 古い URL を解放
    if (photoUrl.value) {
      URL.revokeObjectURL(photoUrl.value)
      photoUrl.value = null
    }
    // 新しい photo があれば URL を生成
    if (newPhoto) {
      photoUrl.value = URL.createObjectURL(newPhoto)
    }
  },
  { immediate: true }
)

// コンポーネントが破棄されるときも URL を解放
onUnmounted(() => {
  if (photoUrl.value) {
    URL.revokeObjectURL(photoUrl.value)
  }
})

// イニシャル(名前の先頭1文字)
const initial = computed(() => {
  return props.name.trim().charAt(0) || '?'
})

// サイズに応じた Tailwind クラス
const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-8 h-8 text-sm'
    case 'lg':
      return 'w-24 h-24 text-3xl'
    default:
      return 'w-12 h-12 text-lg'
  }
})

// イニシャル用の背景色
const backgroundColor = computed(() => {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-violet-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-pink-500',
  ]
  const sum = Array.from(props.name).reduce(
    (acc, c) => acc + c.charCodeAt(0),
    0
  )
  return colors[sum % colors.length]
})
</script>

<template>
  <div
    class="rounded-full flex items-center justify-center overflow-hidden shrink-0"
    :class="sizeClasses"
  >
    <!-- 画像がある場合 -->
    <img
      v-if="photoUrl"
      :src="photoUrl"
      :alt="name"
      class="w-full h-full object-cover"
    />
    <!-- 画像がない場合はイニシャル -->
    <div
      v-else
      class="w-full h-full text-white font-semibold flex items-center justify-center"
      :class="backgroundColor"
    >
      {{ initial }}
    </div>
  </div>
</template>