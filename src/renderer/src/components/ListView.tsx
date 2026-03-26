import { useState } from 'react'
import StickyCard from './StickyCard'

interface Task {
  id: number
  issueKey: string
  title: string
  priority: string
  estimatedHours: number
  dueDate: string | null
  status: string
  score: number
  spaceId: number
}

type TabRange = 'today' | 'week' | 'nextWeek'

interface ListViewProps {
  tasks: Task[]
  onComplete: (id: number) => void
}

function getDateRange(tab: TabRange): { start: Date; end: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (tab) {
    case 'today': {
      const end = new Date(today)
      end.setDate(end.getDate() + 1)
      return { start: today, end }
    }
    case 'week': {
      const dayOfWeek = today.getDay()
      const monday = new Date(today)
      monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 7)
      return { start: monday, end: sunday }
    }
    case 'nextWeek': {
      const dayOfWeek = today.getDay()
      const nextMonday = new Date(today)
      nextMonday.setDate(nextMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + 7)
      const nextSunday = new Date(nextMonday)
      nextSunday.setDate(nextSunday.getDate() + 7)
      return { start: nextMonday, end: nextSunday }
    }
  }
}

function filterTasksByRange(tasks: Task[], tab: TabRange): Task[] {
  if (tab === 'today') {
    return tasks
  }

  const { start, end } = getDateRange(tab)
  return tasks.filter((task) => {
    if (!task.dueDate) return tab === 'week'
    const due = new Date(task.dueDate)
    return due >= start && due < end
  })
}

const TABS: { key: TabRange; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '今週' },
  { key: 'nextWeek', label: '来週' }
]

const SPACE_COLORS = [
  '#FAC775', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'
]

function getSpaceColor(spaceId: number): string {
  return SPACE_COLORS[spaceId % SPACE_COLORS.length]
}

export default function ListView({ tasks, onComplete }: ListViewProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabRange>('today')

  const filteredTasks = filterTasksByRange(tasks, activeTab)

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">タスクがありません</p>
          <p className="text-sm">
            {activeTab === 'today' && 'すべてのタスクが完了しています'}
            {activeTab === 'week' && '今週の期限のタスクはありません'}
            {activeTab === 'nextWeek' && '来週の期限のタスクはありません'}
          </p>
        </div>
      ) : (
        <div className="sticky-card-list grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <StickyCard
              key={task.id}
              id={task.id}
              issueKey={task.issueKey}
              title={task.title}
              priority={task.priority}
              estimatedHours={task.estimatedHours}
              dueDate={task.dueDate}
              score={task.score}
              spaceColor={getSpaceColor(task.spaceId)}
              onComplete={onComplete}
            />
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400 text-right">
        {filteredTasks.length} / {tasks.length} タスク
      </div>
    </div>
  )
}
