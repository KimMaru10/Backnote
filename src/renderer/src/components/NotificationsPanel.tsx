import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Loader2, AlertCircle, Bell } from 'lucide-react'

interface BacklogNotification {
  id: number
  spaceId: number
  spaceDomain: string
  alreadyRead: boolean
  reason: number
  reasonText: string
  sender: { id: number; name: string; iconUrl: string }
  issueId: number
  issueKey: string
  issueTitle: string
  issueStatus: string
  statusColor: string
  excerpt: string
  createdAt: string
  localTaskId?: number
}

interface NotificationsPanelProps {
  open: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

function statusBadgeClass(name: string): string {
  switch (name) {
    case '完了':
      return 'bg-emerald-50 text-emerald-700'
    case '処理中':
      return 'bg-blue-50 text-blue-700'
    case '処理済み':
      return 'bg-purple-50 text-purple-700'
    case '未対応':
      return 'bg-gray-100 text-gray-600'
    default:
      return 'bg-amber-50 text-amber-700'
  }
}

function buildSentence(reason: string): { prefix: string; verb: string; suffix: string } {
  switch (reason) {
    case '更新':
      return { prefix: '課題を', verb: '更新', suffix: 'しました。' }
    case 'コメント':
      return { prefix: '', verb: 'コメント', suffix: 'しました。' }
    case '担当者':
      return { prefix: '', verb: '担当者', suffix: 'に設定しました。' }
    case 'ファイル':
      return { prefix: 'ファイルを', verb: '添付', suffix: 'しました。' }
    default:
      return { prefix: '', verb: reason, suffix: 'しました。' }
  }
}

function formatRelative(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}時間前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}日前`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}ヶ月前`
  return `${Math.floor(mo / 12)}年前`
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length <= n ? s : s.slice(0, n) + '…'
}

function Avatar({ name, iconUrl }: { name: string; iconUrl?: string }): JSX.Element {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={name}
        className="w-9 h-9 rounded-full object-cover bg-gray-100 shrink-0"
        referrerPolicy="no-referrer"
      />
    )
  }
  const initial = name?.charAt(0) ?? '?'
  return (
    <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-medium text-sm shrink-0">
      {initial}
    </div>
  )
}

export default function NotificationsPanel({
  open,
  onClose,
  onUnreadCountChange
}: NotificationsPanelProps): JSX.Element | null {
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
  const navigate = useNavigate()
  const [items, setItems] = useState<BacklogNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlyUnread, setOnlyUnread] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${backendUrl}/api/notifications/backlog`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: BacklogNotification[]) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setItems(list)
        onUnreadCountChange?.(list.filter((n) => !n.alreadyRead).length)
      })
      .catch(() => {
        if (cancelled) return
        setError('お知らせの取得に失敗しました')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, backendUrl, onUnreadCountChange])

  const unreadCount = useMemo(() => items.filter((n) => !n.alreadyRead).length, [items])
  const filtered = useMemo(
    () => (onlyUnread ? items.filter((n) => !n.alreadyRead) : items),
    [items, onlyUnread]
  )

  const markRead = async (n: BacklogNotification): Promise<void> => {
    if (n.alreadyRead) return
    try {
      await fetch(`${backendUrl}/api/notifications/backlog/${n.spaceId}/${n.id}/read`, {
        method: 'POST'
      })
      setItems((prev) => {
        const next = prev.map((x) => (x.id === n.id ? { ...x, alreadyRead: true } : x))
        onUnreadCountChange?.(next.filter((x) => !x.alreadyRead).length)
        return next
      })
    } catch {
      // 既読化失敗は致命的でない
    }
  }

  const handleClick = async (n: BacklogNotification): Promise<void> => {
    await markRead(n)
    if (n.localTaskId) {
      navigate(`/tasks/${n.localTaskId}`)
      onClose()
    } else if (n.spaceDomain && n.issueKey) {
      window.open(`https://${n.spaceDomain}/view/${n.issueKey}`, '_blank')
    }
  }

  if (!open) return null

  return (
    <>
      {/* 背景クリックで閉じる薄いオーバーレイ */}
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-[420px] max-w-[95vw] bg-white shadow-2xl border-l border-gray-200 flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
          <Bell size={16} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-800">お知らせ</h2>
          {unreadCount > 0 && (
            <span className="text-xs font-normal text-gray-400">{unreadCount} 件未読</span>
          )}
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyUnread}
              onChange={(e) => setOnlyUnread(e.target.checked)}
              className="accent-emerald-600"
            />
            未読のみ
          </label>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* 本体 */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-2 text-sm">
              <Loader2 size={16} className="animate-spin" />
              読み込み中…
            </div>
          )}

          {error && (
            <div className="m-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-400">お知らせはありません</div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {filtered.map((n) => {
                const sentence = buildSentence(n.reasonText)
                return (
                  <li
                    key={`${n.spaceId}-${n.id}`}
                    onClick={() => handleClick(n)}
                    className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                      n.alreadyRead ? '' : 'bg-emerald-50/40'
                    }`}
                  >
                    <div className="flex gap-3">
                      <Avatar name={n.sender?.name ?? '?'} iconUrl={n.sender?.iconUrl} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[13px] text-gray-700 leading-snug">
                            <span className="font-semibold text-gray-800">
                              {n.sender?.name ?? '不明'}
                            </span>
                            <span className="text-gray-500"> さんが </span>
                            {sentence.prefix && (
                              <span className="text-gray-500">{sentence.prefix} </span>
                            )}
                            <span className="font-medium text-emerald-600">{sentence.verb}</span>
                            <span className="text-gray-500"> {sentence.suffix}</span>
                          </div>
                          <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">
                            {formatRelative(n.createdAt)}
                          </span>
                        </div>

                        {n.excerpt && (
                          <div className="mt-1 text-[13px] text-gray-700 break-words leading-snug">
                            「{truncate(n.excerpt, 90)}」
                          </div>
                        )}

                        <div className="mt-1.5 flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] text-gray-400 shrink-0">
                            {n.issueKey}
                          </span>
                          <span className="text-[11px] text-gray-500 truncate">
                            {truncate(n.issueTitle, 40)}
                          </span>
                          {n.issueStatus && (
                            <span
                              className={`ml-auto text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${statusBadgeClass(
                                n.issueStatus
                              )}`}
                            >
                              {n.issueStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}
