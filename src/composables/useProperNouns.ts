import { ref, watch, type Ref } from 'vue'

// 執筆画面の「固有名詞」ボタンに結びつける語句
export interface ProperNoun {
  id: string
  name: string
  // ルビ(空文字ならルビなしで挿入する)
  reading: string
}

// 作品ごとに localStorage に保存する
function storageKey(workId: number): string {
  return `properNouns:${workId}`
}

function load(workId: number): ProperNoun[] {
  try {
    const raw = localStorage.getItem(storageKey(workId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(workId: number, nouns: ProperNoun[]) {
  try {
    localStorage.setItem(storageKey(workId), JSON.stringify(nouns))
  } catch {
    // 保存できない環境(プライベートモード等)では、その画面を開いている間だけ使える
  }
}

export function useProperNouns(workId: Ref<number>) {
  const properNouns = ref<ProperNoun[]>(load(workId.value))

  // 作品が切り替わったら、その作品の固有名詞を読み直す
  watch(workId, (id) => {
    properNouns.value = load(id)
  })

  function addProperNoun(name: string, reading: string) {
    properNouns.value = [
      ...properNouns.value,
      { id: crypto.randomUUID(), name, reading },
    ]
    save(workId.value, properNouns.value)
  }

  function removeProperNoun(id: string) {
    properNouns.value = properNouns.value.filter((n) => n.id !== id)
    save(workId.value, properNouns.value)
  }

  return { properNouns, addProperNoun, removeProperNoun }
}
