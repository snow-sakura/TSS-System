/**
 * 全流程Pipeline流程图
 * 4个阶段节点水平排列，状态实时更新（等待/运行中/完成/失败）
 */
import { FileText, ClipboardList, Target, FlaskConical, Loader2, CheckCircle, XCircle, Clock } from "lucide-react"

export type StageStatus = "waiting" | "running" | "completed" | "failed"

export interface StageNode {
  key: string
  label: string
  icon: string
  gradient: string
  status: StageStatus
  duration?: number
}

interface PipelineFlowProps {
  stages: StageNode[]
  currentStageKey?: string
}

const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-5 h-5" />,
  ClipboardList: <ClipboardList className="w-5 h-5" />,
  Target: <Target className="w-5 h-5" />,
  FlaskConical: <FlaskConical className="w-5 h-5" />,
}

const statusConfig = {
  waiting: {
    border: "border-border",
    bg: "bg-white",
    iconBg: "bg-cream",
    iconColor: "text-muted",
    labelColor: "text-muted",
    badge: <Clock className="w-4 h-4 text-muted-light" />,
    desc: "等待执行",
  },
  running: {
    border: "border-amber/30",
    bg: "bg-amber-light/50",
    iconBg: "gradient-amber",
    iconColor: "text-white",
    labelColor: "text-warn",
    badge: <Loader2 className="w-4 h-4 text-amber animate-spin" />,
    desc: "执行中...",
  },
  completed: {
    border: "border-pass/30",
    bg: "bg-pass/10",
    iconBg: "bg-pass",
    iconColor: "text-white",
    labelColor: "text-pass",
    badge: <CheckCircle className="w-4 h-4 text-pass" />,
    desc: "已完成",
  },
  failed: {
    border: "border-fail/30",
    bg: "bg-fail/10",
    iconBg: "bg-fail",
    iconColor: "text-white",
    labelColor: "text-fail",
    badge: <XCircle className="w-4 h-4 text-fail" />,
    desc: "执行失败",
  },
}

export default function PipelineFlow({ stages, currentStageKey }: PipelineFlowProps) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink">全流程状态</h3>
        <div className="flex items-center gap-3 text-[11px] text-ink-light">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 等待</span>
          <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 text-amber" /> 运行中</span>
          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-pass" /> 完成</span>
          <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-fail" /> 失败</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {stages.map((stage, idx) => {
          const cfg = statusConfig[stage.status]
          const isLast = idx === stages.length - 1
          const isRunning = stage.status === "running"

          return (
            <div key={stage.key} className="flex-1 flex items-center gap-2">
              {/* 节点 */}
              <div className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-500 ${cfg.border} ${cfg.bg} ${isRunning ? "shadow-lg shadow-amber/10 scale-[1.02]" : ""}`}>
                {/* 图标 */}
                <div className={`w-10 h-10 rounded-xl ${cfg.iconBg} flex items-center justify-center shadow-sm transition-all duration-500 ${isRunning ? "animate-pulse" : ""}`}>
                  <div className={cfg.iconColor}>
                    {iconMap[stage.icon] || <FileText className="w-5 h-5" />}
                  </div>
                </div>
                {/* 标签 */}
                <span className={`text-xs font-semibold ${cfg.labelColor} text-center`}>{stage.label}</span>
                {/* 状态 + 耗时 */}
                <div className="flex items-center gap-1">
                  {cfg.badge}
                  {stage.duration != null && (
                    <span className={`text-[10px] font-mono ${stage.status === "completed" ? "text-emerald-600" : "text-gray-400"}`}>
                      {stage.duration}s
                    </span>
                  )}
                </div>
              </div>

              {/* 连接箭头 */}
              {!isLast && (
                <div className="flex-shrink-0 flex items-center -mx-1">
                  <svg width="28" height="28" viewBox="0 0 28 28" className={stage.status === "completed" ? "text-emerald-400" : "text-gray-300"}>
                    <path d="M6 14h16M16 8l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
