import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Loader2, AlertCircle } from 'lucide-react'

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

function reasonClass(reason: string): string {
  switch (reason) {
    case 'コメント':
      return 'text-emerald-600'
    case '担当者':
      return 'text-emerald-600'
    case '更新':
      return 'text-emerald-600'
    case 'ファイル':
      return 'text-blue-600'
    default:
      return 'text-gray-600'
  }
}

function statusBadgeStyle(color: string): React.CSSProperties {
  if (!color) return {}
  return { backgroundColor: color, color: '#fff' }
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
        className="w-10 h-10 rounded-full object-cover bg-gray-100"
        referrerPolicy="no-referrer"
      />
    )
  }
  const initial = name?.charAt(0) ?? '?'
  return (
    <div className="w-10 h-10 rounded-full bg-orange-400 text-white flex items-center justify-center font-semibold text-sm">
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
  const [senderFilter, setSenderFilter] = useState<string>('')
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

  // ユーザー絞り込み候補
  const senderOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: { id: number; name: string }[] = []
    for (const n of items) {
      if (!n.sender || !n.sender.name || seen.has(n.sender.name)) continue
      seen.add(n.sender.name)
      out.push({ id: n.sender.id, name: n.sender.name })
    }
    return out
  }, [items])

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (onlyUnread && n.alreadyRead) return false
      if (senderFilter && n.sender?.name !== senderFilter) return false
      return true
    })
  }, [items, onlyUnread, senderFilter])

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
      {/* クリックで閉じる薄い backdrop */}
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-[420px] max-w-[95vw] bg-white shadow-2xl flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500 text-white">
          <h2 className="text-base font-semibold mr-2">お知らせ</h2>
          <select
            value={senderFilter}
            onChange={(e) => setSenderFilter(e.target.value)}
            className="flex-1 bg-white text-gray-700 text-sm rounded-md px-2 py-1.5 outline-none"
          >
            <option value="">ユーザーで絞り込み</option>
            {senderOptions.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
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
            className="ml-1 p-1 rounded-md hover:bg-emerald-600/40 transition-colors"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* 本体 */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
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
            <div className="text-center py-10 text-gray-400 text-sm">お知らせはありません</div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-gray-200">
              {filtered.map((n) => (
                <li
                  key={`${n.spaceId}-${n.id}`}
                  onClick={() => handleClick(n)}
                  className={`px-4 py-3 cursor-pointer hover:bg-white transition-colors ${
                    n.alreadyRead ? 'bg-gray-50' : 'bg-white'
                  }`}
                >
                  <div className="flex gap-3">
                    <Avatar name={n.sender?.name ?? '?'} iconUrl={n.sender?.iconUrl} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[13px] text-gray-800">
                          <span className="font-semibold">{n.sender?.name ?? '不明'}</span>
                          <span className="mx-1">さんが</span>
                          {n.reasonText === '担当者' || n.reasonText === '更新' || n.reasonText === 'コメント' ? (
                            <>
                              <span className={`font-medium ${reasonClass(n.reasonText)}`}>
                                {n.reasonText}
                              </span>
                              <span className="ml-1">
                                {n.reasonText === '担当者' ? 'に設定しました。' : 'しました。'}
                              </span>
                            </>
                          ) : (
                            <span className={`font-medium ${reasonClass(n.reasonText)}`}>
                              {n.reasonText}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[11px] text-gray-400">{formatRelative(n.createdAt)}</span>
                          {n.issueStatus && (
                            <span
                              className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={statusBadgeStyle(n.statusColor)}
                            >
                              {n.issueStatus}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-[13px] text-gray-700 break-words">
                        「{truncate(n.excerpt, 90)}」
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500 truncate">
                        <span className="font-mono">{n.issueKey}</span>
                        {n.issueTitle && <span className="ml-1">{truncate(n.issueTitle, 40)}</span>}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}
