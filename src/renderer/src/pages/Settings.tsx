import { useState, useEffect } from 'react'

interface BacklogSpace {
  id: number
  domain: string
  apiKeyRef: string
  color: string
  displayName: string
  isActive: boolean
}

interface SpaceForm {
  domain: string
  apiKeyRef: string
  color: string
  displayName: string
}

const COLORS = ['#FF6B6B', '#6BCB77', '#4D96FF', '#FAC775', '#A66CFF', '#FF922B']
const emptyForm: SpaceForm = { domain: '', apiKeyRef: '', color: '#FAC775', displayName: '' }

function Settings(): JSX.Element {
  const [spaces, setSpaces] = useState<BacklogSpace[]>([])
  const [form, setForm] = useState<SpaceForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const backendUrl = window.api.getBackendUrl()

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
    await fetch(`${backendUrl}/api/spaces/${id}`, { method: 'DELETE' })
    await fetchSpaces()
  }

  const handleCancel = (): void => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
    setTestResult(null)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Backlog スペース管理</h3>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-[#FAC775] text-[#BA7517] rounded-lg font-medium hover:bg-[#f5bc5c] transition-colors"
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
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(space)}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(space.id)}
                    className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
                  >
                    Delete
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FAC775]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ドメイン</label>
              <input
                type="text"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder="your-space.backlog.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FAC775]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">APIキー</label>
              <input
                type="password"
                value={form.apiKeyRef}
                onChange={(e) => setForm({ ...form, apiKeyRef: e.target.value })}
                placeholder="Backlog APIキーを入力"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FAC775]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">カラー</label>
              <div className="flex gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      form.color === color ? 'border-gray-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
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
                className="px-4 py-2 bg-[#FAC775] text-[#BA7517] rounded-lg font-medium hover:bg-[#f5bc5c] disabled:opacity-50 transition-colors"
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
    </div>
  )
}

export default Settings
