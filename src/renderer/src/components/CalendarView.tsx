import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task, Space } from '../types/Task'

type CalendarMode = 'week' | 'month'

interface CalendarViewProps {
  tasks: Task[]
  spaces: Space[]
}

function toStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getMonday(date: Date): Date {
  const d = toStartOfDay(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function getMonthDates(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1)
  const monday = getMonday(firstDay)
  const weeks: Date[][] = []

  let current = new Date(monday)
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
    if (current.getMonth() > month && current.getDay() === 1) break
  }
  return weeks
}

function getWeekDates(baseDate: Date): Date[] {
  const monday = getMonday(baseDate)
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

function getSpaceColor(spaceId: number, spaces: Space[]): string {
  const space = spaces.find((s) => s.id === spaceId)
  return space?.color ?? '#FAC775'
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

export default function CalendarView({ tasks, spaces }: CalendarViewProps): JSX.Element {
  const navigate = useNavigate()
  const [mode, setMode] = useState<CalendarMode>('month')
  const [baseDate, setBaseDate] = useState(() => new Date())

  const today = useMemo(() => toStartOfDay(new Date()), [])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (!task.dueDate) continue
      const date = new Date(task.dueDate)
      if (isNaN(date.getTime())) continue
      const key = toStartOfDay(date).toISOString()
      const existing = map.get(key) ?? []
      existing.push(task)
      map.set(key, existing)
    }
    return map
  }, [tasks])

  const navigatePrev = (): void => {
    const d = new Date(baseDate)
    if (mode === 'week') d.setDate(d.getDate() - 7)
    else d.setMonth(d.getMonth() - 1)
    setBaseDate(d)
  }

  const navigateNext = (): void => {
    const d = new Date(baseDate)
    if (mode === 'week') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
    setBaseDate(d)
  }

  const goToday = (): void => setBaseDate(new Date())

  const headerLabel = mode === 'week'
    ? (() => {
        const dates = getWeekDates(baseDate)
        return `${dates[0].getMonth() + 1}/${dates[0].getDate()} - ${dates[6].getMonth() + 1}/${dates[6].getDate()}`
      })()
    : `${baseDate.getFullYear()}年 ${baseDate.getMonth() + 1}月`

  const renderDayCell = (date: Date, isCurrentMonth: boolean = true): JSX.Element => {
    const key = toStartOfDay(date).toISOString()
    const dayTasks = tasksByDate.get(key) ?? []
    const isToday = toStartOfDay(date).getTime() === today.getTime()
    const isWeekend = date.getDay() === 0 || date.getDay() === 6

    return (
      <div
        key={key}
        className={`border-r border-b border-gray-100 p-1 min-h-[80px] ${
          !isCurrentMonth ? 'bg-gray-50' : isWeekend ? 'bg-gray-50/50' : ''
        }`}
      >
        <div className={`text-xs mb-1 ${
          isToday ? 'bg-amber-400 text-white w-5 h-5 rounded-full flex items-center justify-center font-bold' :
          !isCurrentMonth ? 'text-gray-300' :
          isWeekend ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {date.getDate()}
        </div>
        <div className="space-y-0.5">
          {dayTasks.slice(0, 3).map((task) => (
            <div
              key={task.id}
              className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: `${getSpaceColor(task.spaceId, spaces)}40`, color: getSpaceColor(task.spaceId, spaces) }}
              onClick={() => navigate(`/tasks/${task.id}`)}
              title={`${task.issueKey}: ${task.title}`}
            >
              {task.issueKey.split('-').pop()} {task.title}
            </div>
          ))}
          {dayTasks.length > 3 && (
            <div className="text-[10px] text-gray-400 px-1">+{dayTasks.length - 3}件</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
          >
            ←
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 rounded transition-colors"
          >
            今日
          </button>
          <button
            onClick={navigateNext}
            className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
          >
            →
          </button>
          <span className="text-sm font-semibold text-gray-700 ml-2">{headerLabel}</span>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode('week')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'week' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            週
          </button>
          <button
            onClick={() => setMode('month')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'month' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            月
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-xs text-gray-400 py-2 border-r border-gray-100">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar body */}
      {mode === 'week' ? (
        <div className="grid grid-cols-7">
          {getWeekDates(baseDate).map((date) => renderDayCell(date))}
        </div>
      ) : (
        getMonthDates(baseDate.getFullYear(), baseDate.getMonth()).map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((date) => renderDayCell(date, date.getMonth() === baseDate.getMonth()))}
          </div>
        ))
      )}
    </div>
  )
}
