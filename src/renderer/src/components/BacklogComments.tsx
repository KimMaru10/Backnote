import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MessageCircle, AlertCircle } from 'lucide-react'

interface BacklogCommentUser {
  id: number
  name: string
  nulabAccount?: { iconUrl?: string } | null
}

interface BacklogChangeLog {
  field: string
  newValue: string | null
  originalValue: string | null
}

interface BacklogComment {
  id: number
  content: string
  createdUser: BacklogCommentUser
  created: string
  updated: string
  changeLog: BacklogChangeLog[] | null
}

interface BacklogCommentsProps {
  taskId: number
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'たった今'
  if (diffMin < 60) return `${diffMin} 分前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} 時間前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD} 日前`
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatChangeLog(log: BacklogChangeLog): string {
  const fieldLabel: Record<string, string> = {
    status: 'ステータス',
    assigner: '担当者',
    priority: '優先度',
    milestone: 'マイルストーン',
    component: 'カテゴリー',
    summary: 'タイトル',
    description: '説明',
    estimatedHours: '見積時間',
    actualHours: '実績時間',
    dueDate: '期限',
    startDate: '開始日',
    issueType: '種別',
    resolution: '完了理由'
  }
  const label = fieldLabel[log.field] ?? log.field
  if (log.originalValue && log.newValue) return `${label}: ${log.originalValue} → ${log.newValue}`
  if (log.newValue) return `${label}: ${log.newValue}`
  return `${label}が変更されました`
}

export default function BacklogComments({ taskId }: BacklogCommentsProps): JSX.Element {
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
  const [comments, setComments] = useState<BacklogComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${backendUrl}/api/tasks/${taskId}/comments`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`status ${res.status}`)
        }
        return res.json()
      })
      .then((data: BacklogComment[]) => {
        if (cancelled) return
        setComments(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (cancelled) return
        setError('Backlog コメントの取得に失敗しました')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [taskId, backendUrl])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <MessageCircle size={16} />
        Backlog コメント
        {!loading && comments.length > 0 && (
          <span className="text-xs font-normal text-gray-400">{comments.length}</span>
        )}
      </h3>

      {loading && <p className="text-sm text-gray-400 py-4 text-center">読み込み中...</p>}

      {error && !loading && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {!loading && !error && comments.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">コメントはまだありません</p>
      )}

      {!loading && !error && comments.length > 0 && (
        <div className="space-y-4">
          {comments.map((c) => {
            const isSystem = !c.content && c.changeLog && c.changeLog.length > 0
            return (
              <div key={c.id} className="flex gap-3">
                <div className="flex-shrink-0">
                  {c.createdUser.nulabAccount?.iconUrl ? (
                    <img
                      src={c.createdUser.nulabAccount.iconUrl}
                      alt={c.createdUser.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 font-medium">
                      {c.createdUser.name.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-800">{c.createdUser.name}</span>
                    <span className="text-xs text-gray-400">{formatRelativeTime(c.created)}</span>
                  </div>

                  {isSystem ? (
                    <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg space-y-0.5">
                      {c.changeLog?.map((log, idx) => (
                        <div key={idx}>{formatChangeLog(log)}</div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {c.content && (
                        <div className="text-sm text-gray-800 prose prose-sm max-w-none break-words">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.content}</ReactMarkdown>
                        </div>
                      )}
                      {c.changeLog && c.changeLog.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg space-y-0.5">
                          {c.changeLog.map((log, idx) => (
                            <div key={idx}>{formatChangeLog(log)}</div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
