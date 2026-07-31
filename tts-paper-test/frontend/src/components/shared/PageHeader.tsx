/**
 * 页面头部组件
 */
import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  subtitle?: string
  count?: number
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, count, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {count !== undefined && (
          <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">
            共 {count} 条
          </span>
        )}
        {subtitle && (
          <span className="text-xs text-muted">{subtitle}</span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
