import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { Task, Space } from '../types/Task'
import { getScoreLabel } from '../utils/scoreLabel'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  spaces: Space[]
}

const SEARCH_DEBOUNCE_MS = 120

export default function CommandPalette({ open, onClose, spaces }: CommandPaletteProps): JSX.Element | null {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Task[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(false)

  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'

  // 開いたとき入力フォーカス
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      // 次フレームで focus（モーダルがマウントされてから）
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // インクリメンタル検索（debounce）
  useEffect(() => {
    if (!open) return
    if (!query.trim()) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${backendUrl}/api/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal
        })
        if (!res.ok) return
        const data = (await res.json()) as Task[]
        setResults(Array.isArray(data) ? data : [])
        setSelectedIdx(0)
      } catch {
        // abort or network error
      } finally {
        setLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [open, query, backendUrl])

  // キーボード操作
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const selected = results[selectedIdx]
      if (selected) {
        navigate(`/tasks/${selected.id}`)
        onClose()
      }
    }
  }

  // 選択中のアイテムをスクロール内に保つ
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.querySelector<HTMLElement>(`[data-idx="${selectedIdx}"]`)
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx, results])

  if (!open) return null

  const getSpaceColor = (spaceId: number): string => spaces.find((s) => s.id === spaceId)?.color ?? '#FAC775'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-w-[90vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="タイトル / IssueKey / メモを検索..."
            className="flex-1 bg-transparent outline-none text-sm placeholder-gray-400"
          />
          {loading && <span className="text-xs text-gray-400">検索中</span>}
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-500 rounded">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
          {query.trim() && results.length === 0 && !loading && (
            <div className="py-8 text-center text-sm text-gray-400">該当するタスクがありません</div>
          )}
          {!query.trim() && (
            <div className="py-8 text-center text-sm text-gray-400">
              検索キーワードを入力してください
              <div className="mt-2 text-xs text-gray-400">タイトル / IssueKey / メモ本文を横断検索します</div>
            </div>
          )}
          {results.map((task, idx) => {
            const label = getScoreLabel(task.score)
            const isSelected = idx === selectedIdx
            return (
              <button
                key={task.id}
                data-idx={idx}
                type="button"
                onClick={() => {
                  navigate(`/tasks/${task.id}`)
                  onClose()
                }}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-gray-50 last:border-b-0 ${
                  isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getSpaceColor(task.spaceId) }}
                />
                <span className="text-xs font-mono text-gray-400 w-28 flex-shrink-0 truncate">{task.issueKey}</span>
                <span className="flex-1 text-sm text-gray-800 truncate">{task.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${label.badgeClass}`}>
                  {label.emoji} {label.text}
                </span>
              </button>
            )
          })}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400 flex items-center gap-3">
          <span>↑↓ 移動</span>
          <span>↵ 開く</span>
          <span>ESC 閉じる</span>
        </div>
      </div>
    </div>
  )
}
