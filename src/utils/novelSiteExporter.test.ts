import { describe, it, expect } from 'vitest'
import { convertRubyForPixiv, buildEpisodeFiles } from '@/utils/novelSiteExporter'
import type { Scene } from '@/types/scene'

function scene(overrides: Partial<Scene> = {}): Scene {
  return {
    workId: 1,
    title: '',
    summary: '',
    worldDateTime: '',
    worldState: '',
    todoNotes: '',
    customFields: [],
    summaryHistory: [],
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('convertRubyForPixiv', () => {
  it('｜文字《ふりがな》を pixiv 記法に変換する', () => {
    expect(convertRubyForPixiv('｜山田太郎《やまだたろう》の')).toBe('[[rb:山田太郎 > やまだたろう]]の')
  })

  it('ルビ記法が無ければそのまま返す', () => {
    expect(convertRubyForPixiv('ただの本文です')).toBe('ただの本文です')
  })

  it('複数のルビ記法をすべて変換する', () => {
    expect(convertRubyForPixiv('｜東京《とうきょう》から｜大阪《おおさか》へ')).toBe(
      '[[rb:東京 > とうきょう]]から[[rb:大阪 > おおさか]]へ'
    )
  })
})

describe('buildEpisodeFiles', () => {
  it('シーンごとに1ファイルを生成し、なろう/カクヨム/ハーメルンはルビ記法を変換しない', () => {
    const scenes = [
      scene({ order: 0, title: '出会い', summary: '｜主人公《しゅじんこう》は歩いた' }),
      scene({ order: 1, title: '別れ', summary: '本文2' }),
    ]

    const files = buildEpisodeFiles(scenes, 'narou')

    expect(files).toEqual([
      { filename: '001_出会い.txt', title: '出会い', content: '｜主人公《しゅじんこう》は歩いた' },
      { filename: '002_別れ.txt', title: '別れ', content: '本文2' },
    ])
  })

  it('pixiv の場合はルビ記法を変換する', () => {
    const scenes = [scene({ order: 0, title: '出会い', summary: '｜主人公《しゅじんこう》は歩いた' })]

    const files = buildEpisodeFiles(scenes, 'pixiv')

    expect(files[0].content).toBe('[[rb:主人公 > しゅじんこう]]は歩いた')
  })

  it('タイトル未設定は「無題」になる', () => {
    const files = buildEpisodeFiles([scene({ order: 0, title: '' })], 'narou')
    expect(files[0].filename).toBe('001_無題.txt')
    expect(files[0].title).toBe('無題')
  })

  it('ファイル名に使えない文字は置き換える', () => {
    const files = buildEpisodeFiles([scene({ order: 0, title: '第一話/序章:始まり' })], 'narou')
    expect(files[0].filename).toBe('001_第一話_序章_始まり.txt')
  })
})
