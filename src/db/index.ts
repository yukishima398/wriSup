//TSの仕様として、フォルダ名までを指定してインポートしようとした時、自動的にindex.tsまで読み込む
//上の仕様を生かして、そのフォルダ内にあるファイルをまとめてimportできるように

//Dexieはブラウザ標準のDBを扱いやすくするライブラリ
import Dexie, { type Table } from 'dexie'
import type { Work } from '@/types/work'
import type { Scene } from '@/types/scene'
import type { Foreshadow } from '@/types/foreshadow'

// データベースクラス。Dexieを継承して、その機能を使えるようにしている
export class WriSupDB extends Dexie {
  works!: Table<Work, number>
  scenes!: Table<Scene, number>
  foreshadows!: Table<Foreshadow, number>

  constructor() {
    super('WriSupDB')//名前

    // version 1: 初期構造。新旧のバージョンを管理することで、バージョンアップしても既存データを壊さない
    this.version(1).stores({
      works: '++id, title, createdAt',//インデックス。このデータをよく使うとdexieに関して教える
    })

    // version 2: scenes テーブルを追加
    this.version(2).stores({
      works: '++id, title, createdAt',
      scenes: '++id, workId, order, createdAt',
    })

    // version 3: foreshadows テーブルを追加
    this.version(3).stores({
      works: '++id, title, createdAt',
      scenes: '++id, workId, order, createdAt',
      foreshadows: '++id, workId, status, placedSceneId, resolvedSceneId, createdAt',
    })
  }
}

// シングルトン（アプリ全体でただ一つ）としてエクスポート
export const db = new WriSupDB()