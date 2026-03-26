import { useState } from 'react'

interface StickyCardProps {
  id: number
  issueKey: string
  title: string
  priority: string
  estimatedHours: number
  dueDate: string | null
  score: number
  spaceColor: string
  onComplete: (id: number) => void
}

function getPriorityBadge(priority: string): { label: string; className: string } {
  switch (priority) {
    case '高':
      return { label: '高', className: 'bg-red-100 text-red-700' }
    case '中':
      return { label: '中', className: 'bg-yellow-100 text-yellow-700' }
    case '低':
      return { label: '低', className: 'bg-blue-100 text-blue-700' }
    default:
      return { label: priority, className: 'bg-gray-100 text-gray-700' }
  }
}

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null
  const date = new Date(dueDate)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  const formatted = `${date.getMonth() + 1}/${date.getDate()}`
  if (diffDays < 0) return `${formatted} (期限切れ)`
  if (diffDays === 0) return `${formatted} (今日)`
  if (diffDays <= 3) return `${formatted} (残${diffDays}日)`
  return formatted
}

export default function StickyCard({
  id,
  issueKey,
  title,
  priority,
  estimatedHours,
  dueDate,
  score,
  spaceColor,
  onComplete
}: StickyCardProps): JSX.Element {
  const [isPeeling, setIsPeeling] = useState(false)
  const priorityBadge = getPriorityBadge(priority)
  const dueDateStr = formatDueDate(dueDate)

  const handleComplete = (): void => {
    setIsPeeling(true)
    setTimeout(() => {
      onComplete(id)
    }, 300)
  }

  return (
    <div
      className={`sticky-card ${isPeeling ? 'sticky-card--peel' : ''}`}
      style={{ borderLeftColor: spaceColor }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-mono">{issueKey}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge.className}`}>
          {priorityBadge.label}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-800 mb-3 line-clamp-2">
        {title}
      </h3>

      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <div className="flex items-center gap-2">
          {estimatedHours > 0 && (
            <span>{estimatedHours}h</span>
          )}
          {dueDateStr && (
            <span className={dueDate && new Date(dueDate) < new Date() ? 'text-red-500 font-medium' : ''}>
              {dueDateStr}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-gray-400">
          {score.toFixed(2)}
        </span>
      </div>

      <button
        onClick={handleComplete}
        disabled={isPeeling}
        className="w-full py-1.5 text-xs font-medium rounded-md transition-colors
          bg-peeltask-yellow hover:bg-peeltask-yellow/80 text-peeltask-text
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        完了する
      </button>
    </div>
  )
}
