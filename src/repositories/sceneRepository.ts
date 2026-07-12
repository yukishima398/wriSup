import { db } from '@/db'
import type { Scene, SceneInput, SceneUpdate } from '@/types/scene'
import { deleteSceneCharactersByScene } from '@/repositories/sceneCharacterRepository'

/**
 * シーンを新規作成する
 * order は自動採番される(その作品内の最大order + 1)
 *
 * @param input シーンの内容(order を除く全フィールド)
 * @returns 作成されたシーンの ID
 */
export async function createScene(
  input: Omit<SceneInput, 'order'>//orderは自動採番。入力させない
): Promise<number> {
  const now = new Date()

  // 同じ作品内の最大 order を取得して +1
  const lastOrder = await getMaxOrderInWork(input.workId)
  const newOrder = lastOrder + 1

  const id = await db.scenes.add({
    ...input,
    order: newOrder,
    createdAt: now,
    updatedAt: now,
  })
  return id as number
}

/**
 * 指定した作品のシーン一覧を取得する(order 昇順)
 *
 * @param workId 作品 ID
 * @returns シーンの配列
 */
export async function listScenesByWork(workId: number): Promise<Scene[]> {
  return await db.scenes
  //workIDと指定値が等しいレコードを、dbからorder順に並べて取得
    .where('workId')
    .equals(workId)
    .sortBy('order')
}

/**
 * ID を指定して1件のシーンを取得する
 *
 * @param id シーン ID
 * @returns シーン。見つからない場合は undefined
 */
export async function getScene(id: number): Promise<Scene | undefined> {
  return await db.scenes.get(id)
}

/**
 * シーンを更新する(部分更新可能)
 *
 * @param update id と更新したいフィールド
 */
export async function updateScene(update: SceneUpdate): Promise<void> {
  const { id, ...changes } = update
  await db.scenes.update(id, {
    ...changes,
    updatedAt: new Date(),
  })
}

/**
 * シーンを削除、キャラが登場するかも削除
 *
 * @param id 削除するシーンの ID
 */
export async function deleteScene(id: number): Promise<void> {
  //rw→ReadWriteモード
  await db.transaction('rw', db.scenes, db.sceneCharacters, async () => {
    // シーンとキャラの紐付けを先に削除（ゴミを残さない）
    await deleteSceneCharactersByScene(id)
    await db.scenes.delete(id)
  })
}

/**
 * 作品に属する全シーンを削除する
 * (作品自体を削除するときに使う)
 *
 * @param workId 作品 ID
 */
export async function deleteScenesByWork(workId: number): Promise<void> {
  await db.scenes.where('workId').equals(workId).delete()
}

// ─── 内部用ヘルパー関数 ───

/**
 * 2つのシーンの order を入れ替える
 * 章フィルタ表示中は「表示中のリストでの隣」を渡せば、章内での並び替えになる
 *
 * @param sceneIdA 入れ替えるシーンA
 * @param sceneIdB 入れ替えるシーンB
 */
export async function swapSceneOrders(sceneIdA: number, sceneIdB: number): Promise<void> {
  const [a, b] = await Promise.all([db.scenes.get(sceneIdA), db.scenes.get(sceneIdB)])
  if (!a || !b) throw new Error('シーンが見つかりません')

  const now = new Date()
  await db.transaction('rw', db.scenes, async () => {
    await db.scenes.update(sceneIdA, { order: b.order, updatedAt: now })
    await db.scenes.update(sceneIdB, { order: a.order, updatedAt: now })
  })
}

/**
 * 指定作品内の最大 order 値を取得する
 * シーンがなければ 0 を返す
 */
async function getMaxOrderInWork(workId: number): Promise<number> {
  //promiseは非同期処理終了時にその型で返すことを約束する
    const scenes = await db.scenes
    .where('workId')
    .equals(workId)
    .toArray()

    if (scenes.length === 0) return -1
    return Math.max(...scenes.map((s) => s.order))
}