import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, AlertCircle, ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react'
import BacklogContent from './BacklogContent'

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

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number): string => String(n).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const mi = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`
}

// Backlog API の changeLog.field を日本語表記にマッピングする。
// 一覧: https://developer.nulab.com/ja/docs/backlog/api/2/get-comment-list/
const FIELD_LABEL: Record<string, string> = {
  summary: 'タイトル',
  description: '説明',
  status: 'ステータス',
  assigner: '担当者',
  assignee: '担当者',
  issueType: '種別',
  categoryId: 'カテゴリー',
  category: 'カテゴリー',
  component: 'カテゴリー',
  versionId: '発生バージョン',
  version: '発生バージョン',
  milestoneId: 'マイルストーン',
  milestone: 'マイルストーン',
  resolution: '完了理由',
  priority: '優先度',
  limitDate: '期限日',
  dueDate: '期限日',
  startDate: '開始日',
  estimatedHours: '予定時間',
  actualHours: '実績時間',
  attachment: '添付ファイル',
  notification: '通知',
  commit: 'コミット',
  parentIssue: '親課題'
}

function formatChangeLog(log: BacklogChangeLog): string {
  const label = FIELD_LABEL[log.field] ?? log.field
  if (log.originalValue && log.newValue) return `${label}: ${log.originalValue} → ${log.newValue}`
  if (log.newValue) return `${label}: ${log.newValue}`
  if (log.originalValue) return `${label}: ${log.originalValue} を削除`
  return `${label}が変更されました`
}

type SortOrder = 'desc' | 'asc'

export default function BacklogComments({ taskId }: BacklogCommentsProps): JSX.Element {
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
  const [comments, setComments] = useState<BacklogComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // API は新しい順で返ってくる前提で、UI 側で並び替える
  const sortedComments = useMemo(() => {
    const sorted = [...comments]
    sorted.sort((a, b) => {
      const ta = new Date(a.created).getTime()
      const tb = new Date(b.created).getTime()
      return sortOrder === 'desc' ? tb - ta : ta - tb
    })
    return sorted
  }, [comments, sortOrder])

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-700 flex items-center gap-2">
          <MessageCircle size={16} />
          Backlog コメント
          {!loading && comments.length > 0 && (
            <span className="text-xs font-normal text-gray-400">{comments.length}</span>
          )}
        </h3>
        {!loading && comments.length > 1 && (
          <button
            onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
            title="並び替え"
          >
            {sortOrder === 'desc' ? <ArrowDownNarrowWide size={14} /> : <ArrowUpNarrowWide size={14} />}
            {sortOrder === 'desc' ? '新しい順' : '古い順'}
          </button>
        )}
      </div>

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
          {sortedComments.map((c) => {
            const isSystem = !c.content && c.changeLog && c.changeLog.length > 0
            return (
              <div key={c.id} className="bg-white rounded-lg px-4 py-3 border border-gray-200">
                {/* ヘッダー: アイコン + ユーザー名 + 投稿日時 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-shrink-0">
                    {c.createdUser.nulabAccount?.iconUrl ? (
                      <img
                        src={c.createdUser.nulabAccount.iconUrl}
                        alt={c.createdUser.name}
                        className="w-9 h-9 rounded-full"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm text-gray-500 font-medium">
                        {c.createdUser.name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{c.createdUser.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{formatDateTime(c.created)}</div>
                  </div>
                </div>

                {/* 本文 */}
                {isSystem ? (
                  <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg space-y-1">
                    {c.changeLog?.map((log, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="inline-block w-1.5 h-1.5 rounded-full border border-gray-400 flex-shrink-0" />
                        <span className="flex-1">{formatChangeLog(log)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {c.changeLog && c.changeLog.length > 0 && (
                      <div className="mb-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg space-y-1">
                        {c.changeLog.map((log, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="inline-block w-1.5 h-1.5 rounded-full border border-gray-400 flex-shrink-0" />
                            <span className="flex-1">{formatChangeLog(log)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {c.content && <BacklogContent text={c.content} taskId={taskId} />}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
