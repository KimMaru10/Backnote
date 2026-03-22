import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getBackendUrl: (): string => 'http://localhost:8080'
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
}
