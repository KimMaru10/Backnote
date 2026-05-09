import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NotificationsView from './NotificationsView'

interface NotificationsPanelProps {
  open: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

const ANIMATION_MS = 280

export default function NotificationsPanel({
  open,
  onClose,
  onUnreadCountChange
}: NotificationsPanelProps): JSX.Element | null {
  const navigate = useNavigate()
  // 入退場アニメーション制御:
  // - shouldRender: DOM に乗せるかどうか（true の間だけ要素を描画）
  // - active: transform/opacity の最終状態（true で表示、false で隠す）
  const [shouldRender, setShouldRender] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      // 1 フレーム遅らせて初期 state（translate-x-full）から最終 state へトランジション
      const id = window.requestAnimationFrame(() => setActive(true))
      return () => window.cancelAnimationFrame(id)
    }
    setActive(false)
    const t = window.setTimeout(() => setShouldRender(false), ANIMATION_MS)
    return () => window.clearTimeout(t)
  }, [open])

  if (!shouldRender) return null

  const handleOpenTask = (taskId: number): void => {
    navigate(`/tasks/${taskId}`)
    onClose()
  }
  const handleOpenExternal = (url: string): void => {
    window.open(url, '_blank')
  }

  return (
    <>
      {/* 背景クリックで閉じる薄いオーバーレイ（フェード） */}
      <div
        className={`fixed inset-0 z-40 bg-black/10 transition-opacity duration-[280ms] ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-[500px] max-w-[95vw] bg-white shadow-2xl border-l border-gray-200 transition-transform duration-[280ms] ease-out ${
          active ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
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
