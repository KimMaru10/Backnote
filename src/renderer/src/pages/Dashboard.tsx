import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, HelpCircle } from 'lucide-react'
import { useAppContext } from '../App'

const SYNC_MESSAGES = [
  '課題を更新しています...',
  '今日も一日がんばろう！',
  'コーヒーでも飲みながら待ってね☕',
  '気分転換も大事だよ',
  'タスクを整理中...',
  '優先度を計算しています...',
  'Backlogと通信中...',
  '深呼吸してリラックス',
  'あと少しで完了します...',
  'いい感じに進んでるね！',
  '今週もあと少し！',
  'ストレッチしてみない？',
  '水分補給も忘れずに💧',
  '集中力が大事！',
  'もうすぐ終わるよ...',
]

function getRandomSyncMessage(): string {
  return SYNC_MESSAGES[Math.floor(Math.random() * SYNC_MESSAGES.length)]
}
import Lottie from 'lottie-react'
import type { Task, Space } from '../types/Task'
import ListView from '../components/ListView'
import GanttChart from '../components/GanttChart'
import CalendarView from '../components/CalendarView'
import loadingAnimation from '../assets/loading-animation.json'

type ViewMode = 'list' | 'gantt' | 'calendar'

function Dashboard(): JSX.Element {
  const { assigneeMode } = useAppContext()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right')
  const [slideKey, setSlideKey] = useState(0)

  const VIEW_ORDER: ViewMode[] = ['list', 'gantt', 'calendar']

  const handleViewChange = (next: ViewMode): void => {
    const currentIdx = VIEW_ORDER.indexOf(viewMode)
    const nextIdx = VIEW_ORDER.indexOf(next)
    setSlideDir(nextIdx > currentIdx ? 'right' : 'left')
    setViewMode(next)
    setSlideKey((k) => k + 1)
  }

  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'

  const fetchTasks = async (mode?: string): Promise<void> => {
    try {
      const currentMode = mode ?? assigneeMode
      const modeParam = currentMode === 'all' ? '?mode=all' : ''
      const res = await fetch(`${backendUrl}/api/tasks${modeParam}`)
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
    setSyncMessage(getRandomSyncMessage())
    setError(null)
    const minLoadingMs = 3000
    const startTime = Date.now()
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
      const elapsed = Date.now() - startTime
      const remaining = minLoadingMs - elapsed
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining))
      }
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchSpaces()
    fetchSyncStatus()
  }, [])

  useEffect(() => {
    fetchTasks(assigneeMode)
  }, [assigneeMode])

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
        <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>
        <div className="flex items-center gap-4">
          {lastSyncedAt && (
            <span className="text-sm text-gray-500">
              最終同期: {formatDate(lastSyncedAt)}
            </span>
          )}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => handleViewChange('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              リスト
            </button>
            <button
              onClick={() => handleViewChange('gantt')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'gantt' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              ガント
            </button>
            <button
              onClick={() => handleViewChange('calendar')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'calendar' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              カレンダー
            </button>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1.5 bg-brand text-white rounded-lg text-sm font-medium shadow-sm hover:shadow hover:bg-brand-dark active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={syncing ? 'sync-icon-spin' : ''}>
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            更新
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {syncing ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Lottie
            animationData={loadingAnimation}
            loop
            style={{ width: 240, height: 240 }}
          />
          <p className="text-gray-500 -mt-4 text-base font-medium">{syncMessage}</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center max-w-lg mx-auto">
          <div className="w-20 h-20 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <img src={new URL('../assets/logo.svg', import.meta.url).href} alt="" className="w-12 h-12" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Backnoteへようこそ
          </h3>
          <p className="text-gray-500 mb-6">
            Backlogのタスクをデスクトップで管理しましょう。<br />
            まずはスペースを登録してください。
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="px-6 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand-dark transition-colors flex items-center justify-center gap-2"
            >
              <Settings size={18} />
              スペースを登録する
            </button>
            <button
              onClick={() => navigate('/guide')}
              className="px-6 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <HelpCircle size={18} />
              はじめての方はこちら
            </button>
          </div>
        </div>
      ) : (
        <div key={slideKey} className={slideDir === 'right' ? 'tab-slide-right' : 'tab-slide-left'}>
          {viewMode === 'list' ? (
            <ListView tasks={tasks} spaces={spaces} />
          ) : viewMode === 'gantt' ? (
            <GanttChart tasks={tasks} spaces={spaces} />
          ) : (
            <CalendarView tasks={tasks} spaces={spaces} />
          )}
        </div>
      )}
    </div>
  )
}

export default Dashboard
