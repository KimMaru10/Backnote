declare global {
  interface Window {
    api?: {
      getBackendUrl: () => string
    }
  }
}

export {}
