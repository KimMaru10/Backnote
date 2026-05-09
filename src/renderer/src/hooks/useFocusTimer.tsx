import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'

// 集中モード（ポモドーロ）のタイマー状態をグローバルに保持する。
// X 押下でフルスクリーンを抜けてもタイマーは継続し、ミニタイマーで表示する。

type FocusSession = {
  taskId: number
  taskTitle: string
  presetMin: number
  secondsLeft: number
  running: boolean
  completed: boolean
  startedAt: number | null // epoch ms
}

type FocusTimerContextValue = {
  session: FocusSession | null
  // セッション開始（または同タスクなら継続）
  startSession: (taskId: number, taskTitle: string, presetMin: number) => void
  pause: () => void
  resume: () => void
  // タイマーを完全終了（メモも保存しない）
  cancel: () => void
  // 中断: 経過時間を記録してセッション終了
  stopAndRecord: () => Promise<void>
  // プリセット時間変更（停止状態のときのみ）
  setPresetMin: (min: number) => void
}

const FocusTimerContext = createContext<FocusTimerContextValue | null>(null)

function backendUrl(): string {
  return window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
}

function formatJaDateTime(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function postMemo(taskId: number, content: string): Promise<void> {
  try {
    await fetch(`${backendUrl()}/api/tasks/${taskId}/memos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
  } catch {
    // ignore
  }
}

function notify(title: string, body: string): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body })
    } catch {
      // ignore
    }
  }
}

export function FocusTimerProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<FocusSession | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const completionHandledRef = useRef(false)

  // Tick
  useEffect(() => {
    if (!session?.running) return
    intervalRef.current = setInterval(() => {
      setSession((s) => {
        if (!s) return s
        if (s.secondsLeft <= 1) {
          return { ...s, secondsLeft: 0, running: false, completed: true }
        }
        return { ...s, secondsLeft: s.secondsLeft - 1 }
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session?.running])

  // 完了時の副作用（メモ保存・通知）— セッション内で1回だけ
  useEffect(() => {
    if (!session?.completed) {
      completionHandledRef.current = false
      return
    }
    if (completionHandledRef.current) return
    completionHandledRef.current = true
    if (session.startedAt) {
      const memo = `${formatJaDateTime(session.startedAt)} 〜 ${formatJaDateTime(Date.now())} に ${session.presetMin} 分集中しました 🍅`
      void postMemo(session.taskId, memo)
    }
    notify('🍅 集中タイム終了！', `${session.taskTitle}\n${session.presetMin} 分お疲れさまでした`)
  }, [session?.completed, session?.taskId, session?.presetMin, session?.startedAt, session?.taskTitle])

  const startSession = useCallback((taskId: number, taskTitle: string, presetMin: number) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
    setSession({
      taskId,
      taskTitle,
      presetMin,
      secondsLeft: presetMin * 60,
      running: true,
      completed: false,
      startedAt: Date.now()
    })
  }, [])

  const pause = useCallback(() => {
    setSession((s) => (s ? { ...s, running: false } : s))
  }, [])

  const resume = useCallback(() => {
    setSession((s) => (s ? { ...s, running: true, startedAt: s.startedAt ?? Date.now() } : s))
  }, [])

  const cancel = useCallback(() => {
    setSession(null)
  }, [])

  const stopAndRecord = useCallback(async () => {
    setSession((current) => {
      if (current && current.startedAt) {
        const elapsed = current.presetMin * 60 - current.secondsLeft
        const minutes = Math.max(1, Math.round(elapsed / 60))
        const memo = `${formatJaDateTime(current.startedAt)} 〜 ${formatJaDateTime(Date.now())} に ${minutes} 分集中しました（中断）`
        void postMemo(current.taskId, memo)
      }
      return null
    })
  }, [])

  const setPresetMin = useCallback((min: number) => {
    setSession((s) => (s ? { ...s, presetMin: min, secondsLeft: min * 60, running: false, completed: false, startedAt: null } : s))
  }, [])

  return (
    <FocusTimerContext.Provider value={{ session, startSession, pause, resume, cancel, stopAndRecord, setPresetMin }}>
      {children}
    </FocusTimerContext.Provider>
  )
}

export function useFocusTimer(): FocusTimerContextValue {
  const ctx = useContext(FocusTimerContext)
  if (!ctx) throw new Error('useFocusTimer must be inside FocusTimerProvider')
  return ctx
}
