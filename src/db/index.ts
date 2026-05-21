//TSの仕様として、フォルダ名までを指定してインポートしようとした時、自動的にindex.tsまで読み込む
//上の仕様を生かして、そのフォルダ内にあるファイルをまとめてimportできるように

//Dexieはブラウザ標準のDBを扱いやすくするライブラリ
import Dexie, { type Table } from 'dexie'
import type { Work } from '@/types/work'

// データベースクラス
export class WriSupDB extends Dexie {
  works!: Table<Work, number>

  constructor() {
    super('WriSupDB')
    this.version(1).stores({
      works: '++id, title, createdAt',
    })
  }
}

// シングルトンとしてエクスポート
export const db = new WriSupDB()