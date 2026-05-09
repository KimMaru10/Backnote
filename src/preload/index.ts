import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getBackendUrl: (): string => {
    return `http://localhost:${ipcRenderer.sendSync('get-backend-port')}`
  },
  // 通知クリックなどで main プロセスから受け取るナビゲーションイベント
  onNavigate: (handler: (path: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, path: string): void => handler(path)
    ipcRenderer.on('navigate', listener)
    return () => {
      ipcRenderer.removeListener('navigate', listener)
    }
  },
  // Tray ポップオーバーからメインウィンドウを前面化 + 該当パスへ遷移
  openInMain: (path: string): void => {
    ipcRenderer.send('open-in-main', path)
  },
  // Tray ポップオーバーから外部 URL を OS のブラウザで開く
  openExternal: (url: string): void => {
    ipcRenderer.send('open-external', url)
  },
  // Tray ポップオーバーを非表示にする
  hideTrayPopover: (): void => {
    ipcRenderer.send('hide-tray-popover')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (_err: unknown) {
    // contextBridge 登録失敗はアプリ起動不可のため再スロー
    throw _err
  }
}
