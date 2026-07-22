/**
 * 阶段卡片 - 可展开/收起，实时显示流式Markdown输出
 */
import { useState, useEffect, useRef } from "react"
import { ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, Loader2, Sparkles, FileText, ClipboardList, Target, FlaskConical } from "lucide-react"
import ReactMarkdown from "react-markdown"
import type { StageStatus } from "./PipelineFlow"

export interface StageData {
  key: string
  label: string
  icon: string
  gradient: string
  status: StageStatus
  content: string
  duration?: number
  order: number
}

interface StageCardProps {
  stage: StageData
  defaultExpanded?: boolean
}

const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-5 h-5" />,
  ClipboardList: <ClipboardList className="w-5 h-5" />,
  Target: <Target className="w-5 h-5" />,
  FlaskConical: <FlaskConical className="w-5 h-5" />,
}

const gradientMap: Record<string, string> = {
  "from-blue-500 to-indigo-600": "from-blue-500 to-indigo-600",
  "from-cyan-500 to-teal-600": "from-cyan-500 to-teal-600",
  "from-violet-500 to-purple-600": "from-violet-500 to-purple-600",
  "from-emerald-500 to-green-600": "from-emerald-500 to-green-600",
}

export default function StageCard({ stage, defaultExpanded = false }: StageCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const contentRef = useRef<HTMLDivElement>(null)

  // 运行中或刚完成时自动展开
  useEffect(() => {
    if (stage.status === "running") {
      setExpanded(true)
    }
  }, [stage.status])

  // 新内容到达时自动滚动到底部
  useEffect(() => {
    if (expanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [stage.content, expanded])

  const statusIcon = () => {
    switch (stage.status) {
      case "running":
        return <Loader2 className="w-4 h-4 text-amber animate-spin" />
      case "completed":
        return <CheckCircle className="w-4 h-4 text-pass" />
      case "failed":
        return <XCircle className="w-4 h-4 text-fail" />
      default:
        return <Clock className="w-4 h-4 text-muted-light" />
    }
  }

  const statusText = () => {
    switch (stage.status) {
      case "running": return "执行中..."
      case "completed": return `已完成${stage.duration ? ` (${stage.duration}s)` : ""}`
      case "failed": return "执行失败"
      default: return "等待执行"
    }
  }

  const statusColor = () => {
    switch (stage.status) {
      case "running": return "text-warn bg-amber-light border-amber/20"
      case "completed": return "text-pass bg-pass/10 border-pass/20"
      case "failed": return "text-fail bg-fail/10 border-fail/20"
      default: return "text-muted bg-cream border-border"
    }
  }

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all duration-300 ${
      stage.status === "running"
        ? "border-amber-300 shadow-lg shadow-amber/5"
        : stage.status === "completed"
          ? "border-pass/20"
          : stage.status === "failed"
            ? "border-fail/20"
            : "border-border"
    }`}>
      {/* 卡片头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-cream/50 transition-colors rounded-t-2xl"
      >
        {/* 序号+图标 */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
            stage.status === "completed" ? "bg-pass" :
            stage.status === "running" ? "gradient-amber" :
            stage.status === "failed" ? "bg-fail" :
            "bg-muted-light"
          }`}>
            {stage.order}
          </span>
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradientMap[stage.gradient] || "from-muted to-ink-light"} flex items-center justify-center flex-shrink-0`}>
            <div className="text-white w-4 h-4">{iconMap[stage.icon]}</div>
          </div>
        </div>

        {/* 标题 */}
        <div className="flex-1 text-left">
          <span className="text-sm font-semibold text-ink">{stage.label}</span>
          <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor()}`}>
            {statusIcon()}
            {statusText()}
          </span>
        </div>

        {/* 展开/收起 */}
        <div className="flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-ink-light" /> : <ChevronRight className="w-4 h-4 text-ink-light" />}
        </div>
      </button>

      {/* 卡片内容（可展开） */}
      <div className={`transition-all duration-300 overflow-hidden ${
        expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
      }`}>
        <div className="border-t border-border mx-4" />
        <div
          ref={contentRef}
          className="p-4 overflow-y-auto font-mono text-sm leading-relaxed"
          style={{ maxHeight: "560px" }}
        >
          {stage.status === "waiting" && !stage.content ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-light">
              <Clock className="w-8 h-8 mb-2 text-muted-light" />
              <p className="text-sm">等待执行</p>
              <p className="text-xs mt-1 text-muted">启动全流程后将在此显示流式输出</p>
            </div>
          ) : stage.status === "running" && !stage.content ? (
            <div className="flex flex-col items-center justify-center py-12 text-amber-600">
              <Loader2 className="w-8 h-8 mb-2 animate-spin" />
              <p className="text-sm">AI Agent 正在分析...</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:text-ink prose-headings:font-semibold prose-table:text-xs prose-code:text-amber-700 prose-code:bg-amber-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
              <ReactMarkdown>{stage.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
