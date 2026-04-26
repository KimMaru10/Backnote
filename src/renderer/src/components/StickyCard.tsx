import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { getScoreLabel } from '../utils/scoreLabel'

interface StickyCardProps {
  id: number
  issueKey: string
  title: string
  priority: string
  estimatedHours: number
  dueDate: string | null
  score: number
  spaceColor: string
}

function getPriorityBadge(priority: string): { label: string; className: string } {
  switch (priority) {
    case '高':
      return { label: '高', className: 'bg-rose-600 text-white' }
    case '中':
      return { label: '中', className: 'bg-orange-500 text-white' }
    case '低':
      return { label: '低', className: 'bg-slate-300 text-slate-600' }
    default:
      return { label: priority, className: 'bg-slate-200 text-slate-500' }
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
  spaceColor
}: StickyCardProps): JSX.Element {
  const navigate = useNavigate()
  const priorityBadge = getPriorityBadge(priority)
  const dueDateStr = formatDueDate(dueDate)
  const isOverdue = dueDate && new Date(dueDate) < new Date()

  const handleClick = (): void => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void }
    if (doc.startViewTransition) {
      doc.startViewTransition(() => {
        flushSync(() => {
          navigate(`/tasks/${id}`)
        })
      })
    } else {
      navigate(`/tasks/${id}`)
    }
  }

  return (
    <div
      className="sticky-card cursor-pointer"
      style={{ viewTransitionName: `task-card-${id}`, '--card-space-color': `${spaceColor}40` } as React.CSSProperties}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-2 p-1">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: spaceColor }}
          />
          <span className="text-xs text-gray-400 font-mono">{issueKey}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge.className}`}>
          {priorityBadge.label}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-800 mb-3 line-clamp-2">
        {title}
      </h3>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          {estimatedHours > 0 && (
            <span>{estimatedHours}h</span>
          )}
          {dueDateStr ? (
            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
              {dueDateStr}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              ⚠️ 期限未設定
            </span>
          )}
        </div>
        {(() => {
          const label = getScoreLabel(score)
          return (
            <span className={`text-xs px-2 py-0.5 rounded-full ${label.badgeClass}`}>
              {label.emoji} {label.text}
            </span>
          )
        })()}
      </div>
    </div>
  )
}
