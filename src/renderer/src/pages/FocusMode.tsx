import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pause, Play, Square, X } from 'lucide-react'
import type { Task } from '../types/Task'

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

function formatJaDateTime(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

export default function FocusMode(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'

  const [task, setTask] = useState<Task | null>(null)
  const [presetMin, setPresetMin] = useState(25)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(false)
  const startedAtRef = useRef<Date | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // タスク取得
  useEffect(() => {
    if (!id) return
    fetch(`${backendUrl}/api/tasks/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTask(data))
      .catch(() => setTask(null))
  }, [id, backendUrl])

  // タイマー
  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // 終了
          if (intervalRef.current) clearInterval(intervalRef.current)
          setRunning(false)
          setCompleted(true)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  // タスク完了時に処理
  useEffect(() => {
    if (!completed || !task) return
    const start = startedAtRef.current
    if (!start) return
    const minutesWorked = presetMin
    const memo = `${formatJaDateTime(start)} 〜 ${formatJaDateTime(new Date())} に ${minutesWorked} 分集中しました 🍅`

    // メモを Backlog ローカル DB に追記
    fetch(`${backendUrl}/api/tasks/${task.id}/memos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: memo })
    }).catch(() => {
      // ignore
    })

    // ネイティブ通知（Notification API）
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('🍅 集中タイム終了！', { body: `${task.title}\n${minutesWorked} 分お疲れさまでした` })
      } catch {
        // ignore
      }
    }
  }, [completed, task, presetMin, backendUrl])

  const startTimer = (): void => {
    setRunning(true)
    setCompleted(false)
    if (!startedAtRef.current) {
      startedAtRef.current = new Date()
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }

  const pauseTimer = (): void => {
    setRunning(false)
  }

  const stopTimer = (): void => {
    if (running) {
      const ok = window.confirm('集中を中断しますか？経過時間をメモに記録します。')
      if (!ok) return
    }
    setRunning(false)
    if (startedAtRef.current && task) {
      const elapsed = presetMin * 60 - secondsLeft
      const minutes = Math.max(1, Math.round(elapsed / 60))
      const memo = `${formatJaDateTime(startedAtRef.current)} 〜 ${formatJaDateTime(new Date())} に ${minutes} 分集中しました（中断）`
      void fetch(`${backendUrl}/api/tasks/${task.id}/memos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: memo })
      })
    }
    navigate(`/tasks/${id}`)
  }

  const resetTimer = (mins: number): void => {
    setPresetMin(mins)
    setSecondsLeft(mins * 60)
    setRunning(false)
    setCompleted(false)
    startedAtRef.current = null
  }

  const totalSeconds = presetMin * 60
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center text-white z-40">
      <button
        onClick={() => navigate(`/tasks/${id}`)}
        className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
        title="閉じる"
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
                onClick={() => resetTimer(p.minutes)}
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
                {secondsLeft === totalSeconds ? '集中スタート' : '再開'}
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
        </>
      )}
    </div>
  )
}
