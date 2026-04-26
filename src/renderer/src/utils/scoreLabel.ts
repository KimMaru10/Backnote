// タスクのスコア（数値）を、人が読んで意味の伝わる「緊急度ラベル」へ変換する。
// しきい値は scoring.go の重み配分に合わせて決定（実運用は 0.2-0.6 が中心）。

export type ScoreLabel = {
  emoji: string
  text: string
  badgeClass: string
}

export function getScoreLabel(score: number): ScoreLabel {
  if (score >= 1.0) {
    return { emoji: '🔥', text: '今すぐ着手', badgeClass: 'bg-red-50 text-red-700' }
  }
  if (score >= 0.7) {
    return { emoji: '⚡', text: 'これからやろう', badgeClass: 'bg-orange-50 text-orange-700' }
  }
  if (score >= 0.4) {
    return { emoji: '📅', text: '計画的に', badgeClass: 'bg-blue-50 text-blue-700' }
  }
  if (score >= 0.2) {
    return { emoji: '🌱', text: '余裕あり', badgeClass: 'bg-green-50 text-green-700' }
  }
  return { emoji: '☕', text: 'いつでも', badgeClass: 'bg-gray-100 text-gray-600' }
}
