import { useState, useEffect } from 'react'
import { FolderKanban, Pencil, Trash2 } from 'lucide-react'
import NotificationSettings from '../components/NotificationSettings'

interface BacklogSpace {
  id: number
  domain: string
  apiKeyRef: string
  color: string
  displayName: string
  projectIds: string
  isActive: boolean
}

interface BacklogProject {
  id: number
  projectKey: string
  name: string
}

interface SpaceForm {
  domain: string
  apiKeyRef: string
  color: string
  displayName: string
}

const DEFAULT_COLORS = ['#FF6B6B', '#6BCB77', '#4D96FF', '#FAC775', '#A66CFF', '#FF922B']
const STORAGE_KEY = 'peeltask-custom-colors'

function loadCustomColors(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveCustomColors(colors: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
}

const emptyForm: SpaceForm = { domain: '', apiKeyRef: '', color: '#FAC775', displayName: '' }

function Settings(): JSX.Element {
  const [spaces, setSpaces] = useState<BacklogSpace[]>([])
  const [form, setForm] = useState<SpaceForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [customColors, setCustomColors] = useState<string[]>(loadCustomColors)

  const allColors = [...DEFAULT_COLORS, ...customColors]

  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pickerColor, setPickerColor] = useState('#8B5CF6')
  const [projectsSpaceId, setProjectsSpaceId] = useState<number | null>(null)
  const [projects, setProjects] = useState<BacklogProject[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set())
  const [projectsLoading, setProjectsLoading] = useState(false)

  const handleConfirmColor = (): void => {
    if (!allColors.includes(pickerColor)) {
      const updated = [...customColors, pickerColor]
      setCustomColors(updated)
      saveCustomColors(updated)
    }
    setForm((prev) => ({ ...prev, color: pickerColor }))
    setShowColorPicker(false)
  }

  const handleOpenProjects = async (space: BacklogSpace): Promise<void> => {
    setProjectsSpaceId(space.id)
    setProjectsLoading(true)
    try {
      const res = await fetch(`${backendUrl}/api/spaces/${space.id}/projects`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setProjects(data)
      const currentIds = space.projectIds
        ? new Set(space.projectIds.split(',').map(Number).filter(Boolean))
        : new Set<number>()
      setSelectedProjectIds(currentIds)
    } catch (_err: unknown) {
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }

  const handleToggleProject = (projectId: number): void => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const handleSaveProjects = async (): Promise<void> => {
    if (projectsSpaceId === null) return
    try {
      const ids = [...selectedProjectIds].join(',')
      await fetch(`${backendUrl}/api/spaces/${projectsSpaceId}/projects`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: ids })
      })
      setProjectsSpaceId(null)
      await fetchSpaces()
    } catch (_err: unknown) {
      setTestResult('プロジェクトの保存に失敗しました')
    }
  }

  const handleRemoveColor = (color: string): void => {
    const updated = customColors.filter((c) => c !== color)
    setCustomColors(updated)
    saveCustomColors(updated)
    if (form.color === color) {
      setForm((prev) => ({ ...prev, color: DEFAULT_COLORS[0] }))
    }
  }

  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'

  const fetchSpaces = async (): Promise<void> => {
    try {
      const res = await fetch(`${backendUrl}/api/spaces`)
      const data = await res.json()
      setSpaces(data)
    } catch (_err: unknown) {
      setSpaces([])
    }
  }

  useEffect(() => {
    fetchSpaces()
  }, [])

  const handleTestConnection = async (): Promise<void> => {
    setTestResult(null)
    setLoading(true)
    try {
      const res = await fetch(`${backendUrl}/api/spaces/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: form.domain, apiKey: form.apiKeyRef })
      })
      const data = await res.json()
      setTestResult(data.success ? 'success' : (data.error || '不明なエラー'))
    } catch (_err: unknown) {
      setTestResult('failed: connection error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (): Promise<void> => {
    setLoading(true)
    try {
      const url = editingId
        ? `${backendUrl}/api/spaces/${editingId}`
        : `${backendUrl}/api/spaces`
      const method = editingId ? 'PUT' : 'POST'

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      setForm(emptyForm)
      setEditingId(null)
      setShowForm(false)
      setTestResult(null)
      await fetchSpaces()
    } catch (_err: unknown) {
      setTestResult('failed: save error')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (space: BacklogSpace): void => {
    setForm({
      domain: space.domain,
      apiKeyRef: space.apiKeyRef,
      color: space.color,
      displayName: space.displayName
    })
    setEditingId(space.id)
    setShowForm(true)
    setTestResult(null)
  }

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('このスペースを削除しますか？')) return
    try {
      const res = await fetch(`${backendUrl}/api/spaces/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setTestResult('削除に失敗しました')
        return
      }
      await fetchSpaces()
    } catch (_err: unknown) {
      setTestResult('削除に失敗しました')
    }
  }

  const handleCancel = (): void => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
    setTestResult(null)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">設定</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Backlog スペース管理</h3>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-brand text-white rounded-lg font-medium hover:bg-brand-dark transition-colors"
            >
              + スペースを追加
            </button>
          )}
        </div>

        {spaces.length > 0 && (
          <div className="space-y-3 mb-4">
            {spaces.map((space) => (
              <div
                key={space.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: space.color }}
                  />
                  <div>
                    <p className="font-medium text-gray-800">{space.displayName}</p>
                    <p className="text-sm text-gray-500">{space.domain}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenProjects(space)}
                    className="p-2 text-gray-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                    title="プロジェクト選択"
                  >
                    <FolderKanban size={16} />
                  </button>
                  <button
                    onClick={() => handleEdit(space)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="編集"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(space.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {spaces.length === 0 && !showForm && (
          <p className="text-gray-500">スペースが登録されていません。</p>
        )}
      </div>

      {projectsSpaceId !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            プロジェクト選択
            <span className="text-sm font-normal text-gray-400 ml-2">取得したいプロジェクトを選択</span>
          </h3>
          {projectsLoading ? (
            <p className="text-gray-400 text-sm py-4 text-center">読み込み中...</p>
          ) : projects.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">プロジェクトが見つかりません</p>
          ) : (
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {projects.map((proj) => (
                <label
                  key={proj.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.has(proj.id)}
                    onChange={() => handleToggleProject(proj.id)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-mono text-gray-500">{proj.projectKey}</span>
                  <span className="text-sm text-gray-700">{proj.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-gray-400">
              {selectedProjectIds.size === 0 ? '未選択（全プロジェクト取得）' : `${selectedProjectIds.size}件選択中`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSaveProjects}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => setProjectsSpaceId(null)}
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            {editingId ? 'スペースを編集' : 'スペースを追加'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">表示名</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="開発チームA"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ドメイン</label>
              <input
                type="text"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder="your-space.backlog.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">APIキー</label>
              <input
                type="password"
                value={form.apiKeyRef}
                onChange={(e) => setForm({ ...form, apiKeyRef: e.target.value })}
                placeholder="Backlog APIキーを入力"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">カラー</label>
              <div className="flex gap-2 flex-wrap items-center">
                {allColors.map((color) => (
                  <div key={color} className="relative group">
                    <button
                      onClick={() => setForm({ ...form, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        form.color === color ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                    {customColors.includes(color) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveColor(color) }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-gray-600 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <div className="relative">
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
                  >
                    +
                  </button>
                  {showColorPicker && (
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 flex flex-col items-center gap-2">
                      <input
                        type="color"
                        value={pickerColor}
                        onChange={(e) => setPickerColor(e.target.value)}
                        className="w-16 h-10 cursor-pointer border-0 p-0"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleConfirmColor}
                          className="px-3 py-1 text-xs bg-peeltask-yellow text-peeltask-text rounded font-medium hover:bg-peeltask-yellow/80 transition-colors"
                        >
                          追加
                        </button>
                        <button
                          onClick={() => setShowColorPicker(false)}
                          className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                        >
                          閉じる
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${
                testResult === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {testResult === 'success' ? '接続成功' : testResult}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleTestConnection}
                disabled={loading || !form.domain || !form.apiKeyRef}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                接続テスト
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !form.domain || !form.apiKeyRef || !form.displayName}
                className="px-4 py-2 bg-brand text-white rounded-lg font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors"
              >
                {editingId ? '更新' : '保存'}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <NotificationSettings />
      </div>
    </div>
  )
}

export default Settings
