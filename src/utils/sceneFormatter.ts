import type { Work } from '@/types/work'
import type { Scene } from '@/types/scene'

/**
 * 作品とシーン一覧を、コピペ用のテキストに変換する
 *
 * @param work 作品
 * @param scenes シーン配列(order 順)
 * @returns 整形されたテキスト
 */
export function formatScenesAsText(work: Work, scenes: Scene[]): string {
  const lines: string[] = []

  // 作品ヘッダー
  lines.push(`=== ${work.title} ===`)
  lines.push('')

  if (work.goal) {
    lines.push(`ゴール:${work.goal}`)
  }
  if (work.theme) {
    lines.push(`テーマ:${work.theme}`)
  }

  if (work.goal || work.theme) {
    lines.push('')
  }

  lines.push('────────────────────────')
  lines.push('')

  // 各シーン
  for (const scene of scenes) {
    // タイトル行
    lines.push(`#${scene.order} ${scene.title || '無題'}`)

    // 時系列
    if (scene.worldDateTime) {
      lines.push(`🕐 ${scene.worldDateTime}`)
    }

    lines.push('')

    // あらすじ
    if (scene.summary) {
      lines.push('【あらすじ】')
      lines.push(scene.summary)
      lines.push('')
    }

    // 世界状態
    if (scene.worldState) {
      lines.push('【世界状態】')
      lines.push(scene.worldState)
      lines.push('')
    }

    // TODO
    if (scene.todoNotes) {
      lines.push('【TODO】')
      lines.push(scene.todoNotes)
      lines.push('')
    }

    lines.push('────────────────────────')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 作品とシーン一覧を、コピペ用のテキストに変換する
 *
 * @param work 作品
 * @param scenes シーン配列(order 順)
 * @returns 整形されたテキスト
 */
export function formatSceneAsText(scene: Scene): string {
  const lines: string[] = []

    // タイトル行
    lines.push(`#${scene.order} ${scene.title || '無題'}`)

    // あらすじ
    if (scene.summary) {
      lines.push('【あらすじ】')
      lines.push(scene.summary)
      lines.push('')
    }

    // 時系列
    if (scene.worldDateTime) {
      lines.push(`🕐 ${scene.worldDateTime}`)
    }
    lines.push('')

    // 世界状態
    if (scene.worldState) {
      lines.push('【世界状態】')
      lines.push(scene.worldState)
      lines.push('')
    }
      // TODO
      if (scene.todoNotes) {
        lines.push('【TODO】')
        lines.push(scene.todoNotes)
        lines.push('')
      }
    lines.push('')

    return lines.join('\n')
}