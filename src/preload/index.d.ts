declare global {
  interface Window {
    api?: {
      getBackendUrl: () => string
      onNavigate?: (handler: (path: string) => void) => () => void
      openInMain?: (path: string) => void
      openExternal?: (url: string) => void
      hideTrayPopover?: () => void
    }
  }
}

export {}
