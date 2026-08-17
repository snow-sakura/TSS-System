/**
 * 前端功能真实性清单 — 每项标注 真实 / 半真 / 模拟 + 证据
 */
import { ListChecks } from "lucide-react"
import { TRUTH_META, MODULE_META, type FeatureTruth, type ModuleKey } from "../analysisData"

interface Props {
  items: FeatureTruth[]
  scope?: ModuleKey[]
}

export default function FeatureTruthList({ items, scope }: Props) {
  const groups: { module: ModuleKey; items: FeatureTruth[] }[] = []
  if (!scope) {
    ;(["web", "workflow"] as ModuleKey[]).forEach((m) => {
      groups.push({ module: m, items: items.filter((i) => i.module === m) })
    })
  } else {
    scope.forEach((m) => {
      groups.push({ module: m, items: items.filter((i) => i.module === m) })
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-4 h-4 text-amber" />
        <h3 className="text-sm font-semibold text-ink">前端功能真实性审计</h3>
        <span className="text-[10px] text-muted ml-auto">依据前端调用链 + 后端接口核对</span>
      </div>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.module}>
            <p className="text-[11px] font-medium text-ink-light mb-2 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-amber" />
              {MODULE_META[g.module].label}
            </p>
            <div className="space-y-1.5">
              {g.items.map((item) => {
                const meta = TRUTH_META[item.status]
                return (
                  <div key={item.id} className="flex items-start gap-2.5 rounded-xl border border-border/60 px-3 py-2 hover:bg-cream/30 transition-colors">
                    <span className={`mt-0.5 flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-ink">{item.feature}</p>
                      <p className="text-[10px] text-muted font-mono truncate mt-0.5" title={item.evidence}>
                        {item.evidence}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
