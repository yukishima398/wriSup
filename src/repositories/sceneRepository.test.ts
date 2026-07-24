import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { createScene, listScenesByWork } from '@/repositories/sceneRepository'

// テスト用の共通シーン入力(タイトルだけ差し替えて使う)
function sceneInput(workId: number, title: string) {
  return {
    workId,
    title,
    summary: '',
    worldDateTime: '',
    worldState: '',
    todoNotes: '',
    customFields: [],
    summaryHistory: [],
  }
}

describe('createScene の insertAfterSceneId', () => {
  it('指定なしなら末尾に追加される', async () => {
    const workId = 1
    const idA = await createScene(sceneInput(workId, 'A'))
    const idB = await createScene(sceneInput(workId, 'B'))

    const scenes = await listScenesByWork(workId)
    expect(scenes.map((s) => s.id)).toEqual([idA, idB])
    expect(scenes.map((s) => s.order)).toEqual([0, 1])
  })

  it('指定したシーンの直後に挿入され、以降のシーンは order が1つずつ後ろにずれる', async () => {
    const workId = 2
    const idA = await createScene(sceneInput(workId, 'A'))
    const idB = await createScene(sceneInput(workId, 'B'))
    const idC = await createScene(sceneInput(workId, 'C'))

    const idNew = await createScene(sceneInput(workId, 'NEW'), idA)

    const scenes = await listScenesByWork(workId)
    expect(scenes.map((s) => s.title)).toEqual(['A', 'NEW', 'B', 'C'])
    expect(scenes.map((s) => s.id)).toEqual([idA, idNew, idB, idC])
    expect(scenes.map((s) => s.order)).toEqual([0, 1, 2, 3])
  })

  it('存在しないシーンIDを指定するとエラーになる', async () => {
    const workId = 3
    await expect(createScene(sceneInput(workId, 'X'), 999999)).rejects.toThrow(
      '挿入先のシーンが見つかりません'
    )
  })
})
