import { db } from '@/db'
import type {
  Foreshadow,
  ForeshadowInput,
  ForeshadowUpdate,
  ForeshadowStatus,
} from '@/types/foreshadow'

/**
 * 伏線を新規作成する
 *
 * @param input 伏線の内容
 * @returns 作成された伏線の ID
 */
export async function createForeshadow(
  input: ForeshadowInput
): Promise<number> {
  const now = new Date()
  const id = await db.foreshadows.add({
    ...input,
    createdAt: now,
    updatedAt: now,
  })
  return id as number
}

/**
 * 指定した作品の伏線一覧を取得する(作成日順)
 *
 * @param workId 作品 ID
 * @returns 伏線の配列
 */
export async function listForeshadowsByWork(
  workId: number
): Promise<Foreshadow[]> {
  return await db.foreshadows
    .where('workId')
    .equals(workId)
    .sortBy('createdAt')
}

/**
 * ステータスでフィルタした伏線一覧を取得する
 *
 * @param workId 作品 ID
 * @param status フィルタしたいステータス
 * @returns 該当する伏線の配列
 */
export async function listForeshadowsByStatus(
  workId: number,
  status: ForeshadowStatus
): Promise<Foreshadow[]> {
  const all = await db.foreshadows
    .where('workId')
    .equals(workId)
    .toArray()
  return all.filter((f) => f.status === status)
}

/**
 * 指定シーンに紐付く伏線を取得する
 * (張られた or 回収された伏線)
 *
 * @param sceneId シーン ID
 * @returns 紐付く伏線の配列(分類済み)
 */
export async function listForeshadowsBySceneId(sceneId: number): Promise<{
  placedHere: Foreshadow[]
  resolvedHere: Foreshadow[]
}> {
  const all = await db.foreshadows.toArray()
  return {
    placedHere: all.filter((f) => f.placedSceneId === sceneId),
    resolvedHere: all.filter((f) => f.resolvedSceneId === sceneId),
  }
}

/**
 * ID を指定して1件の伏線を取得する
 *
 * @param id 伏線 ID
 * @returns 伏線。見つからない場合は undefined
 */
export async function getForeshadow(id: number): Promise<Foreshadow | undefined> {
  return await db.foreshadows.get(id)
}

/**
 * 伏線を更新する(部分更新可能)
 *
 * @param update id と更新したいフィールド
 */
export async function updateForeshadow(update: ForeshadowUpdate): Promise<void> {
  const { id, ...changes } = update
  await db.foreshadows.update(id, {
    ...changes,
    updatedAt: new Date(),
  })
}

/**
 * 伏線を削除する
 *
 * @param id 削除する伏線の ID
 */
export async function deleteForeshadow(id: number): Promise<void> {
  await db.foreshadows.delete(id)
}

/**
 * 作品に属する全伏線を削除する
 * (作品自体を削除するときに使う)
 *
 * @param workId 作品 ID
 */
export async function deleteForeshadowsByWork(workId: number): Promise<void> {
  await db.foreshadows.where('workId').equals(workId).delete()
}

/**
 * 指定シーンへの参照を全て外す
 * (シーン削除時に、孤児参照を防ぐために使う)
 *
 * @param sceneId 削除されるシーンの ID
 */
export async function clearSceneReferences(sceneId: number): Promise<void> {
  const now = new Date()

  await db.transaction('rw', db.foreshadows, async () => {
    // placedSceneId がこのシーンを指してる伏線を取得
    const placedRefs = await db.foreshadows
      .where('placedSceneId')
      .equals(sceneId)
      .toArray()

    // resolvedSceneId がこのシーンを指してる伏線を取得
    const resolvedRefs = await db.foreshadows
      .where('resolvedSceneId')
      .equals(sceneId)
      .toArray()

    // 参照を外す
    for (const f of placedRefs) {
      if (f.id !== undefined) {
        await db.foreshadows.update(f.id, {
          placedSceneId: undefined,
          updatedAt: now,
        })
      }
    }

    for (const f of resolvedRefs) {
      if (f.id !== undefined) {
        await db.foreshadows.update(f.id, {
          resolvedSceneId: undefined,
          updatedAt: now,
        })
      }
    }
  })
}