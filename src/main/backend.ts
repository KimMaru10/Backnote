import { ChildProcess, spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { app, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import * as http from 'http'
import * as net from 'net'

const MAX_HEALTH_CHECK_RETRIES = 30
const HEALTH_CHECK_INTERVAL_MS = 500
const HEALTH_CHECK_TIMEOUT_MS = 1000
// Go 側の shutdownTimeout (backend/cmd/main.go) と揃えること。
// この値を変えるなら向こうも合わせて変更する。
const GRACEFUL_SHUTDOWN_MS = 5000
const FORCE_KILL_DELAY_MS = 1000
const SHUTDOWN_REQUEST_TIMEOUT_MS = 2000
const PORT_FREE_MAX_RETRIES = 20
const PORT_FREE_INTERVAL_MS = 500
const SHUTDOWN_TOKEN_HEADER = 'X-Shutdown-Token'

export const BACKEND_PORT = 8080

let backendProcess: ChildProcess | null = null
let intentionalShutdown = false
let shutdownToken = ''

function getBackendPath(): string {
  const binaryName = process.platform === 'win32' ? 'backnote-backend.exe' : 'backnote-backend'
  if (app.isPackaged) {
    return join(process.resourcesPath, 'backend', binaryName)
  }
  return join(app.getAppPath(), 'backend', 'bin', binaryName)
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

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false
    const done = (result: boolean): void => {
      if (resolved) return
      resolved = true
      resolve(result)
    }
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      socket.destroy()
      done(true)
    })
    socket.on('error', () => done(false))
    socket.setTimeout(300, () => {
      socket.destroy()
      done(false)
    })
  })
}

async function waitForPortFree(port: number): Promise<void> {
  for (let i = 0; i < PORT_FREE_MAX_RETRIES; i++) {
    if (!(await isPortInUse(port))) return
    await new Promise((r) => setTimeout(r, PORT_FREE_INTERVAL_MS))
  }
  // タイムアウトしても spawn を試みると bind 失敗で「予期せず終了しました」を再発させてしまうため、
  // 呼び出し元の起動エラーダイアログ経路に流す。
  throw new Error(
    `Port ${port} is still in use after ${PORT_FREE_MAX_RETRIES * PORT_FREE_INTERVAL_MS}ms.`
  )
}

export async function startBackend(port: number = BACKEND_PORT): Promise<void> {
  const backendPath = getBackendPath()

  if (!existsSync(backendPath)) {
    throw new Error(`Backend binary not found: ${backendPath}`)
  }

  // 前回のバックエンドが孤児として残っているケースに備えて port が空くのを待つ。
  // 空かないまま spawn すると bind 失敗で log.Fatalf → exit ハンドラがダイアログを出してしまう。
  await waitForPortFree(port)

  intentionalShutdown = false
  shutdownToken = randomBytes(32).toString('hex')

  return new Promise((resolve, reject) => {
    const childStdio: 'inherit' | 'ignore' = app.isPackaged ? 'ignore' : 'inherit'
    backendProcess = spawn(backendPath, [], {
      env: {
        ...process.env,
        BACKNOTE_PORT: String(port),
        BACKNOTE_SHUTDOWN_TOKEN: shutdownToken
      },
      stdio: ['ignore', childStdio, childStdio]
    })

    backendProcess.on('error', (err) => {
      backendProcess = null
      reject(new Error(`Backend spawn failed: ${err.message}`))
    })

    backendProcess.on('exit', (code) => {
      backendProcess = null
      // 意図的なシャットダウン中はダイアログを出さない。
      // Windows の kill('SIGTERM') は TerminateProcess 相当で非0 終了になるため、
      // 通常終了とクラッシュを区別する手がかりとしてこのフラグを使う。
      if (intentionalShutdown) return
      if (code !== 0 && code !== null) {
        dialog.showErrorBox(
          'Backnote エラー',
          `処理が予期せず終了しました。アプリを再起動してください。\n(error code: ${code})`
        )
      }
    })

    waitForHealth(port).then(resolve).catch(reject)
  })
}

function requestShutdown(port: number): Promise<void> {
  if (!shutdownToken) return Promise.resolve()
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: '/api/shutdown',
        method: 'POST',
        headers: {
          [SHUTDOWN_TOKEN_HEADER]: shutdownToken
        }
      },
      (res) => {
        res.resume()
        res.on('end', () => resolve())
      }
    )
    req.on('error', () => resolve())
    req.setTimeout(SHUTDOWN_REQUEST_TIMEOUT_MS, () => {
      req.destroy()
      resolve()
    })
    req.end()
  })
}

export function stopBackend(port: number = BACKEND_PORT): Promise<void> {
  if (!backendProcess) return Promise.resolve()

  const proc = backendProcess
  backendProcess = null
  intentionalShutdown = true

  const waitForExit = new Promise<void>((resolve) => {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      resolve()
      return
    }
    proc.once('exit', () => resolve())
  })

  // まず HTTP で graceful shutdown を要求。バックエンドは DB/Syncer をクローズして exit 0。
  // クロスプラットフォームで同じシャットダウン経路を辿るのが狙い。
  // 重要: response が返ってきた時点ではバックエンドはまだクリーンアップ中。
  // ここで kill すると defer の writer.Stop/syncer.Stop が走り切らず、
  // listener が解放されないまま終了 → 次回起動時に port 衝突で log.Fatalf する。
  // よって response 受信後も自然終了を待ち、GRACEFUL_SHUTDOWN_MS タイムアウト時のみ kill する。
  return requestShutdown(port).then(() => {
    if (proc.exitCode !== null || proc.signalCode !== null) return

    const killTimer = setTimeout(() => {
      if (proc.exitCode !== null || proc.signalCode !== null) return
      proc.kill('SIGTERM')
      const forceKillTimer = setTimeout(() => {
        if (proc.exitCode === null && proc.signalCode === null) {
          proc.kill('SIGKILL')
        }
      }, FORCE_KILL_DELAY_MS)
      proc.once('exit', () => clearTimeout(forceKillTimer))
    }, GRACEFUL_SHUTDOWN_MS)

    return waitForExit.finally(() => clearTimeout(killTimer))
  })
}
