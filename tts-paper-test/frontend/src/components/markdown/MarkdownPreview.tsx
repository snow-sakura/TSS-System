/**
 * 共享 Markdown 内容渲染组件
 * 使用 react-markdown + remark-gfm + remark-breaks 渲染完整 Markdown
 * （表格/代码块/标题/列表/加粗/普通换行等），供所有弹窗预览场景复用。
 *
 * 样式由 index.css 中的 .pipeline-markdown 提供，包含：
 * - 表格（边框、斑马纹、表头背景）
 * - 代码块（暗色背景、等宽字体）
 * - 标题（层级、分隔线）
 * - 列表（有序/无序）
 * - 引用块（琥珀色边框）
 * - 加粗/斜体/链接
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
    <div className={`pipeline-markdown ${className ?? ""}`} style={scrollStyle}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table>{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          th: ({ children }) => <th>{children}</th>,
          td: ({ children }) => <td>{children}</td>,
          h1: ({ children }) => <h1>{children}</h1>,
          h2: ({ children }) => <h2>{children}</h2>,
          h3: ({ children }) => <h3>{children}</h3>,
          h4: ({ children }) => <h4>{children}</h4>,
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong>{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          ul: ({ children }) => <ul>{children}</ul>,
          ol: ({ children }) => <ol>{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.includes("language-")
            return isBlock ? (
              <code className={codeClassName}>{children}</code>
            ) : (
              <code>{children}</code>
            )
          },
          pre: ({ children }) => <pre>{children}</pre>,
          blockquote: ({ children }) => <blockquote>{children}</blockquote>,
          hr: () => <hr />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default memo(MarkdownPreview)
