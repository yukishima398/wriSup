/**
 * シーンの自由項目(キャラクターの customFields と同じ考え方)
 *
 * - id:クライアント側で生成する一意ID(v-for の :key 用)
 * - name:項目名(例:「視点キャラ」「使用した伏線」)
 * - value:値
 */
export interface SceneField {
    id: string
    name: string
    value: string
  }

/**
 * ストーリー欄の履歴の1件
 * 編集フォーム側で数秒の入力停止ごとにチェックポイントとして積む(サーバー通信なし)
 */
export interface SceneHistoryEntry {
    /** その時点でのストーリー本文 */
    value: string

    /** チェックポイントを取った日時 */
    savedAt: Date
  }

/**
 * シーン(物語の最小単位)を表す型
 */
export interface Scene {
    /** 自動採番される ID */
    id?: number

    /** 所属する作品の ID */
    workId: number

    /** 所属する章の ID */
    chapterId?: number

    /** シーンのタイトル */
    title: string

    /** あらすじ(本文ではなく要約) */
    summary: string

    /** 作品世界の日時(自由記述。例:「3月15日 14:00」) */
    worldDateTime: string

    /** このシーン終了時点の世界・キャラの状態メモ */
    worldState: string

    /** [TODO: 〇〇] 用の置き場 */
    todoNotes: string

    /** 自由項目の配列(視点キャラ・使用した伏線などを任意に追加) */
    customFields: SceneField[]

    /** ストーリー欄の履歴(直近 MAX_SUMMARY_HISTORY 件) */
    summaryHistory: SceneHistoryEntry[]

    /** 並び順(作品内で連番) */
    order: number

    /** 作成日時 */
    createdAt: Date

    /** 最終更新日時 */
    updatedAt: Date
  }

  /**
   * 新規作成時に使う型(id, createdAt, updatedAt はDB側で自動設定)
   */
  export type SceneInput = Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>

  /**
   * 編集時に使う型(id は必須、その他は変更したいものだけ指定可能)
   */
  export type SceneUpdate = Partial<SceneInput> & { id: number }

  /**
   * ストーリー欄の履歴を保持する最大件数(超えたら古いものから捨てる)
   */
  export const MAX_SUMMARY_HISTORY = 20

  /**
   * 新しい空の SceneField を生成するヘルパー
   * (フォームで「+ 項目を追加」したときに使う)
   */
  export function createEmptySceneField(): SceneField {
    return {
      id: crypto.randomUUID(),
      name: '',
      value: '',
    }
  }