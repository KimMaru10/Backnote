import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { startBackend, stopBackend, BACKEND_PORT } from './backend'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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
    mainWindow.show()
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopBackend()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
