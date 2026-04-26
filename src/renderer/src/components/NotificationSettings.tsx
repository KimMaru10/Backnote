import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'

type Settings = {
  notification_enabled: string
  remind_today: string
  remind_overdue: string
  morning_summary: string
  morning_summary_time: string
}

const DEFAULTS: Settings = {
  notification_enabled: 'true',
  remind_today: 'true',
  remind_overdue: 'true',
  morning_summary: 'true',
  morning_summary_time: '09:00'
}

export default function NotificationSettings(): JSX.Element {
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    const fetchSettings = async (): Promise<void> => {
      try {
        const res = await fetch(`${backendUrl}/api/settings`)
        if (!res.ok) return
        const data = (await res.json()) as Partial<Settings>
        setSettings({ ...DEFAULTS, ...data })
      } catch {
        // 取得失敗時はデフォルト値を使う
      }
    }
    void fetchSettings()
  }, [backendUrl])

  const update = async (patch: Partial<Settings>): Promise<void> => {
    const next = { ...settings, ...patch }
    setSettings(next)
    setSaving(true)
    try {
      await fetch(`${backendUrl}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      })
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  const enabled = settings.notification_enabled === 'true'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={18} className="text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-700">通知</h3>
        {saving && <span className="text-xs text-gray-400">保存中...</span>}
        {!saving && savedAt && Date.now() - savedAt < 2000 && (
          <span className="text-xs text-green-600">保存しました</span>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">
        アプリを閉じていても、メニューバー常駐でデスクトップ通知を受け取れます。
      </p>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => void update({ notification_enabled: e.target.checked ? 'true' : 'false' })}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">通知を有効化</span>
        </label>

        <div className={`pl-7 space-y-3 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.remind_today === 'true'}
              onChange={(e) => void update({ remind_today: e.target.checked ? 'true' : 'false' })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">期限当日のタスクを通知</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.remind_overdue === 'true'}
              onChange={(e) => void update({ remind_overdue: e.target.checked ? 'true' : 'false' })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">期限切れタスクを通知</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.morning_summary === 'true'}
              onChange={(e) => void update({ morning_summary: e.target.checked ? 'true' : 'false' })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">朝のサマリ通知</span>
          </label>

          <div className="pl-7 flex items-center gap-3">
            <span className="text-sm text-gray-500">時刻</span>
            <input
              type="time"
              value={settings.morning_summary_time}
              onChange={(e) => void update({ morning_summary_time: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
