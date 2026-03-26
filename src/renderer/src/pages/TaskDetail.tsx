import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Task, Memo } from '../types/Task'

interface Space {
  id: number
  domain: string
  displayName: string
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

  const openInBacklog = (): void => {
    if (!task) return
    const space = spaces.find((s) => s.id === task.spaceId)
    if (!space) return
    const url = `https://${space.domain}/view/${task.issueKey}`
    window.open(url, '_blank')
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{error ?? 'タスクが見つかりません'}</p>
        <button onClick={() => navigate('/')} className="text-peeltask-text hover:underline">
          Dashboardに戻る
        </button>
      </div>
    )
  }

  const space = spaces.find((s) => s.id === task.spaceId)
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-800 mb-4 text-sm"
      >
        ← Dashboard に戻る
      </button>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 font-mono">{task.issueKey}</span>
            {space && (
              <span className="text-xs text-gray-400">{space.displayName}</span>
            )}
          </div>
          <button
            onClick={openInBacklog}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Webで見る
          </button>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-4">{task.title}</h2>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-400">優先度: </span>
            <span className={task.priority === '高' ? 'text-red-600 font-medium' : ''}>{task.priority}</span>
          </div>
          <div>
            <span className="text-gray-400">見積もり: </span>
            <span>{task.estimatedHours > 0 ? `${task.estimatedHours}h` : '未設定'}</span>
          </div>
          <div>
            <span className="text-gray-400">期限: </span>
            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ja-JP') : '未設定'}
              {isOverdue && ' (期限切れ)'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">スコア: </span>
            <span className="font-mono">{task.score.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-400">ステータス: </span>
            <span>{task.status}</span>
          </div>
        </div>

        {task.description && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">説明</h3>
            <div className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
              {task.description}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          メモ
          <span className="text-sm font-normal text-gray-400 ml-2">（ローカル保存・Backlogには送信されません）</span>
        </h3>

        <div className="mb-4">
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-peeltask-yellow"
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
            <span className="text-xs text-gray-400">Cmd+Enter で送信</span>
            <button
              onClick={handleAddMemo}
              disabled={memoSaving || !newMemo.trim()}
              className="px-4 py-2 bg-peeltask-yellow text-peeltask-text rounded-lg text-sm font-medium hover:bg-peeltask-yellow/80 disabled:opacity-50 transition-colors"
            >
              {memoSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {memos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">メモはまだありません</p>
        ) : (
          <div className="space-y-3">
            {memos.map((memo) => (
              <div key={memo.id} className="bg-gray-50 rounded-lg p-3 group">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap flex-1">{memo.content}</p>
                  <button
                    onClick={() => handleDeleteMemo(memo.id)}
                    className="text-gray-300 hover:text-red-500 text-xs ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    削除
                  </button>
                </div>
                <span className="text-xs text-gray-400 mt-1 block">
                  {new Date(memo.createdAt).toLocaleString('ja-JP')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskDetail
