/**
 * 空状态组件
 */
import type { ComponentType } from "react"

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-12 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-cream flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-muted" />
        </div>
      )}
      <p className="text-sm font-medium text-ink mb-1">{title}</p>
      {description && <p className="text-xs text-muted mb-4">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pass text-white text-sm font-medium shadow-sm hover:shadow-md transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
