import { Notification, BrowserWindow, app } from 'electron'
import { BACKEND_PORT } from './backend'

const NOTIFICATION_CHECK_INTERVAL_MS = 30 * 60 * 1000 // 30分
const SUMMARY_CHECK_INTERVAL_MS = 60 * 1000 // 1分（朝のサマリ時刻判定用）
const RENOTIFY_AFTER_MS = 6 * 60 * 60 * 1000 // 同じタスクは 6 時間あけて再通知（その日の最初は通知）

type Settings = {
  notification_enabled?: string
  remind_today?: string
  remind_overdue?: string
  morning_summary?: string
  morning_summary_time?: string
}

type Task = {
  id: number
  issueKey: string
  title: string
  dueDate: string | null
  lastNotifiedAt: string | null
}

type DueResponse = {
  dueToday: Task[]
  overdue: Task[]
}

let dueIntervalId: NodeJS.Timeout | null = null
let summaryIntervalId: NodeJS.Timeout | null = null
let lastSummaryDate: string | null = null

function backendUrl(path: string): string {
  return `http://localhost:${BACKEND_PORT}${path}`
}

async function fetchSettings(): Promise<Settings> {
  try {
    const res = await fetch(backendUrl('/api/settings'))
    if (!res.ok) return {}
    return (await res.json()) as Settings
  } catch {
    return {}
  }
}

async function fetchDue(): Promise<DueResponse | null> {
  try {
    const res = await fetch(backendUrl('/api/notifications/due'))
    if (!res.ok) return null
    return (await res.json()) as DueResponse
  } catch {
    return null
  }
}

async function markNotified(taskIds: number[]): Promise<void> {
  if (taskIds.length === 0) return
  try {
    await fetch(backendUrl('/api/notifications/mark'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds })
    })
  } catch {
    // 通知発行自体は成功しているので、mark の失敗は次回再通知で許容
  }
}

function shouldRenotify(task: Task): boolean {
  if (!task.lastNotifiedAt) return true
  const last = new Date(task.lastNotifiedAt).getTime()
  if (Number.isNaN(last)) return true
  return Date.now() - last >= RENOTIFY_AFTER_MS
}

function showTaskNotification(
  task: Task,
  type: 'today' | 'overdue',
  getMainWindow: () => BrowserWindow | null
): void {
  const title = type === 'today' ? '⚡ 今日が期限のタスク' : '🔥 期限切れのタスク'
  const body = `${task.issueKey}: ${task.title}`
  const notification = new Notification({ title, body })
  notification.on('click', () => {
    const win = getMainWindow()
    if (!win) return
    win.show()
    win.focus()
    win.webContents.send('navigate', `/tasks/${task.id}`)
  })
  notification.show()
}

function showSummaryNotification(
  todayCount: number,
  overdueCount: number,
  getMainWindow: () => BrowserWindow | null
): void {
  const title = '📋 今日のタスク'
  const body = `今日の期限: ${todayCount} 件 / 期限切れ: ${overdueCount} 件`
  const notification = new Notification({ title, body })
  notification.on('click', () => {
    const win = getMainWindow()
    if (!win) return
    win.show()
    win.focus()
  })
  notification.show()
}

async function checkAndNotifyDue(getMainWindow: () => BrowserWindow | null): Promise<void> {
  const settings = await fetchSettings()
  if (settings.notification_enabled !== 'true') return

  const due = await fetchDue()
  if (!due) return

  const notifiedIds: number[] = []

  if (settings.remind_today === 'true') {
    for (const task of due.dueToday) {
      if (shouldRenotify(task)) {
        showTaskNotification(task, 'today', getMainWindow)
        notifiedIds.push(task.id)
      }
    }
  }
  if (settings.remind_overdue === 'true') {
    for (const task of due.overdue) {
      if (shouldRenotify(task)) {
        showTaskNotification(task, 'overdue', getMainWindow)
        notifiedIds.push(task.id)
      }
    }
  }

  if (notifiedIds.length > 0) {
    await markNotified(notifiedIds)
    updateBadge(due.dueToday.length + due.overdue.length)
  } else {
    updateBadge(due.dueToday.length + due.overdue.length)
  }
}

function updateBadge(count: number): void {
  if (process.platform === 'darwin') {
    app.dock?.setBadge(count > 0 ? String(count) : '')
  }
}

// 毎分、現在時刻が設定の朝のサマリ時刻と一致するか判定。
// 一日に一度だけ発火。
async function checkAndNotifySummary(getMainWindow: () => BrowserWindow | null): Promise<void> {
  const settings = await fetchSettings()
  if (settings.notification_enabled !== 'true') return
  if (settings.morning_summary !== 'true') return

  const targetTime = settings.morning_summary_time ?? '09:00'
  const [hStr, mStr] = targetTime.split(':')
  const targetH = Number(hStr)
  const targetM = Number(mStr)
  if (Number.isNaN(targetH) || Number.isNaN(targetM)) return

  const now = new Date()
  if (now.getHours() !== targetH || now.getMinutes() !== targetM) return

  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  if (lastSummaryDate === today) return // 今日はもう発火済み

  const due = await fetchDue()
  if (!due) return

  if (due.dueToday.length === 0 && due.overdue.length === 0) {
    lastSummaryDate = today
    return
  }
  showSummaryNotification(due.dueToday.length, due.overdue.length, getMainWindow)
  lastSummaryDate = today
}

export function startNotifier(getMainWindow: () => BrowserWindow | null): void {
  // 起動直後にも一度実行
  void checkAndNotifyDue(getMainWindow)

  if (dueIntervalId) clearInterval(dueIntervalId)
  dueIntervalId = setInterval(() => {
    void checkAndNotifyDue(getMainWindow)
  }, NOTIFICATION_CHECK_INTERVAL_MS)

  if (summaryIntervalId) clearInterval(summaryIntervalId)
  summaryIntervalId = setInterval(() => {
    void checkAndNotifySummary(getMainWindow)
  }, SUMMARY_CHECK_INTERVAL_MS)
}

export function stopNotifier(): void {
  if (dueIntervalId) clearInterval(dueIntervalId)
  if (summaryIntervalId) clearInterval(summaryIntervalId)
  dueIntervalId = null
  summaryIntervalId = null
}
