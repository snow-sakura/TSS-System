/**
 * AI自动化 — Pipeline全流程执行页面
 * 左右布局：左侧上传区域，右侧5步骤+可展开日志
 */
import { useState, useRef, useCallback, useEffect } from "react"
import { lifecycleApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Play, Square, Sparkles, Upload, Loader2, CheckCircle, XCircle,
  AlertCircle, ChevronDown, ChevronRight, Clock
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useAutomationStore } from "@/stores/automationStore"
import { useSSEStream } from "@/hooks/useSSEStream"
import LogPanel from "@/components/log-panel/LogPanel"

const STAGE_DEFS = [
  { key: "requirements", label: "需求分析", icon: "FileText", gradient: "from-blue-500 to-indigo-600", order: 1 },
  { key: "test-plans", label: "规划方案", icon: "ClipboardList", gradient: "from-cyan-500 to-teal-600", order: 2 },
  { key: "test-points", label: "提取测试点", icon: "Target", gradient: "from-violet-500 to-purple-600", order: 3 },
  { key: "test-cases", label: "用例生成", icon: "FlaskConical", gradient: "from-emerald-500 to-green-600", order: 4 },
  { key: "test-review", label: "用例评审", icon: "CheckCircle", gradient: "from-pink-500 to-rose-600", order: 5 },
]

type PipelineStatus = "idle" | "running" | "completed" | "failed"
type StageStatus = "waiting" | "running" | "completed" | "failed"

interface StageData {
  key: string
  label: string
  icon: string
  gradient: string
  order: number
  status: StageStatus
  content: string
  duration?: number
}

interface AIPipelineProps {
  onStageUpdate?: (key: string, status: StageStatus) => void
}

