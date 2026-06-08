/**
 * シーンとキャラクターの紐付け
 *
 * 1シーンに複数キャラ、1キャラに複数シーン(多対多)
 * 各組み合わせに「思惑」という固有情報を持つ
 */
export interface SceneCharacter {
    /** 自動採番される ID */
    id?: number
  
    /** 紐付け対象のシーン ID */
    sceneId: number
  
    /** 紐付け対象のキャラクター ID */
    characterId: number
  
    /**
     * このシーンにおけるこのキャラの思惑
     * 長文可、改行可、メモやモノローグも記述できる
     */
    intent: string
  
    /** 作成日時 */
    createdAt: Date
  
    /** 最終更新日時 */
    updatedAt: Date
  }
  
  /**
   * 新規作成時に使う型。自動採番される情報はomitしておく
   */
  export type SceneCharacterInput = Omit<
    SceneCharacter,
    'id' | 'createdAt' | 'updatedAt'
  >
  
  /**
   * 編集時に使う型。partialでidは必須、それ以外は任意にしておく
   */
  export type SceneCharacterUpdate = Partial<SceneCharacterInput> & {
    id: number
  }