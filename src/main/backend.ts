import { ChildProcess, spawn } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import http from 'http'

const MAX_HEALTH_CHECK_RETRIES = 30
const HEALTH_CHECK_INTERVAL_MS = 500
const HEALTH_CHECK_TIMEOUT_MS = 1000
const GRACEFUL_SHUTDOWN_MS = 3000

export const BACKEND_PORT = 8080

let backendProcess: ChildProcess | null = null

function getBackendPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'backend', 'peeltask-backend')
  }
  return join(app.getAppPath(), 'backend', 'bin', 'peeltask-backend')
}

function waitForHealth(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let retries = 0

    const check = (): void => {
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve()
        } else {
          retry()
        }
      })

      req.on('error', () => {
        retry()
      })

      req.setTimeout(HEALTH_CHECK_TIMEOUT_MS, () => {
        req.destroy()
        retry()
      })
    }

    const retry = (): void => {
      retries++
      if (retries >= MAX_HEALTH_CHECK_RETRIES) {
        reject(new Error(`Backend failed to start after ${MAX_HEALTH_CHECK_RETRIES} retries`))
        return
      }
      setTimeout(check, HEALTH_CHECK_INTERVAL_MS)
    }

    check()
  })
}

export async function startBackend(port: number = BACKEND_PORT): Promise<void> {
  const backendPath = getBackendPath()

  if (!existsSync(backendPath)) {
    throw new Error(`Backend binary not found: ${backendPath}`)
  }

  backendProcess = spawn(backendPath, [], {
    env: {
      ...process.env,
      PEELTASK_PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  backendProcess.on('error', (err) => {
    backendProcess = null
    throw new Error(`Backend spawn failed: ${err.message}`)
  })

  backendProcess.on('exit', (code) => {
    backendProcess = null
    if (code !== 0 && code !== null) {
      throw new Error(`Backend exited unexpectedly with code ${code}`)
    }
  })

  await waitForHealth(port)
}

export function stopBackend(): void {
  if (!backendProcess) return

  const proc = backendProcess
  backendProcess = null

  proc.kill('SIGTERM')

  setTimeout(() => {
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill('SIGKILL')
    }
  }, GRACEFUL_SHUTDOWN_MS)
}
