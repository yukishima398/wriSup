import type { Work } from '@/types/work'
import type { Scene } from '@/types/scene'
import type { Chapter } from '@/types/chapter'
import type { Character } from '@/types/character'
import type { Foreshadow } from '@/types/foreshadow'
import type { SceneCharacter } from '@/types/sceneCharacter'

/**
 * 検索結果の種類
 */
export type SearchKind = 'scene' | 'character' | 'foreshadow' | 'chapter' | 'work'

/** 絞り込みタブに並べる順 */
export const SEARCH_KINDS: SearchKind[] = ['scene', 'character', 'foreshadow', 'chapter', 'work']

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  scene: 'シーン',
  character: 'キャラクター',
  foreshadow: '伏線',
  chapter: '章',
  work: '作品',
}

/**
 * 検索対象の全データ(全作品分)
 */
export interface SearchSource {
  works: Work[]
  scenes: Scene[]
  chapters: Chapter[]
  characters: Character[]
  foreshadows: Foreshadow[]
  sceneCharacters: SceneCharacter[]
}

export interface SearchOptions {
  /** 大文字・小文字を区別するか */
  caseSensitive: boolean
}

/**
 * ハイライト表示用に、一致部分(match: true)とそれ以外に分けた文字列片
 */
export interface TextSegment {
  text: string
  match: boolean
}

/**
 * 本文の一致箇所の前後を切り出した抜粋(1行=1段落の範囲内で切り出す)
 */
export interface SearchSnippet {
  segments: TextSegment[]
  /** 段落の途中から切り出したか(先頭に…を付ける) */
  truncatedStart: boolean
  /** 段落の途中で切ったか(末尾に…を付ける) */
  truncatedEnd: boolean
}

/**
 * 1つの欄(ストーリー・説明など)での一致
 */
export interface SearchFieldHit {
  label: string
  matchCount: number
  snippets: SearchSnippet[]
  /** 抜粋に入りきらなかった一致の数(「他 n か所」表示用) */
  hiddenCount: number
}

/**
 * 検索結果の1件(シーン・キャラなど1項目につき1件)
 */
export interface SearchResultItem {
  key: string
  kind: SearchKind
  workId: number
  /** 遷移先の ID(シーン ID・キャラ ID など。作品なら作品 ID) */
  targetId: number
  /** タイトルを一致部分で分けたもの(タイトルが空なら空配列) */
  title: TextSegment[]
  /** タイトルの前に添える文字(シーン番号など) */
  prefix?: string
  /** タイトルの後ろに添える補足(所属する章など) */
  meta?: string
  /** タイトル以外で一致した欄 */
  fields: SearchFieldHit[]
  /** タイトルを含む一致の総数 */
  matchCount: number
}

// 抜粋で一致箇所の前後に残す文字数
const CONTEXT_BEFORE = 24
const CONTEXT_AFTER = 48
// 1つの欄で表示する抜粋の最大数
const MAX_SNIPPETS_PER_FIELD = 3

type Range = [start: number, end: number]

// 入力をそのままの文字列として探す(記号を正規表現として解釈させない)
function buildPattern(query: string, options: SearchOptions): RegExp {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped, options.caseSensitive ? 'gu' : 'giu')
}

function findRanges(text: string, pattern: RegExp): Range[] {
  return Array.from(text.matchAll(pattern), (m) => [m.index, m.index + m[0].length])
}

function toSegments(text: string, ranges: Range[], from = 0, to = text.length): TextSegment[] {
  const segments: TextSegment[] = []
  let cursor = from
  for (const [start, end] of ranges) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false })
    segments.push({ text: text.slice(start, end), match: true })
    cursor = end
  }
  if (cursor < to) segments.push({ text: text.slice(cursor, to), match: false })
  return segments
}

// 一致箇所ごとに前後を切り出す。同じ段落で近くにある一致は1つの抜粋にまとめる
function buildSnippets(text: string, ranges: Range[]): SearchSnippet[] {
  const snippets: SearchSnippet[] = []
  let i = 0

  while (i < ranges.length && snippets.length < MAX_SNIPPETS_PER_FIELD) {
    const firstStart = ranges[i][0]
    const lineStart = text.lastIndexOf('\n', firstStart - 1) + 1
    const newlineIndex = text.indexOf('\n', firstStart)
    const lineEnd = newlineIndex === -1 ? text.length : newlineIndex

    const start = Math.max(lineStart, firstStart - CONTEXT_BEFORE)
    let end = Math.min(lineEnd, ranges[i][1] + CONTEXT_AFTER)
    const group: Range[] = [ranges[i]]
    i++

    while (i < ranges.length && ranges[i][0] < end) {
      group.push(ranges[i])
      end = Math.min(lineEnd, Math.max(end, ranges[i][1] + CONTEXT_AFTER))
      i++
    }

    snippets.push({
      segments: toSegments(text, group, start, end),
      truncatedStart: start > lineStart,
      truncatedEnd: end < lineEnd,
    })
  }

  return snippets
}

