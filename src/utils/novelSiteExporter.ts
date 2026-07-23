import JSZip from 'jszip'
import type { Work } from '@/types/work'
import type { Scene } from '@/types/scene'
import { RUBY_PATTERN, escapeHtml } from '@/utils/rubyFormatter'

/**
 * 投稿先サイト
 * なろう・カクヨム・ハーメルンは同じ「｜文字《ふりがな》」記法をそのまま使う。
 * pixiv だけ独自のルビ記法「[[rb:文字 > ふりがな]]」に変換する必要がある。
 */
export type NovelSite = 'narou' | 'kakuyomu' | 'hameln' | 'pixiv'

export const NOVEL_SITE_LABELS: Record<NovelSite, string> = {
  narou: 'なろう',
  kakuyomu: 'カクヨム',
  hameln: 'ハーメルン',
  pixiv: 'pixiv',
}

export type ExportFormat = 'txt' | 'pdf'

/**
 * 「｜文字《ふりがな》」記法を pixiv のルビ記法「[[rb:文字 > ふりがな]]」に変換する
 *
 * @param text 変換対象の本文
 * @returns 変換後の本文
 */
export function convertRubyForPixiv(text: string): string {
  return text.replace(RUBY_PATTERN, (_match, base: string, ruby: string) => `[[rb:${base} > ${ruby}]]`)
}

// ファイル名に使えない文字を置き換える
function sanitizeFilename(name: string): string {
  const sanitized = name.replace(/[\\/:*?"<>|]/g, '_').trim()
  return sanitized || '無題'
}

export interface EpisodeFile {
  /** ZIP内でのファイル名(話数+タイトル) */
  filename: string
  /** 話のタイトル */
  title: string
  /** サイトの記法に変換済みの本文 */
  content: string
}

/**
 * シーン一覧を、投稿サイトの記法に変換した「1話=1ファイル」の配列に変換する
 *
 * @param scenes シーン配列(order 順)
 * @param site 投稿先サイト
 * @returns 話ごとのファイル情報の配列
 */
export function buildEpisodeFiles(scenes: Scene[], site: NovelSite): EpisodeFile[] {
  return scenes.map((scene) => {
    const title = scene.title || '無題'
    const body = site === 'pixiv' ? convertRubyForPixiv(scene.summary) : scene.summary
    const filename = `${String(scene.order + 1).padStart(3, '0')}_${sanitizeFilename(title)}.txt`
    return { filename, title, content: body }
  })
}

/**
 * 話ごとのtxtファイルをZIPにまとめてダウンロードする
 *
 * @param work 作品(ZIPファイル名に使う)
 * @param scenes シーン配列(order 順)
 * @param site 投稿先サイト
 */
export async function downloadEpisodesAsZip(work: Work, scenes: Scene[], site: NovelSite): Promise<void> {
  const files = buildEpisodeFiles(scenes, site)
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.filename, file.content)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(work.title)}_${NOVEL_SITE_LABELS[site]}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 話ごとに改ページした印刷用ページを開き、印刷ダイアログを表示する
 * (ユーザーが「PDFとして保存」を選べば、事実上のPDF出力になる)
 *
 * @param work 作品(タイトル表示に使う)
 * @param scenes シーン配列(order 順)
 * @param site 投稿先サイト
 */
export function printEpisodesForPdf(work: Work, scenes: Scene[], site: NovelSite): void {
  const files = buildEpisodeFiles(scenes, site)
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('ポップアップがブロックされました。ブラウザのポップアップブロック設定を確認してください。')
    return
  }

  const episodesHtml = files
    .map(
      (file) => `
        <section class="episode">
          <h2>${escapeHtml(file.title)}</h2>
          <pre>${escapeHtml(file.content)}</pre>
        </section>
      `
    )
    .join('')

  printWindow.document.write(`
    <!doctype html>
    <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(work.title)}</title>
      <style>
        body { font-family: "游明朝", "Yu Mincho", serif; line-height: 1.9; padding: 2rem; }
        .episode { page-break-after: always; }
        .episode:last-child { page-break-after: auto; }
        h2 { font-size: 1.1rem; margin-bottom: 1rem; }
        pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; margin: 0; }
      </style>
    </head>
    <body>${episodesHtml}</body>
    </html>
  `)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}
