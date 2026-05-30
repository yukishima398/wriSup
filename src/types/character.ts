/**
 * キャラクターの自由項目(年齢、性格、好物 など)
 *
 * - id:クライアント側で生成する一意ID(v-for の :key 用)可変フィールドを v-for でループ表示するとき、Vue は :key を必要とする。
 * - name:項目名(例:「年齢」「性格」)
 * - value:値(例:「18」「皮肉屋」)
 */
export interface CharacterField {
    id: string
    name: string
    value: string
  }
  
  /**
   * キャラクターを表す型
   */
  export interface Character {
    /** 自動採番される ID */
    id?: number
  
    /** 所属する作品の ID */
    workId: number
  
    /** キャラクター名(必須) */
    name: string
  
    /** 自由項目の配列(年齢・性格・関係性などを任意に追加) */
    customFields: CharacterField[]
  
    /** 作成日時 */
    createdAt: Date
  
    /** 最終更新日時 */
    updatedAt: Date
  }
  
  /**
   * 新規作成時に使う型
   */
  export type CharacterInput = Omit<Character, 'id' | 'createdAt' | 'updatedAt'>
  
  /**
   * 編集時に使う型
   */
  export type CharacterUpdate = Partial<CharacterInput> & { id: number }
  
  /**
   * 新しい空の CharacterField を生成するヘルパー
   * (フォームで「+ 項目を追加」したときに使う)
   */
  export function createEmptyField(): CharacterField {
    return {
      id: crypto.randomUUID(),
      name: '',
      value: '',
    }
  }