import { useState, useEffect } from 'react'
import type { Task } from '../types/Task'
import ListView from '../components/ListView'
import GanttChart from '../components/GanttChart'

type ViewMode = 'list' | 'gantt'

interface Space {
  id: number
  displayName: string
  color: string
}

function Dashboard(): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'

  const fetchTasks = async (): Promise<void> => {
    try {
      const res = await fetch(`${backendUrl}/api/tasks`)
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
      setError(null)
    } catch (_err: unknown) {
      setTasks([])
      setError('タスクの取得に失敗しました。バックエンドが起動しているか確認してください。')
    }
  }

  const fetchSpaces = async (): Promise<void> => {
    try {
      const res = await fetch(`${backendUrl}/api/spaces`)
      if (!res.ok) return
      const data = await res.json()
      setSpaces(Array.isArray(data) ? data : [])
    } catch (_err: unknown) {
      // スペース取得失敗は致命的でない
    }
  }

  const fetchSyncStatus = async (): Promise<void> => {
    try {
      const res = await fetch(`${backendUrl}/api/sync/status`)
      const data = await res.json()
      setLastSyncedAt(data.lastSyncedAt)
    } catch (_err: unknown) {
      // バックエンド未起動時は無視
    }
  }

  const handleSync = async (): Promise<void> => {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch(`${backendUrl}/api/sync`, { method: 'POST' })
      if (!res.ok) throw new Error('sync failed')
      const data = await res.json()
      setLastSyncedAt(data.lastSyncedAt)
      if (data.errors && data.errors.length > 0) {
        setError(`同期エラー: ${data.errors.join(', ')}`)
      }
      await fetchTasks()
    } catch (_err: unknown) {
      setError('同期に失敗しました。バックエンドが起動しているか確認してください。')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchSpaces()
    fetchSyncStatus()
  }, [])

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <div className="flex items-center gap-4">
          {lastSyncedAt && (
            <span className="text-sm text-gray-500">
              最終同期: {formatDate(lastSyncedAt)}
            </span>
          )}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              リスト
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'gantt' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              ガント
            </button>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-peeltask-yellow text-peeltask-text rounded-lg font-medium hover:bg-peeltask-yellow/80 disabled:opacity-50 transition-colors"
          >
            {syncing ? '同期中...' : 'Sync'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-peeltask-yellow rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-peeltask-text font-bold text-2xl">P</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Welcome to PeelTask
          </h3>
          <p className="text-gray-500">
            Backlogスペースを登録して、タスクの同期を始めましょう。
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <ListView tasks={tasks} spaces={spaces} />
      ) : (
        <GanttChart tasks={tasks} spaces={spaces} />
      )}
    </div>
  )
}

export default Dashboard
