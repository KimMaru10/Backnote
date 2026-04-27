import { useNavigate } from 'react-router-dom'
import { Star, X, Sparkles } from 'lucide-react'
import type { Task, Space, FocusEntry } from '../types/Task'

const MAX_FOCUS = 3

interface DailyFocusProps {
  tasks: Task[]
  spaces: Space[]
  entries: FocusEntry[]
  loading: boolean
  onSetEntries: (taskIds: number[]) => Promise<void>
  onRemove: (taskId: number) => Promise<void>
  onComplete: (taskId: number) => Promise<void>
}

export default function DailyFocus({
  tasks,
  spaces,
  entries,
  loading,
  onSetEntries,
  onRemove,
  onComplete
}: DailyFocusProps): JSX.Element | null {
  const navigate = useNavigate()

  if (loading) return null

  // 空のときの「おすすめ採用」ボタン
  if (entries.length === 0) {
    if (tasks.length === 0) return null
    const top = tasks.slice(0, MAX_FOCUS).map((t) => t.id)
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              今日のフォーカスを決めよう
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              今日やる 3 つを決めれば、迷う時間が減ります。スコア上位 3 件をワンクリックで採用できます。
            </p>
          </div>
          <button
            onClick={() => void onSetEntries(top)}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors flex items-center gap-2 flex-shrink-0"
          >
            <Star size={14} />
            おすすめ 3 件を採用
          </button>
        </div>
      </div>
    )
  }

  const completedCount = entries.filter((e) => e.completedAt).length

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Star size={18} className="text-amber-500 fill-amber-500" />
          今日のフォーカス
          <span className="text-xs font-normal text-gray-500">
            {completedCount} / {entries.length} 完了
          </span>
        </h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {entries.map((entry) => {
          const task = entry.task
          if (!task) return null
          const space = spaces.find((s) => s.id === task.spaceId)
          const done = !!entry.completedAt
          return (
            <div
              key={entry.id}
              className={`bg-white border rounded-lg p-3 relative group transition-opacity ${
                done ? 'opacity-50 border-green-300' : 'border-amber-100 hover:border-amber-300'
              }`}
            >
              <button
                onClick={() => void onRemove(task.id)}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 transition-opacity"
                title="フォーカスから外す"
              >
                <X size={14} />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: space?.color ?? '#FAC775' }}
                />
                <span className="text-xs font-mono text-gray-400">{task.issueKey}</span>
              </div>
              <button
                onClick={() => navigate(`/tasks/${task.id}`)}
                className={`text-sm font-medium text-left line-clamp-2 hover:underline ${
                  done ? 'text-gray-500 line-through' : 'text-gray-800'
                }`}
              >
                {task.title}
              </button>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-gray-400">
                  {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                    : '期限未設定'}
                </span>
                {!done && (
                  <button
                    onClick={() => void onComplete(task.id)}
                    className="text-[11px] px-2 py-0.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-full transition-colors"
                  >
                    ✓ 完了
                  </button>
                )}
                {done && <span className="text-[11px] text-green-600 font-medium">✓ 完了</span>}
              </div>
            </div>
          )
        })}
        {entries.length < MAX_FOCUS && (
          <div className="border border-dashed border-amber-200 rounded-lg p-3 flex items-center justify-center text-xs text-gray-400">
            あと {MAX_FOCUS - entries.length} つ追加できます
          </div>
        )}
      </div>
    </div>
  )
}
