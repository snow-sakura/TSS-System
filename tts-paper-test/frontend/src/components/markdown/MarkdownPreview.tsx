/**
 * 共享 Markdown 内容渲染组件
 * 使用 react-markdown + remark-gfm + remark-breaks 渲染完整 Markdown
 * （表格/代码块/标题/列表/加粗/普通换行等），供所有弹窗预览场景复用。
 */
import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { FileText } from "lucide-react"

interface MarkdownPreviewProps {
  content: string
  /** 空内容时显示的占位文本 */
  emptyText?: string
  /** 附加到预览容器的样式类 */
  className?: string
  /** 内容最大高度（数字=px 或 CSS 值），超出后在容器内滚动，防止页面被 AI 长文拉长 */
  maxHeight?: number | string
}

function MarkdownPreview({ content, emptyText = "暂无内容", className, maxHeight }: MarkdownPreviewProps) {
  const scrollStyle =
    maxHeight != null
      ? { maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight, overflowY: "auto" as const }
      : undefined

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-ink-light">
        <FileText className="w-8 h-8 mb-2 text-gray-300" />
        <p className="text-sm font-medium">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className={`preview-content prose prose-sm max-w-none ${className ?? ""}`} style={scrollStyle}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-xl border border-border shadow-sm">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-cream/60">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink border-b border-border whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-ink-light border-b border-border/40">{children}</td>
          ),
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-ink mt-6 mb-3 pb-2 border-b border-border" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-ink mt-5 mb-2 pb-1.5 border-b border-border/50" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-ink mt-4 mb-2" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-bold text-ink mt-3 mb-1.5">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-ink-light leading-relaxed mb-3">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-ink">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-ink-light">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-ink-light">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-ink-light">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-")
            return isBlock ? (
              <code className="block bg-gray-900 text-gray-100 rounded-xl p-4 text-xs font-mono overflow-x-auto my-3 leading-relaxed">{children}</code>
            ) : (
              <code className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded-md text-xs font-mono">{children}</code>
            )
          },
          pre: ({ children }) => (
            <pre className="bg-gray-900 rounded-xl p-4 overflow-x-auto my-3">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-amber pl-4 py-2 my-3 bg-amber-50/50 rounded-r-xl text-sm text-ink-light italic">{children}</blockquote>
          ),
          hr: () => (
            <hr className="my-4 border-border" />
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:text-amber-hover underline">{children}</a>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt} className="max-w-full rounded-xl my-2 shadow-sm" loading="lazy" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default memo(MarkdownPreview)