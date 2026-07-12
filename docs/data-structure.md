# さっかのアメ データ構造(2026/7/12)

さっかのアメ はブラウザ内 IndexedDB(Dexie)にすべてのデータを保存する。
`src/db/index.ts` で定義されたテーブルと、`src/types/*.ts` の型定義をもとにしたER図。

## ER図

```mermaid
erDiagram
    WORK ||--o{ CHAPTER : "has"
    WORK ||--o{ SCENE : "has"
    WORK ||--o{ CHARACTER : "has"
    WORK ||--o{ FORESHADOW : "has"
    CHAPTER ||--o{ SCENE : "groups"
    SCENE ||--o{ SCENE_CHARACTER : "appears in"
    CHARACTER ||--o{ SCENE_CHARACTER : "appears in"
    SCENE ||--o{ FORESHADOW : "placedSceneId"
    SCENE ||--o{ FORESHADOW : "resolvedSceneId"
    SCENE ||--o{ SCENE_FIELD : "customFields (embedded)"
    SCENE ||--o{ SCENE_HISTORY_ENTRY : "summaryHistory (embedded)"
    CHARACTER ||--o{ CHARACTER_FIELD : "customFields (embedded)"

    WORK {
        number id PK
        string title
        string goal
        string theme
        Date createdAt
        Date updatedAt
    }

    CHAPTER {
        number id PK
        number workId FK
        string title
        number order
        Date createdAt
        Date updatedAt
    }

    SCENE {
        number id PK
        number workId FK
        number chapterId FK "任意・未分類ならundefined"
        string title
        string summary
        string worldDateTime "自由記述の作品内日時"
        string worldState
        string todoNotes
        number order
        Date createdAt
        Date updatedAt
    }

    SCENE_FIELD {
        string id PK "crypto.randomUUID"
        string name
        string value
    }

    SCENE_HISTORY_ENTRY {
        string value "その時点のストーリー本文"
        Date savedAt "チェックポイント日時"
    }

    CHARACTER {
        number id PK
        number workId FK
        string name
        Blob photo "任意・128x128に圧縮済み"
        Date createdAt
        Date updatedAt
    }

    CHARACTER_FIELD {
        string id PK "crypto.randomUUID"
        string name
        string value
    }

    SCENE_CHARACTER {
        number id PK
        number sceneId FK
        number characterId FK
        string intent "このシーンでのキャラの行動"
        Date createdAt
        Date updatedAt
    }

    FORESHADOW {
        number id PK
        number workId FK
        string title
        string description
        string status "planned / placed / resolved"
        number placedSceneId FK "任意"
        number resolvedSceneId FK "任意"
        Date createdAt
        Date updatedAt
    }
```

## 補足

- `SCENE_FIELD` / `SCENE_HISTORY_ENTRY` / `CHARACTER_FIELD` は独立した Dexie テーブルではなく、
  `Scene.customFields` / `Scene.summaryHistory` / `Character.customFields` として **配列でそのまま埋め込み保存**されている(JSON扱い)。
- 日付を持つフィールドは全テーブル共通で `createdAt`(作成日時)・`updatedAt`(最終更新日時)。
  `SCENE_HISTORY_ENTRY` のみ `savedAt`(ストーリー本文のチェックポイントを取った日時、入力停止3秒後に自動記録)を持つ。
- `Chapter` / `Scene` は `order` フィールドで作品内の並び順を管理(番号の入れ替えでソート)。
- `Foreshadow.status` は `planned`(構想中)→`placed`(張り済み)→`resolved`(回収済み)と遷移する。

## テーブル定義の変遷(`src/db/index.ts` の Dexie バージョン)

| version | 追加内容 |
| --- | --- |
| 1 | `works` テーブルを新規作成 |
| 2 | `scenes` テーブルを追加 |
| 3 | `foreshadows` テーブルを追加 |
| 4 | `characters` テーブルを追加 |
| 5 | `sceneCharacters`(シーン⇔キャラの多対多、複合インデックス)を追加 |
| 6 | `chapters` テーブルを追加し、`scenes` に `chapterId` インデックスを追加 |

*(Dexie のバージョン定義自体には作成日の記録がないため、上表は追加順のみを示す)*
