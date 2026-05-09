import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'

const POPOVER_WIDTH = 500
const POPOVER_HEIGHT = 600

let popoverWindow: BrowserWindow | null = null

function createPopoverWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Backnote',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // メインウィンドウと同じ index.html を読み込み、hash で popover モードに切替
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/popover`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/popover' })
  }

  // 外側クリックや別ウィンドウへのフォーカスで自動非表示
  win.on('blur', () => {
    if (!popoverWindow || popoverWindow.isDestroyed()) return
    if (popoverWindow.webContents.isDevToolsOpened()) return
    popoverWindow.hide()
  })

  return win
}

function getOrCreate(): BrowserWindow {
  if (!popoverWindow || popoverWindow.isDestroyed()) {
    popoverWindow = createPopoverWindow()
  }
  return popoverWindow
}

// Tray アイコンの位置を基準にメニューバー直下に配置する。
// macOS は画面右上のメニューバーが多いので、X はトレイアイコン中心、Y はバー直下。
function positionNearTray(win: BrowserWindow, trayBounds: Electron.Rectangle): void {
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const work = display.workArea
  const winBounds = win.getBounds()

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2)
  if (x + winBounds.width > work.x + work.width - 4) {
    x = work.x + work.width - winBounds.width - 4
  }
  if (x < work.x + 4) x = work.x + 4

  const y = Math.round(trayBounds.y + trayBounds.height + 4)
  win.setPosition(x, y, false)
}

export function toggleTrayPopover(trayBounds: Electron.Rectangle): void {
  const win = getOrCreate()
  if (win.isVisible()) {
    win.hide()
    return
  }
  positionNearTray(win, trayBounds)
  win.show()
  win.focus()
}

export function hideTrayPopover(): void {
  if (popoverWindow && !popoverWindow.isDestroyed() && popoverWindow.isVisible()) {
    popoverWindow.hide()
  }
}

export function destroyTrayPopover(): void {
  if (popoverWindow && !popoverWindow.isDestroyed()) {
    popoverWindow.destroy()
  }
  popoverWindow = null
}
