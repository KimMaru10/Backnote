import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { BACKEND_PORT } from './backend'
import { toggleTrayPopover } from './popover'

// バッジ更新は Backlog API への負荷を抑えるため 2 分間隔。
// 同タイミングで notifier.ts の Backlog 通知ポーリングも走るので、ユーザー体感も揃う。
const POLL_INTERVAL_MS = 2 * 60 * 1000

let tray: Tray | null = null
let pollTimer: NodeJS.Timeout | null = null
let getMainWindowFn: (() => BrowserWindow | null) | null = null

function backendUrl(path: string): string {
  return `http://localhost:${BACKEND_PORT}${path}`
}

function showAndFocus(): BrowserWindow | null {
  const win = getMainWindowFn?.() ?? null
  if (!win) return null
  if (!win.isVisible()) win.show()
  win.focus()
  return win
}

async function fetchUnreadCount(): Promise<number> {
  try {
    const res = await fetch(backendUrl('/api/notifications/backlog/count'))
    if (!res.ok) return 0
    const data = (await res.json()) as { unread: number }
    return data.unread ?? 0
  } catch {
    return 0
  }
}

async function updateBadge(): Promise<void> {
  if (!tray) return
  if (process.platform !== 'darwin') return
  const unread = await fetchUnreadCount()
  tray.setTitle(unread > 0 ? ` ${unread}` : '')
}

// アプリ起動中はずっと保持される。プロセス終了でのみ破棄。
export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
  getMainWindowFn = getMainWindow

  // resources/trayTemplate.png は黒シルエット + 透明背景のテンプレート画像。
  // 同ディレクトリの trayTemplate@2x.png (32x32) が Retina で自動選択される。
  const iconPath = join(__dirname, '../../resources/trayTemplate.png')
  let image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    // アイコンが見つからない環境でも tray を作れるようフォールバック
    image = nativeImage.createEmpty()
  }
  // macOS のメニューバーは白黒推奨。テンプレート画像化で light/dark 自動対応。
  if (process.platform === 'darwin') {
    image.setTemplateImage(true)
  }

  tray = new Tray(image)
  tray.setToolTip('Backnote')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Backnote を開く',
      click: () => showAndFocus()
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        ;(app as unknown as { isQuiting: boolean }).isQuiting = true
        app.quit()
      }
    }
  ])

  // setContextMenu を使うと macOS では左クリックでもメニューが出てしまい
  // ポップオーバーと重なる。右クリック時に明示的に popUpContextMenu を呼ぶ。
  tray.on('click', () => {
    if (!tray) return
    toggleTrayPopover(tray.getBounds())
  })
  tray.on('right-click', () => {
    if (!tray) return
    tray.popUpContextMenu(contextMenu)
  })

  // 30 秒ごとに未読件数を更新（macOS のみバッジ表示）
  void updateBadge()
  pollTimer = setInterval(() => {
    void updateBadge()
  }, POLL_INTERVAL_MS)

  return tray
}

export function stopTray(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function getTray(): Tray | null {
  return tray
}
