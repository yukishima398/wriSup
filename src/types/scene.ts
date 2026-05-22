/**
 * シーン(物語の最小単位)を表す型
 */
export interface Scene {
    /** 自動採番される ID */
    id?: number
  
    /** 所属する作品の ID */
    workId: number
  
    /** 所属する章の ID(将来用、現状は未使用) */
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