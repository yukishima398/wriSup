import { db } from '@/db'
import type { Work, WorkInput, WorkUpdate } from '@/types/work'
import { deleteScenesByWork } from '@/repositories/sceneRepository'
import { deleteForeshadowsByWork } from '@/repositories/foreshadowRepository'

/**
 * 作品を新規作成する
 * @param input タイトル、ゴール、テーマ
 * @returns 作成された作品の ID
 */
//上はJSdoc。型定義のようなものとVscodeで方が表示されるようにするのを兼ねている
export async function createWork(input: WorkInput): Promise<number> {
  const now = new Date()
  const id = await db.works.add({
    ...input,
    createdAt: now,
    updatedAt: now,
  })
  return id as number
}

/**
 * すべての作品を取得する（新しい順）
 * @returns 作品の配列
 */
export async function listWorks(): Promise<Work[]> {
  return await db.works
    .orderBy('createdAt')
    .reverse()
    .toArray()
}

/**
 * ID を指定して1件の作品を取得する
 * @param id 作品 ID
 * @returns 作品。見つからない場合は undefined
 */
export async function getWork(id: number): Promise<Work | undefined> {
  return await db.works.get(id)
}

/**
 * 作品を更新する（部分更新可能）
 * @param update id と更新したいフィールド
 */
export async function updateWork(update: WorkUpdate): Promise<void> {
  const { id, ...changes } = update
  await db.works.update(id, {
    ...changes,
    updatedAt: new Date(),
  })
}

/**
 * 作品を削除する
 * 関連するシーン・伏線も連鎖的に削除される
 *
 * @param id 削除する作品の ID
 */
export async function deleteWork(id: number): Promise<void> {
  await db.transaction('rw', db.works, db.scenes, db.foreshadows, async () => {
    // 関連データを先に削除
    await deleteForeshadowsByWork(id)
    await deleteScenesByWork(id)
    // 作品自体を削除
    await db.works.delete(id)
  })
}