import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { db } from '@/db'
import { buildBackupData, restoreBackup } from '@/utils/backup'

function makeBlob(text: string, type = 'image/png'): Blob {
  return new Blob([text], { type })
}

describe('buildBackupData / restoreBackup', () => {
  it('全テーブルのデータをバックアップし、そのまま復元できる(ラウンドトリップ)', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z')

    const workId = await db.works.add({
      title: '作品A',
      goal: 'ゴール',
      theme: 'テーマ',
      thumbnail: makeBlob('thumb-data'),
      createdAt: now,
      updatedAt: now,
    })

    const chapterId = await db.chapters.add({
      workId,
      title: '第一章',
      order: 0,
      createdAt: now,
      updatedAt: now,
    })

    const sceneId = await db.scenes.add({
      workId,
      chapterId,
      title: 'シーン1',
      summary: '｜本文《ほんぶん》',
      worldDateTime: '',
      worldState: '',
      todoNotes: '',
      customFields: [],
      summaryHistory: [{ value: '過去の本文', savedAt: now }],
      order: 0,
      createdAt: now,
      updatedAt: now,
    })

    const characterId = await db.characters.add({
      workId,
      name: 'キャラA',
      customFields: [{ id: 'f1', name: '年齢', value: '17' }],
      photo: makeBlob('photo-data'),
      createdAt: now,
      updatedAt: now,
    })

    await db.sceneCharacters.add({
      sceneId,
      characterId,
      intent: '行動メモ',
      createdAt: now,
      updatedAt: now,
    })

    await db.foreshadows.add({
      workId,
      title: '伏線1',
      description: '説明',
      status: 'placed',
      placedSceneId: sceneId,
      createdAt: now,
      updatedAt: now,
    })

    const backup = await buildBackupData()

    // 全テーブルが空になった状態から復元する
    await db.works.clear()
    await db.scenes.clear()
    await db.chapters.clear()
    await db.characters.clear()
    await db.sceneCharacters.clear()
    await db.foreshadows.clear()

    await restoreBackup(backup)

    const works = await db.works.toArray()
    expect(works).toHaveLength(1)
    expect(works[0].title).toBe('作品A')
    expect(works[0].createdAt).toBeInstanceOf(Date)
    expect(works[0].thumbnail).toBeInstanceOf(Blob)
    expect(await works[0].thumbnail?.text()).toBe('thumb-data')

    const scenes = await db.scenes.toArray()
    expect(scenes).toHaveLength(1)
    expect(scenes[0].summary).toBe('｜本文《ほんぶん》')
    expect(scenes[0].chapterId).toBe(chapterId)
    expect(scenes[0].summaryHistory[0].savedAt).toBeInstanceOf(Date)

    const characters = await db.characters.toArray()
    expect(characters).toHaveLength(1)
    expect(characters[0].photo).toBeInstanceOf(Blob)
    expect(await characters[0].photo?.text()).toBe('photo-data')

    const sceneCharacters = await db.sceneCharacters.toArray()
    expect(sceneCharacters).toHaveLength(1)
    expect(sceneCharacters[0].sceneId).toBe(sceneId)
    expect(sceneCharacters[0].characterId).toBe(characterId)

    const foreshadows = await db.foreshadows.toArray()
    expect(foreshadows).toHaveLength(1)
    expect(foreshadows[0].placedSceneId).toBe(sceneId)

    const chapters = await db.chapters.toArray()
    expect(chapters).toHaveLength(1)
    expect(chapters[0].title).toBe('第一章')
  })

  it('復元は既存データを上書き(置き換え)する', async () => {
    const now = new Date()
    await db.works.clear()
    await db.works.add({ title: '古い作品', goal: '', theme: '', createdAt: now, updatedAt: now })

    const backup = await buildBackupData()
    // バックアップ後に別の作品を追加してから復元 → バックアップ時点の内容に戻るはず
    await db.works.add({ title: '復元後に消えるべき作品', goal: '', theme: '', createdAt: now, updatedAt: now })

    await restoreBackup(backup)

    const works = await db.works.toArray()
    expect(works.map((w) => w.title)).toEqual(['古い作品'])
  })
})
