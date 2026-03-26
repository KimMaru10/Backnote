import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task, Space } from '../types/Task'

const DAYS_TO_SHOW = 14
const DAY_WIDTH = 80
const ROW_HEIGHT = 36
const HOURS_PER_DAY = 8

interface GanttChartProps {
  tasks: Task[]
  spaces: Space[]
}

function toStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDay(date: Date): string {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function getSpaceColor(spaceId: number, spaces: Space[]): string {
  const space = spaces.find((s) => s.id === spaceId)
  return space?.color ?? '#FAC775'
}

function getPriorityOpacity(priority: string): number {
  switch (priority) {
    case '高': return 1.0
    case '中': return 0.7
    case '低': return 0.5
    default: return 0.7
  }
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  return date
}

export default function GanttChart({ tasks, spaces }: GanttChartProps): JSX.Element {
  const navigate = useNavigate()

  const today = useMemo(() => toStartOfDay(new Date()), [])

  const { dates, startDate } = useMemo(() => {
    const dateList: Date[] = []
    for (let i = 0; i < DAYS_TO_SHOW; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      dateList.push(d)
    }
    return { dates: dateList, startDate: today }
  }, [today])

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => b.score - a.score)
  }, [tasks])

  const totalWidth = DAYS_TO_SHOW * DAY_WIDTH

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {sortedTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">タスクがありません</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${240 + totalWidth}px` }}>
            {/* Header */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="w-60 shrink-0 px-3 py-2 border-r border-gray-200 bg-gray-50">
                <span className="text-xs font-medium text-gray-500">タスク</span>
              </div>
              <div className="flex">
                {dates.map((date, i) => {
                  const isTodayCol = toStartOfDay(date).getTime() === today.getTime()
                  return (
                    <div
                      key={i}
                      className={`text-center border-r border-gray-100 py-2 ${
                        isTodayCol ? 'bg-amber-50' : isWeekend(date) ? 'bg-gray-50' : ''
                      }`}
                      style={{ width: `${DAY_WIDTH}px` }}
                    >
                      <div className={`text-[10px] ${isTodayCol ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                        {formatDay(date)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rows */}
            {sortedTasks.map((task) => {
              const color = getSpaceColor(task.spaceId, spaces)
              const opacity = getPriorityOpacity(task.priority)
              const dueDate = parseDate(task.dueDate)
              const isOverdue = dueDate !== null && dueDate < new Date()

              let barStart = 0
              let barWidth = DAY_WIDTH
              if (dueDate) {
                const dueDateNorm = toStartOfDay(dueDate)
                const daysUntilDue = Math.round((dueDateNorm.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                const estimatedDays = Math.max(Math.ceil(task.estimatedHours / HOURS_PER_DAY), 1)
                barStart = Math.max((daysUntilDue - estimatedDays) * DAY_WIDTH, 0)
                barWidth = Math.min(estimatedDays * DAY_WIDTH, totalWidth - barStart)
              }

              return (
                <div
                  key={task.id}
                  className="flex border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  style={{ height: `${ROW_HEIGHT}px` }}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <div className="w-60 shrink-0 px-3 flex items-center gap-2 border-r border-gray-200 overflow-hidden">
                    <span className="text-[10px] text-gray-400 font-mono shrink-0">{task.issueKey}</span>
                    <span className={`text-xs truncate ${isOverdue ? 'text-red-500' : 'text-gray-700'}`}>
                      {task.title}
                    </span>
                  </div>

                  <div className="relative flex-1" style={{ minWidth: `${totalWidth}px` }}>
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                      style={{ left: `${DAY_WIDTH / 2}px` }}
                    />
                    <div
                      className="absolute top-1.5 rounded-md flex items-center px-2 overflow-hidden"
                      style={{
                        left: `${barStart}px`,
                        width: `${Math.max(barWidth, 20)}px`,
                        height: `${ROW_HEIGHT - 12}px`,
                        backgroundColor: color,
                        opacity
                      }}
                    >
                      <span className="text-[10px] text-white font-medium truncate drop-shadow-sm">
                        {task.estimatedHours > 0 ? `${task.estimatedHours}h` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