function searchField(label: string, text: string | undefined, pattern: RegExp): SearchFieldHit | null {
  if (!text) return null
  const ranges = findRanges(text, pattern)
  if (ranges.length === 0) return null

  const snippets = buildSnippets(text, ranges)
  const shownCount = snippets.reduce(
    (sum, s) => sum + s.segments.filter((seg) => seg.match).length,
    0
  )
  return { label, matchCount: ranges.length, snippets, hiddenCount: ranges.length - shownCount }
}

// タイトルと各欄を検索し、どこかに一致があれば結果を1件作る
function buildItem(
  base: Pick<SearchResultItem, 'key' | 'kind' | 'workId' | 'targetId' | 'prefix' | 'meta'>,
  title: string | undefined,
  fields: Array<[label: string, text: string | undefined]>,
  pattern: RegExp
): SearchResultItem | null {
  const titleText = title ?? ''
  const titleRanges = findRanges(titleText, pattern)
  const fieldHits = fields
    .map(([label, text]) => searchField(label, text, pattern))
    .filter((hit): hit is SearchFieldHit => hit !== null)

  const matchCount = titleRanges.length + fieldHits.reduce((sum, hit) => sum + hit.matchCount, 0)
  if (matchCount === 0) return null

  return {
    ...base,
    title: toSegments(titleText, titleRanges),
    fields: fieldHits,
    matchCount,
  }
}

/**
 * 全作品の登録テキストから、query を含む項目を探す
 * 結果は作品の並び(source.works の順)→ 作品情報・章・シーン・伏線・キャラの順に並ぶ
 *
 * @param source 検索対象の全データ
 * @param query 検索語(前後の空白は無視する)
 * @param options 検索オプション
 * @returns 一致した項目の配列。query が空なら空配列
 */
export function searchTexts(source: SearchSource, query: string, options: SearchOptions): SearchResultItem[] {
  const trimmed = query.trim()
  if (trimmed === '') return []

  const pattern = buildPattern(trimmed, options)
  const results: SearchResultItem[] = []
  const push = (item: SearchResultItem | null) => {
    if (item) results.push(item)
  }

  for (const work of source.works) {
    if (work.id === undefined) continue
    push(buildItem(
      { key: `work-${work.id}`, kind: 'work', workId: work.id, targetId: work.id },
      work.title,
      [['ゴール', work.goal], ['テーマ', work.theme]],
      pattern
    ))
  }

  const chapterById = new Map<number, Chapter>()
  for (const chapter of [...source.chapters].sort((a, b) => a.order - b.order)) {
    if (chapter.id === undefined) continue
    chapterById.set(chapter.id, chapter)
    push(buildItem(
      { key: `chapter-${chapter.id}`, kind: 'chapter', workId: chapter.workId, targetId: chapter.id },
      chapter.title,
      [],
      pattern
    ))
  }

  // 登場キャラの「行動」はシーンの一部として扱う
  const characterNameById = new Map<number, string>()
  for (const character of source.characters) {
    if (character.id !== undefined) characterNameById.set(character.id, character.name)
  }
  const linksBySceneId = new Map<number, SceneCharacter[]>()
  for (const link of source.sceneCharacters) {
    const list = linksBySceneId.get(link.sceneId)
    if (list) {
      list.push(link)
    } else {
      linksBySceneId.set(link.sceneId, [link])
    }
  }

  for (const scene of [...source.scenes].sort((a, b) => a.order - b.order)) {
    if (scene.id === undefined) continue
    const chapter = scene.chapterId !== undefined ? chapterById.get(scene.chapterId) : undefined
    push(buildItem(
      {
        key: `scene-${scene.id}`,
        kind: 'scene',
        workId: scene.workId,
        targetId: scene.id,
        prefix: `#${scene.order}`,
        meta: chapter?.title,
      },
      scene.title,
      [
        ['日時', scene.worldDateTime],
        ['ストーリー', scene.summary],
        ['世界状態', scene.worldState],
        ['TODO', scene.todoNotes],
        ...(scene.customFields ?? []).map((f): [string, string] => [f.name || '項目名未設定', f.value]),
        ...(linksBySceneId.get(scene.id) ?? []).map((link): [string, string] => [
          `${characterNameById.get(link.characterId) ?? '(削除されたキャラ)'}の行動`,
          link.intent,
        ]),
      ],
      pattern
    ))
  }

  for (const foreshadow of source.foreshadows) {
    if (foreshadow.id === undefined) continue
    push(buildItem(
      { key: `foreshadow-${foreshadow.id}`, kind: 'foreshadow', workId: foreshadow.workId, targetId: foreshadow.id },
      foreshadow.title,
      [['説明', foreshadow.description]],
      pattern
    ))
  }

  for (const character of source.characters) {
    if (character.id === undefined) continue
    push(buildItem(
      { key: `character-${character.id}`, kind: 'character', workId: character.workId, targetId: character.id },
      character.name,
      (character.customFields ?? []).map((f): [string, string] => [f.name || '項目名未設定', f.value]),
      pattern
    ))
  }

  // 作品ごとにまとめる(sort は安定なので、作品内では上で積んだ順が保たれる)
  // 作品が削除済みで残ったデータは対象外にする
  const workOrder = new Map(source.works.map((w, index) => [w.id, index]))
  return results
    .filter((item) => workOrder.has(item.workId))
    .sort((a, b) => workOrder.get(a.workId)! - workOrder.get(b.workId)!)
}
