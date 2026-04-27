import { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import type { Task, Memo, Space } from '../types/Task'
import { getScoreLabel } from '../utils/scoreLabel'

function linkifyText(text: string): JSX.Element[] {
  const urlPattern = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlPattern)
  return parts.map((part, i) => {
    if (urlPattern.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline break-all"
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function TaskDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'

  const [task, setTask] = useState<Task | null>(null)
  const [memos, setMemos] = useState<Memo[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [newMemo, setNewMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [memoSaving, setMemoSaving] = useState(false)

  const fetchTask = async (): Promise<void> => {
    try {
      const res = await fetch(`${backendUrl}/api/tasks/${id}`)
      if (!res.ok) throw new Error('not found')
      setTask(await res.json())
    } catch (_err: unknown) {
      setError('タスクの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const fetchMemos = async (): Promise<void> => {
    try {
      const res = await fetch(`${backendUrl}/api/tasks/${id}/memos`)
      if (!res.ok) return
      setMemos(await res.json())
    } catch (_err: unknown) {
      // メモ取得失敗は致命的でない
    }
  }

  const fetchSpaces = async (): Promise<void> => {
    try {
      const res = await fetch(`${backendUrl}/api/spaces`)
      if (!res.ok) return
      setSpaces(await res.json())
    } catch (_err: unknown) {
      // スペース取得失敗は致命的でない
    }
  }

  useEffect(() => {
    fetchTask()
    fetchMemos()
    fetchSpaces()
  }, [id])

  const handleAddMemo = async (): Promise<void> => {
    if (!newMemo.trim()) return
    setMemoSaving(true)
    try {
      const res = await fetch(`${backendUrl}/api/tasks/${id}/memos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMemo })
      })
      if (!res.ok) throw new Error('failed')
      setNewMemo('')
      await fetchMemos()
    } catch (_err: unknown) {
      setError('メモの保存に失敗しました')
    } finally {
      setMemoSaving(false)
    }
  }

  const handleDeleteMemo = async (memoId: number): Promise<void> => {
    try {
      await fetch(`${backendUrl}/api/tasks/${id}/memos/${memoId}`, { method: 'DELETE' })
      await fetchMemos()
    } catch (_err: unknown) {
      setError('メモの削除に失敗しました')
    }
  }

  const handleBack = (): void => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> }
    }
    if (doc.startViewTransition) {
      const transition = doc.startViewTransition(() => {
        flushSync(() => { navigate('/') })
      })
      transition.ready.then(() => {
        document.documentElement.animate(
          [
            { opacity: 1, transform: 'translateX(0)' },
            { opacity: 0, transform: 'translateX(100%)' }
          ],
          { duration: 300, easing: 'ease-in', pseudoElement: '::view-transition-old(root)' }
        )
        document.documentElement.animate(
          [
            { opacity: 0, transform: 'translateX(-100%)' },
            { opacity: 1, transform: 'translateX(0)' }
          ],
          { duration: 300, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' }
        )
      })
    } else {
      navigate('/')
    }
  }

  const openInBacklog = (): void => {
    if (!task) return
    const space = spaces.find((s) => s.id === task.spaceId)
    if (!space) return
    window.open(`https://${space.domain}/view/${task.issueKey}`, '_blank')
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{error ?? 'タスクが見つかりません'}</p>
        <button onClick={() => navigate('/')} className="text-brand-dark hover:underline">
          ダッシュボードに戻る
        </button>
      </div>
    )
  }

  const space = spaces.find((s) => s.id === task.spaceId)
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()

  return (
    <div style={{ viewTransitionName: `task-card-${id}` }}>
      {/* ヘッダーバー */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span className="text-sm font-medium">戻る</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {space && (
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: space.color }}
              />
            )}
            <span className="text-sm text-gray-400 font-mono">{task.issueKey}</span>
          </div>
          <button
            onClick={() => navigate(`/focus/${task.id}`)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center gap-1.5"
            title="このタスクに集中する（ポモドーロ）"
          >
            🍅 集中する
          </button>
          <button
            onClick={openInBacklog}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
            </svg>
            Webで見る
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* メインコンテンツ: 2カラム */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: 課題情報 */}
        <div className="lg:col-span-2 space-y-6">
          {/* タイトル */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h1 className="text-xl font-bold text-gray-800 mb-4">{task.title}</h1>

            {task.description && (
              <div className="border-t pt-4">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">説明</h3>
                <div className="text-sm text-gray-600 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-4 leading-relaxed">
                  {linkifyText(task.description)}
                </div>
              </div>
            )}
          </div>

          {/* メモ */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
              メモ
              <span className="normal-case tracking-normal text-gray-300 ml-2">— ローカル保存</span>
            </h3>

            <div className="mb-4">
              <textarea
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                rows={3}
                placeholder="進捗メモを入力..."
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                disabled={memoSaving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleAddMemo()
                  }
                }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-300">Cmd+Enter で保存</span>
                <button
                  onClick={handleAddMemo}
                  disabled={memoSaving || !newMemo.trim()}
                  className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors"
                >
                  {memoSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>

            {memos.length === 0 ? (
              <p className="text-sm text-gray-300 text-center py-6">メモはまだありません</p>
            ) : (
              <div className="space-y-3">
                {memos.map((memo) => (
                  <div key={memo.id} className="bg-gray-50 rounded-lg p-4 group">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words flex-1">{memo.content}</p>
                      <button
                        onClick={() => handleDeleteMemo(memo.id)}
                        className="text-gray-300 hover:text-red-500 text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        削除
                      </button>
                    </div>
                    <span className="text-xs text-gray-400 mt-2 block">
                      {new Date(memo.createdAt).toLocaleString('ja-JP')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右: プロパティ */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">プロパティ</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">ステータス</span>
                <span className="text-sm font-medium text-gray-800">{task.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">優先度</span>
                <span className={`text-sm font-medium ${task.priority === '高' ? 'text-rose-600' : 'text-gray-800'}`}>
                  {task.priority}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">期限</span>
                <span className={`text-sm font-medium ${isOverdue ? 'text-red-500' : 'text-gray-800'}`}>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ja-JP') : '未設定'}
                  {isOverdue && ' (期限切れ)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">見積もり</span>
                <span className="text-sm font-medium text-gray-800">
                  {task.estimatedHours > 0 ? `${task.estimatedHours}h` : '未設定'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">緊急度</span>
                {(() => {
                  const label = getScoreLabel(task.score)
                  return (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${label.badgeClass}`}>
                        {label.emoji} {label.text}
                      </span>
                      <span className="text-xs font-mono text-gray-400">
                        ({task.score.toFixed(2)})
                      </span>
                    </div>
                  )
                })()}
              </div>
              {space && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">スペース</span>
                  <span className="text-sm font-medium text-gray-800">{space.displayName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TaskDetail
