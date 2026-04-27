import { useCallback, useEffect, useState } from 'react'
import type { FocusEntry } from '../types/Task'

const MAX_FOCUS = 3

type UseFocus = {
  entries: FocusEntry[]
  loading: boolean
  focusedTaskIds: Set<number>
  togglePin: (taskId: number, currentlyFocused: boolean) => Promise<void>
  setEntries: (taskIds: number[]) => Promise<void>
  complete: (taskId: number) => Promise<void>
  remove: (taskId: number) => Promise<void>
  refetch: () => Promise<void>
}

export function useFocus(): UseFocus {
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
  const [entries, setEntriesState] = useState<FocusEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFocus = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${backendUrl}/api/focus`)
      if (!res.ok) return
      const data = (await res.json()) as FocusEntry[]
      setEntriesState(Array.isArray(data) ? data : [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [backendUrl])

  useEffect(() => {
    void fetchFocus()
    // 1 分ごとに再取得（日付変更を検知）
    const interval = setInterval(() => void fetchFocus(), 60_000)
    return () => clearInterval(interval)
  }, [fetchFocus])

  const setEntries = useCallback(
    async (taskIds: number[]): Promise<void> => {
      try {
        const res = await fetch(`${backendUrl}/api/focus`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds })
        })
        if (!res.ok) return
        const data = (await res.json()) as FocusEntry[]
        setEntriesState(Array.isArray(data) ? data : [])
      } catch {
        // ignore
      }
    },
    [backendUrl]
  )

  const togglePin = useCallback(
    async (taskId: number, currentlyFocused: boolean): Promise<void> => {
      if (currentlyFocused) {
        try {
          await fetch(`${backendUrl}/api/focus/${taskId}`, { method: 'DELETE' })
          setEntriesState((prev) => prev.filter((e) => e.taskId !== taskId))
        } catch {
          // ignore
        }
        return
      }
      // ピン留めする: 現在の taskId 一覧に追加して PUT。MAX を超えていたら何もしない。
      const current = entries.map((e) => e.taskId)
      if (current.length >= MAX_FOCUS) {
        // 簡易的に最古を入れ替え
        const next = [...current.slice(1), taskId]
        await setEntries(next)
        return
      }
      await setEntries([...current, taskId])
    },
    [backendUrl, entries, setEntries]
  )

  const complete = useCallback(
    async (taskId: number): Promise<void> => {
      try {
        await fetch(`${backendUrl}/api/focus/${taskId}/complete`, { method: 'POST' })
        const now = new Date().toISOString()
        setEntriesState((prev) => prev.map((e) => (e.taskId === taskId ? { ...e, completedAt: now } : e)))
      } catch {
        // ignore
      }
    },
    [backendUrl]
  )

  const remove = useCallback(
    async (taskId: number): Promise<void> => {
      try {
        await fetch(`${backendUrl}/api/focus/${taskId}`, { method: 'DELETE' })
        setEntriesState((prev) => prev.filter((e) => e.taskId !== taskId))
      } catch {
        // ignore
      }
    },
    [backendUrl]
  )

  const focusedTaskIds = new Set(entries.map((e) => e.taskId))

  return { entries, loading, focusedTaskIds, togglePin, setEntries, complete, remove, refetch: fetchFocus }
}
