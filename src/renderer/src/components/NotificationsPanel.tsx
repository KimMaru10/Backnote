import { useNavigate } from 'react-router-dom'
import NotificationsView from './NotificationsView'

interface NotificationsPanelProps {
  open: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

export default function NotificationsPanel({
  open,
  onClose,
  onUnreadCountChange
}: NotificationsPanelProps): JSX.Element | null {
  const navigate = useNavigate()
  if (!open) return null

  const handleOpenTask = (taskId: number): void => {
    navigate(`/tasks/${taskId}`)
    onClose()
  }
  const handleOpenExternal = (url: string): void => {
    window.open(url, '_blank')
  }

  return (
    <>
      {/* 背景クリックで閉じる薄いオーバーレイ */}
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-[500px] max-w-[95vw] bg-white shadow-2xl border-l border-gray-200">
        <NotificationsView
          onOpenTask={handleOpenTask}
          onOpenExternal={handleOpenExternal}
          onClose={onClose}
          onUnreadCountChange={onUnreadCountChange}
        />
      </aside>
    </>
  )
}
