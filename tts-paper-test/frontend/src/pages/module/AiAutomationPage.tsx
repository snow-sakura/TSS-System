/**
 * AI自动化测试 - 连接真实 Pipeline API (SSE)
 */
import { useState, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft, Upload, FileText, FlaskConical, Play,
  CheckCircle2, CheckCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, ClipboardList, Target,
  Loader2, X
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"
import { lifecycleApi } from "@/lib/api"
import { useSSEStream } from "@/hooks/useSSEStream"
import LogPanel from "@/components/log-panel/LogPanel"

interface StageData {
  key: string
  label: string
  order: number
  icon: string
  gradient: string
  status: "waiting" | "running" | "completed" | "failed"
  content: string
  duration?: number
}

const STAGE_DEFS = [
  { key: "requirements", label: "需求分析", icon: "FileText", gradient: "from-blue-500 to-indigo-600" },
  { key: "test-plans", label: "规划方案", icon: "ClipboardList", gradient: "from-cyan-500 to-teal-600" },
  { key: "test-points", label: "提取测试点", icon: "Target", gradient: "from-violet-500 to-purple-600" },
  { key: "test-cases", label: "用例生成", icon: "FlaskConical", gradient: "from-emerald-500 to-green-600" },
  { key: "test-review", label: "用例评审", icon: "CheckCircle", gradient: "from-pink-500 to-rose-600" },
]

export default function AiAutomationPage() {
  const navigate = useNavigate()
  const [requirementContent, setRequirementContent] = useState("")
  const [requirementName, setRequirementName] = useState("")
  const [stages, setStages] = useState<StageData[]>(
    STAGE_DEFS.map((def) => ({ ...def, status: "waiting", content: "" }))
  )
  const [pipelineStatus, setPipelineStatus] = useState<"idle" | "running" | "completed" | "failed">("idle")
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [sseResponse, setSseResponse] = useState<Response | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const updateStage = useCallback((key: string, updates: Partial<StageData>) => {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...updates } : s)))
  }, [])

  const appendStageContent = useCallback((key: string, content: string) => {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, content: s.content + content } : s)))
  }, [])

  // 使用公共 SSE Hook 解析流
  useSSEStream({
    response: sseResponse,
    onEvent: useCallback((eventType: string, data: any) => {
      // 将日志推送到 LogPanel
      if (eventType === "stage_log" || eventType === "stage_output" || eventType === "stage_error") {
        try {
          const addLog = (window as any).__tssLogAdd
          if (addLog) addLog({
            level: eventType === "stage_error" ? "ERROR" : eventType === "stage_log" ? "INFO" : "AGENT",
            message: data.content?.slice(0, 200) || eventType,
            stage: data.stage || "pipeline",
            detail: eventType === "stage_error" ? data.error : undefined,
          })
        } catch {}
      }

      switch (eventType) {
        case "stage_start":
          setCurrentStage(data.stage)
          setStages((prev) =>
            prev.map((s) => ({
              ...s,
              status: s.key === data.stage ? "running" : s.status,
              content: s.key === data.stage ? "" : s.content,
            }))
          )
          break
        case "stage_output":
          if (data.content) appendStageContent(data.stage, data.content)
          break
        case "stage_log":
          break
        case "stage_complete":
          updateStage(data.stage, {
            status: data.status === "completed" ? "completed" : "failed",
            duration: data.duration,
          })
          break
        case "stage_error":
          updateStage(data.stage, { status: "failed", duration: data.duration })
          break
        case "pipeline_complete":
          setPipelineStatus(data.status === "completed" ? "completed" : "failed")
          setCurrentStage(null)
          if (data.status === "completed") toast.success("Pipeline 执行完成！")
          break
      }
    }, [appendStageContent, updateStage]),
    onError: useCallback((err: Error) => {
      console.error("Pipeline error:", err)
      toast.error("Pipeline 执行失败")
      setPipelineStatus("failed")
    }, []),
    onComplete: useCallback(() => {
      setSseResponse(null)
    }, []),
  })

  const handleStartPipeline = useCallback(async () => {
    if (!requirementContent.trim() || pipelineStatus === "running") return

    // 重置阶段状态
    setStages(STAGE_DEFS.map((def) => ({ ...def, status: "waiting", content: "" })))
    setCurrentStage(null)
    setPipelineStatus("running")

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await lifecycleApi.startPipelineSSE({
        requirement_content: requirementContent,
        requirement_name: requirementName || "未命名需求",
      }, controller.signal)

      setSseResponse(response)
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Pipeline error:", err)
        toast.error("Pipeline 执行失败")
        setPipelineStatus("failed")
      }
    }
  }, [requirementContent, requirementName, pipelineStatus])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setSseResponse(null)
    setPipelineStatus("idle")
    setCurrentStage(null)
    toast.info("Pipeline 已停止")
  }, [])

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-pass" />
      case "running": return <Loader2 className="w-5 h-5 text-amber animate-spin" />
      case "failed": return <AlertTriangle className="w-5 h-5 text-fail" />
      default: return <Clock className="w-5 h-5 text-muted" />
    }
  }

  const completedCount = stages.filter((s) => s.status === "completed").length
  const progress = (completedCount / stages.length) * 100

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* 顶部栏 */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group">
            <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
            <span className="text-xs font-medium text-ink-light group-hover:text-ink transition-colors hidden sm:block">返回</span>
          </button>
          <div className="h-8 w-px bg-border/60" />
          <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md">
            <FlaskConical className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>AI自动化测试</h1>
            <p className="text-[11px] text-muted truncate">上传文档，AI自动生成测试流程</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pipelineStatus === "running" ? (
            <Button onClick={handleStop} className="h-9 text-sm shadow-sm bg-fail text-white hover:bg-fail/90">
              <X className="w-4 h-4 mr-1" /> 停止
            </Button>
          ) : (
            <Button
              onClick={handleStartPipeline}
              disabled={!requirementContent.trim() || pipelineStatus === "running"}
              className="h-9 text-sm shadow-sm gradient-amber text-white hover:opacity-90"
            >
              <Play className="w-4 h-4 mr-1" /> 开始全流程
            </Button>
          )}
        </div>
      </div>

      {/* 左右布局内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧 - 输入区域和全流程状态 */}
        <div className="w-1/2 p-6 border-r border-border overflow-y-auto">
          {/* 输入区域 */}
          <div className="mb-6">
            <h2 className="text-base font-semibold text-ink mb-3">需求输入</h2>
            <div className="bg-white rounded-2xl border border-border shadow-card p-6">
              <div className="mb-4">
                <label className="block text-xs font-medium text-ink-light mb-1">需求名称</label>
                <input
                  value={requirementName}
                  onChange={(e) => setRequirementName(e.target.value)}
                  placeholder="如：用户登录功能"
                  className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">需求内容 *</label>
                <textarea
                  value={requirementContent}
                  onChange={(e) => setRequirementContent(e.target.value)}
                  placeholder="请输入需求内容，AI将根据此内容自动生成测试流程..."
                  rows={8}
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* 全流程状态 */}
          <div>
            <h2 className="text-base font-semibold text-ink mb-3">全流程状态</h2>
            <div className="bg-white rounded-2xl border border-border shadow-card p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-ink-light">完成 {completedCount}/{stages.length} 步</span>
                <span className="text-xs text-muted">
                  {pipelineStatus === "running" ? "执行中..." : pipelineStatus === "completed" ? "全部完成" : "等待开始"}
                </span>
              </div>
              <div className="w-full h-2 bg-cream rounded-full overflow-hidden mb-4">
                <div className="h-full gradient-amber rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="space-y-2">
                {stages.map((stage, idx) => (
                  <div key={stage.key} className="flex items-center gap-3 py-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cream text-xs font-medium text-ink-light">{idx + 1}</div>
                    {statusIcon(stage.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{stage.label}</p>
                      {stage.duration && <p className="text-[10px] text-muted">{(stage.duration / 1000).toFixed(1)}s</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧 - 5个流程步骤详情 */}
        <div className="w-1/2 p-6 overflow-y-auto">
          <h2 className="text-base font-semibold text-ink mb-4">流程步骤详情</h2>
          <div className="space-y-3">
            {stages.map((stage) => (
              <div key={stage.key} className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
                <div
                  onClick={() => setExpandedStage(expandedStage === stage.key ? null : stage.key)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-cream/50 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cream text-sm font-semibold text-ink">{stage.order}</div>
                  {statusIcon(stage.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{stage.label}</p>
                    {stage.content && <p className="text-xs text-muted truncate">{stage.content.slice(0, 50)}...</p>}
                  </div>
                  {expandedStage === stage.key ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
                </div>
                {expandedStage === stage.key && (
                  <div className="border-t border-border bg-[#1C1917] p-4 animate-fade-in max-h-64 overflow-y-auto">
                    {stage.content ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{stage.content}</ReactMarkdown>
                      </div>
                    ) : stage.status === "running" ? (
                      <div className="flex items-center gap-2 text-stone-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> 正在生成...
                      </div>
                    ) : (
                      <p className="text-sm text-stone-500 text-center py-4">暂无内容</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LogPanel */}
      <LogPanel currentStage={currentStage || ""} defaultOpen={false} />
    </div>
  )
}
