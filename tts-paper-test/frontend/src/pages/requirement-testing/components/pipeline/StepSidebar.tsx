/**
 * StepSidebar — 左侧 240px 步骤卡片列（平均分配高度）
 *
 * 五个步骤等分可用高度，每个步骤卡片带加深边框：
 *   - 图标区（32×32）+ 标题 + 角色 + 统计行（耗时 / 生成条数 / 补充条数 / 字数）
 *   - 选中态：琥珀色深色边框 + 背景高亮 + ring + 阴影
 *   - 所有状态边框加深，清晰区分每个步骤节点
 * - 底部固定展示：总耗时 + 总产出 + 导航提示
 */
import { memo } from "react"
import type { StepItem } from "./PipelineStepper"
import {
  CheckCircle, XCircle, Loader2,
  FileText, Search, Route, TestTubes, ClipboardCheck,
  ArrowRight, Plus,
} from "lucide-react"

interface StepSidebarProps {
  steps: StepItem[]
  selectedStepKey: string | null
  onStepSelect: (key: string) => void
  pipelineStatus: "idle" | "running" | "completed" | "failed"
  onFocusOutput?: () => void
}

const STEP_META: Record<string, { icon: typeof FileText; agent: string; desc: string }> = {
  requirement_analysis: { icon: FileText, agent: "需求分析师", desc: "解析需求文档，提取关键信息" },
  requirements: { icon: FileText, agent: "需求分析师", desc: "解析需求文档，提取关键信息" },
  test_planning: { icon: Search, agent: "测试架构师", desc: "制定测试策略与计划" },
  "test-plans": { icon: Search, agent: "测试架构师", desc: "制定测试策略与计划" },
  test_point_extraction: { icon: Route, agent: "测试分析师", desc: "提取可测需求点，分类整理" },
  "test-points": { icon: Route, agent: "测试分析师", desc: "提取可测需求点，分类整理" },
  test_case_generation: { icon: TestTubes, agent: "用例生成器", desc: "生成完整测试用例" },
  "test-cases": { icon: TestTubes, agent: "用例生成器", desc: "生成完整测试用例" },
  test_case_review: { icon: ClipboardCheck, agent: "评审专员", desc: "评审并优化测试用例" },
  "test-review": { icon: ClipboardCheck, agent: "评审专员", desc: "评审并优化测试用例" },
}

function formatDuration(ms: number): string {
  if (ms <= 0) return ""
  const rounded = Math.round(ms)
  const s = Math.round(rounded / 1000)
  if (s <= 0) return `${rounded}ms`
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec > 0 ? `${m}m${sec}s` : `${m}m`
}

