/**
 * 能力矩阵对比表 — 维度 × 竞品 TestHub × TSS 本地 × 差距
 */
import { Table2 } from "lucide-react"
import { GAP_META, type CapabilityRow, type ModuleKey, MODULE_META } from "../analysisData"

interface Props {
  rows: CapabilityRow[]
  scope?: ModuleKey[]
}

export default function CapabilityMatrix({ rows, scope }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Table2 className="w-4 h-4 text-amber" />
        <h3 className="text-sm font-semibold text-ink">能力矩阵对比</h3>
        {scope && (
          <span className="text-[10px] text-muted ml-auto">
            {scope.map(m => MODULE_META[m].label).join(" · ")}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <div className="max-h-[calc(100vh-320px)] min-h-[240px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10">
            <tr className="bg-cream border-b border-border">
              <th className="px-4 py-2.5 text-[11px] font-medium text-ink-light whitespace-nowrap w-28">维度</th>
              <th className="px-4 py-2.5 text-[11px] font-medium text-ink-light whitespace-nowrap w-[38%]">竞品 TestHub</th>
              <th className="px-4 py-2.5 text-[11px] font-medium text-ink-light whitespace-nowrap w-[38%]">TSS 本地</th>
              <th className="px-4 py-2.5 text-[11px] font-medium text-ink-light whitespace-nowrap">差距</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = GAP_META[row.gap]
              return (
                <tr key={row.id} className="border-b border-border/60 last:border-b-0 hover:bg-cream/30 transition-colors align-top bg-white">
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-ink">{row.dimension}</p>
                    <p className="text-[10px] text-muted mt-0.5">{MODULE_META[row.module].label}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[11px] text-ink-light leading-relaxed">{row.competitor}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[11px] text-ink-light leading-relaxed">{row.local}</p>
                    {row.note && <p className="text-[10px] text-muted mt-1 italic">注：{row.note}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium whitespace-nowrap ${meta.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
