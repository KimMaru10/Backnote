import { useState, useEffect } from 'react'

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

function Dashboard(): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'

  const fetchTasks = async (): Promise<void> => {
    try {
      const res = await fetch(`${backendUrl}/api/tasks`)
      const data = await res.json()
      setTasks(data)
      setError(null)
    } catch (_err: unknown) {
      setTasks([])
      setError('タスクの取得に失敗しました。バックエンドが起動しているか確認してください。')
    }
  }

  const fetchSyncStatus = async (): Promise<void> => {
    try {
      const res = await fetch(`${backendUrl}/api/sync/status`)
      const data = await res.json()
      setLastSyncedAt(data.lastSyncedAt)
    } catch (_err: unknown) {
      // バックエンド未起動時は初回のみ無視（fetchTasksでエラー表示）
    }
  }

  const handleSync = async (): Promise<void> => {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch(`${backendUrl}/api/sync`, { method: 'POST' })
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

  const priorityColor = (priority: string): string => {
    switch (priority) {
      case '高': return 'text-red-600 bg-red-50'
      case '中': return 'text-yellow-600 bg-yellow-50'
      case '低': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
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
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-[#FAC775] text-[#BA7517] rounded-lg font-medium hover:bg-[#f5bc5c] disabled:opacity-50 transition-colors"
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
          <div className="w-16 h-16 bg-[#FAC775] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-[#BA7517] font-bold text-2xl">P</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Welcome to PeelTask
          </h3>
          <p className="text-gray-500">
            Backlogスペースを登録して、タスクの同期を始めましょう。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs text-gray-400 font-mono shrink-0">
                    {task.issueKey}
                  </span>
                  <span className="font-medium text-gray-800 truncate">
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  {task.dueDate && (
                    <span className="text-xs text-gray-500">
                      {new Date(task.dueDate).toLocaleDateString('ja-JP')}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    score: {task.score.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard
