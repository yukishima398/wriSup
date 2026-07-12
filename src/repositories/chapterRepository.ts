import { db } from '@/db'
import type { Chapter, ChapterInput, ChapterUpdate } from '@/types/chapter'

/**
 * 章を新規作成する
 * order は自動採番される(その作品内の最大order + 1)
 *
 * @param input 章の内容(order を除く全フィールド)
 * @returns 作成された章の ID
 */
export async function createChapter(input: ChapterInput): Promise<number> {
  const now = new Date()

  const lastOrder = await getMaxOrderInWork(input.workId)
  const newOrder = lastOrder + 1

  const id = await db.chapters.add({
    ...input,
    order: newOrder,
    createdAt: now,
    updatedAt: now,
  })
  return id as number
}

/**
 * 指定した作品の章一覧を取得する(order 昇順)
 *
 * @param workId 作品 ID
 * @returns 章の配列
 */
export async function listChaptersByWork(workId: number): Promise<Chapter[]> {
  return await db.chapters
    .where('workId')
    .equals(workId)
    .sortBy('order')
}

/**
 * 章を更新する(部分更新可能)
 *
 * @param update id と更新したいフィールド
 */
export async function updateChapter(update: ChapterUpdate): Promise<void> {
  const { id, ...changes } = update
  await db.chapters.update(id, {
    ...changes,
    updatedAt: new Date(),
  })
}

/**
 * 章を削除する
 * 所属していたシーンは削除せず、章の紐付けだけ外す(未分類に戻す)
 *
 * @param id 削除する章の ID
 */
export async function deleteChapter(id: number): Promise<void> {
  await db.transaction('rw', db.chapters, db.scenes, async () => {
    const linkedScenes = await db.scenes.where('chapterId').equals(id).toArray()
    const now = new Date()
    for (const scene of linkedScenes) {
      if (scene.id !== undefined) {
        await db.scenes.update(scene.id, { chapterId: undefined, updatedAt: now })
      }
    }
    await db.chapters.delete(id)
  })
}

/**
 * 作品に属する全章を削除する
 * (作品自体を削除するときに使う)
 *
 * @param workId 作品 ID
 */
export async function deleteChaptersByWork(workId: number): Promise<void> {
  await db.chapters.where('workId').equals(workId).delete()
}

/**
 * 章を1つ上に移動する
 * @param chapterId 移動対象の章ID
 */
export async function moveChapterUp(chapterId: number): Promise<void> {
  const target = await db.chapters.get(chapterId)
  if (!target) throw new Error('章が見つかりません')

  const above = await db.chapters
    .where('workId')
    .equals(target.workId)
    .filter((c) => c.order < target.order)
    .sortBy('order')
    .then((chapters) => chapters[chapters.length - 1])

  if (!above) return

  await swapOrders(target.id!, target.order, above.id!, above.order)
}

/**
 * 章を1つ下に移動する
 * @param chapterId 移動対象の章ID
 */
export async function moveChapterDown(chapterId: number): Promise<void> {
  const target = await db.chapters.get(chapterId)
  if (!target) throw new Error('章が見つかりません')

  const below = await db.chapters
    .where('workId')
    .equals(target.workId)
    .filter((c) => c.order > target.order)
    .sortBy('order')
    .then((chapters) => chapters[0])

  if (!below) return

  await swapOrders(target.id!, target.order, below.id!, below.order)
}

/**
 * 2つの章の order を入れ替える
 */
async function swapOrders(
  idA: number,
  orderA: number,
  idB: number,
  orderB: number
): Promise<void> {
  const now = new Date()
  await db.transaction('rw', db.chapters, async () => {
    await db.chapters.update(idA, { order: orderB, updatedAt: now })
    await db.chapters.update(idB, { order: orderA, updatedAt: now })
  })
}

/**
 * 指定作品内の最大 order 値を取得する
 * 章がなければ -1 を返す
 */
async function getMaxOrderInWork(workId: number): Promise<number> {
  const chapters = await db.chapters
    .where('workId')
    .equals(workId)
    .toArray()

  if (chapters.length === 0) return -1
  return Math.max(...chapters.map((c) => c.order))
}
