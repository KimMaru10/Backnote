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
  // Tray の検索メニューから CommandPalette を開く要求
  onOpenPalette: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on('open-palette', listener)
    return () => {
      ipcRenderer.removeListener('open-palette', listener)
    }
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
