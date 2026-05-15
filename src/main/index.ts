import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { startBackend, stopBackend, BACKEND_PORT } from './backend'
import { createTray, stopTray } from './tray'
import { destroyTrayPopover, hideTrayPopover } from './popover'
import { startNotifier, stopNotifier } from './notifier'

let mainWindow: BrowserWindow | null = null

function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Backnote',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 通常の close は終了せず、ウィンドウを隠して Tray から再表示できるようにする。
  // 「終了」を選んだときだけ isQuiting フラグを立てて本当に終了。
  mainWindow.on('close', (event) => {
    if (!(app as unknown as { isQuiting: boolean }).isQuiting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.on('get-backend-port', (event) => {
  event.returnValue = BACKEND_PORT
})

// Tray ポップオーバーからメインウィンドウを前面化 + 該当パスへ遷移
ipcMain.on('open-in-main', (_event, path: string) => {
  hideTrayPopover()
  if (!mainWindow) return
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.send('navigate', path)
})

ipcMain.on('open-external', (_event, url: string) => {
  if (typeof url === 'string' && url.startsWith('http')) {
    void shell.openExternal(url)
  }
})

ipcMain.on('hide-tray-popover', () => {
  hideTrayPopover()
})

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors,NetworkServiceInProcess2')
app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess')

// シングルインスタンスロック。Tray 常駐型なので、ウィンドウを × で閉じた後に
// アプリアイコンを再クリックされても 2 つ目の Electron を起動しない。
// 起動してしまうとバックエンドが port 衝突で死ぬ。
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show()
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  try {
    await startBackend()
  } catch (err) {
    dialog.showErrorBox(
      'Backnote 起動エラー',
      `起動に失敗しました。アプリを再起動してください。\n${err instanceof Error ? err.message : String(err)}`
    )
  }

  createWindow()
  createTray(getMainWindow)
  startNotifier(getMainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

let isQuittingInProgress = false

app.on('before-quit', (event) => {
  ;(app as unknown as { isQuiting: boolean }).isQuiting = true
  if (isQuittingInProgress) return
  isQuittingInProgress = true

  stopTray()
  destroyTrayPopover()
  stopNotifier()

  // stopBackend の HTTP graceful shutdown 完了を待ってから app.quit() する。
  // これを待たないと requestShutdown が in-flight のままプロセスが落ち、
  // バックエンドの DB/Syncer クリーンアップが走らない。
  event.preventDefault()
  void stopBackend().finally(() => {
    app.quit()
  })
})

// Tray 常駐するため window-all-closed では quit しない。
// （macOS は元々この挙動だが、Windows/Linux でも同じにする）
app.on('window-all-closed', () => {
  // 何もしない: Tray から再表示するため
})
