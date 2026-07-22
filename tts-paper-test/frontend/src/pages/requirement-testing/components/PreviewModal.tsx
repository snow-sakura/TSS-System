/**
 * Markdown 内容预览弹窗
 * 使用 react-markdown + remark-gfm 渲染完整Markdown（表格/代码块/标题/列表/加粗等）
 */
import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { X, FileText } from "lucide-react"

interface PreviewModalProps {
  title: string
  content: string
  onClose: () => void
}

function PreviewModal({ title, content, onClose }: PreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-elevated w-[760px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-amber flex items-center justify-center shadow-sm">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-bold text-ink max-w-[500px] truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{title}</h3>
          </div>
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group">
            <X className="w-4 h-4 group-hover:text-ink" />
            <span className="text-xs font-medium hidden sm:block">关闭</span>
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {content ? (
            <div className="preview-content prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
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
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-ink-light">
              <FileText className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-sm font-medium">暂无内容</p>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 border-t border-border flex justify-between items-center flex-shrink-0 bg-gray-50/50 rounded-b-2xl">
          <span className="text-xs text-ink-light">共 {content.length} 字符</span>
          <button onClick={onClose} className="h-9 px-5 rounded-xl border border-border text-sm font-medium text-ink-light hover:bg-white hover:text-ink transition-all">
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(PreviewModal)
