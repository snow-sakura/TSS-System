/**
 * FlowChart — AI Web自动化全流程可视化 + 一键全流程控制
 *
 * 流程: 创建项目 → 输入URL → AI探索 → 页面分析 → 用例生成 → 用例评审 → 测试执行 → 结果报告
 *
 * 支持:
 *  - 点击步骤跳转到对应 Tab
 *  - "一键运行"按钮触发完整流水线
 *  - 实时状态更新（pending / running / completed / failed）
 */
import { useCallback } from "react"
import {
  CheckCircle2, Clock, Loader2, AlertTriangle, ChevronRight,
  Play, Square, FileText, Globe, Target, ClipboardList,
  CheckCircle, BarChart3, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export interface FlowStep {
  key: string
  label: string
  icon: any
  status: "pending" | "running" | "completed" | "failed"
}

interface FlowChartProps {
  steps: FlowStep[]
  onStepClick?: (key: string) => void
  /** "一键运行"回调 */
  onStartPipeline?: () => void
  /** 是否正在运行流水线 */
  isPipelineRunning?: boolean
}

const statusConfig = {
  pending: { color: "bg-cream text-muted border-border", iconColor: "text-muted" },
  running: { color: "bg-amber-light text-amber border-amber/30", iconColor: "text-amber" },
  completed: { color: "bg-pass/10 text-pass border-pass/20", iconColor: "text-pass" },
  failed: { color: "bg-fail/10 text-fail border-fail/20", iconColor: "text-fail" },
}

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: AlertTriangle,
}

export default function FlowChart({ steps, onStepClick, onStartPipeline, isPipelineRunning }: FlowChartProps) {
  const runningCount = steps.filter((s) => s.status === "running").length
  const completedCount = steps.filter((s) => s.status === "completed").length
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-4 sm:p-6">
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-ink">全流程进度</h3>
          {isPipelineRunning && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber/10 text-amber rounded-full text-[10px] font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              运行中 {runningCount > 0 ? `(${runningCount}/8)` : ""}
            </span>
          )}
          {!isPipelineRunning && completedCount === steps.length && steps.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-pass/10 text-pass rounded-full text-[10px] font-medium">
              <CheckCircle2 className="w-3 h-3" />
              全部完成
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 进度条 */}
          {completedCount > 0 && completedCount < steps.length && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-20 h-1.5 bg-cream rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber to-pass rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] text-muted font-medium">{progress}%</span>
            </div>
          )}

          {/* 一键运行按钮 */}
          {onStartPipeline && (
            <Button
              onClick={onStartPipeline}
              disabled={isPipelineRunning}
              variant={isPipelineRunning ? "outline" : "default"}
              size="sm"
              className={`relative h-8 px-3 text-[11px] font-semibold rounded-xl transition-all ${
                isPipelineRunning
                  ? "border-fail/30 text-fill hover:bg-fail/5"
                  : "bg-gradient-to-r from-amber to-orange-400 text-white shadow-md hover:shadow-lg hover:from-amber-500 hover:to-orange-500"
              }`}
            >
              {isPipelineRunning ? (
                <>
                  <Square className="w-3.5 h-3.5 mr-1.5" />
                  停止
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  一键运行
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 步骤流 */}
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {steps.map((step, idx) => {
          const config = statusConfig[step.status]
          const Icon = step.icon
          const StatusIcon = STATUS_ICONS[step.status]
          const statusTips: Record<string, string> = {
            pending: "等待执行",
            running: "执行中...",
            completed: "已完成",
            failed: "执行失败",
          }

          return (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => onStepClick?.(step.key)}
                disabled={isPipelineRunning && step.status !== "running"}
                title={`${statusTips[step.status] || ""} - 点击跳转`}
                className={`flex flex-col items-center gap-1.5 group transition-all duration-300 ${
                  step.status === "running"
                    ? "scale-110"
                    : "hover:scale-105"
                } ${
                  step.status === "pending" ? "opacity-70 hover:opacity-100" : ""
                }`}
              >
                <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${config.color} ${
                  step.status === "running" ? "shadow-lg shadow-amber/30 ring-2 ring-amber/30" : ""
                }`}>
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                  <div className="absolute -top-1.5 -right-1.5">
                    <StatusIcon className={`w-4 h-4 ${
                      step.status === "running" ? "text-amber animate-spin" :
                      step.status === "completed" ? "text-pass" :
                      step.status === "failed" ? "text-fail" : "text-muted"
                    }`} />
                  </div>
                </div>
                <span className={`text-[11px] font-medium whitespace-nowrap transition-colors ${
                  step.status === "running" ? "text-amber" :
                  step.status === "completed" ? "text-pass" :
                  step.status === "failed" ? "text-fail" : "text-ink-light"
                }`}>{step.label}</span>
              </button>
              {idx < steps.length - 1 && (
                <ChevronRight className={`w-4 h-4 mx-1 flex-shrink-0 transition-colors ${
                  step.status === "completed" ? "text-pass" : "text-muted"
                }`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
