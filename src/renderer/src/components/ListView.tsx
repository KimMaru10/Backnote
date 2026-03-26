import { useState } from 'react'
import type { Task } from '../types/Task'
import StickyCard from './StickyCard'

type TabRange = 'all' | 'overdue' | 'today' | 'week' | 'future'

interface Space {
  id: number
  displayName: string
  color: string
}

interface ListViewProps {
  tasks: Task[]
  spaces: Space[]
}

function filterTasksByTab(tasks: Task[], tab: TabRange): Task[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)

  switch (tab) {
    case 'all':
      return tasks
    case 'overdue':
      return tasks.filter((t) => t.dueDate && new Date(t.dueDate) < today)
    case 'today':
      return tasks.filter((t) => {
        if (!t.dueDate) return false
        const due = new Date(t.dueDate)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        return due >= today && due < tomorrow
      })
    case 'week':
      return tasks.filter((t) => {
        if (!t.dueDate) return false
        const due = new Date(t.dueDate)
        return due >= today && due < weekEnd
      })
    case 'future':
      return tasks.filter((t) => {
        if (!t.dueDate) return true
        return new Date(t.dueDate) >= weekEnd
      })
  }
}

const TABS: { key: TabRange; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'overdue', label: '期限切れ' },
  { key: 'today', label: '今日' },
  { key: 'week', label: '今週' },
  { key: 'future', label: '未来' }
]

function getSpaceColor(spaceId: number, spaces: Space[]): string {
  const space = spaces.find((s) => s.id === spaceId)
  return space?.color ?? '#FAC775'
}

function getProjectKey(issueKey: string): string {
  return issueKey.split('-')[0]
}

export default function ListView({ tasks, spaces }: ListViewProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabRange>('all')
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  const spaceFiltered = selectedSpaceId !== null
    ? tasks.filter((t) => t.spaceId === selectedSpaceId)
    : tasks

  const projectFiltered = selectedProject !== null
    ? spaceFiltered.filter((t) => getProjectKey(t.issueKey) === selectedProject)
    : spaceFiltered

  const filteredTasks = filterTasksByTab(projectFiltered, activeTab)

  const now = new Date()
  const overdueCount = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now).length

  // スペースフィルター適用後のプロジェクト一覧を抽出
  const projects = [...new Set(spaceFiltered.map((t) => getProjectKey(t.issueKey)))].sort()

  return (
    <div>
      {spaces.length > 1 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            onClick={() => { setSelectedSpaceId(null); setSelectedProject(null) }}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              selectedSpaceId === null
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全スペース
          </button>
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => { setSelectedSpaceId(space.id); setSelectedProject(null) }}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedSpaceId === space.id
                  ? 'text-white'
                  : 'text-gray-600 hover:opacity-80'
              }`}
              style={{
                backgroundColor: selectedSpaceId === space.id ? space.color : `${space.color}30`,
                borderColor: space.color
              }}
            >
              {space.displayName}
            </button>
          ))}
        </div>
      )}

      {projects.length > 1 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            onClick={() => setSelectedProject(null)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              selectedProject === null
                ? 'bg-gray-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全プロジェクト
          </button>
          {projects.map((proj) => (
            <button
              key={proj}
              onClick={() => setSelectedProject(proj)}
              className={`px-3 py-1 text-xs rounded-full font-mono transition-colors ${
                selectedProject === proj
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {proj}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors relative ${
              activeTab === tab.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.key === 'overdue' && overdueCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">
                {overdueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">タスクがありません</p>
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
              spaceColor={getSpaceColor(task.spaceId, spaces)}
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
