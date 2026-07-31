/**
 * 统计卡片组件
 */
import type { ComponentType } from "react"

interface StatCardProps {
  label: string
  value: number | string
  icon: ComponentType<{ className?: string }>
  color: string
  trend?: { value: string; up: boolean }
}

export default function StatCard({ label, value, icon: Icon, color, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted">{label}</p>
          <p className="text-xl font-bold text-ink">{value}</p>
        </div>
      </div>
      {trend && (
        <div className={`text-xs mt-2 ${trend.up ? "text-pass" : "text-fail"}`}>
          {trend.up ? "↑" : "↓"} {trend.value}
        </div>
      )}
    </div>
  )
}
