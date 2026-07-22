/**
 * AI Web自动化全流程可视化组件
 * 流程: 项目创建 → URL输入 → AI探索 → 页面分析 → 用例生成 → 用例评审 → 测试执行 → 结果报告
 */
import { CheckCircle2, Clock, Loader2, AlertTriangle, ChevronRight } from "lucide-react"

interface FlowStep {
  key: string
  label: string
  icon: any
  status: "pending" | "running" | "completed" | "failed"
}

interface FlowChartProps {
  steps: FlowStep[]
  onStepClick?: (key: string) => void
}

const statusConfig = {
  pending: { color: "bg-cream text-muted border-border", iconColor: "text-muted" },
  running: { color: "bg-amber-light text-amber border-amber/30", iconColor: "text-amber" },
  completed: { color: "bg-pass/10 text-pass border-pass/20", iconColor: "text-pass" },
  failed: { color: "bg-fail/10 text-fail border-fail/20", iconColor: "text-fail" },
}

export default function FlowChart({ steps, onStepClick }: FlowChartProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4 text-pass" />
      case "running": return <Loader2 className="w-4 h-4 text-amber animate-spin" />
      case "failed": return <AlertTriangle className="w-4 h-4 text-fail" />
      default: return <Clock className="w-4 h-4 text-muted" />
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-ink mb-4">全流程进度</h3>
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {steps.map((step, idx) => {
          const config = statusConfig[step.status]
          const Icon = step.icon
          return (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => onStepClick?.(step.key)}
                className={`flex flex-col items-center gap-1.5 group transition-all duration-300 ${
                  step.status === "running" ? "scale-105" : "hover:scale-105"
                }`}
              >
                <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${config.color} ${
                  step.status === "running" ? "shadow-md shadow-amber/20" : ""
                }`}>
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                  <div className="absolute -top-1 -right-1">
                    {getStatusIcon(step.status)}
                  </div>
                </div>
                <span className="text-[11px] font-medium text-ink-light whitespace-nowrap">{step.label}</span>
              </button>
              {idx < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted mx-1 flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
