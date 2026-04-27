import { useState, useMemo } from 'react'
import type { Task, Space } from '../types/Task'
import StickyCard from './StickyCard'

type TabRange = 'all' | 'overdue' | 'today' | 'week' | 'future' | 'undated'

interface ListViewProps {
  tasks: Task[]
  spaces: Space[]
  focusedTaskIds?: Set<number>
  onTogglePin?: (taskId: number, isFocused: boolean) => void
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
      // 期限未設定は「未設定」タブに分離するので、ここでは期限ありの未来分のみ
      return tasks.filter((t) => {
        if (!t.dueDate) return false
        return new Date(t.dueDate) >= weekEnd
      })
    case 'undated':
      return tasks.filter((t) => !t.dueDate)
  }
}

const TABS: { key: TabRange; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'overdue', label: '期限切れ' },
  { key: 'today', label: '今日' },
  { key: 'week', label: '今週' },
  { key: 'future', label: '未来' },
  { key: 'undated', label: '未設定' }
]

function getSpaceColor(spaceId: number, spaces: Space[]): string {
  const space = spaces.find((s) => s.id === spaceId)
  return space?.color ?? '#FAC775'
}

function getProjectKey(issueKey: string): string {
  return issueKey.split('-')[0]
}

export default function ListView({ tasks, spaces, focusedTaskIds, onTogglePin }: ListViewProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabRange>('all')
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right')
  const [slideKey, setSlideKey] = useState(0)
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  const TAB_ORDER: TabRange[] = ['all', 'overdue', 'today', 'week', 'future', 'undated']

  const handleTabChange = (next: TabRange): void => {
    const currentIdx = TAB_ORDER.indexOf(activeTab)
    const nextIdx = TAB_ORDER.indexOf(next)
    setSlideDir(nextIdx > currentIdx ? 'right' : 'left')
    setActiveTab(next)
    setSlideKey((k) => k + 1)
  }

  const spaceFiltered = selectedSpaceId !== null
    ? tasks.filter((t) => t.spaceId === selectedSpaceId)
    : tasks

  const projectFiltered = selectedProject !== null
    ? spaceFiltered.filter((t) => getProjectKey(t.issueKey) === selectedProject)
    : spaceFiltered

  const filteredTasks = filterTasksByTab(projectFiltered, activeTab)

  const overdueCount = useMemo(
    () => tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date()).length,
    [tasks]
  )
  const undatedCount = useMemo(
    () => tasks.filter((t) => !t.dueDate).length,
    [tasks]
  )

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
            onClick={() => handleTabChange(tab.key)}
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
            {tab.key === 'undated' && undatedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] rounded-full">
                {undatedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div key={slideKey} className={slideDir === 'right' ? 'tab-slide-right' : 'tab-slide-left'}>
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
                isFocused={focusedTaskIds?.has(task.id)}
                onTogglePin={onTogglePin}
              />
            ))}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-400 text-right">
          {filteredTasks.length} / {tasks.length} タスク
        </div>
      </div>
    </div>
  )
}
