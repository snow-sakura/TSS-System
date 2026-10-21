import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"
import { 
  Play, Sparkles, Clock, FileText, ClipboardList, Target, FlaskConical, 
  CheckCircle, Loader2, ChevronDown, ChevronUp, ChevronLeft, Upload, X, FileIcon,
  AlertCircle, RotateCcw, CheckSquare, Code, Eye, Square,
  FolderKanban, Plus, History, Zap, PanelRightOpen, PanelRightClose
} from "lucide-react"
import { usePipelineStore } from "@/stores/pipelineStore"
import type { UploadedFile, PipelineLog, PipelineRecord, PipelineStep } from "@/stores/pipelineStore"
import { useToast } from "@/hooks/useToast"
import { useSSEStream } from "@/hooks/useSSEStream"
import { lifecycleApi, projectApi } from "@/lib/api"
import type { PipelineRecord as ApiPipelineRecord, StageResult } from "@/lib/api-types"
import { 
  createUploadedFile, isSupportedFile, formatFileSize, 
  mockAiProcessContent 
} from "@/lib/fileProcessor"
import { 
  loadStepConfigs, getDefaultConfig, renderLogTemplate,
  type StepPromptConfig, type StepKey
} from "@/lib/stepPromptConfig"
import PipelineRecordsPage from "./PipelineRecordsPage"
import StepPromptConfigPage from "../StepPromptConfigPage"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, ClipboardList, Target, FlaskConical, CheckCircle,
}

// 步骤标签映射
const STAGE_LABEL_MAP: Record<string, { label: string; icon: string }> = {
  "requirements": { label: "需求分析", icon: "FileText" },
  "test-plans": { label: "测试方案", icon: "ClipboardList" },
  "test-points": { label: "测试点", icon: "Target" },
  "test-cases": { label: "测试用例", icon: "FlaskConical" },
  "test-review": { label: "用例评审", icon: "CheckCircle" },
}

// 后端步骤 key → 前端步骤 key 映射
const STEP_KEY_MAP: Record<string, string> = {
  "requirements": "analyze",
  "test-plans": "plan",
  "test-points": "point",
  "test-cases": "case",
  "test-review": "review",
}

// 前端步骤 key → 后端步骤 key 映射
const FRONTEND_TO_BACKEND: Record<string, string> = {
  "analyze": "requirements",
  "plan": "test-plans",
  "point": "test-points",
  "case": "test-cases",
  "review": "test-review",
}

interface ThrottleState {
  timer: ReturnType<typeof setTimeout> | null
  pending: string
}

