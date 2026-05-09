import { useLocation, useNavigate } from 'react-router-dom'
import { Maximize2, Pause, Play, X } from 'lucide-react'
import { useFocusTimer } from '../hooks/useFocusTimer'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 集中モードのフローティング・ミニタイマー。
// セッションがあり、現在 /focus/:taskId ページに居ない時のみ表示する。
export default function MiniTimer(): JSX.Element | null {
  const focus = useFocusTimer()
  const navigate = useNavigate()
  const location = useLocation()

  if (!focus.session) return null
  if (location.pathname === `/focus/${focus.session.taskId}`) return null

  const { taskId, taskTitle, secondsLeft, running, completed } = focus.session

  return (
    <div className="fixed bottom-6 right-6 z-40 bg-gray-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-[360px]">
      <span className="text-xl">🍅</span>

      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400 truncate" title={taskTitle}>
          {taskTitle}
        </div>
        <div className="font-mono text-lg tabular-nums leading-tight">
          {completed ? '完了' : formatTime(secondsLeft)}
        </div>
      </div>

      {!completed && (
        <button
          onClick={() => (running ? focus.pause() : focus.resume())}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          title={running ? '一時停止' : '再開'}
        >
          {running ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
      )}

      <button
        onClick={() => navigate(`/focus/${taskId}`)}
        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        title="集中モードに戻る"
      >
        <Maximize2 size={14} />
      </button>

      <button
        onClick={() => {
          if (window.confirm('集中タイマーを終了しますか？')) {
            void focus.stopAndRecord()
          }
        }}
        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        title="タイマー終了"
      >
        <X size={14} />
      </button>
    </div>
  )
}
