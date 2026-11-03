import { db } from '@/db'
import { listWorks } from '@/repositories/workRepository'
import type { SearchSource } from '@/utils/textSearch'

/**
 * テキスト検索用に、全作品のデータをまとめて取得する
 * 作品はホーム画面と同じ新しい順で返す
 *
 * @returns 検索対象の全データ
 */
export async function loadSearchSource(): Promise<SearchSource> {
  const [works, scenes, chapters, characters, foreshadows, sceneCharacters] = await Promise.all([
    listWorks(),
    db.scenes.toArray(),
    db.chapters.toArray(),
    db.characters.toArray(),
    db.foreshadows.toArray(),
    db.sceneCharacters.toArray(),
  ])
  return { works, scenes, chapters, characters, foreshadows, sceneCharacters }
}
