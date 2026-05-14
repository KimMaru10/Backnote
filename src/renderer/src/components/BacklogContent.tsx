import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Clipboard, Check } from 'lucide-react'

// rehype-sanitize のデフォルトスキーマに span.className を許可する。
// @-メンションを <span class="bn-mention"> で囲んでスタイル適用するため。
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...((defaultSchema.attributes && defaultSchema.attributes.span) || []), 'className', 'class']
  }
}

// Backlog のメンション（@username）を検出して緑色の span に置き換える。
// HEAD（1 文字目）: 英字 / アンダースコア / 日本語（ひらがな・カタカナ・漢字）。
//   数字始まりの「@6/10」のような日付風表記は HEAD で弾く。
// TAIL（2 文字目以降）は「半角空白 / タブ / 改行 / 敬称（様 さん さま 殿 君 くん ちゃん）」
//   以外を吸収する。Backlog の表示名には `。` `/` `@` 記号や全角空白も含まれうる
//   （例: `@PENCIL_佐藤大介@6/10最終出社。大変お世話になりました` で 1 ユーザー名）ので、
//   敬称ベースで終点を判定する負の先読みで「敬称の直前」までを取り込む。
//   末尾に残った全角空白だけ後段の trim で削る。
const MENTION_HEAD = '[A-Za-z_\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]'
const MENTION_TAIL = '(?:(?![ \\t\\n\\r]|様|さま|さん|殿|君|くん|ちゃん).)*'
const MENTION_PATTERN = new RegExp('@' + MENTION_HEAD + MENTION_TAIL, 'g')

function highlightMentions(text: string): string {
  return text.replace(MENTION_PATTERN, (raw) => {
    // 末尾に余分な全角スペースが残っていれば切り落として、その分はメンション外に戻す
    const trimmed = raw.replace(/　+$/, '')
    const tail = raw.slice(trimmed.length)
    return `<span class="bn-mention">${trimmed}</span>${tail}`
  })
}

// rehype-sanitize で除去される危険タグ（script など）を Markdown の inline code に包んで、
// タグが文字列として表示されるようにする。
const UNSAFE_TAG_PATTERN = /<\/?(?:script|iframe|object|embed|style|form|input|button|link|meta)\b[^>]*>/gi

function escapeUnsafeHtml(text: string): string {
  return text.replace(UNSAFE_TAG_PATTERN, (match) => '`' + match + '`')
}

// Backlog記法 のテーブル `|a|b|h`（h はヘッダ行マーク）を GFM テーブルへ変換する。
// 連続するテーブル行を 1 つのテーブルとして扱い、ヘッダがなければ最初の行をヘッダ扱い。
function convertBacklogTables(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let i = 0
  const isTableLine = (s: string): boolean => /^\s*\|.*\|h?\s*$/.test(s) && s.includes('|', 1)

  while (i < lines.length) {
    if (!isTableLine(lines[i])) {
      out.push(lines[i])
      i++
      continue
    }
    // テーブル開始 → 連続するテーブル行を集める
    const block: string[] = []
    while (i < lines.length && isTableLine(lines[i])) {
      block.push(lines[i].trim())
      i++
    }
    // 最大カラム数を計算
    let maxCols = 0
    const rows = block.map((row) => {
      const isHeader = row.endsWith('|h')
      const body = isHeader ? row.slice(0, -1) : row // 末尾 'h' を除去
      // 先頭末尾の | を取り除いてセルに分割
      const cells = body.replace(/^\|/, '').replace(/\|$/, '').split('|')
      if (cells.length > maxCols) maxCols = cells.length
      return { isHeader, cells }
    })
    // セル数を揃える
    rows.forEach((r) => {
      while (r.cells.length < maxCols) r.cells.push('')
    })
    // ヘッダ行があるか
    const headerRow = rows.find((r) => r.isHeader) ?? rows[0]
    const dataRows = rows.filter((r) => r !== headerRow)
    out.push('| ' + headerRow.cells.join(' | ') + ' |')
    out.push('|' + Array(maxCols).fill(' --- ').join('|') + '|')
    dataRows.forEach((r) => out.push('| ' + r.cells.join(' | ') + ' |'))
  }
  return out.join('\n')
}

