import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { startBackend, stopBackend, BACKEND_PORT } from './backend'
import { createTray } from './tray'
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

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors,NetworkServiceInProcess2')
app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess')

app.whenReady().then(async () => {
  try {
    await startBackend()
  } catch (err) {
    dialog.showErrorBox(
      'Backnote Backend Error',
      `バックエンドの起動に失敗しました: ${err instanceof Error ? err.message : String(err)}`
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

app.on('before-quit', () => {
  ;(app as unknown as { isQuiting: boolean }).isQuiting = true
  stopNotifier()
  stopBackend()
})

// Tray 常駐するため window-all-closed では quit しない。
// （macOS は元々この挙動だが、Windows/Linux でも同じにする）
app.on('window-all-closed', () => {
  // 何もしない: Tray から再表示するため
})
