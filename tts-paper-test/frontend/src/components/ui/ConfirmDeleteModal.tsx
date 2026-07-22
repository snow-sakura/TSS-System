/**
 * 通用确认删除弹窗
 * 替代 window.confirm()，统一删除确认体验
 */
import { X, AlertTriangle } from "lucide-react"

interface Props {
  open: boolean
  title?: string
  message: string
  itemName: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function ConfirmDeleteModal({ open, title, message, itemName, onConfirm, onCancel, loading }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-elevated w-[400px] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            {title || "确认删除"}
          </h3>
          <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group">
            <X className="w-4 h-4 group-hover:text-ink" />
            <span className="text-xs font-medium hidden sm:block">关闭</span>
          </button>
        </div>
        <div className="px-6 py-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-fail/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-fail" />
          </div>
          <div>
            <p className="text-sm text-ink font-medium">{message}</p>
            <p className="text-xs text-muted mt-1.5 bg-cream/50 rounded-lg px-3 py-2 font-mono break-all">
              「{itemName}」
            </p>
            <p className="text-[11px] text-fail mt-2">此操作不可撤销，请谨慎确认。</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onCancel} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
          <button onClick={onConfirm} disabled={loading} className="h-9 px-5 rounded-xl bg-fail text-white text-sm font-medium shadow-sm hover:shadow-md hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
            {loading ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  )
}
