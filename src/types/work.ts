//データ型を１箇所で管理

/**
 * 作品（小説、シリーズなど）を表す型
 */
export interface Work {
    /** 自動採番される ID（新規作成時は未定義） */
    id?: number
  
    /** 作品タイトル */
    title: string
  
    /** 作品のゴール（最終的に何を達成するか） */
    goal: string
  
    /** 作品のテーマ */
    theme: string
  
    /** 作成日時 */
    createdAt: Date
  
    /** 最終更新日時 */
    updatedAt: Date
  }
  
  /**
   * 新規作成時に使う型（id, createdAt, updatedAt はDB側で自動設定するので除外）
   */
  export type WorkInput = Omit<Work, 'id' | 'createdAt' | 'updatedAt'>
  
  /**
   * 編集時に使う型（id は必須、title/goal/theme は変更したいものだけ指定可能）
   */
  export type WorkUpdate = Partial<WorkInput> & { id: number }