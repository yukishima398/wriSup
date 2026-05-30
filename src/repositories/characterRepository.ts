import { db } from '@/db'
import type {
  Character,
  CharacterInput,
  CharacterUpdate,
} from '@/types/character'

/**
 * キャラクターを新規作成する
 *
 * @param input キャラクターの内容
 * @returns 作成されたキャラクターの ID
 */
export async function createCharacter(
  input: CharacterInput
): Promise<number> {
  const now = new Date()
  const id = await db.characters.add({
    ...input,
    createdAt: now,
    updatedAt: now,
  })
  return id as number
}

/**
 * 指定した作品のキャラクター一覧を取得する(作成日順)
 *
 * @param workId 作品 ID
 * @returns キャラクターの配列
 */
export async function listCharactersByWork(
  workId: number
): Promise<Character[]> {
  return await db.characters
    .where('workId')
    .equals(workId)
    .sortBy('createdAt')
}

/**
 * ID を指定して1件のキャラクターを取得する
 *
 * @param id キャラクター ID
 * @returns キャラクター。見つからない場合は undefined
 */
export async function getCharacter(
  id: number
): Promise<Character | undefined> {
  return await db.characters.get(id)
}

/**
 * キャラクターを更新する(部分更新可能)
 *
 * @param update id と更新したいフィールド
 */
export async function updateCharacter(
  update: CharacterUpdate
): Promise<void> {
  const { id, ...changes } = update
  await db.characters.update(id, {
    ...changes,
    updatedAt: new Date(),
  })
}

/**
 * キャラクターを削除する
 *
 * @param id 削除するキャラクターの ID
 */
export async function deleteCharacter(id: number): Promise<void> {
  await db.characters.delete(id)
}

/**
 * 作品に属する全キャラクターを削除する
 * (作品自体を削除するときに使う)
 *
 * @param workId 作品 ID
 */
export async function deleteCharactersByWork(workId: number): Promise<void> {
  await db.characters.where('workId').equals(workId).delete()
}