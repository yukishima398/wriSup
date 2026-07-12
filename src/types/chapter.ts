/**
 * 章(複数シーンをまとめる単位)を表す型
 */
export interface Chapter {
    /** 自動採番される ID */
    id?: number

    /** 所属する作品の ID */
    workId: number

    /** 章タイトル(例:「第一章 出会い」) */
    title: string

    /** 並び順(作品内で連番) */
    order: number

    /** 作成日時 */
    createdAt: Date

    /** 最終更新日時 */
    updatedAt: Date
  }

  /**
   * 新規作成時に使う型(order は自動採番、id/createdAt/updatedAt はDB側で自動設定)
   */
  export type ChapterInput = Omit<Chapter, 'id' | 'order' | 'createdAt' | 'updatedAt'>

  /**
   * 編集時に使う型(id は必須、その他は変更したいものだけ指定可能)
   */
  export type ChapterUpdate = Partial<ChapterInput> & { id: number }
