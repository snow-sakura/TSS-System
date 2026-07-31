/**
 * PipelineHeader — 顶部概览栏
 *
 * 显示：流水线标题、整体状态、实时统计、开始/停止按钮
 */
import { memo } from "react"
import { Button } from "@/components/ui/button"
import {
  Square, Sparkles, CheckCircle, XCircle, Loader2,
  Clock, AlertTriangle,
} from "lucide-react"

export type PipelineStatus = "idle" | "running" | "completed" | "failed"

interface PipelineStats {
  total: number
  completed: number
  failed: number
  running: number
  totalDuration: number
  totalWords: number
}

interface PipelineHeaderProps {
  status: PipelineStatus
  stats: PipelineStats
  /** 需求名称（运行中/完成时显示） */
  requirementName?: string
  onStart: () => void
  onStop: () => void
  /** 是否可以启动（输入内容非空） */
  canStart: boolean
  /** 继续执行模式：按钮文案显示为「继续执行」 */
  continueMode?: boolean
}

const formatDuration = (ms: number): string => {
  if (ms <= 0) return ""
  const s = (ms / 1000).toFixed(1)
  if (s === "0.0") return ""
  return `${s}s`
}

function PipelineHeaderInner({
  status,
  stats,
  requirementName,
  onStart,
  onStop,
  canStart,
  continueMode,
}: PipelineHeaderProps) {
  const isRunning = status === "running"

  return (
    <div className="flex-shrink-0 bg-white border-b border-border px-5 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* 左侧：标题 + 状态 */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md flex-shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2
                className="text-sm font-bold text-ink truncate"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                AI 全流程自动化
              </h2>
              {/* 状态徽标 */}
              <StatusBadge status={status} />
            </div>
            <p className="text-[11px] text-muted truncate mt-0.5">
              需求分析 → 规划方案 → 提取测试点 → 用例生成 → 用例评审
              {requirementName && ` · ${requirementName}`}
            </p>
          </div>
        </div>

        {/* 右侧：统计 + 按钮 */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* 实时统计信息 */}
          <div className="flex items-center gap-3">
            {isRunning && (
              <div className="flex items-center gap-2 text-xs text-ink-light bg-amber-light/50 px-3 py-1 rounded-lg border border-amber/20">
                <Loader2 className="w-3.5 h-3.5 text-amber animate-spin" />
                <span>
                  执行中 {stats.completed}/{stats.total} 步
                </span>
              </div>
            )}
            {status === "completed" && (
              <div className="flex items-center gap-2 text-xs bg-pass/10 px-3 py-1 rounded-lg border border-pass/20">
                <CheckCircle className="w-3.5 h-3.5 text-pass" />
                <span className="text-pass font-medium">
                  已完成 {stats.completed}/{stats.total} 步
                </span>
                {stats.totalDuration > 0 && (
                  <span className="text-muted font-mono">
                    总耗时 {formatDuration(stats.totalDuration)}
                  </span>
                )}
                {stats.totalWords > 0 && (
                  <span className="text-muted">
                    {stats.totalWords} 字
                  </span>
                )}
              </div>
            )}
            {status === "failed" && (
              <div className="flex items-center gap-2 text-xs bg-fail/10 px-3 py-1 rounded-lg border border-fail/20">
                <AlertTriangle className="w-3.5 h-3.5 text-fail" />
                <span className="text-fail font-medium">
                  执行失败 · {stats.failed}/{stats.total} 步出错
                </span>
              </div>
            )}
          </div>

          {/* 控制按钮：仅运行时显示「停止」按钮，其他状态的控制按钮在 InputSection 中 */}
          {isRunning && (
            <Button
              onClick={onStop}
              size="sm"
              className="h-8 px-3 text-xs bg-fail hover:bg-fail/80 text-white gap-1.5 shadow-sm"
            >
              <Square className="w-3.5 h-3.5" />
              停止
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** 状态徽标（小圆点 + 文字） */
function StatusBadge({ status }: { status: PipelineStatus }) {
  switch (status) {
    case "running":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-light text-amber border border-amber/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
          运行中
        </span>
      )
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pass/10 text-pass border border-pass/20">
          <CheckCircle className="w-3 h-3" />
          已完成
        </span>
      )
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-fail/10 text-fail border border-fail/20">
          <XCircle className="w-3 h-3" />
          执行失败
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cream text-muted border border-border">
          <Clock className="w-3 h-3" />
          就绪
        </span>
      )
  }
}

export default memo(PipelineHeaderInner)
