import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import TaskDetail from './pages/TaskDetail'

function AppLayout(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string): boolean => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <img src={new URL('./assets/logo.svg', import.meta.url).href} alt="Backnote" className="w-8 h-8" />
          <h1 className="text-lg font-bold text-gray-800">Backnote</h1>
        </div>
        <nav className="flex gap-2">
          <button
            onClick={() => navigate('/')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/')
                ? 'bg-peeltask-yellow text-peeltask-text'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            ダッシュボード
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/settings')
                ? 'bg-peeltask-yellow text-peeltask-text'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            設定
          </button>
        </nav>
      </header>

      <main className="p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
        </Routes>
      </main>
    </div>
  )
}

function App(): JSX.Element {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  )
}

export default App
