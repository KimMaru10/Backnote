declare global {
  interface Window {
    api?: {
      getBackendUrl: () => string
      onNavigate?: (handler: (path: string) => void) => () => void
      onOpenPalette?: (handler: () => void) => () => void
    }
  }
}

export {}
