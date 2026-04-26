import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

// アプリ起動中はずっと保持される。プロセス終了でのみ破棄。
export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
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

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '開く',
      click: () => {
        const win = getMainWindow()
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        // 通常の close では非表示になる。終了時はフラグを立てて quit する。
        ;(app as unknown as { isQuiting: boolean }).isQuiting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)

  // クリックでウィンドウ表示
  tray.on('click', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isVisible()) {
      win.focus()
    } else {
      win.show()
    }
  })

  return tray
}

export function getTray(): Tray | null {
  return tray
}
