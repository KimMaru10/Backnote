import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { User, Building2, Settings as SettingsIcon, LayoutDashboard, HelpCircle, Search, Bell } from 'lucide-react'
import { useState, createContext, useContext, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import TaskDetail from './pages/TaskDetail'
import Guide from './pages/Guide'
import FocusMode from './pages/FocusMode'
import CommandPalette from './components/CommandPalette'
import NotificationsPanel from './components/NotificationsPanel'
import TrayPopoverApp from './components/TrayPopoverApp'
import BackToTop from './components/BackToTop'
import MiniTimer from './components/MiniTimer'
import { FocusTimerProvider } from './hooks/useFocusTimer'
import type { Space } from './types/Task'

type AssigneeMode = 'mine' | 'all'

interface AppContextType {
  assigneeMode: AssigneeMode
  setAssigneeMode: (mode: AssigneeMode) => void
}

export const AppContext = createContext<AppContextType>({
  assigneeMode: 'mine',
  setAssigneeMode: () => {}
})

export function useAppContext(): AppContextType {
  return useContext(AppContext)
}

function AppLayout(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { assigneeMode, setAssigneeMode } = useAppContext()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [spaces, setSpaces] = useState<Space[]>([])

  const isActive = (path: string): boolean => location.pathname === path

  // 通知クリック → main プロセスから navigate イベントを受け取り、該当パスへ遷移
  useEffect(() => {
    const off = window.api?.onNavigate?.((path) => {
      navigate(path)
    })
    return off
  }, [navigate])

  // ヘッダーのベルアイコン用バッジ — Backlog 未読件数を 60 秒ごとに同期
  useEffect(() => {
    const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
    let cancelled = false
    const fetchCount = async (): Promise<void> => {
      try {
        const res = await fetch(`${backendUrl}/api/notifications/backlog/count`)
        if (!res.ok) return
        const data = (await res.json()) as { unread: number }
        if (!cancelled) setUnreadCount(data.unread ?? 0)
      } catch {
        // 失敗時は前回値を維持
      }
    }
    void fetchCount()
    const id = window.setInterval(fetchCount, 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  // Cmd+K (または Ctrl+K) でクイックジャンプを開く
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // クイックジャンプ用のスペース一覧を取得（カラー表示のため）
  useEffect(() => {
    const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
    fetch(`${backendUrl}/api/spaces`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSpaces(Array.isArray(data) ? data : []))
      .catch(() => setSpaces([]))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              isActive('/')
                ? 'bg-gray-100 text-gray-800'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard size={16} />
            ダッシュボード
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              isActive('/settings')
                ? 'bg-gray-100 text-gray-800'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <SettingsIcon size={16} />
            設定
          </button>
          <button
            onClick={() => navigate('/guide')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              isActive('/guide')
                ? 'bg-gray-100 text-gray-800'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <HelpCircle size={16} />
            ガイド
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setNotifPanelOpen(true)}
            className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
            title="お知らせ"
            aria-label="お知らせ"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
            title="クイックジャンプ"
          >
            <Search size={14} />
            <span>検索</span>
            <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-white border border-gray-200 rounded text-gray-500">⌘K</kbd>
          </button>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setAssigneeMode('mine')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              assigneeMode === 'mine'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="自分の担当タスクのみ"
          >
            <User size={14} />
            自分
          </button>
          <button
            onClick={() => setAssigneeMode('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              assigneeMode === 'all'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="スペース全体のタスク"
          >
            <Building2 size={14} />
            全体
          </button>
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} spaces={spaces} />
      <NotificationsPanel
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />
      <MiniTimer />
      <BackToTop />

      <main className="p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/focus/:id" element={<FocusMode />} />
          <Route path="/guide" element={<Guide />} />
        </Routes>
      </main>
    </div>
  )
}

function App(): JSX.Element {
  const [assigneeMode, setAssigneeMode] = useState<AssigneeMode>('mine')

  // Tray からのポップオーバー用ウィンドウは index.html#/popover で起動される。
  // メインアプリのレイアウトとは独立した最小 UI を返す。
  const isPopover =
    typeof window !== 'undefined' && window.location.hash.startsWith('#/popover')
  if (isPopover) {
    return <TrayPopoverApp />
  }

  return (
    <AppContext.Provider value={{ assigneeMode, setAssigneeMode }}>
      <FocusTimerProvider>
        <HashRouter>
          <AppLayout />
        </HashRouter>
      </FocusTimerProvider>
    </AppContext.Provider>
  )
}

export default App
