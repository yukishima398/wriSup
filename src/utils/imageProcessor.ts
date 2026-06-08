/**
 * 画像処理ユーティリティ
 *
 * ユーザーがアップロードした画像を、サムネイル用に圧縮・リサイズする
 */

/** 出力する正方形画像のサイズ(ピクセル) */
const TARGET_SIZE = 128

/** JPEG 圧縮の品質(0.0 〜 1.0) */
const JPEG_QUALITY = 0.85

/**
 * 画像ファイルを 128x128 の正方形 JPEG Blob に変換する
 * 中央クロップで正方形を取得し、JPEG で圧縮する
 *
 * @param file ユーザーが選択した画像ファイル
 * @returns 圧縮された画像の Blob
 * @throws 画像でないファイル、または読み込み失敗時にエラー
 */
export async function compressToBlob(file: File): Promise<Blob> {
  // 画像かどうかチェック
  if (!file.type.startsWith('image/')) {
    throw new Error('画像ファイルを選択してください')
  }

  // File を Image にロード
  const image = await loadImage(file)

  // htmlのCanvas機能を呼び出す
  const canvas = document.createElement('canvas')
  canvas.width = TARGET_SIZE
  canvas.height = TARGET_SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas の描画コンテキスト取得に失敗しました')
  }

  // 中央クロップの計算
  const { sx, sy, sSize } = calculateCenterCrop(image.width, image.height)

  // 描画(リサイズ + クロップ)
  ctx.drawImage(
    image,
    sx, sy, sSize, sSize,           // 元画像の切り出し範囲(中央正方形)
    0, 0, TARGET_SIZE, TARGET_SIZE  // 描画先のサイズ(128x128)
  )

  // Blob として出力
  return await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY)
}

/**
 * File を HTMLImageElement に変換する内部ヘルパー
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)  // メモリ解放
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像の読み込みに失敗しました'))
    }

    img.src = url
  })
}

/**
 * 元画像の中央正方形のクロップ範囲を計算する
 */
function calculateCenterCrop(
  width: number,
  height: number
): { sx: number; sy: number; sSize: number } {
  // 短い辺を基準にする
  const sSize = Math.min(width, height)

  // 中央を計算
  const sx = (width - sSize) / 2
  const sy = (height - sSize) / 2

  return { sx, sy, sSize }
}

/**
 * Canvas を Blob に変換するヘルパー(Promise 化)
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('画像の圧縮に失敗しました'))
        }
      },
      type,
      quality
    )
  })
}