/**
 * 平台对标分析页面 — 本地 TSS vs 竞品 TestHub
 *
 * 用法：
 *  - 独立路由：<CompetitorAnalysisPage />（scope=all，含页面头）
 *  - 模块内嵌入：<CompetitorAnalysisPage scope={["web"]} embedded />（不含页面头）
 */
import { useMemo, useState } from "react"
import { GitCompare, ExternalLink } from "lucide-react"
import {
  CAPABILITY_MATRIX, FEATURE_TRUTH, ACTION_PLAN, buildOverview,
  type ModuleKey,
} from "./analysisData"
import OverviewCards from "./components/OverviewCards"
import CapabilityMatrix from "./components/CapabilityMatrix"
import FeatureTruthList from "./components/FeatureTruthList"
import ActionPlan from "./components/ActionPlan"

interface Props {
  /** 展示范围：默认 all（全部）；web / workflow 过滤 */
  scope?: ModuleKey[]
  /** 嵌入模式：不渲染页面级头部（供模块内 Tab 使用） */
  embedded?: boolean
}

const SCOPE_TABS: { key: ModuleKey[] | null; label: string }[] = [
  { key: null, label: "全部" },
  { key: ["web"], label: "AI Web自动化" },
  { key: ["workflow"], label: "流程编排" },
]

function CompetitorAnalysisPage({ scope, embedded = false }: Props) {
  const [activeScope, setActiveScope] = useState<ModuleKey[] | null>(scope ?? null)
  const current = embedded ? scope ?? null : activeScope

  const rows = useMemo(
    () => CAPABILITY_MATRIX.filter((r) => !current || current.includes(r.module)),
    [current],
  )
  const truth = useMemo(
    () => FEATURE_TRUTH.filter((f) => !current || current.includes(f.module)),
    [current],
  )
  const stats = useMemo(() => buildOverview(current ?? undefined), [current])

  return (
    <div className="space-y-4">
      {/* 页面头部（独立路由时） */}
      {!embedded && (
        <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center flex-shrink-0">
              <GitCompare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                平台对标分析
              </h2>
              <p className="text-[11px] text-muted">
                本地 TSS 与竞品 TestHub 的能力差距盘点（Web 自动化 + 流程编排）
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <a href="https://testhub.aisky.cloud/" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-[11px] text-ink-light hover:bg-cream transition-colors">
              <ExternalLink className="w-3 h-3" /> 官网
            </a>
            <a href="https://github.com/chenjigang4167/testhub_platform" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-[11px] text-ink-light hover:bg-cream transition-colors">
              <ExternalLink className="w-3 h-3" /> 开源仓库
            </a>
          </div>
        </div>
      )}

      {/* 范围切换（非嵌入时可用） */}
      {!embedded && scope === undefined && (
        <div className="flex items-center gap-1.5 bg-white rounded-xl border border-border p-1 w-fit shadow-sm">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setActiveScope(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeScope === tab.key
                  ? "gradient-amber text-white shadow-sm"
                  : "text-ink-light hover:bg-cream"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <OverviewCards stats={stats} />

      <CapabilityMatrix rows={rows} scope={current ?? undefined} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <FeatureTruthList items={truth} scope={current ?? undefined} />
        <ActionPlan items={ACTION_PLAN} scope={current ?? undefined} />
      </div>

      {!embedded && (
        <p className="text-[10px] text-muted-light px-1">
          分析结论基于 2026-08 人工代码审计：本地前端调用链 / 后端接口对照竞品官网、文档站与开源仓库。竞品数据以其开源实现与公开文档为准，未登录其线上系统。
        </p>
      )}
    </div>
  )
}

export default CompetitorAnalysisPage
