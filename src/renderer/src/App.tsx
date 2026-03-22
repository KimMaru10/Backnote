import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'

type Page = 'dashboard' | 'settings'

function App(): JSX.Element {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FAC775] rounded-lg flex items-center justify-center">
            <span className="text-[#BA7517] font-bold text-sm">P</span>
          </div>
          <h1 className="text-lg font-bold text-gray-800">PeelTask</h1>
        </div>
        <nav className="flex gap-2">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'dashboard'
                ? 'bg-[#FAC775] text-[#BA7517]'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setCurrentPage('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'settings'
                ? 'bg-[#FAC775] text-[#BA7517]'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Settings
          </button>
        </nav>
      </header>

      {/* Content */}
      <main className="p-6">
        {currentPage === 'dashboard' ? <Dashboard /> : <Settings />}
      </main>
    </div>
  )
}

export default App
