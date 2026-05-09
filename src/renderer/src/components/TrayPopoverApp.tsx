import { useEffect, useState } from 'react'
import NotificationsView from './NotificationsView'

// Tray からポップオーバーされたとき index.html#/popover で起動される。
// メインアプリの HashRouter とは独立した最小構成で、
// クリック操作はすべて IPC でメインウィンドウに引き渡す。
export default function TrayPopoverApp(): JSX.Element {
  const [refreshNonce, setRefreshNonce] = useState(0)

  // 再表示（ウィンドウフォーカス）のたびにリスト再取得
  useEffect(() => {
    const handler = (): void => setRefreshNonce((k) => k + 1)
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [])

  const handleOpenTask = (taskId: number): void => {
    window.api?.openInMain?.(`/tasks/${taskId}`)
  }
  const handleOpenExternal = (url: string): void => {
    window.api?.openExternal?.(url)
  }
  const handleClose = (): void => {
    window.api?.hideTrayPopover?.()
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <NotificationsView
        onOpenTask={handleOpenTask}
        onOpenExternal={handleOpenExternal}
        onClose={handleClose}
        refreshNonce={refreshNonce}
      />
    </div>
  )
}
