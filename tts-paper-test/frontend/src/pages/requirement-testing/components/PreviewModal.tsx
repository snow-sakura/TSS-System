/**
 * Markdown 内容预览弹窗
 * 使用共享 MarkdownPreview 组件渲染完整 Markdown（表格/代码块/标题/列表/加粗等）
 */
import { memo } from "react"
import { X, FileText } from "lucide-react"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"

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
          <MarkdownPreview content={content} />
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
