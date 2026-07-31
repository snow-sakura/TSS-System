/**
 * PipelineStepper — 水平步骤进度条
 *
 * 显示 5 个阶段的横向进度，每个步骤包含：
 *   序号圆 → 状态（waiting/running/completed/failed） → 步骤名称 → 耗时 → 产出字数
 * 步骤之间用箭头连接
 */
import { memo } from "react"
import {
  CheckCircle, XCircle, Loader2, Circle,
  FileText, Search, Route, TestTubes, ClipboardCheck,
} from "lucide-react"

export interface StepItem {
  key: string
  label: string
  status: "waiting" | "running" | "completed" | "failed"
  durationMs: number
  wordCount: number
  /** 生成�数（提取测试点/用例生成/用例评审 用） */
  generated?: number
  /** 补充数量 */
  supplemented?: number
}

interface PipelineStepperProps {
  steps: StepItem[]
  currentStepKey: string | null
  onStepClick?: (key: string) => void
}

const STEP_ICONS: Record<string, typeof FileText> = {
  requirement_analysis: FileText,
  requirements: FileText,
  test_planning: Search,
  "test-plans": Search,
  test_point_extraction: Route,
  "test-points": Route,
  test_case_generation: TestTubes,
  "test-cases": TestTubes,
  test_case_review: ClipboardCheck,
  "test-review": ClipboardCheck,
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

/** 统计徽标 */
function StepStats({ step }: { step: StepItem }) {
  const hasGenerated = step.generated !== undefined && step.generated > 0
  const hasSupplemented = step.supplemented !== undefined && step.supplemented > 0
  const hasDuration = step.durationMs > 0
  const hasWords = step.wordCount > 0

  if (!hasDuration && !hasGenerated && !hasSupplemented && !hasWords) return null

  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-light mt-0.5 flex-wrap">
      {hasDuration && (
        <span className="inline-flex items-center font-mono bg-cream rounded px-1 py-0.5">
          {formatDuration(step.durationMs)}
        </span>
      )}
      {hasGenerated && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 font-bold leading-none border border-amber-200">
          <FileText className="w-2.5 h-2.5" />
          {step.generated}
        </span>
      )}
      {hasSupplemented && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 font-bold leading-none border border-blue-200">
          +{step.supplemented}
        </span>
      )}
      {hasWords && (
        <span className="inline-flex items-center bg-cream rounded px-1 py-0.5">
          {step.wordCount} 字
        </span>
      )}
    </div>
  )
}

function PipelineStepperInner({ steps, currentStepKey, onStepClick }: PipelineStepperProps) {
  if (steps.length === 0) return null

  return (
    <div className="flex-shrink-0 bg-white border-b border-border px-5 py-3 overflow-x-auto">
      <div className="flex items-center justify-center gap-1 w-full">
        <div className="inline-flex items-center gap-1">
          {steps.map((step, idx) => {
          const isActive = step.key === currentStepKey
          const isLast = idx === steps.length - 1
          const Icon = STEP_ICONS[step.key] || Circle

          return (
            <div key={step.key} className="flex items-center gap-1">
              {/* 步骤项 */}
              <button
                onClick={() => onStepClick?.(step.key)}
                disabled={step.status === "waiting"}
                className={`
                  group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all
                  border
                  ${isActive
                    ? "bg-cream shadow-sm border-amber/40 ring-1 ring-amber/10"
                    : "border-transparent hover:border-border/80 hover:bg-cream-light"
                  }
                  ${step.status === "waiting" ? "opacity-45 cursor-default" : "cursor-pointer"}
                `}
              >
                {/* 序号圆 + 图标 */}
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                    transition-all duration-300
                    ${step.status === "completed" ? "bg-pass text-white shadow-sm" : ""}
                    ${step.status === "running" ? "gradient-amber text-white shadow-sm" : ""}
                    ${step.status === "failed" ? "bg-fail text-white shadow-sm" : ""}
                    ${step.status === "waiting" ? "bg-cream-dark text-muted-light border border-border" : ""}
                  `}
                >
                  {step.status === "completed" ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : step.status === "failed" ? (
                    <XCircle className="w-4 h-4" />
                  ) : step.status === "running" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* 文字��息 */}
                <div className="text-left">
                  <div
                    className={`text-xs font-semibold leading-tight ${
                      step.status === "waiting" ? "text-muted" : "text-ink"
                    }`}
                  >
                    {step.label}
                  </div>
                  <StepStats step={step} />
                </div>
              </button>

              {/* 连接箭头 */}
              {!isLast && (
                <div className="w-5 flex items-center justify-center">
                  <svg className="w-4 h-4 text-muted-light" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}

export default memo(PipelineStepperInner)
