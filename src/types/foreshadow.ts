/**
 * 伏線のステータス
 * - planned:構想中(まだ書いてない、これから張る予定)
 * - placed:張り済み(書いた、まだ回収してない)
 * - resolved:回収済み(物語内で回収完了)
 */
export type ForeshadowStatus = 'planned' | 'placed' | 'resolved'

/**
 * 伏線を表す型
 */
export interface Foreshadow {
  /** 自動採番される ID */
  id?: number

  /** 所属する作品の ID */
  workId: number

  /** 伏線のタイトル(例:「主人公の左腕の傷」) */
  title: string

  /** 詳細な説明・メモ */
  description: string

  /** 現在のステータス */
  status: ForeshadowStatus

  /** 張ったシーンの ID(任意) */
  placedSceneId?: number

  /** 回収予定/回収済みシーンの ID(任意) */
  resolvedSceneId?: number

  /** 作成日時 */
  createdAt: Date

  /** 最終更新日時 */
  updatedAt: Date
}

/**
 * 新規作成時に使う型
 */
export type ForeshadowInput = Omit<Foreshadow, 'id' | 'createdAt' | 'updatedAt'>

/**
 * 編集時に使う型
 */
export type ForeshadowUpdate = Partial<ForeshadowInput> & { id: number }

/**
 * ステータスの表示用ラベル(日本語)。キー（Eng）で検索すると日本語のvalを返す
 */
export const FORESHADOW_STATUS_LABELS: Record<ForeshadowStatus, string> = {
  planned: '構想中',
  placed: '張り済み',
  resolved: '回収済み',
}

/**
 * ステータスの表示用カラー(Tailwind クラス)
 */
export const FORESHADOW_STATUS_COLORS: Record<ForeshadowStatus, string> = {
  planned: 'bg-slate-100 text-slate-700',
  placed: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
}