import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getBackendUrl: (): string => {
    return `http://localhost:${ipcRenderer.sendSync('get-backend-port')}`
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
