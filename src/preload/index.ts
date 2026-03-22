import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getBackendUrl: (): string => {
    return `http://localhost:${ipcRenderer.sendSync('get-backend-port')}`
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
}
