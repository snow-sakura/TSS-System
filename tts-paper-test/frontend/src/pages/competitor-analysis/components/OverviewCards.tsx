/**
 * 概览统计卡 — 能力对比一眼看全
 */
import { CheckCircle2, AlertTriangle, CircleDot, XCircle, Sparkles } from "lucide-react"
import type { OverviewStats } from "../analysisData"

interface Props {
  stats: OverviewStats
}

export default function OverviewCards({ stats }: Props) {
  const cards = [
    {
      key: "total", label: "对比维度", value: stats.total, unit: "项",
      icon: CircleDot, cls: "bg-sky-50 text-sky-600", desc: "覆盖 Web 自动化与流程编排",
    },
    {
      key: "lead", label: "本地领先", value: stats.lead, unit: "项",
      icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600", desc: "优于竞品公开形态",
    },
    {
      key: "partial", label: "部分实现", value: stats.partial, unit: "项",
      icon: Sparkles, cls: "bg-amber/10 text-amber", desc: "有雏形，待补齐",
    },
    {
      key: "gap", label: "重大缺口", value: stats.gap, unit: "项",
      icon: AlertTriangle, cls: "bg-fail/10 text-fail", desc: "竞品有、本地无或差距大",
    },
    {
      key: "mock", label: "模拟假功能", value: stats.mockFeatures, unit: "处",
      icon: XCircle, cls: "bg-rose-50 text-rose-500", desc: "前端/节点无真实后端支撑",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.key} className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{c.label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.cls}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                {c.value}
              </span>
              <span className="text-[11px] text-muted">{c.unit}</span>
            </div>
            <p className="text-[10px] text-muted-light leading-relaxed">{c.desc}</p>
          </div>
        )
      })}
    </div>
  )
}
