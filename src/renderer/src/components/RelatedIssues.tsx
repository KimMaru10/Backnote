import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, AlertCircle } from 'lucide-react'

interface RelatedIssue {
  backlogId: number
  issueKey: string
  summary: string
  status: string
  statusId: number
  assigneeName?: string
  dueDate?: string
  localTaskId?: number
}

interface RelatedResponse {
  parent: RelatedIssue | null
  siblings: RelatedIssue[]
  children: RelatedIssue[]
}

interface RelatedIssuesProps {
  taskId: number
  spaceDomain: string | null
}

function statusBadge(name: string): string {
  switch (name) {
    case '完了':
      return 'bg-emerald-100 text-emerald-700'
    case '処理中':
      return 'bg-blue-100 text-blue-700'
    case '処理済み':
      return 'bg-purple-100 text-purple-700'
    case '未対応':
      return 'bg-gray-100 text-gray-700'
    default:
      return 'bg-amber-100 text-amber-700'
  }
}

function roleBadge(role: '親' | '兄弟' | '子'): string {
  switch (role) {
    case '親':
      return 'bg-emerald-50 text-brand'
    case '兄弟':
      return 'bg-amber-50 text-amber-700'
    case '子':
      return 'bg-blue-50 text-blue-700'
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function RelatedIssues({ taskId, spaceDomain }: RelatedIssuesProps): JSX.Element | null {
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
  const navigate = useNavigate()
  const [data, setData] = useState<RelatedResponse>({ parent: null, siblings: [], children: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${backendUrl}/api/tasks/${taskId}/related`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((d: RelatedResponse) => {
        if (cancelled) return
        setData({
          parent: d.parent ?? null,
          siblings: Array.isArray(d.siblings) ? d.siblings : [],
          children: Array.isArray(d.children) ? d.children : []
        })
      })
      .catch(() => {
        if (cancelled) return
        setError('親子課題の取得に失敗しました')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [taskId, backendUrl])

  if (loading) return null
  const total = (data.parent ? 1 : 0) + data.siblings.length + data.children.length
  if (total === 0 && !error) return null

  // 同期済みならアプリ内遷移、未同期なら Backlog Web を開く。
  const handleNavigate = (issue: RelatedIssue): void => {
    if (issue.localTaskId) {
      navigate(`/tasks/${issue.localTaskId}`)
    } else if (spaceDomain) {
      window.open(`https://${spaceDomain}/view/${issue.issueKey}`, '_blank')
    }
  }

  const renderRow = (issue: RelatedIssue, role: '親' | '兄弟' | '子'): JSX.Element => (
    <tr key={`${role}-${issue.backlogId}`} className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 pr-3 align-top">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium mr-2 ${roleBadge(role)}`}>
          {role}
        </span>
        <button
          onClick={() => handleNavigate(issue)}
          className="font-mono text-xs text-brand hover:underline"
          title={issue.localTaskId ? 'アプリ内で開く' : 'Backlog で開く'}
        >
          {issue.issueKey}
        </button>
      </td>
      <td className="py-2 pr-3 text-gray-800">
        <button onClick={() => handleNavigate(issue)} className="text-left hover:underline">
          {issue.summary}
        </button>
      </td>
      <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{issue.assigneeName ?? '-'}</td>
      <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{formatDate(issue.dueDate)}</td>
      <td className="py-2 pr-3 whitespace-nowrap">
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(issue.status)}`}>
          {issue.status}
        </span>
      </td>
    </tr>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <GitBranch size={16} />
        関連課題
        <span className="text-xs font-normal text-gray-400">
          {data.parent ? '親 1 / ' : ''}
          {data.siblings.length > 0 ? `兄弟 ${data.siblings.length} / ` : ''}
          子 {data.children.length}
        </span>
      </h3>

      {error && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg mb-3">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {total > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-200">
                <th className="text-left font-medium py-2 pr-3">キー</th>
                <th className="text-left font-medium py-2 pr-3">件名</th>
                <th className="text-left font-medium py-2 pr-3">担当者</th>
                <th className="text-left font-medium py-2 pr-3">期限日</th>
                <th className="text-left font-medium py-2 pr-3">状態</th>
              </tr>
            </thead>
            <tbody>
              {data.parent && renderRow(data.parent, '親')}
              {data.siblings.map((s) => renderRow(s, '兄弟'))}
              {data.children.map((c) => renderRow(c, '子'))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
