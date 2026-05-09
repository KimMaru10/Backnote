import { app, BrowserWindow, Menu, Tray, nativeImage, MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { BACKEND_PORT } from './backend'

const POLL_INTERVAL_MS = 30 * 1000
const URGENT_TASK_DISPLAY = 3
const NOTIFICATION_DISPLAY = 5

type TrayTask = {
  id: number
  issueKey: string
  title: string
  status: string
  score: number
  dueDate: string | null
}

type DueResponse = {
  dueToday: TrayTask[]
  overdue: TrayTask[]
}

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

function navigateInApp(path: string): void {
  const win = showAndFocus()
  // 既存の onNavigate 経由を再利用するため 'navigate' チャネル名で送る
  win?.webContents.send('navigate', path)
}

function openPalette(): void {
  const win = showAndFocus()
  win?.webContents.send('open-palette')
}

async function fetchDue(): Promise<DueResponse> {
  try {
    const res = await fetch(backendUrl('/api/notifications/due'))
    if (!res.ok) return { dueToday: [], overdue: [] }
    return (await res.json()) as DueResponse
  } catch {
    return { dueToday: [], overdue: [] }
  }
}

async function fetchUrgentTasks(limit: number): Promise<TrayTask[]> {
  try {
    const res = await fetch(backendUrl('/api/tasks'))
    if (!res.ok) return []
    const tasks = (await res.json()) as TrayTask[]
    return tasks
      .filter((t) => t.status !== '完了')
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  } catch {
    return []
  }
}

function urgencyEmoji(score: number): string {
  if (score >= 1.0) return '🔥'
  if (score >= 0.7) return '⚡'
  if (score >= 0.4) return '📅'
  if (score >= 0.2) return '🌱'
  return '☕'
}

function truncate(s: string, n = 28): string {
  return s.length <= n ? s : s.slice(0, n) + '…'
}

function buildLoadingMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: '📋 Backnote を開く', click: () => showAndFocus() },
    { type: 'separator' },
    { label: '読み込み中…', enabled: false },
    { type: 'separator' },
    {
      label: '🔚 終了',
      click: () => {
        ;(app as unknown as { isQuiting: boolean }).isQuiting = true
        app.quit()
      }
    }
  ])
}

async function rebuildMenu(): Promise<void> {
  if (!tray) return

  const [due, urgent] = await Promise.all([fetchDue(), fetchUrgentTasks(URGENT_TASK_DISPLAY)])
  const unread = due.dueToday.length + due.overdue.length

  // バッジ更新（macOS のみ）
  if (process.platform === 'darwin') {
    tray.setTitle(unread > 0 ? ` ${unread}` : '')
  }

  const items: MenuItemConstructorOptions[] = []

  items.push({ label: '📋 Backnote を開く', click: () => showAndFocus() })

  // 通知セクション
  if (unread > 0) {
    items.push({ type: 'separator' })
    items.push({ label: `🔔 通知 (${unread} 件)`, enabled: false })

    const all: { task: TrayTask; prefix: string; tag: string }[] = [
      ...due.overdue.map((task) => ({ task, prefix: '⚠️', tag: '期限超過' })),
      ...due.dueToday.map((task) => ({ task, prefix: '📅', tag: '今日期限' }))
    ]
    for (const { task, prefix, tag } of all.slice(0, NOTIFICATION_DISPLAY)) {
      items.push({
        label: `  ${prefix} ${task.issueKey} ${tag}: ${truncate(task.title)}`,
        click: () => navigateInApp(`/tasks/${task.id}`)
      })
    }
    if (all.length > NOTIFICATION_DISPLAY) {
      items.push({ label: '  もっと見る…', click: () => navigateInApp('/') })
    }
  }

  // 緊急タスクセクション
  if (urgent.length > 0) {
    items.push({ type: 'separator' })
    items.push({ label: '🔥 緊急タスク', enabled: false })
    for (const task of urgent) {
      items.push({
        label: `  ${urgencyEmoji(task.score)} ${task.issueKey}: ${truncate(task.title)}`,
        click: () => navigateInApp(`/tasks/${task.id}`)
      })
    }
  }

  // クイックアクション
  items.push({ type: 'separator' })
  items.push({
    label: '🍅 集中モードを開始',
    enabled: urgent.length > 0,
    click: () => {
      if (urgent[0]) navigateInApp(`/focus/${urgent[0].id}`)
    }
  })
  items.push({ label: '🔍 検索 (⌘K)', click: () => openPalette() })

  items.push({ type: 'separator' })
  items.push({ label: '⚙️ 設定', click: () => navigateInApp('/settings') })
  items.push({
    label: '🔚 終了',
    click: () => {
      ;(app as unknown as { isQuiting: boolean }).isQuiting = true
      app.quit()
    }
  })

  tray.setContextMenu(Menu.buildFromTemplate(items))
}

// アプリ起動中はずっと保持される。プロセス終了でのみ破棄。
export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
  getMainWindowFn = getMainWindow

  const iconPath = join(__dirname, '../../resources/icon.png')
  let image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    // アイコンが見つからない環境でも tray を作れるようフォールバック
    image = nativeImage.createEmpty()
  }
  // macOS のメニューバーは小さい白黒推奨。templateImage 化で自動対応。
  if (process.platform === 'darwin') {
    image = image.resize({ width: 18, height: 18 })
    image.setTemplateImage(true)
  }

  tray = new Tray(image)
  tray.setToolTip('Backnote')
  tray.setContextMenu(buildLoadingMenu())

  // クリックでウィンドウ表示
  tray.on('click', () => showAndFocus())

  // 初回構築 + 30 秒ポーリング
  void rebuildMenu()
  pollTimer = setInterval(() => {
    void rebuildMenu()
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
