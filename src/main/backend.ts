import { ChildProcess, spawn } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import http from 'http'

let backendProcess: ChildProcess | null = null

function getBackendPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'backend', 'peeltask-backend')
  }
  return join(app.getAppPath(), 'backend', 'bin', 'peeltask-backend')
}

function waitForHealth(port: number, maxRetries: number = 30): Promise<void> {
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

      req.setTimeout(1000, () => {
        req.destroy()
        retry()
      })
    }

    const retry = (): void => {
      retries++
      if (retries >= maxRetries) {
        reject(new Error(`Backend failed to start after ${maxRetries} retries`))
        return
      }
      setTimeout(check, 500)
    }

    check()
  })
}

export async function startBackend(port: number = 8080): Promise<void> {
  const backendPath = getBackendPath()

  backendProcess = spawn(backendPath, [], {
    env: {
      ...process.env,
      PEELTASK_PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  backendProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[backend] ${data.toString().trim()}`)
  })

  backendProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[backend] ${data.toString().trim()}`)
  })

  backendProcess.on('exit', (code) => {
    console.log(`[backend] process exited with code ${code}`)
    backendProcess = null
  })

  await waitForHealth(port)
  console.log(`[backend] ready on port ${port}`)
}

export function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill('SIGTERM')

    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        backendProcess.kill('SIGKILL')
      }
    }, 3000)

    backendProcess = null
  }
}
