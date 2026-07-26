import { db } from '@/db'
import type { Work } from '@/types/work'
import type { Scene } from '@/types/scene'
import type { Chapter } from '@/types/chapter'
import type { Character } from '@/types/character'
import type { SceneCharacter } from '@/types/sceneCharacter'
import type { Foreshadow } from '@/types/foreshadow'

const BACKUP_VERSION = 1

// JSONに入れられないBlob(サムネイル・キャラ写真)を、base64文字列にして持ち回るための型
interface SerializedBlob {
  base64: string
  type: string
}

type BackupWork = Omit<Work, 'thumbnail'> & { thumbnail?: SerializedBlob }
type BackupCharacter = Omit<Character, 'photo'> & { photo?: SerializedBlob }

export interface BackupData {
  version: number
  exportedAt: string
  works: BackupWork[]
  scenes: Scene[]
  chapters: Chapter[]
  characters: BackupCharacter[]
  sceneCharacters: SceneCharacter[]
  foreshadows: Foreshadow[]
}

// btoa/atobはNode(vitest)・ブラウザどちらのグローバルにも存在するため、FileReaderやURLに依存せずBlobを変換できる
async function blobToSerialized(blob: Blob): Promise<SerializedBlob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return { base64: btoa(binary), type: blob.type }
}

function serializedToBlob(serialized: SerializedBlob): Blob {
  const binary = atob(serialized.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: serialized.type })
}

/**
 * 全テーブルを読み出し、バックアップ用のデータ構造に変換する
 * (Blobはbase64化するのでJSON.stringifyにそのまま渡せる)
 */
export async function buildBackupData(): Promise<BackupData> {
  const [works, scenes, chapters, characters, sceneCharacters, foreshadows] = await Promise.all([
    db.works.toArray(),
    db.scenes.toArray(),
    db.chapters.toArray(),
    db.characters.toArray(),
    db.sceneCharacters.toArray(),
    db.foreshadows.toArray(),
  ])

  const backupWorks: BackupWork[] = await Promise.all(
    works.map(async ({ thumbnail, ...rest }) => ({
      ...rest,
      thumbnail: thumbnail ? await blobToSerialized(thumbnail) : undefined,
    }))
  )

  const backupCharacters: BackupCharacter[] = await Promise.all(
    characters.map(async ({ photo, ...rest }) => ({
      ...rest,
      photo: photo ? await blobToSerialized(photo) : undefined,
    }))
  )

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    works: backupWorks,
    scenes,
    chapters,
    characters: backupCharacters,
    sceneCharacters,
    foreshadows,
  }
}

/**
 * バックアップデータをJSONファイルとしてダウンロードする(ブラウザ専用処理)
 */
export function downloadBackupFile(data: BackupData): void {
  const json = JSON.stringify(data)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sakka-no-ame-backup_${data.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 全データをバックアップ用JSONファイルとしてダウンロードする
 */
export async function exportBackup(): Promise<void> {
  const data = await buildBackupData()
  downloadBackupFile(data)
}

/**
 * バックアップファイル(File)を読み込んでパース・簡易検証する
 */
export async function parseBackupFile(file: File): Promise<BackupData> {
  const text = await file.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('ファイルの形式が正しくありません(JSONとして読み込めません)')
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    !Array.isArray((data as BackupData).works) ||
    !Array.isArray((data as BackupData).scenes)
  ) {
    throw new Error('バックアップファイルの形式が正しくありません')
  }

  return data as BackupData
}

// createdAt/updatedAtをJSON文字列からDateに戻す
function reviveDates<T extends { createdAt: unknown; updatedAt: unknown }>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  }))
}

/**
 * バックアップデータで全データを置き換える
 * 既存の全作品・シーン・章・キャラ・伏線・紐付けは削除され、バックアップの内容で上書きされる
 */
export async function restoreBackup(data: BackupData): Promise<void> {
  const works: Work[] = await Promise.all(
    data.works.map(async ({ thumbnail, ...rest }) => ({
      ...rest,
      thumbnail: thumbnail ? serializedToBlob(thumbnail) : undefined,
    }))
  )

  const characters: Character[] = await Promise.all(
    data.characters.map(async ({ photo, ...rest }) => ({
      ...rest,
      photo: photo ? serializedToBlob(photo) : undefined,
    }))
  )

  const scenes: Scene[] = data.scenes.map((scene) => ({
    ...scene,
    summaryHistory: (scene.summaryHistory ?? []).map((entry) => ({
      ...entry,
      savedAt: new Date(entry.savedAt as unknown as string),
    })),
  }))

  await db.transaction(
    'rw',
    [db.works, db.scenes, db.chapters, db.characters, db.sceneCharacters, db.foreshadows],
    async () => {
      await db.works.clear()
      await db.scenes.clear()
      await db.chapters.clear()
      await db.characters.clear()
      await db.sceneCharacters.clear()
      await db.foreshadows.clear()

      await db.works.bulkPut(reviveDates(works))
      await db.scenes.bulkPut(reviveDates(scenes))
      await db.chapters.bulkPut(reviveDates(data.chapters))
      await db.characters.bulkPut(reviveDates(characters))
      await db.sceneCharacters.bulkPut(reviveDates(data.sceneCharacters))
      await db.foreshadows.bulkPut(reviveDates(data.foreshadows))
    }
  )
}
