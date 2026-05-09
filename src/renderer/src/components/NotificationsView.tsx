import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, AlertCircle, Bell, AlertTriangle, Flame } from 'lucide-react'
import { getScoreLabel } from '../utils/scoreLabel'

export type TabKey = 'notifications' | 'overdue' | 'priority'

export interface BacklogNotification {
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

export interface PanelTask {
  id: number
  issueKey: string
  title: string
  status: string
  score: number
  dueDate: string | null
  spaceId: number
}

interface DueResponse {
  dueToday: PanelTask[]
  overdue: PanelTask[]
}

export interface NotificationsViewProps {
  // 課題詳細を開くときの動作（in-app: navigate / popover: IPC）
  onOpenTask: (taskId: number) => void
  // 未同期課題は Backlog Web を別タブで開く（in-app: window.open / popover: IPC）
  onOpenExternal: (url: string) => void
  // 閉じる動作（in-app: パネル閉じる / popover: ウィンドウ非表示）
  onClose: () => void
  // 未読件数の変動を親に通知（バッジ更新用）
  onUnreadCountChange?: (count: number) => void
  // 親が「再フェッチして」と指示する用（popover が再表示されたとき増分）
  refreshNonce?: number
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

function daysOverdue(iso: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000))
}

function formatDueLabel(iso: string | null): string {
  if (!iso) return '-'
  const days = daysOverdue(iso)
  if (days > 0) return `${days}日超過`
  if (days === 0) return '今日期限'
  return new Date(iso).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })
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

interface TabButtonProps {
  label: string
  icon: JSX.Element
  active: boolean
  badge?: number
  onClick: () => void
}

function TabButton({ label, icon, active, badge, onClick }: TabButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`relative w-full flex flex-col items-center gap-1 py-3 transition-colors ${
        active
          ? 'bg-white text-emerald-700 border-l-2 border-emerald-500'
          : 'text-gray-500 hover:bg-white/60 border-l-2 border-transparent'
      }`}
    >
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  )
}

const TAB_CONFIG: Record<TabKey, { title: string; label: string }> = {
  notifications: { title: 'お知らせ', label: 'お知らせ' },
  overdue: { title: '期限切れ', label: '期限切れ' },
  priority: { title: '優先度高', label: '優先度' }
}