// Backlog記法 を Markdown に近い形に変換する。
// 見出し（行頭 `*` `**` `***`）は Markdown の `#` `##` `###` に変換する。
// Backlog のリスト記法は `-` / `+` で `*` は使わないため、`*` を `#` に置換しても衝突しない。
function backlogToMarkdown(text: string, taskId?: number): string {
  let result = text
    .replace(/&br;/g, '\n')
    .replace(/^(\*{1,3})\s+(.+)$/gm, (_, marks: string, body: string) =>
      `${'#'.repeat(marks.length)} ${body}`
    )
    .replace(/''(.+?)''/g, '**$1**')
    .replace(/%%(.+?)%%/g, '~~$1~~')
    .replace(/\[\[([^\]]+?)[>:]([^\]]+?)\]\]/g, '[$1]($2)')
    .replace(/\{code\}([\s\S]*?)\{\/code\}/g, '```\n$1\n```')
    .replace(/\{quote\}([\s\S]*?)\{\/quote\}/g, (_, body: string) =>
      body
        .split('\n')
        .map((line: string) => (line ? `> ${line}` : '>'))
        .join('\n')
    )

  // Backlog記法のテーブルを GFM テーブルに変換
  result = convertBacklogTables(result)

  // #image(URL) / #image(filename) → Markdown 画像
  // taskId が分かっている場合は、ローカルファイル名のときに API プロキシ URL を組み立てる。
  const backendUrl = window.api?.getBackendUrl?.() ?? 'http://localhost:8080'
  result = result.replace(/#image\(([^)]+)\)/g, (_, src: string) => {
    const trimmed = src.trim()
    const isExternal = /^https?:\/\//i.test(trimmed)
    if (isExternal) return `![](${trimmed})`
    if (taskId !== undefined) {
      return `![${trimmed}](${backendUrl}/api/tasks/${taskId}/attachments/${encodeURIComponent(trimmed)})`
    }
    return trimmed
  })
  // #thumbnail(URL) も同様（縮小は Markdown では区別しないので image と同じに）
  result = result.replace(/#thumbnail\(([^)]+)\)/g, (_, src: string) => {
    const trimmed = src.trim()
    const isExternal = /^https?:\/\//i.test(trimmed)
    if (isExternal) return `![](${trimmed})`
    if (taskId !== undefined) {
      return `![${trimmed}](${backendUrl}/api/tasks/${taskId}/attachments/${encodeURIComponent(trimmed)})`
    }
    return trimmed
  })

  // @-メンションを緑色の span に置換（最後に実行: 他の置換結果に影響しないように）
  result = highlightMentions(result)

  return result
}

// コードブロック用ラッパー: hover でコピーボタンを表示する。
function CodeBlock({ children }: { children?: React.ReactNode }): JSX.Element {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = (): void => {
    const text = preRef.current?.innerText ?? ''
    if (!text) return
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="relative group my-2">
      <pre
        ref={preRef}
        className="bg-slate-50 border border-slate-200 rounded p-3 pr-10 overflow-x-auto text-[12px] leading-snug text-gray-900 [&>code]:!bg-transparent [&>code]:!p-0 [&>code]:!border-0 [&>code]:!text-gray-900 [&>code]:!whitespace-pre-wrap [&>code]:!break-normal"
      >
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-emerald-50 hover:border-brand text-gray-500 hover:text-brand opacity-0 group-hover:opacity-100 transition-opacity"
        title="コードをクリップボードへコピー"
        aria-label="コードをコピー"
      >
        {copied ? <Check size={14} /> : <Clipboard size={14} />}
      </button>
    </div>
  )
}

interface BacklogContentProps {
  text: string
  // 添付画像をプロキシ取得するためのタスク ID。コメント・説明から渡される。
  taskId?: number
}

// Backlog の説明・コメントなどを統一スタイルで描画する共通コンポーネント。
export default function BacklogContent({ text, taskId }: BacklogContentProps): JSX.Element {
  return (
    <div
      className={[
        'text-sm text-gray-800 max-w-none break-words leading-6',
        '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_a]:text-brand [&_a]:no-underline hover:[&_a]:underline [&_a]:break-all',
        '[&_strong]:font-semibold [&_strong]:text-gray-900',
        '[&_em]:italic',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1',
        '[&_li]:leading-relaxed',
        '[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:pb-1 [&_h1]:border-b-2 [&_h1]:border-gray-300 [&_h1]:text-gray-900',
        '[&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-gray-200 [&_h2]:text-gray-900',
        '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-gray-800',
        '[&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-gray-600 [&_blockquote]:italic',
        // インラインコード（バッククォート由来）
        '[&_code]:bg-white [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:font-mono [&_code]:text-rose-700 [&_code]:border [&_code]:border-gray-200 [&_code]:break-all',
        // テーブル: ヘッダーのみ薄緑、セルは白
        '[&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_table]:text-xs',
        '[&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1.5 [&_th]:bg-emerald-50 [&_th]:text-gray-800 [&_th]:font-semibold [&_th]:text-left',
        '[&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:bg-white',
        // テーブル内のインラインコードはコード風スタイルを外す
        '[&_td_code]:bg-transparent [&_td_code]:border-0 [&_td_code]:p-0 [&_td_code]:text-gray-700 [&_td_code]:font-mono [&_td_code]:text-[12px]',
        '[&_th_code]:bg-transparent [&_th_code]:border-0 [&_th_code]:p-0 [&_th_code]:text-gray-700 [&_th_code]:font-mono [&_th_code]:text-[12px]',
        '[&_hr]:my-3 [&_hr]:border-gray-200',
        '[&_img]:max-w-full [&_img]:rounded [&_img]:my-2',
        // @-メンションを緑色（ブランドカラー）でハイライト + 薄緑の背景
        '[&_.bn-mention]:text-brand [&_.bn-mention]:font-medium [&_.bn-mention]:bg-emerald-50 [&_.bn-mention]:px-1.5 [&_.bn-mention]:py-0.5 [&_.bn-mention]:rounded'
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          pre: (props) => <CodeBlock>{props.children}</CodeBlock>
        }}
      >
        {backlogToMarkdown(escapeUnsafeHtml(text), taskId)}
      </ReactMarkdown>
    </div>
  )
}
