/**
 * 行动建议 — 按优先级 P0 / P1 / P2 排列
 */
import { Lightbulb, Clock, CheckCircle2 } from "lucide-react"
import { MODULE_META, type ActionItem, type ModuleKey } from "../analysisData"

interface Props {
  items: ActionItem[]
  scope?: ModuleKey[]
}

const PRIORITY_META: Record<ActionItem["priority"], { label: string; badge: string; bar: string }> = {
  P0: { label: "高优先", badge: "bg-fail/10 text-fail border-fail/20", bar: "bg-fail" },
  P1: { label: "中优先", badge: "bg-amber/10 text-amber border-amber/30", bar: "bg-amber" },
  P2: { label: "后续",   badge: "bg-sky-50 text-sky-600 border-sky-200", bar: "bg-sky-400" },
}

const ORDER: ActionItem["priority"][] = ["P0", "P1", "P2"]

export default function ActionPlan({ items, scope }: Props) {
  const filtered = items.filter((i) => !scope || scope.includes(i.module))
  const groups = ORDER.map((p) => ({ priority: p, items: filtered.filter((i) => i.priority === p) }))

  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-amber" />
        <h3 className="text-sm font-semibold text-ink">行动建议</h3>
        <span className="text-[10px] text-muted ml-auto">按投入产出比排序，估算工作量</span>
      </div>
      <div className="space-y-3">
        {groups.map((g) => {
          const meta = PRIORITY_META[g.priority]
          if (g.items.length === 0) return null
          return (
            <div key={g.priority} className="flex gap-3">
              <div className="flex flex-col items-center pt-0.5">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold text-white ${meta.bar}`}>
                  {g.priority}
                </span>
                <span className="mt-1 text-[9px] text-muted whitespace-nowrap">{meta.label}</span>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {g.items.map((item) => (
                  <div key={item.id} className={`rounded-xl border px-3 py-2.5 transition-colors ${
                    item.done
                      ? "border-pass/30 bg-pass/5 hover:bg-pass/10"
                      : "border-border/60 hover:bg-cream/30"
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-xs font-medium ${item.done ? "text-pass line-through decoration-pass/50" : "text-ink"}`}>{item.title}</p>
                      {item.done && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-pass/10 text-pass text-[10px] font-medium">
                          <CheckCircle2 className="w-3 h-3" /> 已完成
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded-md bg-cream text-muted text-[10px]">
                        {MODULE_META[item.module].label}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-light leading-relaxed mt-1">{item.description}</p>
                    <p className="text-[10px] text-muted mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {item.effort}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