export default function NotificationsView({
  onOpenTask,
  onOpenExternal,
  onClose,
  onUnreadCountChange,
  refreshNonce
}: NotificationsViewProps): JSX.Element {
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
  const [tab, setTab] = useState<TabKey>('notifications')

  const [notifications, setNotifications] = useState<BacklogNotification[]>([])
  const [overdueTasks, setOverdueTasks] = useState<PanelTask[]>([])
  const [priorityTasks, setPriorityTasks] = useState<PanelTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlyUnread, setOnlyUnread] = useState(false)

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.alreadyRead).length,
    [notifications]
  )
  const overdueCount = overdueTasks.length

  // タブ切替時/再表示時にデータ取得
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const run = async (): Promise<void> => {
      try {
        if (tab === 'notifications') {
          const res = await fetch(`${backendUrl}/api/notifications/backlog`)
          if (!res.ok) throw new Error(`status ${res.status}`)
          const data = (await res.json()) as BacklogNotification[]
          if (cancelled) return
          const list = Array.isArray(data) ? data : []
          setNotifications(list)
          onUnreadCountChange?.(list.filter((n) => !n.alreadyRead).length)
        } else if (tab === 'overdue') {
          const res = await fetch(`${backendUrl}/api/notifications/due`)
          if (!res.ok) throw new Error(`status ${res.status}`)
          const data = (await res.json()) as DueResponse
          if (cancelled) return
          setOverdueTasks([...(data.overdue ?? []), ...(data.dueToday ?? [])])
        } else if (tab === 'priority') {
          const res = await fetch(`${backendUrl}/api/tasks`)
          if (!res.ok) throw new Error(`status ${res.status}`)
          const data = (await res.json()) as PanelTask[]
          if (cancelled) return
          const top = (Array.isArray(data) ? data : [])
            .filter((t) => t.status !== '完了')
            .sort((a, b) => b.score - a.score)
            .slice(0, 20)
          setPriorityTasks(top)
        }
      } catch {
        if (!cancelled) setError('取得に失敗しました')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [tab, backendUrl, onUnreadCountChange, refreshNonce])

  // 期限切れ件数（タブバッジ用）はパネル表示時に取得
  useEffect(() => {
    let cancelled = false
    fetch(`${backendUrl}/api/notifications/due`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DueResponse | null) => {
        if (cancelled || !data) return
        setOverdueTasks((prev) =>
          prev.length === 0 ? [...(data.overdue ?? []), ...(data.dueToday ?? [])] : prev
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [backendUrl, refreshNonce])

  const filteredNotifications = useMemo(
    () => (onlyUnread ? notifications.filter((n) => !n.alreadyRead) : notifications),
    [notifications, onlyUnread]
  )

  const markRead = async (n: BacklogNotification): Promise<void> => {
    if (n.alreadyRead) return
    try {
      await fetch(`${backendUrl}/api/notifications/backlog/${n.spaceId}/${n.id}/read`, {
        method: 'POST'
      })
      setNotifications((prev) => {
        const next = prev.map((x) => (x.id === n.id ? { ...x, alreadyRead: true } : x))
        onUnreadCountChange?.(next.filter((x) => !x.alreadyRead).length)
        return next
      })
    } catch {
      // 既読化失敗は致命的でない
    }
  }

  const handleNotificationClick = async (n: BacklogNotification): Promise<void> => {
    await markRead(n)
    if (n.localTaskId) {
      onOpenTask(n.localTaskId)
    } else if (n.spaceDomain && n.issueKey) {
      onOpenExternal(`https://${n.spaceDomain}/view/${n.issueKey}`)
    }
  }

  const handleTaskClick = (t: PanelTask): void => {
    onOpenTask(t.id)
  }

  const currentTitle = TAB_CONFIG[tab].title
  const currentTotal =
    tab === 'notifications'
      ? notifications.length
      : tab === 'overdue'
        ? overdueTasks.length
        : priorityTasks.length

  return (
    <div className="flex h-full bg-white">
      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">{currentTitle}</h2>
          {currentTotal > 0 && (
            <span className="text-xs font-normal text-gray-400">
              {tab === 'notifications' && unreadCount > 0
                ? `${unreadCount} 件未読`
                : `${currentTotal} 件`}
            </span>
          )}
          <div className="flex-1" />
          {tab === 'notifications' && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
                className="accent-emerald-600"
              />
              未読のみ
            </label>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* リスト */}
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

          {!loading && !error && tab === 'notifications' && (
            <NotificationList items={filteredNotifications} onClick={handleNotificationClick} />
          )}

          {!loading && !error && tab === 'overdue' && (
            <TaskList items={overdueTasks} variant="overdue" onClick={handleTaskClick} />
          )}

          {!loading && !error && tab === 'priority' && (
            <TaskList items={priorityTasks} variant="priority" onClick={handleTaskClick} />
          )}
        </div>
      </div>

      {/* タブサイドバー（右） */}
      <div className="w-[80px] shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col py-2">
        <TabButton
          label={TAB_CONFIG.notifications.label}
          icon={<Bell size={18} />}
          active={tab === 'notifications'}
          badge={unreadCount}
          onClick={() => setTab('notifications')}
        />
        <TabButton
          label={TAB_CONFIG.overdue.label}
          icon={<AlertTriangle size={18} />}
          active={tab === 'overdue'}
          badge={overdueCount}
          onClick={() => setTab('overdue')}
        />
        <TabButton
          label={TAB_CONFIG.priority.label}
          icon={<Flame size={18} />}
          active={tab === 'priority'}
          onClick={() => setTab('priority')}
        />
      </div>
    </div>
  )
}

interface NotificationListProps {
  items: BacklogNotification[]
  onClick: (n: BacklogNotification) => void
}

function NotificationList({ items, onClick }: NotificationListProps): JSX.Element {
  if (items.length === 0) {
    return <div className="text-center py-10 text-sm text-gray-400">お知らせはありません</div>
  }
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((n) => {
        const sentence = buildSentence(n.reasonText)
        return (
          <li
            key={`${n.spaceId}-${n.id}`}
            onClick={() => onClick(n)}
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
                    {sentence.prefix && <span className="text-gray-500">{sentence.prefix} </span>}
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
  )
}

interface TaskListProps {
  items: PanelTask[]
  variant: 'overdue' | 'priority'
  onClick: (t: PanelTask) => void
}

function TaskList({ items, variant, onClick }: TaskListProps): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-gray-400">
        {variant === 'overdue' ? '期限切れのタスクはありません' : 'タスクがありません'}
      </div>
    )
  }
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((t) => {
        const overdue = variant === 'overdue' && t.dueDate ? daysOverdue(t.dueDate) > 0 : false
        const score = getScoreLabel(t.score)
        return (
          <li
            key={t.id}
            onClick={() => onClick(t)}
            className="px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50"
          >
            <div className="flex items-start gap-3">
              {variant === 'overdue' ? (
                <div
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                    overdue ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  <AlertTriangle size={16} />
                </div>
              ) : (
                <div className="shrink-0 w-9 h-9 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-base">
                  {score.emoji}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[13px] text-gray-800 font-medium leading-snug break-words">
                    {t.title}
                  </div>
                  {t.status && (
                    <span
                      className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${statusBadgeClass(
                        t.status
                      )}`}
                    >
                      {t.status}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                  <span className="font-mono text-gray-400">{t.issueKey}</span>
                  {variant === 'overdue' && (
                    <span className={overdue ? 'text-rose-600 font-medium' : 'text-gray-500'}>
                      {formatDueLabel(t.dueDate)}
                    </span>
                  )}
                  {variant === 'priority' && (
                    <>
                      <span className={`${score.badgeClass} px-1.5 py-0.5 rounded`}>
                        {score.text}
                      </span>
                      {t.dueDate && <span>{formatDueLabel(t.dueDate)}</span>}
                    </>
                  )}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