export default function AIPipeline({ onStageUpdate }: AIPipelineProps) {
  // 使用Zustand读取当前活动记录
  const { currentRecord } = useAutomationStore()

  const [requirementName, setRequirementName] = useState(currentRecord?.name || "")
  const [requirementContent, setRequirementContent] = useState(currentRecord?.requirementContent || "")
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>(currentRecord?.requirementContent ? "completed" : "idle")
  const [currentStageKey, setCurrentStageKey] = useState<string | null>(null)
  const [stageStates, setStageStates] = useState<StageData[]>(() => {
    if (currentRecord) {
      return STAGE_DEFS.map((def, idx) => ({
        ...def,
        status: (idx < currentRecord.stagesCompleted ? "completed" : "waiting") as StageStatus,
        content: idx < currentRecord.stagesCompleted ? `已自动完成 ${def.label}` : "",
      }))
    }
    return STAGE_DEFS.map((def) => ({ ...def, status: "waiting" as StageStatus, content: "" }))
  })
  const [sseResponse, setSseResponse] = useState<Response | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)

  // 同步状态到父组件
  useEffect(() => {
    if (onStageUpdate) {
      stageStates.forEach((s) => onStageUpdate(s.key, s.status))
    }
  }, [stageStates, onStageUpdate])

  const updateStage = useCallback((key: string, updates: Partial<StageData>) => {
    setStageStates((prev) => prev.map((s) => (s.key === key ? { ...s, ...updates } : s)))
  }, [])

  const appendStageContent = useCallback((key: string, content: string) => {
    setStageStates((prev) => prev.map((s) => {
      if (s.key === key) {
        // 避免重复追加相同内容
        const newContent = s.content + content
        return { ...s, content: newContent }
      }
      return s
    }))
  }, [])

  // 使用公共 SSE Hook 解析流
  useSSEStream({
    response: sseResponse,
    onEvent: useCallback((eventType: string, data: any) => {
      // 将日志推送到 LogPanel
      if (eventType === "stage_log" || eventType === "stage_output") {
        try {
          const addLog = (window as any).__tssLogAdd
          if (addLog) addLog({
            level: eventType === "stage_log" ? "INFO" : "AGENT",
            message: data.content?.slice(0, 200) || eventType,
            stage: data.stage || "pipeline",
            detail: eventType === "stage_error" ? data.error : undefined,
          })
        } catch {}
      }

      switch (eventType) {
        case "stage_start":
          setCurrentStageKey(data.stage)
          setStageStates((prev) => prev.map((s) => ({ ...s, status: s.key === data.stage ? "running" : s.status, content: s.key === data.stage ? "" : s.content })))
          break
        case "stage_output":
          if (data.content) appendStageContent(data.stage, data.content)
          break
        case "stage_log": break
        case "stage_complete":
          updateStage(data.stage, { status: (data.status === "completed" ? "completed" : "failed") as StageStatus, duration: data.duration })
          break
        case "stage_error":
          updateStage(data.stage, { status: "failed" as StageStatus, duration: data.duration })
          break
        case "pipeline_complete":
          setPipelineStatus(data.status === "completed" ? "completed" : "failed")
          setCurrentStageKey(null)
          break
      }
    }, [appendStageContent, updateStage]),
    onComplete: useCallback(() => {
      setSseResponse(null)
    }, []),
  })

  const startPipeline = useCallback(async () => {
    if (!requirementContent.trim() || pipelineStatus === "running") return
    setStageStates(STAGE_DEFS.map((def) => ({ ...def, status: "waiting" as StageStatus, content: "" })))
    setCurrentStageKey(null)
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
      if (err.name !== "AbortError") { console.error("Pipeline error:", err); setPipelineStatus("failed") }
    }
  }, [requirementContent, requirementName, pipelineStatus])

  const stopPipeline = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    setSseResponse(null)
    setPipelineStatus("idle"); setCurrentStageKey(null)
  }, [])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res: any = await lifecycleApi.uploadRequirement(formData)
      const data = res?.data
      // 后端返回 raw_content (RequirementResponse.raw_content), 也保留 content 作为兼容
      const fileContent = data?.raw_content || data?.content
      if (fileContent) {
        setRequirementContent(fileContent)
        if (!requirementName) setRequirementName(data.name || file.name.replace(/\.[^.]+$/, ""))
      } else {
        setUploadError("文件内容为空或无法提取文本")
      }
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail || err?.message || "上传失败")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [requirementName])

  useEffect(() => { return () => { if (abortRef.current) abortRef.current.abort() } }, [])

  const statusIcon = (status: StageStatus) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-pass" />
      case "running": return <Loader2 className="w-4 h-4 text-amber animate-spin" />
      case "failed": return <XCircle className="w-4 h-4 text-fail" />
      default: return <Clock className="w-4 h-4 text-muted" />
    }
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden h-full">
      {/* 左侧：上传区域 */}
      <div className="lg:w-1/2 bg-white rounded-2xl border border-border shadow-card p-5 flex flex-col h-full min-h-0">
        <h2 className="text-sm font-semibold text-ink mb-3 flex-shrink-0">需求文档</h2>
        <div className="flex-1 flex flex-col space-y-3">
          <input type="text" placeholder="需求名称（可选）" value={requirementName}
            onChange={(e) => setRequirementName(e.target.value)} disabled={pipelineStatus === "running"}
            className="w-full h-10 px-4 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber focus:ring-1 focus:ring-amber outline-none disabled:opacity-50" />
          <textarea placeholder="请输入需求文档内容，或粘贴需求描述..." value={requirementContent}
            onChange={(e) => setRequirementContent(e.target.value)} disabled={pipelineStatus === "running"}
            className="flex-1 px-4 py-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber focus:ring-1 focus:ring-amber outline-none resize-none disabled:opacity-50 min-h-[120px]" />
          <div className="flex items-center justify-between flex-shrink-0">
            <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${uploading ? "text-amber" : "text-muted hover:text-ink"}`}>
              {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 解析中...</> : <><Upload className="w-3.5 h-3.5" /> 上传文档</>}
              <input ref={fileInputRef} type="file" className="hidden" accept=".docx,.doc,.pdf,.xlsx,.xls,.pptx,.ppt,.md,.txt,.csv,.xmind" disabled={pipelineStatus === "running" || uploading} onChange={handleFileUpload} />
            </label>
            {pipelineStatus === "running" ? (
              <Button onClick={stopPipeline} className="h-8 px-3 text-xs bg-fail hover:bg-fail/80 text-white"><Square className="w-3 h-3 mr-1" /> 停止</Button>
            ) : (
              <Button onClick={startPipeline} disabled={!requirementContent.trim()}
                className={`h-8 px-3 text-xs text-white ${!requirementContent.trim() ? "bg-muted-light" : "gradient-amber"}`}>
                <Play className="w-3 h-3 mr-1" /> 开始全流程
              </Button>
            )}
          </div>
          {uploadError && <p className="text-[11px] text-fail mt-1 flex-shrink-0">{uploadError}</p>}
        </div>
      </div>

      {/* 右侧：5步骤+可展开日志 */}
      <div className="lg:w-1/2 bg-white rounded-2xl border border-border shadow-card p-5 flex flex-col h-full min-h-0">
        <h2 className="text-sm font-semibold text-ink mb-3 flex-shrink-0">流程步骤详情</h2>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {stageStates.map((stage) => (
            <div key={stage.key} className="bg-cream/30 rounded-xl border border-border overflow-hidden">
              <div onClick={() => setExpandedStage(expandedStage === stage.key ? null : stage.key)}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-cream/60 transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold text-white bg-gradient-to-br ${stage.gradient}`}>
                  {stage.order}
                </div>
                {statusIcon(stage.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{stage.label}</p>
                  {stage.duration && <p className="text-[10px] text-muted">耗时: {(stage.duration / 1000).toFixed(1)}s</p>}
                </div>
                {expandedStage === stage.key ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
              </div>
              {expandedStage === stage.key && (
                <div className="border-t border-border bg-white">
                  {stage.content ? (
                    <div className="p-3 prose prose-sm max-w-none"><ReactMarkdown>{stage.content}</ReactMarkdown></div>
                  ) : (
                    <div className="p-3 text-center text-xs text-muted">
                      {stage.status === "waiting" ? "等待执行..." : stage.status === "running" ? "正在执行..." : "暂无内容"}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* LogPanel */}
      <LogPanel currentStage={currentStageKey || ""} />
    </div>
  )
}
