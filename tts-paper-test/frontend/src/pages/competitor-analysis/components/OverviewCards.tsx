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
    <div className="flex flex-wrap gap-2">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <span
            key={c.key}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white border border-border text-[11px] text-muted"
            title={c.desc}
          >
            <span className={`w-4 h-4 rounded-md flex items-center justify-center ${c.cls}`}>
              <Icon className="w-2.5 h-2.5" />
            </span>
            <span>
              {c.label} <strong className="text-ink">{c.value}</strong>
              {c.unit}
            </span>
          </span>
        )
      })}
    </div>
  )
}
