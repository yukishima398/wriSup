import { describe, it, expect } from 'vitest'
import { searchTexts, type SearchSource, type SearchSnippet } from '@/utils/textSearch'
import type { Scene } from '@/types/scene'
import type { Work } from '@/types/work'

const now = new Date('2026-01-01T00:00:00.000Z')

function work(overrides: Partial<Work> = {}): Work {
  return { id: 1, title: '', goal: '', theme: '', createdAt: now, updatedAt: now, ...overrides }
}

function scene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 1,
    workId: 1,
    title: '',
    summary: '',
    worldDateTime: '',
    worldState: '',
    todoNotes: '',
    customFields: [],
    summaryHistory: [],
    order: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function source(overrides: Partial<SearchSource> = {}): SearchSource {
  return {
    works: [work()],
    scenes: [],
    chapters: [],
    characters: [],
    foreshadows: [],
    sceneCharacters: [],
    ...overrides,
  }
}

// 抜粋を「…前[一致]後…」の形の文字列にして比較しやすくする
function snippetText(snippet: SearchSnippet): string {
  const body = snippet.segments.map((s) => (s.match ? `[${s.text}]` : s.text)).join('')
  return `${snippet.truncatedStart ? '…' : ''}${body}${snippet.truncatedEnd ? '…' : ''}`
}

describe('searchTexts', () => {
  it('空白だけの検索語では何も返さない', () => {
    expect(searchTexts(source({ scenes: [scene({ summary: 'abc' })] }), '  ', { caseSensitive: false })).toEqual([])
  })

  it('シーン・キャラ・伏線・章・作品情報を横断して探す', () => {
    const results = searchTexts(
      source({
        works: [work({ goal: '魔王を倒す' })],
        chapters: [{ id: 5, workId: 1, title: '魔王城', order: 1, createdAt: now, updatedAt: now }],
        scenes: [scene({ id: 2, summary: '魔王が現れた' })],
        characters: [{
          id: 3, workId: 1, name: '勇者',
          customFields: [{ id: 'f', name: '目的', value: '魔王討伐' }],
          createdAt: now, updatedAt: now,
        }],
        foreshadows: [{
          id: 4, workId: 1, title: '剣の正体', description: '魔王の剣', status: 'planned',
          createdAt: now, updatedAt: now,
        }],
      }),
      '魔王',
      { caseSensitive: false }
    )

    expect(results.map((r) => r.key)).toEqual([
      'work-1',
      'chapter-5',
      'scene-2',
      'foreshadow-4',
      'character-3',
    ])
    expect(results.find((r) => r.kind === 'character')?.fields[0].label).toBe('目的')
  })

  it('シーンに登場するキャラの行動もそのシーンの一致として扱う', () => {
    const [result] = searchTexts(
      source({
        scenes: [scene({ id: 7 })],
        characters: [{ id: 3, workId: 1, name: 'アリス', customFields: [], createdAt: now, updatedAt: now }],
        sceneCharacters: [{ id: 1, sceneId: 7, characterId: 3, intent: '扉を開ける', createdAt: now, updatedAt: now }],
      }),
      '扉',
      { caseSensitive: false }
    )

    expect(result.key).toBe('scene-7')
    expect(result.fields[0].label).toBe('アリスの行動')
  })

  it('大文字・小文字の区別を切り替えられる', () => {
    const data = source({ scenes: [scene({ summary: 'Hello hello' })] })

    expect(searchTexts(data, 'hello', { caseSensitive: false })[0].matchCount).toBe(2)
    expect(searchTexts(data, 'hello', { caseSensitive: true })[0].matchCount).toBe(1)
  })

  it('記号を含む検索語も文字どおりに探す', () => {
    const data = source({ scenes: [scene({ summary: '「えっ!?」(驚き)' })] })

    expect(searchTexts(data, '!?', { caseSensitive: false })[0].matchCount).toBe(1)
    expect(searchTexts(data, '(驚き)', { caseSensitive: false })[0].matchCount).toBe(1)
  })

  it('タイトルの一致部分を分割して返す', () => {
    const [result] = searchTexts(source({ scenes: [scene({ title: '雨の日の約束' })] }), '約束', { caseSensitive: false })

    expect(result.title).toEqual([
      { text: '雨の日の', match: false },
      { text: '約束', match: true },
    ])
    expect(result.fields).toEqual([])
  })

  it('抜粋は段落の中で前後を切り出し、近くの一致は1つにまとめる', () => {
    const summary = [
      '前の段落',
      'あ'.repeat(30) + '鍵と鍵' + 'い'.repeat(60),
      '鍵',
    ].join('\n')
    const [result] = searchTexts(source({ scenes: [scene({ summary })] }), '鍵', { caseSensitive: false })
    const field = result.fields[0]

    expect(field.matchCount).toBe(3)
    expect(field.snippets.map(snippetText)).toEqual([
      '…' + 'あ'.repeat(24) + '[鍵]と[鍵]' + 'い'.repeat(48) + '…',
      '[鍵]',
    ])
    expect(field.hiddenCount).toBe(0)
  })

  it('抜粋に入りきらない一致の数を返す', () => {
    const summary = Array.from({ length: 5 }, () => '鍵').join('\n')
    const [result] = searchTexts(source({ scenes: [scene({ summary })] }), '鍵', { caseSensitive: false })

    expect(result.fields[0].snippets).toHaveLength(3)
    expect(result.fields[0].hiddenCount).toBe(2)
  })

  it('作品の並び順でまとめ、作品内はシーン番号順に並べる', () => {
    const results = searchTexts(
      source({
        works: [work({ id: 2 }), work({ id: 1 })],
        scenes: [
          scene({ id: 10, workId: 1, order: 2, summary: '星' }),
          scene({ id: 11, workId: 1, order: 1, summary: '星' }),
          scene({ id: 12, workId: 2, order: 1, summary: '星' }),
        ],
      }),
      '星',
      { caseSensitive: false }
    )

    expect(results.map((r) => r.key)).toEqual(['scene-12', 'scene-11', 'scene-10'])
  })

  it('削除済みの作品に残ったデータは対象外にする', () => {
    const results = searchTexts(
      source({ scenes: [scene({ workId: 99, summary: '星' })] }),
      '星',
      { caseSensitive: false }
    )

    expect(results).toEqual([])
  })
})
