// HTML特殊文字をエスケープする(v-htmlで描画する前に必須)
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ｜文字《ふりがな》 の形式にマッチする(｜の直後から《の直前までが対象文字)
const RUBY_PATTERN = /｜([^｜\n]+?)《([^《》\n]+)》/g

/**
 * 「｜文字《ふりがな》」記法をルビ付きのHTMLに変換する
 * 先にHTMLエスケープしてから変換するので、結果はそのままv-htmlで描画してよい
 *
 * @param text ルビ記法を含むかもしれない本文
 * @returns ルビタグに変換済みのHTML文字列
 */
export function renderRubyHtml(text: string): string {
  return escapeHtml(text).replace(
    RUBY_PATTERN,
    // ブラウザ標準のrtサイズよりさらに一段階小さくする
    (_match, base: string, ruby: string) => `<ruby>${base}<rt class="text-[0.4em]">${ruby}</rt></ruby>`
  )
}