export default function PipelinePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const throttleMapRef = useRef<Map<string, ThrottleState>>(new Map())
  const loadedFromUrlRef = useRef(false)  // 防止重复加载
  
  const { 
    currentRecord, isRunning, expandedStep,
    startPipeline, continuePipeline, updateStep, 
    appendStepLog, updateStepLog, completeStep, failStep, finishPipeline,
    setExpandedStep, reset, setCurrentRecord
  } = usePipelineStore()
  
  const [pipelineName, setPipelineName] = useState("")
  const [requirementInput, setRequirementInput] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isContinuing, setIsContinuing] = useState(false)

  // 结果弹窗状态 — 使用 ref 避免 SSE 闭包导致状态被覆盖
  const showResultPopupRef = useRef(false)
  const [showResultPopup, setShowResultPopup] = useState(false)
  const resultPopupStepRef = useRef<string | null>(null)
  const [resultPopupStep, setResultPopupStep] = useState<string | null>(null)
  const resultPopupContentRef = useRef<{ content: string; duration?: number } | null>(null)
  const [resultPopupContent, setResultPopupContent] = useState<{ content: string; duration?: number } | null>(null)
  const resultPopupTypeRef = useRef<"result" | "review">("result")
  const [resultPopupType, setResultPopupType] = useState<"result" | "review">("result")

  const openResultPopup = useCallback((step: string, content: string, type: "result" | "review", duration?: number) => {
    resultPopupStepRef.current = step
    resultPopupContentRef.current = { content, duration }
    resultPopupTypeRef.current = type
    // 需要先关闭再打开（处理同一事件触发两次场景）
    setShowResultPopup(false)
    setResultPopupStep(step)
    setResultPopupContent({ content, duration })
    setResultPopupType(type)
    // 用微任务确保 setState 顺序正确
    queueMicrotask(() => {
      showResultPopupRef.current = true
      setShowResultPopup(true)
    })
  }, [])

  const closeResultPopup = useCallback(() => {
    showResultPopupRef.current = false
    resultPopupStepRef.current = null
    resultPopupContentRef.current = null
    setShowResultPopup(false)
    setResultPopupStep(null)
  }, [])

  // 右侧 SSE 日志抽屉状态
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerExpandedSteps, setDrawerExpandedSteps] = useState<Set<string>>(new Set())
  const drawerScrollRef = useRef<HTMLDivElement>(null)
  const drawerAccordionRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // 页内 Tab：AI全流程 / 生成记录 / 步骤提示词（兼容 URL ?tab= 参数）
  const [activeTab, setActiveTab] = useState<"flow" | "records" | "config">("flow")

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "records" || tab === "config") setActiveTab(tab)
    else setActiveTab("flow")
  }, [searchParams])

  const switchTab = useCallback((tab: "flow" | "records" | "config") => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams)
    if (tab === "flow") params.delete("tab")
    else params.set("tab", tab)
    const qs = params.toString()
    navigate(`/test-management/pipeline${qs ? `?${qs}` : ""}`, { replace: true })
  }, [navigate, searchParams])

  const [projectId, setProjectId] = useState<number | null>(null)
  const [versionId, setVersionId] = useState<number | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])

  const [showProjectVersionDialog, setShowProjectVersionDialog] = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState<number | null>(null)
  const [pendingVersionId, setPendingVersionId] = useState<number | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isDialogDragging, setIsDialogDragging] = useState(false)

  // SSE 流式执行
  const [sseResponse, setSseResponse] = useState<Response | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stageContentRef = useRef<Map<string, string>>(new Map())
  const currentRecordRef = useRef(currentRecord)
  currentRecordRef.current = currentRecord

  // 动态加载步骤提示词配置（优先后端 API，失败使用内置丰富模板）
  const [stepConfigs, setStepConfigs] = useState<StepPromptConfig[]>([])
  const loadConfigs = useCallback(async () => {
    try {
      const cfgs = await loadStepConfigs()
      setStepConfigs(cfgs)
    } catch {
      setStepConfigs([])
    }
  }, [])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  useEffect(() => {
    projectApi.listProjects().then(res => setProjects(res.data?.items || [])).catch(() => {})
    projectApi.listVersions().then(res => setVersions(res.data?.items || [])).catch(() => {})
  }, [])

  // 查找步骤配置，若未加载完成则使用内置默认
  const getStepConfig = useCallback((stepKey: string): StepPromptConfig => {
    if (stepConfigs.length > 0) {
      const found = stepConfigs.find(c => c.step_key === stepKey)
      if (found) return found
    }
    return getDefaultConfig(stepKey as StepKey)
  }, [stepConfigs])

  // 从 URL 参数加载历史记录
  useEffect(() => {
    const recordId = searchParams.get("recordId")
    const mode = searchParams.get("mode")
    if (recordId && !loadedFromUrlRef.current && !currentRecord) {
      loadedFromUrlRef.current = true
      const loadRecord = async () => {
        try {
          const res = await lifecycleApi.getPipelineRecord(Number(recordId))
          const record: ApiPipelineRecord = (res as unknown as { data?: ApiPipelineRecord }).data || (res as unknown as ApiPipelineRecord)
          if (record) {
            // 转换后端数据为前端格式
            // 兼容后端数据格式：使用 key 字段
            const steps: PipelineStep[] = (record.stage_results || []).map((stage: StageResult) => {
              const backendKey = stage.stage || stage.key
              const frontKey = STEP_KEY_MAP[backendKey] || backendKey
              // 从 content 推断状态
              const hasContent = !!stage.content && stage.content.length > 0
              const stageStatus = stage.status || (hasContent ? "completed" : "pending")
              return {
                key: frontKey,
                label: stage.label || STAGE_LABEL_MAP[backendKey]?.label || backendKey,
                icon: STAGE_LABEL_MAP[backendKey]?.icon || "FileText",
                status: stageStatus === "completed" ? "completed" : stageStatus === "failed" ? "failed" : "pending",
                progress: stageStatus === "completed" ? 100 : 0,
                description: stage.description || "",
                logs: stage.content ? [{
                  timestamp: new Date().toTimeString().split(" ")[0],
                  content: stage.content.slice(0, 200),
                  type: "info"
                }] : [],
                result: stage.result || stage.content
              }
            })
            
            // 填充默认步骤（如果 stage_results 不完整）
            const defaultSteps = ["analyze", "plan", "point", "case", "review"]
            const completeSteps: PipelineStep[] = defaultSteps.map(key => {
              const existing = steps.find((s) => s.key === key)
              if (existing) return existing
              const config = getDefaultConfig(key as StepKey)
              return {
                key,
                label: config.step_name,
                icon: config.output_logs_template ? "FileText" : "FileText",
                status: "pending",
                progress: 0,
                description: config.description || "",
                logs: []
              }
            })
            
            const pipelineRecord: PipelineRecord = {
              id: String(record.id),
              name: record.requirement_name || record.name || "未命名需求",
              requirement: record.requirement_content || "",
              uploadedFiles: [],
              // 状态规范化：将 completed 映射为 success
              status: ((record.status === "success" || record.status === "completed") ? "success" : "failed") as PipelineRecord["status"],
              currentStepIndex: completeSteps.findIndex((s) => s.status !== "completed"),
              startedAt: record.created_at || new Date().toISOString(),
              completedAt: record.updated_at,
              steps: completeSteps,
              results: {
                requirements: completeSteps.find((s) => s.key === "analyze")?.result,
                plans: completeSteps.find((s) => s.key === "plan")?.result,
                points: completeSteps.find((s) => s.key === "point")?.result,
                cases: completeSteps.find((s) => s.key === "case")?.result,
                reviews: completeSteps.find((s) => s.key === "review")?.result
              }
            }
            
            setCurrentRecord(pipelineRecord)
            setPipelineName(pipelineRecord.name)
            setRequirementInput(pipelineRecord.requirement)
            setProjectId(record.project_id || null)
            setVersionId(record.version_id || null)
            
            // 设置继续执行模式
            if (mode === "continue" || record.status === "failed") {
              const firstPending = completeSteps.find((s) => s.status !== "completed")
              setIsContinuing(true)
              if (firstPending) {
                setExpandedStep(firstPending.key)
              }
              toast?.info?.("已加载历史数据，点击「继续执行」可从失败处恢复")
            }
          }
        } catch {
          toast?.error?.("加载历史记录失败")
        }
      }
      loadRecord()
    }
  }, [searchParams, currentRecord, setCurrentRecord, setExpandedStep, toast])

  useEffect(() => {
    if (currentRecord) {
      setPipelineName(currentRecord.name)
      setRequirementInput(currentRecord.requirement)
      setUploadedFiles(currentRecord.uploadedFiles)
      setProjectId(currentRecord.project_id || null)
      setVersionId(currentRecord.version_id || null)
      const firstPending = currentRecord.steps.find(s => s.status !== "completed")
      setIsContinuing(!!firstPending && currentRecord.status === "failed")
    } else {
      setProjectId(null)
      setVersionId(null)
    }
  }, [currentRecord?.id])

  useEffect(() => {
    if (logsEndRef.current && expandedStep) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [expandedStep, currentRecord?.steps])

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: UploadedFile[] = []
    
    for (const file of fileArray) {
      if (!isSupportedFile(file.name, file.size)) {
        if (file.size > 50 * 1024 * 1024) {
          toast?.error?.(`文件过大: ${file.name}，最大支持50MB`)
        } else {
          toast?.error?.(`不支持的文件格式: ${file.name}`)
        }
        continue
      }
      try {
        const uploaded = await createUploadedFile(file)
        validFiles.push(uploaded)
      } catch (e) {
        toast?.error?.(`文件读取失败: ${file.name}`)
      }
    }
    
    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles])
      
      if (!pipelineName.trim() && validFiles.length > 0) {
        const firstName = validFiles[0].name
        const baseName = firstName.substring(0, firstName.lastIndexOf(".")) || firstName
        setPipelineName(baseName)
      }
      
      if (!requirementInput.trim() && validFiles.length > 0) {
        const contents = validFiles.map(f => {
          if (["txt", "md", "markdown", "csv", "json", "xml", "yaml", "yml", "rtf"].includes(f.type)) {
            return f.content
          }
          return mockAiProcessContent(f.content || "", f.type)
        })
        setRequirementInput(contents.join("\n\n---\n\n"))
      }
      
      toast?.success?.(`成功上传 ${validFiles.length} 个文件`)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      if (!projectId) {
        setPendingProjectId(projectId)
        setPendingVersionId(versionId)
        setShowProjectVersionDialog(true)
        return
      }
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleUploadClick = () => {
    if (isRunning) return
    setPendingProjectId(projectId)
    setPendingVersionId(versionId)
    setPendingFiles([])
    setShowProjectVersionDialog(true)
  }

  const handleDialogFileSelect = (files: FileList | null) => {
    if (!files) return
    setPendingFiles(prev => [...prev, ...Array.from(files)])
  }

  const handleDialogDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDialogDragging(false)
    if (e.dataTransfer.files.length > 0) {
      setPendingFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
    }
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const confirmProjectVersion = async () => {
    if (!pendingProjectId) {
      toast?.error?.("请选择项目")
      return
    }
    setProjectId(pendingProjectId)
    setVersionId(pendingVersionId)
    
    if (pendingFiles.length > 0) {
      await handleFileUpload(pendingFiles)
    }
    
    setShowProjectVersionDialog(false)
    setPendingFiles([])
  }

  const cancelProjectVersion = () => {
    setShowProjectVersionDialog(false)
    setPendingProjectId(null)
    setPendingVersionId(null)
    setPendingFiles([])
  }

  const handleFileRemove = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const generateStepLogs = useCallback(async (
    stepKey: string, 
    stepLabel: string, 
    content: string,
    onProgress: (progress: number) => void
  ) => {
    const now = () => new Date().toTimeString().split(" ")[0]
    const logs: PipelineLog[] = []
    
    // ✨ 使用动态步骤配置（从后端加载或内置丰富模板）
    const stepConfig = getStepConfig(stepKey)
    const templateList = stepConfig.output_logs_template ?? []
    
    const filesStr = uploadedFiles.map(f => f.name).join(", ")
    
    // 🔗 构建变量集：支持 {content_preview}、{files_list}、{prev_result} 等
    const prevResultStr = (() => {
      if (!currentRecord) return ""
      const prevSteps = currentRecord.steps.filter(s => s.status === "completed")
      if (prevSteps.length === 0) return ""
      const last = prevSteps[prevSteps.length - 1]
      try {
        const preview = typeof last.result === "object"
          ? JSON.stringify(last.result, null, 2)
          : String(last.result ?? "")
        return preview.substring(0, 600)
      } catch {
        return ""
      }
    })()

    const variables: Record<string, string> = {
      content_preview: content.substring(0, 120),
      files_list: filesStr || "无",
      step_key: stepKey,
      step_label: stepLabel,
      prev_result: prevResultStr,
      skills: (stepConfig.skills ?? []).map(s => s.name).join("、"),
    }
    
    const typeSpeed = (char: string): number => {
      if (char === '\n') return 80
      if (char === '|') return 30
      if (/[`*_>,-]/.test(char)) return 20
      return 15
    }
    
    const flushUpdate = (sKey: string, logIndex: number, throttleKey: string) => {
      const state = throttleMapRef.current.get(throttleKey)
      if (!state) return
      if (state.timer) {
        clearTimeout(state.timer)
      }
      state.timer = setTimeout(() => {
        const currentState = throttleMapRef.current.get(throttleKey)
        if (currentState?.pending) {
          updateStepLog(sKey, logIndex, currentState.pending)
          currentState.pending = ""
        }
        if (currentState) {
          currentState.timer = null
        }
      }, 50)
    }
    
    const typeText = async (text: string, logIndex: number, throttleKey: string) => {
      let currentText = ""
      let state = throttleMapRef.current.get(throttleKey)
      if (!state) {
        state = { timer: null, pending: "" }
        throttleMapRef.current.set(throttleKey, state)
      }
      
      for (let i = 0; i < text.length; i++) {
        currentText += text[i]
        state.pending = currentText
        flushUpdate(stepKey, logIndex, throttleKey)
        const speed = typeSpeed(text[i])
        await new Promise(r => setTimeout(r, speed))
      }
      if (state.pending) {
        updateStepLog(stepKey, logIndex, state.pending)
        state.pending = ""
      }
    }
    
    if (templateList.length === 0) {
      // 兜底：无配置时使用内置默认
      const fallback = getDefaultConfig(stepKey as StepKey).output_logs_template ?? []
      for (let i = 0; i < fallback.length; i++) {
        const template = fallback[i]
        const processedContent = renderLogTemplate(template.content, variables)
        const logIndex = logs.length
        const throttleKey = `${stepKey}-${logIndex}`
        const emptyLog: PipelineLog = {
          timestamp: now(),
          content: "",
          type: "info",
        }
        logs.push(emptyLog)
        appendStepLog(stepKey, emptyLog)
        onProgress(Math.round((i / fallback.length) * 80))
        await typeText(processedContent, logIndex, throttleKey)
        await new Promise(r => setTimeout(r, 200))
      }
    } else {
      for (let i = 0; i < templateList.length; i++) {
        const template = templateList[i]
        const processedContent = renderLogTemplate(template.content, variables)
        const logIndex = logs.length
        const throttleKey = `${stepKey}-${logIndex}`
        
        const emptyLog: PipelineLog = {
          timestamp: now(),
          content: "",
          type: "info",
        }
        logs.push(emptyLog)
        appendStepLog(stepKey, emptyLog)
        
        onProgress(Math.round((i / templateList.length) * 80))
        
        await typeText(processedContent, logIndex, throttleKey)
        
        await new Promise(r => setTimeout(r, 200))
      }
    }
    
    onProgress(100)
    return logs
  }, [appendStepLog, updateStepLog, uploadedFiles, getStepConfig, currentRecord])

  const generateStepResult = (stepKey: string) => {
    const baseResults: Record<string, () => any> = {
      analyze: () => [
        { id: 1, name: "用户登录", type: "功能点", priority: "P0", status: "active" },
        { id: 2, name: "用户注册", type: "功能点", priority: "P1", status: "active" },
        { id: 3, name: "密码找回", type: "功能点", priority: "P1", status: "active" },
        { id: 4, name: "账户锁定", type: "功能点", priority: "P0", status: "active" },
        { id: 5, name: "会话管理", type: "功能点", priority: "P1", status: "active" },
      ],
      plan: () => [
        { id: 1, name: "登录功能测试方案", scope: "登录功能全流程", strategy: "黑盒测试", priority: "P0" },
        { id: 2, name: "异常场景测试方案", scope: "异常登录场景", strategy: "边界值测试", priority: "P1" },
      ],
      point: () => [
        { id: 1, name: "账号密码登录验证", status: "active", priority: "P0", coverage: 100 },
        { id: 2, name: "手机验证码登录", status: "active", priority: "P1", coverage: 80 },
        { id: 3, name: "账户锁定机制", status: "active", priority: "P0", coverage: 100 },
        { id: 4, name: "记住密码功能", status: "draft", priority: "P2", coverage: 0 },
        { id: 5, name: "登出会话清除", status: "active", priority: "P1", coverage: 90 },
        { id: 6, name: "密码错误提示", status: "active", priority: "P1", coverage: 100 },
        { id: 7, name: "验证码过期处理", status: "active", priority: "P1", coverage: 85 },
      ],
      case: () => [
        { id: 1, name: "正常登录流程", status: "approved", priority: "P0", testType: "功能" },
        { id: 2, name: "错误密码登录", status: "approved", priority: "P0", testType: "功能" },
        { id: 3, name: "账户锁定测试", status: "approved", priority: "P0", testType: "安全" },
      ],
      review: () => ({
        score: 9,
        status: "passed",
        comments: "质量优秀，覆盖核心场景",
        details: {
          completeness: 9,
          executability: 8,
          coverage: 9,
        }
      }),
    }
    return baseResults[stepKey]?.() || { status: "completed" }
  }

  // SSE 事件处理：所有后端日志实时推送到页面
  const handleSSEEvent = useCallback((eventType: string, data: Record<string, unknown>) => {
    const frontStepKey = data.stage ? STEP_KEY_MAP[data.stage as string] : null

    switch (eventType) {
      case "pipeline_start":
        break
      case "stage_start":
        if (frontStepKey) {
          updateStep(frontStepKey, { status: "running", progress: 0 })
          setExpandedStep(frontStepKey)
          // 自动打开抽屉并展开当前步骤
          setDrawerOpen(true)
          setDrawerExpandedSteps(prev => {
            const next = new Set(prev)
            next.add(frontStepKey)
            return next
          })
          stageContentRef.current.set(frontStepKey, "")
          const startLog: PipelineLog = {
            timestamp: new Date().toTimeString().split(" ")[0],
            content: `🚀 启动 ${data.label as string} ...`,
            type: "info",
          }
          appendStepLog(frontStepKey, startLog)
        }
        break
      case "stage_output":
        if (frontStepKey && data.content) {
          const current = stageContentRef.current.get(frontStepKey) || ""
          const contentStr = data.content as string
          const updated = current + contentStr
          stageContentRef.current.set(frontStepKey, updated)
          
          // 追加新的日志条目，使用节流机制减少频繁更新
          const outputLog: PipelineLog = {
            timestamp: new Date().toTimeString().split(" ")[0],
            content: contentStr,
            type: "info",
          }
          appendStepLog(frontStepKey, outputLog)
          
          // 基于已接收的内容长度更新进度（上限99%，完成时设为100%）
          const progress = Math.min(99, Math.round((updated.length / 2000) * 100))
          updateStep(frontStepKey, { progress })
        }
        break
      case "stage_log":
        if (frontStepKey) {
          const level = (data.level as string) || "INFO"
          const logType: PipelineLog["type"] = level === "ERROR" ? "error" : "info"
          const logMsg = (data.message as string) || `${data.stage} 日志`
          const stageLabel = currentRecordRef.current?.steps.find(s => s.key === frontStepKey)?.label || frontStepKey
          const log: PipelineLog = {
            timestamp: new Date().toTimeString().split(" ")[0],
            content: logMsg.includes(stageLabel) ? logMsg : `[${level}] ${logMsg}`,
            type: logType,
          }
          appendStepLog(frontStepKey, log)
        }
        break
      case "stage_complete":
        if (frontStepKey) {
          const content = stageContentRef.current.get(frontStepKey) || ""
          const result = {
            status: "completed",
            duration: data.duration as number,
            content: content,
          }
          completeStep(frontStepKey, result)
          // 弹出结果弹窗（携带真实耗时，修复弹窗内容/耗时不显示问题）
          const popupType = frontStepKey === "review" ? "review" : "result"
          const popupContent = { content, duration: data.duration as number | undefined }
          // 使用 openResultPopup 打开弹窗
          resultPopupStepRef.current = frontStepKey
          resultPopupContentRef.current = popupContent
          resultPopupTypeRef.current = popupType
          setShowResultPopup(false)
          setResultPopupStep(frontStepKey)
          setResultPopupContent(popupContent)
          setResultPopupType(popupType)
          queueMicrotask(() => {
            showResultPopupRef.current = true
            setShowResultPopup(true)
          })
        }
        break
      case "stage_error":
        if (frontStepKey) {
          failStep(frontStepKey, (data.error as string) || "未知错误")
        }
        break
      case "pipeline_complete":
        const success = data.status === "completed"
        finishPipeline(success as boolean)
        if (success) {
          toast?.success?.(`🎉 AI全流程执行完成！总耗时 ${data.total_duration}s`)
        } else {
          toast?.error?.("流水线执行失败")
        }
        setSseResponse(null)
        break
    }
  }, [updateStep, appendStepLog, updateStepLog, completeStep, failStep, finishPipeline, setExpandedStep, toast])

  // 连接 SSE 流
  useSSEStream({
    response: sseResponse,
    onEvent: handleSSEEvent,
    onComplete: useCallback(() => {
      setSseResponse(null)
      // 安全网：如果流已结束但状态仍为 running，说明 pipeline_complete 事件可能丢失
      // 此时根据步骤状态判断最终结果
      if (currentRecord && isRunning) {
        const hasFailedStep = currentRecord.steps.some(s => s.status === "failed")
        const allCompleted = currentRecord.steps.every(s => s.status === "completed")
        if (hasFailedStep) {
          finishPipeline(false)
        } else if (allCompleted) {
          finishPipeline(true)
        } else {
          // 部分完成：标记为部分成功
          finishPipeline(false)
        }
      }
    }, [currentRecord, isRunning, finishPipeline]),
    onError: useCallback((err: Error) => {
      toast?.error?.(`SSE 流错误: ${err.message}`)
      setSseResponse(null)
      if (currentRecord) {
        finishPipeline(false)
      }
    }, [toast, currentRecord, finishPipeline]),
  })

  const handleStart = async () => {
    if (!pipelineName.trim()) {
      toast?.error?.("请输入需求名称")
      return
    }
    if (!requirementInput.trim() && uploadedFiles.length === 0) {
      toast?.error?.("请输入需求描述或上传文档")
      return
    }

    const processedFiles = await Promise.all(
      uploadedFiles.map(async f => ({
        ...f,
        processed: true,
        content: mockAiProcessContent(f.content || "", f.type),
      }))
    )

    stageContentRef.current.clear()
    startPipeline(pipelineName, requirementInput, processedFiles)
    setIsContinuing(false)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await lifecycleApi.startPipelineSSE({
        requirement_content: requirementInput,
        requirement_name: pipelineName,
        project_id: projectId || undefined,
        version_id: versionId || undefined,
      }, controller.signal)
      setSseResponse(response)
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast?.error?.(`启动失败: ${err.message}`)
        finishPipeline(false)
      }
    }
  }

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setSseResponse(null)
  }

  const handleContinue = async () => {
    if (!currentRecord) return
    
    // 找到第一个未完成的步骤作为 resume_from 起点
    const firstPendingStep = currentRecord.steps.find(s => s.status !== "completed")
    const resumeFrom = firstPendingStep ? FRONTEND_TO_BACKEND[firstPendingStep.key] || firstPendingStep.key : undefined
    
    setIsContinuing(true)
    stageContentRef.current.clear()

    // 重置失败步骤的状态为 pending
    if (firstPendingStep) {
      updateStep(firstPendingStep.key, { status: "pending", progress: 0, logs: [] })
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await lifecycleApi.startPipelineSSE({
        requirement_content: requirementInput,
        requirement_name: pipelineName || "未命名需求",
        project_id: projectId || undefined,
        version_id: versionId || undefined,
        resume_from: resumeFrom,
        record_id: Number(currentRecord.id) || undefined,
      }, controller.signal)
      setSseResponse(response)
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast?.error?.(`继续执行失败: ${err.message}`)
        finishPipeline(false)
      }
    }
  }

  const handleReset = () => {
    reset()
    setPipelineName("")
    setRequirementInput("")
    setUploadedFiles([])
    setProjectId(null)
    setVersionId(null)
    setIsContinuing(false)
    stageContentRef.current.clear()
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setSseResponse(null)
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  const toggleStep = (stepKey: string) => {
    if (expandedStep === stepKey) {
      setExpandedStep(null)
    } else {
      setExpandedStep(stepKey)
    }
  }

  /** 滚动 drawer 到指定步骤的 accordion */
  const scrollToAccordion = useCallback((stepKey: string) => {
    requestAnimationFrame(() => {
      const el = drawerAccordionRefs.current.get(stepKey)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }, [])

  const totalProgress = currentRecord 
    ? currentRecord.steps.reduce((sum, s) => sum + s.progress, 0) / currentRecord.steps.length
    : 0

  const completedCount = currentRecord 
    ? currentRecord.steps.filter(s => s.status === "completed").length
    : 0

  const steps = currentRecord?.steps || []
  const canStart = pipelineName.trim() && (requirementInput.trim() || uploadedFiles.length > 0)
  const hasFailedStep = currentRecord?.steps.some(s => s.status === "failed")
  const isFailedRecord = currentRecord?.status === "failed"

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 页内 Tab 导航：AI全流程 / 生成记录 / 步骤提示词 */}
      <div className="flex items-center gap-1 border-b border-border flex-shrink-0">
        {([
          { key: "flow" as const, label: "AI全流程", icon: Sparkles },
          { key: "records" as const, label: "生成记录", icon: History },
          { key: "config" as const, label: "步骤提示词", icon: Zap },
        ]).map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "text-amber border-amber"
                  : "text-muted border-transparent hover:text-ink"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* AI全流程主体（保持挂载，Tab 切换不丢执行状态） */}
      <div className={`flex-1 min-h-0 p-4 md:p-6 flex flex-col overflow-hidden ${activeTab === "flow" ? "" : "hidden"}`}>
        {/* 顶部标题行 */}
        <div className="flex items-center justify-between flex-shrink-0 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink">AI全流程</h2>
            <span className="text-[10px] text-muted bg-cream px-2 py-0.5 rounded-md">
              {hasFailedStep ? "继续执行" : "一键执行完整测试流水线"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(projectId || versionId || pipelineName) && (
              <div className="hidden lg:flex items-center gap-3 text-[11px] bg-cream/60 rounded-lg border border-border px-3 py-1.5">
                {pipelineName && (
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-amber" /><span className="text-muted">需求：</span><span className="text-ink font-medium">{pipelineName}</span></span>
                )}
                {projectId && (
                  <span className="flex items-center gap-1"><FolderKanban className="w-3 h-3 text-amber" /><span className="text-muted">项目：</span><span className="text-ink font-medium">{projects.find(p => p.id === projectId)?.name || "—"}</span></span>
                )}
                {versionId && (
                  <span className="flex items-center gap-1"><FolderKanban className="w-3 h-3 text-amber" /><span className="text-muted">版本：</span><span className="text-ink font-medium">{versions.find(v => v.id === versionId)?.name || "—"}</span></span>
                )}
                {currentRecord?.status && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                    currentRecord.status === "success" ? "bg-pass/10 text-pass" :
                    currentRecord.status === "failed" ? "bg-fail/10 text-fail" :
                    currentRecord.status === "running" ? "bg-info/10 text-info" : "bg-cream text-muted"
                  }`}>
                    {currentRecord.status === "success" ? "成功" : currentRecord.status === "failed" ? "失败" : currentRecord.status === "running" ? "执行中" : "待执行"}
                  </span>
                )}
              </div>
            )}
            {currentRecord && (
              <button onClick={() => switchTab("records")} className="text-[11px] text-ink-light hover:text-ink px-2.5 py-1 rounded-lg border border-border hover:border-amber/40 transition-colors">
                查看记录
              </button>
            )}
          </div>
        </div>

        {/* 移动端信息条 */}
        {(projectId || versionId || pipelineName) && (
          <div className="lg:hidden bg-cream/60 rounded-lg border border-border px-3 py-1.5 mb-2 flex items-center gap-3 flex-wrap text-[11px] flex-shrink-0">
            {pipelineName && <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-amber" />{pipelineName}</span>}
            {projectId && <span className="flex items-center gap-1"><FolderKanban className="w-3 h-3 text-amber" />{projects.find(p => p.id === projectId)?.name || "—"}</span>}
            {versionId && <span className="flex items-center gap-1"><FolderKanban className="w-3 h-3 text-amber" />{versions.find(v => v.id === versionId)?.name || "—"}</span>}
            {currentRecord?.status && (
              <span className={`ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                currentRecord.status === "success" ? "bg-pass/10 text-pass" :
                currentRecord.status === "failed" ? "bg-fail/10 text-fail" :
                currentRecord.status === "running" ? "bg-info/10 text-info" : "bg-cream text-muted"
              }`}>
                {currentRecord.status === "success" ? "成功" : currentRecord.status === "failed" ? "失败" : currentRecord.status === "running" ? "执行中" : "待执行"}
              </span>
            )}
          </div>
        )}

        {/* 主体左右双栏布局：左侧=配置+执行按钮，右侧=流水线步骤+抽屉 */}
        <div className="flex-1 min-h-0 flex flex-row gap-3 overflow-hidden">
          {/* 左栏：配置表单 */}
          <div className="bg-white rounded-2xl border border-border shadow-card p-3 flex-shrink-0 lg:w-[320px] flex flex-col">
            <h3 className="text-[11px] font-semibold text-ink mb-2">流水线配置</h3>

            {/* 需求名称 */}
            <div className="mb-2">
              <label className="text-[10px] font-medium text-muted mb-0.5 block">需求名称</label>
              <input
                value={pipelineName}
                onChange={e => setPipelineName(e.target.value)}
                placeholder="例如：用户登录模块测试"
                disabled={isRunning}
                className="w-full h-7 px-2.5 text-[11px] bg-cream border border-border rounded-lg input-focus disabled:opacity-50"
              />
            </div>

            {/* 项目 + 版本 */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-[10px] font-medium text-muted mb-0.5 block">项目</label>
                <select
                  value={projectId || ''}
                  onChange={(e) => { setProjectId(e.target.value ? Number(e.target.value) : null); setVersionId(null) }}
                  className="w-full h-7 px-2 pr-6 text-[11px] bg-cream border border-border rounded-lg input-focus appearance-none cursor-pointer"
                >
                  <option value="">请选择</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted mb-0.5 block">版本</label>
                <select
                  value={versionId || ''}
                  onChange={(e) => setVersionId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-7 px-2 pr-6 text-[11px] bg-cream border border-border rounded-lg input-focus appearance-none cursor-pointer"
                >
                  <option value="">请选择</option>
                  {versions.filter(v => !projectId || v.project_id === projectId).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            {/* 需求描述 */}
            <div className="mb-2">
              <label className="text-[10px] font-medium text-muted mb-0.5 block">需求描述</label>
              <textarea
                value={requirementInput}
                onChange={e => setRequirementInput(e.target.value)}
                placeholder="请描述要测试的需求..."
                rows={3}
                disabled={isRunning}
                className="w-full px-2.5 py-1.5 text-[11px] bg-cream border border-border rounded-lg input-focus resize-none disabled:opacity-50"
              />
            </div>

            {/* 上传文档 */}
            <div className="mb-2">
              <label className="text-[10px] font-medium text-muted mb-0.5 block">文档（可选）</label>
              <div
                onClick={handleUploadClick}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-2 text-center transition-all flex flex-col items-center justify-center h-14 cursor-pointer ${
                  isDragging ? "border-amber bg-amber/5" : "border-border hover:border-amber/40 hover:bg-cream/50"
                } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Upload className="w-5 h-5 mx-auto text-muted" />
                <p className="text-[10px] text-muted mt-0.5">拖拽或点击选择</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.csv,.md,.xls,.xlsx,.ppt,.pptx,.doc,.docx,.xmind,.png,.jpeg,.jpg,.gif,.json,.xml,.yaml"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFileUpload(e.target.files)
                      e.target.value = ""
                    }
                  }}
                />
              </div>
            </div>

            {/* 已上传文件列表 */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-0.5 mb-2">
                {uploadedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-cream border border-border text-[10px]">
                    <FileIcon className="w-2.5 h-2.5 text-amber flex-shrink-0" />
                    <span className="flex-1 truncate text-ink">{file.name}</span>
                    <button onClick={() => handleFileRemove(file.id)} className="text-muted hover:text-fail transition-colors" disabled={isRunning}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 执行按钮 */}
            <div className="mt-auto flex items-center gap-1.5 pt-2 border-t border-border">
              {!isRunning && !isFailedRecord && (
                <button onClick={handleStart} disabled={!canStart} className="flex-1 h-7 px-2 rounded-lg bg-amber text-white text-[11px] font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                  <Play className="w-3 h-3" /> 开始执行
                </button>
              )}
              {isRunning && (
                <button onClick={handleStop} className="flex-1 h-7 px-2 rounded-lg bg-fail text-white text-[11px] font-medium shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1">
                  <Square className="w-3 h-3" /> 停止
                </button>
              )}
              {isFailedRecord && !isRunning && (
                <button onClick={handleContinue} className="flex-1 h-7 px-2 rounded-lg bg-info text-white text-[11px] font-medium shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1">
                  <RotateCcw className="w-3 h-3" /> 继续
                </button>
              )}
              <button onClick={handleReset} disabled={isRunning} className="h-7 px-2 rounded-lg border border-border text-[10px] text-ink-light hover:bg-cream transition-colors disabled:opacity-50">
                重置
              </button>
            </div>

            {/* 状态信息 */}
            {currentRecord?.startedAt && (
              <div className="flex items-center gap-1 text-[10px] text-muted mt-1.5">
                <Clock className="w-2.5 h-2.5" />
                <span>开始: {new Date(currentRecord.startedAt).toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* 右栏：流水线步骤 + 产出统计 */}
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
              {/* 步骤网格 */}
              <div className="bg-white rounded-2xl border border-border shadow-card flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="p-2.5 border-b border-border flex items-center justify-between flex-shrink-0">
                  <h3 className="text-[11px] font-semibold text-ink">AI 测试流水线</h3>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-muted">总进度</span>
                    <div className="w-20 h-1.5 bg-cream rounded-full overflow-hidden">
                      <div className="h-full bg-amber transition-all duration-500 rounded-full" style={{ width: `${totalProgress}%` }} />
                    </div>
                    <span className="font-medium text-ink">{totalProgress.toFixed(0)}%</span>
                    <span className="text-muted">{completedCount}/{steps.length}</span>
                    {/* 抽屉切换按钮 */}
                    <button
                      onClick={() => setDrawerOpen(!drawerOpen)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all ml-2 ${
                        drawerOpen 
                          ? "bg-amber text-white border-amber" 
                          : "bg-cream text-ink-light border-border hover:border-amber/40"
                      }`}
                    >
                      {drawerOpen ? (
                        <PanelRightClose className="w-3 h-3" />
                      ) : (
                        <PanelRightOpen className="w-3 h-3" />
                      )}
                      <span className="text-[10px] font-medium">日志</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 flex-1 min-h-0 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-3">
                    {steps.map((step, index) => {
                      const Icon = ICON_MAP[step.icon] || FileText
                      const isCurrent = step.status === "running"
                      const isDone = step.status === "completed"
                      const isFailed = step.status === "failed"
                      const isPending = step.status === "pending"
                      const resultCount = step.result ? (Array.isArray(step.result) ? step.result.length : 0) : 0
                      const cfg = getStepConfig(step.key)
                      const skills = cfg?.skills ?? []

                      return (
                        <div key={step.key} className="flex flex-col">
                          <button
                            onClick={() => {
                              toggleStep(step.key)
                              setDrawerExpandedSteps(prev => {
                                const next = new Set(prev)
                                if (next.has(step.key)) next.delete(step.key)
                                else next.add(step.key)
                                return next
                              })
                              if (!drawerOpen) setDrawerOpen(true)
                              scrollToAccordion(step.key)
                            }}
                            className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                              expandedStep === step.key ? "border-amber bg-amber-light shadow-lg ring-2 ring-amber/20"
                              : isDone ? "border-pass/40 bg-pass-light/50 hover:bg-pass-light hover:border-pass/60 shadow-sm"
                              : isFailed ? "border-fail/40 bg-fail-light/50 hover:bg-fail-light hover:border-fail/60 shadow-sm"
                              : "border-border hover:border-muted bg-white hover:shadow-sm"
                            }`}
                          >
                            {/* 头部：图标 + 标题 + 步骤号 */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0 shadow-sm ${
                                isDone ? "bg-pass text-white" : isCurrent ? "bg-info text-white" : isFailed ? "bg-fail text-white" : isPending ? "bg-cream-dark text-muted-light" : "bg-amber text-white"
                              }`}>
                                {isDone ? <CheckCircle className="w-4 h-4" /> : isCurrent ? <Loader2 className="w-4 h-4 animate-spin" /> : isFailed ? <AlertCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-ink truncate leading-tight">{step.label}</div>
                                <div className="text-[10px] text-muted">{index + 1}/{steps.length}</div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  isDone ? "bg-pass/15 text-pass" : isCurrent ? "bg-info/15 text-info" : isFailed ? "bg-fail/15 text-fail" : "bg-cream text-muted"
                                }`}>
                                  {isPending ? "待执行" : isCurrent ? "执行中" : isDone ? "已完成" : "失败"}
                                </span>
                                {resultCount > 0 && (
                                  <span className="text-[10px] text-amber font-bold flex items-center gap-0.5 bg-amber-light px-1.5 py-0.5 rounded">
                                    <FileText className="w-2.5 h-2.5" />{resultCount}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* 进度条 */}
                            {(isCurrent || isDone) && (
                              <div className="h-1.5 bg-cream rounded-full overflow-hidden mb-2 shadow-inner">
                                <div className={`h-full transition-all duration-300 rounded-full ${isDone ? "bg-pass" : "bg-info"}`} style={{ width: `${step.progress}%` }} />
                              </div>
                            )}
                            {/* 描述 */}
                            <div className="flex items-center text-[11px] gap-1">
                              <span className="text-muted truncate flex-1">{step.description}</span>
                            </div>
                            {/* 技能标签 */}
                            {skills.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {skills.slice(0, 2).map((s, i) => (
                                  <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-amber-light text-amber border border-border truncate max-w-full font-medium" title={s.description}>{s.name}</span>
                                ))}
                                {skills.length > 2 && <span className="text-[9px] text-muted font-medium">+{skills.length - 2}</span>}
                              </div>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

            {/* 底部产出统计条（单行紧凑） */}
            {(completedCount > 0 || steps.length > 0) && (
              <div className="bg-white rounded-2xl border border-border shadow-card p-2.5 flex-shrink-0">
                <div className="flex items-center justify-between">
                  {/* 左：状态 + 导航 */}
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-sm ${completedCount === steps.length ? "bg-pass text-white" : "bg-amber text-white"}`}>
                      {completedCount === steps.length ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-ink">{completedCount === steps.length ? "🎉 执行完成" : "🚀 执行中..."}</h4>
                      <p className="text-[9px] text-muted">{completedCount === steps.length ? "全部步骤完成" : `已完成 ${completedCount}/${steps.length}`}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => { if (expandedStep) { const i = steps.findIndex(s => s.key === expandedStep); if (i > 0) setExpandedStep(steps[i - 1].key) } }}
                        disabled={!expandedStep || steps.findIndex(s => s.key === expandedStep) <= 0}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border text-[9px] text-ink-light hover:bg-cream hover:border-amber transition-all disabled:opacity-50"
                      >
                        <ChevronDown className="w-2 h-2 rotate-90" />上
                      </button>
                      <button
                        onClick={() => { if (expandedStep) { const i = steps.findIndex(s => s.key === expandedStep); if (i < steps.length - 1) setExpandedStep(steps[i + 1].key) } else { const f = steps.find(s => s.status === "completed"); if (f) setExpandedStep(f.key) } }}
                        disabled={steps.length === 0}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border text-[9px] text-ink-light hover:bg-cream hover:border-amber transition-all disabled:opacity-50"
                      >
                        下<ChevronDown className="w-2 h-2 -rotate-90" />
                      </button>
                      <span className="text-[9px] text-muted hidden sm:inline">
                        {expandedStep ? steps.find(s => s.key === expandedStep)?.label : ""}
                      </span>
                    </div>
                  </div>

                  {/* 中：各步骤产出 */}
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: "需求", count: currentRecord?.results?.requirements?.length || 0, color: "text-amber" },
                      { label: "方案", count: currentRecord?.results?.plans?.length || 0, color: "text-info" },
                      { label: "测试点", count: currentRecord?.results?.points?.length || 0, color: "text-info" },
                      { label: "用例", count: currentRecord?.results?.cases?.length || 0, color: "text-ink" },
                      { label: "评审", text: currentRecord?.results?.reviews?.status === "passed" ? "通过" : currentRecord?.results?.reviews ? "完成" : "待评", color: "text-pass" },
                    ].map((item, i) => (
                      <div key={i} className="text-center px-1.5 py-0.5 rounded bg-cream border border-border">
                        <p className="text-[8px] text-muted">{item.label}</p>
                        <p className={`text-[11px] font-bold ${item.color}`}>{("count" in item ? item.count : item.text)}</p>
                      </div>
                    ))}
                  </div>

                  {/* 右：耗时 + 操作 */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-cream rounded-lg border border-border">
                      <Clock className="w-2.5 h-2.5 text-amber" />
                      <span className="text-[10px] font-bold text-ink">
                        {currentRecord?.startedAt ? Math.round((new Date(currentRecord.completedAt || new Date()).getTime() - new Date(currentRecord.startedAt).getTime()) / 1000) : 0}s
                      </span>
                    </div>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-cream rounded-lg border border-border">
                      <FileText className="w-2.5 h-2.5 text-pass" />
                      <span className="text-[10px] font-bold text-ink">
                        {(currentRecord?.results?.requirements?.length || 0) + (currentRecord?.results?.plans?.length || 0) + (currentRecord?.results?.points?.length || 0) + (currentRecord?.results?.cases?.length || 0)}条
                      </span>
                    </div>
                    <button onClick={() => setDrawerOpen(!drawerOpen)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border transition-all text-[9px] ${drawerOpen ? "border-amber bg-amber text-white" : "border-border text-ink-light hover:bg-cream"}`}>
                      <Code className="w-2 h-2" />{drawerOpen ? "收起日志" : "日志"}
                    </button>
                    {completedCount === steps.length && (
                      <button onClick={() => switchTab("records")} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber text-white text-[9px] font-medium hover:shadow-md transition-all">
                        <Eye className="w-2 h-2" />记录
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={logsEndRef} />

      {/* ===== 覆盖式日志抽屉 ===== */}
      {drawerOpen && (
        <>
          {/* 半透明背景遮罩 */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300"
            onClick={() => setDrawerOpen(false)}
          />
          {/* 抽屉面板 — 宽度 600px 以容纳完整 Markdown 内容 */}
          <div className="fixed top-0 right-0 z-50 h-full w-[600px] bg-white shadow-2xl border-l border-border transform transition-transform duration-300 ease-in-out flex flex-col">
            {/* 抽屉头部 */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-amber" />
                <h3 className="text-sm font-semibold text-ink">AI 输出内容</h3>
                {isRunning && (
                  <span className="flex items-center gap-1 text-[10px] text-info bg-info/10 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
                    SSE 实时
                  </span>
                )}
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-cream flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>

            {/* 抽屉内容：每个步骤一个手风琴 */}
            <div ref={drawerScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {steps.map((step) => {
                const Icon = ICON_MAP[step.icon] || FileText
                const isDrawerExpanded = drawerExpandedSteps.has(step.key)
                const isCurrent = step.status === "running"
                const isDone = step.status === "completed"
                const isFailed = step.status === "failed"

                const toggleDrawerStep = () => {
                  const wasExpanded = drawerExpandedSteps.has(step.key)
                  setDrawerExpandedSteps(prev => {
                    const next = new Set(prev)
                    if (next.has(step.key)) next.delete(step.key)
                    else next.add(step.key)
                    return next
                  })
                  if (!wasExpanded) scrollToAccordion(step.key)
                }

                // 优先从 step.result.content（store 持久化）获取，其次从 stageContentRef（实时 SSE）获取
                const accumulatedContent = step.result?.content || stageContentRef.current.get(step.key) || ""
                // 状态日志：只显示启动/完成/错误事件，不包含 AI 输出内容
                const statusLogs = step.logs.filter((l: PipelineLog) =>
                  l.content.startsWith("🚀") ||
                  l.content.startsWith("✅") ||
                  l.content.startsWith("❌") ||
                  l.content.startsWith("[") ||
                  l.type === "error" ||
                  l.type === "success"
                )

                return (
                  <div
                    key={step.key}
                    ref={(el) => { if (el) drawerAccordionRefs.current.set(step.key, el) }}
                    className="border border-border rounded-xl overflow-hidden"
                  >
                    {/* 手风琴标题栏 */}
                    <button
                      onClick={toggleDrawerStep}
                      className={`w-full flex items-center gap-2.5 px-4 py-3 transition-all ${
                        isDrawerExpanded ? "bg-cream/80" : "bg-white hover:bg-cream/50"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isDone ? "bg-pass text-white" : isCurrent ? "bg-info text-white" : isFailed ? "bg-fail text-white" : "bg-cream-dark text-muted-light"
                      }`}>
                        {isDone ? <CheckCircle className="w-4 h-4" /> : isCurrent ? <Loader2 className="w-4 h-4 animate-spin" /> : isFailed ? <AlertCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className="text-sm font-semibold text-ink flex-1 text-left">{step.label}</span>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                        isDone ? "bg-pass/10 text-pass" : isCurrent ? "bg-info/10 text-info" : isFailed ? "bg-fail/10 text-fail" : "bg-cream text-muted"
                      }`}>
                        {isDone ? "完成" : isCurrent ? "运行中" : isFailed ? "失败" : "待执行"}
                      </span>
                      {accumulatedContent && (
                        <span className="text-[10px] text-muted font-mono">{Math.round(accumulatedContent.length / 1000)}k</span>
                      )}
                      <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-transform ${isDrawerExpanded ? "rotate-180" : ""}`}>
                        <ChevronDown className="w-3.5 h-3.5 text-muted" />
                      </div>
                    </button>

                    {/* 手风琴内容区 */}
                    {isDrawerExpanded && (
                      <div className="border-t border-border bg-paper/50">
                        {!accumulatedContent && statusLogs.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <p className="text-xs text-muted">等待执行...</p>
                          </div>
                        ) : (
                          <div className="max-h-[600px] overflow-y-auto">
                            {/* ① AI 内容输出区 — Markdown 完整渲染 */}
                            {accumulatedContent && (
                              <div className="p-4">
                                <MarkdownPreview content={accumulatedContent} />
                              </div>
                            )}
                            {/* ② 状态时间线 — 紧凑事件流 */}
                            {statusLogs.length > 0 && (
                              <div className="px-4 py-2 border-t border-border/50 space-y-0.5">
                                {statusLogs.map((log: PipelineLog, idx: number) => {
                                  const isErr = log.type === "error"
                                  const isSucc = log.type === "success"
                                  return (
                                    <div
                                      key={idx}
                                      className={`flex items-start gap-1.5 text-[10px] leading-relaxed ${
                                        isErr ? "text-fail" : isSucc ? "text-pass" : "text-muted"
                                      }`}
                                    >
                                      <span className="flex-shrink-0 opacity-50 font-mono w-[52px]">{log.timestamp}</span>
                                      <span className="flex-shrink-0">{isErr ? "✗" : isSucc ? "✓" : "·"}</span>
                                      <span className="flex-1 break-words">{log.content}</span>
                                      {isCurrent && idx === statusLogs.length - 1 && (
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-info animate-pulse flex-shrink-0 mt-0.5" />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* 项目/版本选择弹窗（含文件选择） */}
      {showProjectVersionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-amber" />
                <h3 className="text-base font-semibold text-ink">请选择所属项目、版本和上传文档</h3>
              </div>
              <p className="text-xs text-muted mt-1">先关联项目和版本，再选择要上传的文档</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-ink mb-1.5 block">
                    所属项目 <span className="text-fail">*</span>
                  </label>
                  <select
                    value={pendingProjectId || ''}
                    onChange={(e) => {
                      const pid = e.target.value ? Number(e.target.value) : null
                      setPendingProjectId(pid)
                      setPendingVersionId(null)
                    }}
                    className="w-full h-10 px-3 pr-8 text-sm bg-cream border border-border rounded-xl input-focus appearance-none cursor-pointer"
                  >
                    <option value="">请选择项目</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-ink mb-1.5 block">所属版本</label>
                  <select
                    value={pendingVersionId || ''}
                    onChange={(e) => setPendingVersionId(e.target.value ? Number(e.target.value) : null)}
                    disabled={!pendingProjectId}
                    className="w-full h-10 px-3 pr-8 text-sm bg-cream border border-border rounded-xl input-focus appearance-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="">请选择版本</option>
                    {versions.filter(v => !pendingProjectId || v.project_id === pendingProjectId).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>

              {/* 文件选择区 */}
              <div>
                <label className="text-sm font-medium text-ink mb-1.5 block">上传文档</label>
                <div
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.multiple = true
                    input.accept = '.pdf,.txt,.csv,.md,.xls,.xlsx,.ppt,.pptx,.doc,.docx,.xmind,.png,.jpeg,.jpg,.gif,.json,.xml,.yaml'
                    input.onchange = (e) => handleDialogFileSelect((e.target as HTMLInputElement).files)
                    input.click()
                  }}
                  onDragOver={(e) => { e.preventDefault(); setIsDialogDragging(true) }}
                  onDragLeave={() => setIsDialogDragging(false)}
                  onDrop={handleDialogDrop}
                  className={`border-2 border-dashed rounded-xl p-3 text-center transition-all cursor-pointer ${
                    isDialogDragging 
                      ? "border-amber bg-amber/5" 
                      : "border-border hover:border-amber/40 hover:bg-cream/50"
                  }`}
                >
                  <Upload className="w-5 h-5 mx-auto text-muted mb-1" />
                  <p className="text-xs text-muted">
                    {pendingFiles.length > 0 ? `已选择 ${pendingFiles.length} 个文件，点击继续添加` : '点击选择文件或拖拽到此处'}
                  </p>
                  <p className="text-[10px] text-muted mt-1">支持 PDF、Word、Excel、PPT、Markdown、图片等格式</p>
                </div>

                {pendingFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                    {pendingFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-cream border border-border text-xs"
                      >
                        <FileIcon className="w-3.5 h-3.5 text-amber flex-shrink-0" />
                        <span className="flex-1 truncate text-ink">{file.name}</span>
                        <span className="text-muted text-[10px]">{(file.size / 1024).toFixed(1)} KB</span>
                        <button
                          onClick={() => removePendingFile(index)}
                          className="text-muted hover:text-fail transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-cream/50">
              <button
                onClick={cancelProjectVersion}
                className="h-9 px-4 rounded-lg border border-border text-sm text-ink-light hover:bg-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmProjectVersion}
                disabled={!pendingProjectId}
                className="h-8 px-4 rounded-lg bg-amber text-white text-sm font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50"
              >
                确认并上传
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 关闭 AI全流程主体隐藏层 */}

      {/* 步骤完成结果弹窗 */}
      {showResultPopup && resultPopupStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  resultPopupType === "review" ? "bg-pass/10" : "bg-amber/10"
                }`}>
                  {resultPopupType === "review" ? (
                    <CheckCircle className="w-5 h-5 text-pass" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-amber" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink">
                    {resultPopupType === "review" ? "用例评审结果" : `${STAGE_LABEL_MAP[FRONTEND_TO_BACKEND[resultPopupStep] || ""]?.label || resultPopupStep} 完成`}
                  </h3>
                  <p className="text-xs text-muted">
                    {resultPopupType === "review" 
                      ? "AI 已完成用例质量评审" 
                      : `耗时 ${resultPopupContent?.duration || 0}s`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={closeResultPopup}
                className="w-8 h-8 rounded-lg hover:bg-cream flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {resultPopupContent?.content ? (
                <MarkdownPreview content={resultPopupContent.content} />
              ) : (
                <p className="text-sm text-muted text-center py-8">
                  {resultPopupType === "review" ? "暂无评审内容" : "暂无输出内容"}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted">
                <CheckCircle className="w-3.5 h-3.5 text-pass" />
                <span>结果已自动同步到对应模块</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeResultPopup}
                  className="h-9 px-4 rounded-lg bg-amber text-white text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  知道了
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 生成记录 Tab */}
      {activeTab === "records" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          <PipelineRecordsPage />
        </div>
      )}
      {/* 步骤提示词 Tab */}
      {activeTab === "config" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          <StepPromptConfigPage />
        </div>
      )}
    </div>
  )
}