/** 状态图标组件 — 统一 32x32 容器，带阴影效果 */
function StatusIcon({
  status,
  icon: Icon,
}: {
  status: StepItem["status"]
  icon: typeof FileText
}) {
  const bgMap: Record<string, string> = {
    completed: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm",
    running: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm",
    failed: "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-sm",
    waiting: "bg-gradient-to-br from-gray-200 to-gray-300 text-gray-600",
  }
  return (
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bgMap[status] || bgMap.waiting}`}
    >
      {status === "completed" ? (
        <CheckCircle className="w-5 h-5" />
      ) : status === "failed" ? (
        <XCircle className="w-5 h-5" />
      ) : status === "running" ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Icon className="w-5 h-5" />
      )}
    </div>
  )
}

/** 统计行 badges - 显示耗时、生成数量、补充数量、字数 */
/** 行内统计：耗时 + 字数（显示在副标题后面，不换行） */
function InlineStats({ step }: { step: StepItem }) {
  const hasDuration = step.durationMs > 0
  const hasWords = step.wordCount > 0
  if (!hasDuration && !hasWords) return null

  return (
    <span className="inline-flex items-center gap-1.5 ml-1.5 text-[10px] text-muted-light font-mono">
      {hasDuration && <span>· {formatDuration(step.durationMs)}</span>}
      {hasWords && <span>· {step.wordCount}字</span>}
    </span>
  )
}

/** 关键数据徽章：生成数量、补充数量（单行紧凑展示） */
function KeyDataBadges({ step }: { step: StepItem }) {
  const hasGenerated = step.generated !== undefined && step.generated > 0
  const hasSupplemented = step.supplemented !== undefined && step.supplemented > 0

  if (!hasGenerated && !hasSupplemented) return null

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {hasGenerated && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 text-[10px] font-bold leading-none border border-amber-300 shadow-sm">
          <FileText className="w-2.5 h-2.5" />
          {step.generated}条
        </span>
      )}
      {hasSupplemented && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 text-[10px] font-bold leading-none border border-blue-300 shadow-sm">
          <Plus className="w-2.5 h-2.5" />
          +{step.supplemented}条
        </span>
      )}
    </div>
  )
}

function StepSidebarInner({
  steps,
  selectedStepKey,
  onStepSelect,
  pipelineStatus,
  onFocusOutput,
}: StepSidebarProps) {
  if (steps.length === 0) {
    return (
      <aside className="w-64 flex-shrink-0 bg-cream-light/50 border-r border-border flex flex-col">
        <div className="flex-1 flex items-center justify-center p-5">
          <p className="text-xs text-muted-light text-center">
            🧭 启动全流程后将在此处<br/>显示步骤导航
          </p>
        </div>
      </aside>
    )
  }

  const totalDuration = steps.reduce((sum, s) => sum + s.durationMs, 0)
  const totalWords = steps.reduce((sum, s) => sum + s.wordCount, 0)
  const doneCount = steps.filter(s => s.status === "completed" || s.status === "failed").length

  return (
    <aside className="w-64 flex-shrink-0 bg-cream-light/50 border-r-2 border-border flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b-2 border-border flex items-center justify-between flex-shrink-0 bg-white/60">
        <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
          执行清单
        </h3>
        <span className="text-[10px] text-muted-light font-mono font-medium bg-cream px-2 py-1 rounded">
          {doneCount}/{steps.length}
        </span>
      </div>

      {/* 步骤卡片（等分高度，内容溢出隐藏） */}
      <nav className="flex-1 flex flex-col p-3 gap-2 overflow-hidden">
        {steps.map((step) => {
          const meta = STEP_META[step.key]
          const Icon = meta?.icon || FileText
          const isSelected = step.key === selectedStepKey
          const isWaiting = step.status === "waiting"

          return (
            <button
              key={step.key}
              onClick={() => !isWaiting && onStepSelect(step.key)}
              disabled={isWaiting}
              className={`
                flex-1 flex items-stretch min-h-[56px] rounded-lg p-2.5
                transition-all duration-200 text-left overflow-hidden
                border-[2.5px]
                ${isSelected
                  ? "border-amber-600 bg-gradient-to-br from-amber-50 to-amber-100/60 ring-2 ring-amber-300/70 shadow-md"
                  : step.status === "completed"
                    ? "border-emerald-500 bg-emerald-50/40 hover:border-emerald-600 hover:bg-emerald-50/60"
                    : step.status === "failed"
                      ? "border-red-500 bg-red-50/40 hover:border-red-600 hover:bg-red-50/60"
                      : step.status === "running"
                        ? "border-blue-500 bg-blue-50/40 hover:border-blue-600 hover:bg-blue-50/60 animate-pulse"
                        : "border-gray-400 bg-white hover:border-gray-500 hover:bg-gray-50"
                }
                ${isWaiting ? "opacity-40 cursor-default" : "cursor-pointer"}
              `}
            >
              {/* 图标 */}
              <StatusIcon status={step.status} icon={Icon} />
              {/* 文字内容 */}
              <div className="flex-1 min-w-0 ml-2.5 flex flex-col justify-center overflow-hidden">
                {/* 标题 + 状态图标 */}
                <div className="flex items-center gap-1">
                  <span
                    className={`text-sm font-bold truncate leading-tight ${
                      isWaiting ? "text-muted" : "text-ink"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.status === "running" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse flex-shrink-0" />
                  )}
                  {step.status === "completed" && (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  )}
                </div>

                {/* 角色名 + 行内统计（耗时、字数）单行显示 */}
                <div className="text-[10px] text-muted-light mt-0.5 truncate flex items-center min-w-0">
                  <span className="truncate flex-shrink">{meta?.agent || step.key}</span>
                  <InlineStats step={step} />
                </div>

                {/* 关键数据徽章：生成数量、补充数量（单行内展示，超出隐藏） */}
                <KeyDataBadges step={step} />
              </div>
            </button>
          )
        })}
      </nav>

      {/* 底部操作区：显示当前选中步骤 + 跳转按钮 */}
      <div className="px-3 py-2.5 border-t-[2.5px] border-border bg-gradient-to-r from-white/80 via-emerald-50/30 to-white/80 flex-shrink-0">
        {pipelineStatus === "completed" ? (
          <button
            onClick={() => onFocusOutput?.()}
            className="w-full flex items-center justify-center gap-2 text-xs text-emerald-700 bg-emerald-50/80 px-3 py-2 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="font-semibold">点击查看详细产出</span>
          </button>
        ) : selectedStepKey ? (
          <button
            onClick={() => onFocusOutput?.()}
            className="w-full flex items-center justify-center gap-2 text-xs text-amber-700 bg-amber-50/80 px-3 py-2 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="font-semibold">查看「{steps.find(s => s.key === selectedStepKey)?.label || selectedStepKey}」产出</span>
          </button>
        ) : (
          <p className="text-xs text-muted text-center">选择左侧步骤查看产出</p>
        )}
      </div>
    </aside>
  )
}

export default memo(StepSidebarInner)
