import { X, AlertTriangle } from "lucide-react"
import { useConfirmStore } from "@/stores/confirmStore"

export default function ConfirmDialog() {
  const { open, title, message, itemName, confirmText, cancelText, danger, resolver } = useConfirmStore()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => resolver?.(false)}>
      <div className="bg-white rounded-2xl shadow-elevated w-[400px] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            {title}
          </h3>
          <button onClick={() => resolver?.(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group">
            <X className="w-4 h-4 group-hover:text-ink" />
          </button>
        </div>
        <div className="px-6 py-5 flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? "bg-fail/10" : "bg-amber/10"}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? "text-fail" : "text-amber"}`} />
          </div>
          <div>
            <p className="text-sm text-ink font-medium">{message}</p>
            {itemName && (
              <p className="text-xs text-muted mt-1.5 bg-cream/50 rounded-lg px-3 py-2 font-mono break-all">
                &laquo;{itemName}&raquo;
              </p>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={() => resolver?.(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">{cancelText}</button>
          <button
            onClick={() => resolver?.(true)}
            className={`h-9 px-5 rounded-xl text-sm font-medium shadow-sm hover:shadow-md hover:opacity-90 text-white ${danger ? "bg-fail" : "bg-amber"}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
