import { ChildProcess, spawn } from 'child_process'
import { app, dialog, Notification } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, WriteStream } from 'fs'
import * as http from 'http'

const MAX_HEALTH_CHECK_RETRIES = 30
const HEALTH_CHECK_INTERVAL_MS = 500
const HEALTH_CHECK_TIMEOUT_MS = 1000
const GRACEFUL_SHUTDOWN_MS = 3000

// 起動後の生存監視 (#49 調査用)
const HEALTH_WATCH_INTERVAL_MS = 30 * 1000
const HEALTH_WATCH_TIMEOUT_MS = 5 * 1000
const HEALTH_WATCH_FAIL_THRESHOLD = 3

export const BACKEND_PORT = 8080

let backendProcess: ChildProcess | null = null
let logStream: WriteStream | null = null
let healthWatcherTimer: NodeJS.Timeout | null = null
let consecutiveHealthFailures = 0
let healthNotifiedAt: number | null = null

function getLogStream(): WriteStream {
  if (logStream) return logStream
  const dir = app.getPath('logs')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'backend.log')
  // バックエンドの Echo middleware は method/uri/status/latency のみ出力する設定 (backend/cmd/main.go)
  // であり Authorization ヘッダや API トークンを stdout に書き出さないため、生 pipe で問題ない。
  // TODO(#49): 調査完了後にローテーション or 期間トリムを検討する。
  logStream = createWriteStream(path, { flags: 'a' })
  return logStream
}

function logEvent(line: string): void {
  const stream = getLogStream()
  stream.write(`[${new Date().toISOString()}] [main] ${line}\n`)
}

function getBackendPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'backend', 'backnote-backend')
  }
  return join(app.getAppPath(), 'backend', 'bin', 'backnote-backend')
}

function waitForHealth(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let retries = 0

    const check = (): void => {
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        // body を消費して Keep-Alive socket を解放する (連続リトライ時の遅延防止)
        res.resume()
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

function startHealthWatcher(port: number): void {
  if (healthWatcherTimer) clearInterval(healthWatcherTimer)
  consecutiveHealthFailures = 0
  healthNotifiedAt = null

  const onSuccess = (): void => {
    if (consecutiveHealthFailures > 0) {
      logEvent(`health recovered after ${consecutiveHealthFailures} failure(s)`)
    }
    consecutiveHealthFailures = 0
    healthNotifiedAt = null
  }

  const onFailure = (reason: string): void => {
    consecutiveHealthFailures++
    logEvent(`health watch failed (${consecutiveHealthFailures}): ${reason}`)

    if (
      consecutiveHealthFailures >= HEALTH_WATCH_FAIL_THRESHOLD &&
      healthNotifiedAt === null
    ) {
      healthNotifiedAt = Date.now()
      logEvent(`health watch: threshold reached, surfacing notification`)
      try {
        new Notification({
          title: 'Backnote バックエンド応答なし',
          body: `${HEALTH_WATCH_FAIL_THRESHOLD} 回連続で /api/health に失敗しました。ログを確認してください。`
        }).show()
      } catch (e) {
        logEvent(`notification failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  healthWatcherTimer = setInterval(() => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      // body を消費して Keep-Alive socket を解放する
      res.resume()
      if (res.statusCode === 200) {
        onSuccess()
      } else {
        onFailure(`status=${res.statusCode}`)
      }
    })
    req.on('error', (err) => onFailure(`error=${err.message}`))
    req.setTimeout(HEALTH_WATCH_TIMEOUT_MS, () => {
      req.destroy()
      onFailure('timeout')
    })
  }, HEALTH_WATCH_INTERVAL_MS)
}

export async function startBackend(port: number = BACKEND_PORT): Promise<void> {
  const backendPath = getBackendPath()
  const stream = getLogStream()
  stream.write(`\n===== ${new Date().toISOString()} startBackend port=${port} =====\n`)

  if (!existsSync(backendPath)) {
    logEvent(`ERROR: backend binary not found: ${backendPath}`)
    throw new Error(`Backend binary not found: ${backendPath}`)
  }

  return new Promise((resolve, reject) => {
    backendProcess = spawn(backendPath, [], {
      env: {
        ...process.env,
        BACKNOTE_PORT: String(port)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    logEvent(`backend spawned pid=${backendProcess.pid} path=${backendPath}`)

    backendProcess.stdout?.pipe(stream, { end: false })
    backendProcess.stderr?.pipe(stream, { end: false })

    backendProcess.on('error', (err) => {
      logEvent(`backend spawn error: ${err.message}`)
      backendProcess = null
      reject(new Error(`Backend spawn failed: ${err.message}`))
    })

    backendProcess.on('exit', (code, signal) => {
      const detail = code !== null ? `code=${code}` : `signal=${signal}`
      logEvent(`backend exited ${detail}`)
      backendProcess = null

      if (healthWatcherTimer) {
        clearInterval(healthWatcherTimer)
        healthWatcherTimer = null
      }

      // 異常終了 (非 0 終了 or シグナル終了) は通知。
      // SIGTERM はアプリ終了時の正規シャットダウンなので除外。
      const abnormal = (code !== null && code !== 0) || (signal !== null && signal !== 'SIGTERM')
      if (abnormal) {
        dialog.showErrorBox(
          'Backnote エラー',
          `処理が予期せず終了しました。アプリを再起動してください。\n(${detail})`
        )
      }
    })

    waitForHealth(port)
      .then(() => {
        logEvent('backend health OK, starting watcher')
        startHealthWatcher(port)
        resolve()
      })
      .catch((err) => {
        logEvent(`backend startup health timeout: ${err.message}`)
        reject(err)
      })
  })
}

export function stopBackend(): void {
  if (healthWatcherTimer) {
    clearInterval(healthWatcherTimer)
    healthWatcherTimer = null
  }

  if (logStream) {
    logStream.write(`===== ${new Date().toISOString()} stopBackend =====\n`)
  }

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
