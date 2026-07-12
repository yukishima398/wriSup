import { ref, watchEffect } from 'vue'

const STORAGE_KEY = 'theme'
type Theme = 'light' | 'dark'

function getPreferredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const isDark = ref(getPreferredTheme() === 'dark')

watchEffect(() => {
  document.documentElement.classList.toggle('dark', isDark.value)
})

// ユーザーが手動で設定していない間は、OSのテーマ変更に追従させる
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (localStorage.getItem(STORAGE_KEY) === null) {
    isDark.value = e.matches
  }
})

export function useDarkMode() {
  function toggle() {
    isDark.value = !isDark.value
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  }

  return { isDark, toggle }
}
