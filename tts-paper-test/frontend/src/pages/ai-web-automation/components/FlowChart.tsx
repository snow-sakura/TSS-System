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
    <div className="flex items-center gap-2 sm:gap-3 bg-white rounded-2xl border border-border shadow-card px-3 h-[52px]">
      {/* 左：标题 + 状态徽章 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <h3 className="text-xs font-semibold text-ink hidden sm:block">全流程</h3>
        {isPipelineRunning ? (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber/10 text-amber rounded-full text-[10px] font-medium whitespace-nowrap">
            <Loader2 className="w-3 h-3 animate-spin" />
            运行中 {runningCount > 0 ? `${completedCount + runningCount}/8` : ""}
          </span>
        ) : completedCount === steps.length && steps.length > 0 ? (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-pass/10 text-pass rounded-full text-[10px] font-medium whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3" />
            全部完成
          </span>
        ) : completedCount > 0 ? (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-cream text-muted rounded-full text-[10px] font-medium whitespace-nowrap">
            {completedCount}/8 · {progress}%
          </span>
        ) : null}
      </div>

      {/* 中：步骤胶囊横条（单一横线，紧凑） */}
      <div className="flex-1 flex items-center overflow-x-auto min-w-0 py-1">
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
            <div key={step.key} className="flex items-center flex-shrink-0">
              <button
                onClick={() => onStepClick?.(step.key)}
                disabled={isPipelineRunning && step.status !== "running"}
                title={`${step.label} - ${statusTips[step.status] || ""} · 点击跳转`}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg group transition-all duration-300 ${
                  step.status === "running" ? "bg-amber/10" : "hover:bg-cream"
                } ${step.status === "pending" ? "opacity-60 hover:opacity-100" : ""}`}
              >
                <div className={`relative w-6 h-6 rounded-md flex items-center justify-center border transition-all ${config.color} ${
                  step.status === "running" ? "shadow-sm ring-1 ring-amber/40" : ""
                }`}>
                  <Icon className={`w-3 h-3 ${config.iconColor}`} />
                  {step.status !== "pending" && (
                    <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full flex items-center justify-center ${
                      step.status === "running" ? "bg-amber/20" : "bg-white"
                    }`}>
                      <StatusIcon className={`w-2.5 h-2.5 ${
                        step.status === "running" ? "text-amber animate-spin" :
                        step.status === "completed" ? "text-pass" :
                        step.status === "failed" ? "text-fail" : "text-muted"
                      }`} />
                    </span>
                  )}
                </div>
                <span className={`hidden md:block text-[10px] font-medium whitespace-nowrap transition-colors ${
                  step.status === "running" ? "text-amber" :
                  step.status === "completed" ? "text-pass" :
                  step.status === "failed" ? "text-fail" : "text-ink-light"
                }`}>{step.label}</span>
              </button>
              {idx < steps.length - 1 && (
                <ChevronRight className={`w-3 h-3 mx-0.5 flex-shrink-0 transition-colors ${
                  step.status === "completed" ? "text-pass" : "text-muted/40"
                }`} />
              )}
            </div>
          )
        })}
      </div>

      {/* 右：一键运行 */}
      {onStartPipeline && (
        <Button
          onClick={onStartPipeline}
          disabled={isPipelineRunning}
          variant={isPipelineRunning ? "outline" : "default"}
          size="sm"
          className={`relative h-7 px-2.5 text-[10px] font-semibold rounded-lg transition-all flex-shrink-0 ${
            isPipelineRunning
              ? "border-fail/30 text-fail hover:bg-fail/5"
              : "bg-gradient-to-r from-amber to-orange-400 text-white shadow-md hover:shadow-lg hover:from-amber-500 hover:to-orange-500"
          }`}
        >
          {isPipelineRunning ? (
            <>
              <Square className="w-3 h-3 mr-1" />
              停止
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1" />
              一键运行
            </>
          )}
        </Button>
      )}
    </div>
  )
}
