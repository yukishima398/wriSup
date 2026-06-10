import { db } from '@/db'
import type {
  SceneCharacter,
  SceneCharacterInput,
  SceneCharacterUpdate,
} from '@/types/sceneCharacter'

/**
 * シーンとキャラを紐付ける
 * 既に同じ組み合わせがあれば例外を投げる
 *
 * @param input 紐付けの内容
 * @returns 作成された紐付けの ID
 */
export async function createSceneCharacter(
  input: SceneCharacterInput
): Promise<number> {
  // 重複チェック
  const existing = await db.sceneCharacters
    .where('[sceneId+characterId]')//条件を指定
    .equals([input.sceneId, input.characterId])//条件に一致するか調べる箇所を指定
    .first()//最初に見つかった1件、またはundifinedを返す

  if (existing) {
    throw new Error('このキャラは既にこのシーンに登録されています')
  }

  const now = new Date()
  const id = await db.sceneCharacters.add({
    ...input,
    createdAt: now,
    updatedAt: now,
  })
  return id as number
}

/**
 * シーンに紐付くキャラ一覧を取得する(作成日順)
 *
 * @param sceneId シーン ID
 * @returns 紐付けの配列
 */
export async function listSceneCharactersByScene(
  sceneId: number
): Promise<SceneCharacter[]> {
  return await db.sceneCharacters
    .where('sceneId')
    .equals(sceneId)
    .sortBy('createdAt')//ここまで絞り込まれたデータを作られた順に並び替える
}

/**
 * キャラが登場するシーンの紐付け一覧を取得する
 * (シーンの order 順で並べる用途を想定)
 *
 * @param characterId キャラ ID
 * @returns 紐付けの配列
 */
export async function listSceneCharactersByCharacter(
  characterId: number
): Promise<SceneCharacter[]> {
  return await db.sceneCharacters
    .where('characterId')
    .equals(characterId)
    .toArray()//並び替えは行わず、そのまま配列に組み込んでいる
}

/**
 * 紐付けを更新する(主に思惑の編集)
 *
 * @param update id と更新したいフィールド
 */
export async function updateSceneCharacter(
  update: SceneCharacterUpdate
): Promise<void> {
  const { id, ...changes } = update
  await db.sceneCharacters.update(id, {
    ...changes,
    updatedAt: new Date(),
  })
}

/**
 * 紐付けを削除する
 *
 * @param id 紐付けの ID
 */
export async function deleteSceneCharacter(id: number): Promise<void> {
  await db.sceneCharacters.delete(id)
}

/**
 * シーンに紐付く全紐付けを削除する
 * (シーン自体を削除するときのカスケード用)
 *
 * @param sceneId シーン ID
 */
export async function deleteSceneCharactersByScene(
  sceneId: number
): Promise<void> {
  await db.sceneCharacters.where('sceneId').equals(sceneId).delete()
}

/**
 * キャラに紐付く全紐付けを削除する
 * (キャラ自体を削除するときのカスケード用)
 *
 * @param characterId キャラ ID
 */
export async function deleteSceneCharactersByCharacter(
  characterId: number
): Promise<void> {
  await db.sceneCharacters.where('characterId').equals(characterId).delete()
}

/**
 * 作品に属する全 sceneCharacter を取得する
 * (作品単位でまとめて取って、UI側で分けて使う用)
 *
 * @param sceneIds その作品に属するシーンの ID 配列
 * @returns sceneCharacter（キャラ+思惑） の配列
 */
export async function listSceneCharactersByWork(
  sceneIds: number[]
): Promise<SceneCharacter[]> {
  if (sceneIds.length === 0) return []
  return await db.sceneCharacters
    .where('sceneId')
    .anyOf(sceneIds)
    .toArray()
}