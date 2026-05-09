import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pause, Play, Square, X } from 'lucide-react'
import type { Task } from '../types/Task'
import { useFocusTimer } from '../hooks/useFocusTimer'

const PRESETS = [
  { label: '15 分', minutes: 15 },
  { label: '25 分', minutes: 25 },
  { label: '45 分', minutes: 45 },
  { label: '60 分', minutes: 60 }
]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function FocusMode(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
  const focus = useFocusTimer()

  const [task, setTask] = useState<Task | null>(null)
  // 開始前の選択時間（セッション開始までは context に書き込まない）
  const [pendingPresetMin, setPendingPresetMin] = useState(25)

  // タスク取得
  useEffect(() => {
    if (!id) return
    fetch(`${backendUrl}/api/tasks/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTask(data))
      .catch(() => setTask(null))
  }, [id, backendUrl])

  const taskId = task ? task.id : null
  // 現在のセッションがこのタスク？
  const session = focus.session
  const isCurrentTask = session !== null && taskId !== null && session.taskId === taskId

  // 表示用のタイマー値: 自分のタスクならセッションから、そうでなければプリセットから
  const presetMin = isCurrentTask ? session.presetMin : pendingPresetMin
  const secondsLeft = isCurrentTask ? session.secondsLeft : pendingPresetMin * 60
  const running = isCurrentTask ? session.running : false
  const completed = isCurrentTask ? session.completed : false

  const totalSeconds = presetMin * 60
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100

  const startTimer = (): void => {
    if (!task) return
    if (isCurrentTask) {
      // 既存セッションの再開
      focus.resume()
    } else {
      focus.startSession(task.id, task.title, pendingPresetMin)
    }
  }

  const pauseTimer = (): void => focus.pause()

  const stopTimer = (): void => {
    if (running) {
      const ok = window.confirm('集中を中断しますか？経過時間をメモに記録します。')
      if (!ok) return
    }
    void focus.stopAndRecord()
    navigate(`/tasks/${id}`)
  }

  const handleClose = (): void => {
    // X はミニタイマーへの最小化。タイマーは継続。
    navigate(`/tasks/${id}`)
  }

  const choosePreset = (mins: number): void => {
    if (isCurrentTask && (running || completed || session.startedAt)) {
      // 既存セッションがあるときはプリセット変更で初期化（確認後）
      const ok = window.confirm('現在のセッションをリセットして時間を変更しますか？')
      if (!ok) return
      focus.cancel()
    }
    setPendingPresetMin(mins)
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center text-white z-40">
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
        title="閉じる（タイマーは継続します）"
      >
        <X size={24} />
      </button>

      {task && (
        <>
          <div className="text-center mb-8 px-4 max-w-3xl">
            <p className="text-gray-400 text-sm font-mono mb-2">{task.issueKey}</p>
            <h1 className="text-3xl font-bold mb-2">{task.title}</h1>
            {task.dueDate && (
              <p className="text-gray-500 text-sm">
                期限: {new Date(task.dueDate).toLocaleDateString('ja-JP')}
              </p>
            )}
          </div>

          <div className="relative mb-8">
            <svg className="w-72 h-72 -rotate-90">
              <circle cx="144" cy="144" r="130" stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
              <circle
                cx="144"
                cy="144"
                r="130"
                stroke="#fb923c"
                strokeWidth="6"
                fill="none"
                strokeDasharray={2 * Math.PI * 130}
                strokeDashoffset={2 * Math.PI * 130 * (1 - progress / 100)}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-7xl font-mono font-bold tabular-nums">
                {formatTime(secondsLeft)}
              </div>
              {completed && (
                <div className="mt-3 text-orange-400 font-medium">🎉 完了！お疲れさまでした</div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={() => choosePreset(p.minutes)}
                disabled={running}
                className={`px-4 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 ${
                  presetMin === p.minutes
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            {!running ? (
              <button
                onClick={startTimer}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 rounded-full font-semibold flex items-center gap-2 transition-colors"
              >
                <Play size={20} fill="currentColor" />
                {isCurrentTask && secondsLeft < totalSeconds ? '再開' : '集中スタート'}
              </button>
            ) : (
              <button
                onClick={pauseTimer}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full font-semibold flex items-center gap-2 transition-colors"
              >
                <Pause size={20} fill="currentColor" />
                一時停止
              </button>
            )}
            <button
              onClick={stopTimer}
              className="px-6 py-3 text-gray-300 hover:text-white border border-white/20 hover:border-white/40 rounded-full flex items-center gap-2 transition-colors"
            >
              <Square size={18} />
              中断
            </button>
          </div>

          {completed && (
            <button
              onClick={() => navigate(`/tasks/${id}`)}
              className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-colors"
            >
              タスク詳細へ戻る
            </button>
          )}

          <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-gray-500">
            ✕ で閉じてもタイマーは継続します（右下のミニタイマーから戻れます）
          </p>
        </>
      )}
    </div>
  )
}
