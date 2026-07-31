import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import { 
  Play, Sparkles, Clock, FileText, ClipboardList, Target, FlaskConical, 
  CheckCircle, Loader2, ChevronDown, ChevronUp, Upload, X, FileIcon,
  AlertCircle, RotateCcw, ArrowRight, CheckSquare, Code, Eye, Square,
  FolderKanban, Plus
} from "lucide-react"
import { usePipelineStore } from "@/stores/pipelineStore"
import type { UploadedFile, PipelineLog, PipelineRecord } from "@/stores/pipelineStore"
import { useToast } from "@/hooks/useToast"
import { useSSEStream } from "@/hooks/useSSEStream"
import { lifecycleApi, projectApi } from "@/lib/api"
import { 
  createUploadedFile, isSupportedFile, formatFileSize, 
  mockAiProcessContent 
} from "@/lib/fileProcessor"
import { 
  loadStepConfigs, getDefaultConfig, renderLogTemplate,
  type StepPromptConfig, type StepKey
} from "@/lib/stepPromptConfig"

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
          const record: any = res?.data || res
          if (record) {
            // 转换后端数据为前端格式
            // 兼容后端数据格式：使用 key 字段
            const steps = (record.stage_results || []).map((stage: any) => {
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
            const completeSteps = defaultSteps.map(key => {
              const existing = steps.find((s: any) => s.key === key)
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
              currentStepIndex: completeSteps.findIndex((s: any) => s.status !== "completed"),
              startedAt: record.created_at || new Date().toISOString(),
              completedAt: record.updated_at,
              steps: completeSteps,
              results: {
                requirements: completeSteps.find((s: any) => s.key === "analyze")?.result,
                plans: completeSteps.find((s: any) => s.key === "plan")?.result,
                points: completeSteps.find((s: any) => s.key === "point")?.result,
                cases: completeSteps.find((s: any) => s.key === "case")?.result,
                reviews: completeSteps.find((s: any) => s.key === "review")?.result
              }
            }
            
            setCurrentRecord(pipelineRecord)
            setPipelineName(pipelineRecord.name)
            setRequirementInput(pipelineRecord.requirement)
            setProjectId(record.project_id || null)
            setVersionId(record.version_id || null)
            
            // 设置继续执行模式
            if (mode === "continue" || record.status === "failed") {
              const firstPending = completeSteps.find((s: any) => s.status !== "completed")
              setIsContinuing(true)
              if (firstPending) {
                setExpandedStep(firstPending.key)
              }
              toast?.info?.("已加载历史数据，点击「继续执行」可从失败处恢复")
            }
          }
        } catch (e) {
          console.error("加载历史记录失败:", e)
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

  // SSE 事件处理：所有后端日志实时推送到页面和浏览器 Console
  const handleSSEEvent = useCallback((eventType: string, data: any) => {
    // 🔴 实时输出到浏览器 Console（IDE 可见）
    const logPrefix = `%c[SSE→${eventType}]`
    const logStyle = "color:#D4A574;font-weight:bold"
    switch (eventType) {
      case "stage_output":
        console.log(logPrefix, logStyle, `阶段:${data.stage} 内容长度:${data.content?.length || 0}`, data.content?.slice(0, 100))
        break
      case "stage_log":
        console.log(logPrefix, logStyle, `[${data.level || "LOG"}] ${data.message || ""}`)
        break
      case "stage_start":
        console.log(logPrefix, logStyle, `▶ 阶段开始: ${data.label} (${data.stage})`)
        break
      case "stage_complete":
        console.log(logPrefix, logStyle, `✔ 阶段完成: ${data.stage} 耗时:${data.duration}s`)
        break
      case "stage_error":
        console.error(logPrefix, logStyle, `✘ 阶段失败: ${data.stage}`, data.error)
        break
      case "pipeline_start":
        console.log(logPrefix, logStyle, `🚀 Pipeline 启动: ${data.requirement_name}`)
        break
      case "pipeline_complete":
        console.log(logPrefix, logStyle, `🎉 Pipeline 完成: ${data.status} 总耗时:${data.total_duration}s`)
        break
      default:
        console.log(logPrefix, logStyle, data)
    }

    const frontStepKey = data.stage ? STEP_KEY_MAP[data.stage] : null

    switch (eventType) {
      case "pipeline_start":
        break
      case "stage_start":
        if (frontStepKey) {
          updateStep(frontStepKey, { status: "running", progress: 0 })
          setExpandedStep(frontStepKey)
          stageContentRef.current.set(frontStepKey, "")
          const startLog: PipelineLog = {
            timestamp: new Date().toTimeString().split(" ")[0],
            content: `🚀 启动 ${data.label} ...`,
            type: "info",
          }
          appendStepLog(frontStepKey, startLog)
        }
        break
      case "stage_output":
        if (frontStepKey && data.content) {
          const current = stageContentRef.current.get(frontStepKey) || ""
          const updated = current + data.content
          stageContentRef.current.set(frontStepKey, updated)
          
          // 追加新的日志条目，使用节流机制减少频繁更新
          const outputLog: PipelineLog = {
            timestamp: new Date().toTimeString().split(" ")[0],
            content: data.content,
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
          const level = data.level || "INFO"
          const logType = level === "ERROR" ? "error" : level === "AGENT" ? "info" : "info"
          const logMsg = data.message || `${data.stage} 日志`
          const stageLabel = currentRecord?.steps.find(s => s.key === frontStepKey)?.label || frontStepKey
          const log: PipelineLog = {
            timestamp: new Date().toTimeString().split(" ")[0],
            content: logMsg.includes(stageLabel) ? logMsg : `[${level}] ${logMsg}`,
            type: logType as any,
          }
          appendStepLog(frontStepKey, log)
        }
        break
      case "stage_complete":
        if (frontStepKey) {
          const content = stageContentRef.current.get(frontStepKey) || ""
          const result = {
            status: "completed",
            duration: data.duration,
            content: content,
          }
          completeStep(frontStepKey, result)
        }
        break
      case "stage_error":
        if (frontStepKey) {
          failStep(frontStepKey, data.error || "未知错误")
        }
        break
      case "pipeline_complete":
        const success = data.status === "completed"
        finishPipeline(success)
        if (success) {
          toast?.success?.(`🎉 AI全流程执行完成！总耗时 ${data.total_duration}s`)
        } else {
          toast?.error?.("流水线执行失败")
        }
        setSseResponse(null)
        break
    }
  }, [updateStep, appendStepLog, updateStepLog, completeStep, failStep, finishPipeline, setExpandedStep, toast, currentRecord])

  // 连接 SSE 流
  useSSEStream({
    response: sseResponse,
    onEvent: handleSSEEvent,
    onComplete: useCallback(() => {
      console.log("%c[SSE] 流连接关闭", "color:#888")
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
      console.error("%c[SSE] 流错误", "color:#f55", err)
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
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("启动 Pipeline 失败:", err)
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
    
    setIsContinuing(true)
    stageContentRef.current.clear()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await lifecycleApi.startPipelineSSE({
        requirement_content: requirementInput,
        requirement_name: pipelineName || "未命名需求",
        project_id: projectId || undefined,
        version_id: versionId || undefined,
      }, controller.signal)
      setSseResponse(response)
    } catch (err: any) {
      if (err.name !== "AbortError") {
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
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink">AI全流程</h2>
          <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">
            {hasFailedStep ? "继续执行" : "一键执行完整测试流水线"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {currentRecord && (
            <button
              onClick={() => navigate("/test-management/records")}
              className="text-xs text-ink-light hover:text-ink px-3 py-1.5 rounded-lg border border-border hover:border-amber/40 transition-colors"
            >
              查看生成记录
            </button>
          )}
        </div>
      </div>

      {/* 执行流程上方：项目/版本信息回显 */}
      {(projectId || versionId || pipelineName) && (
        <div className="bg-cream/60 rounded-xl border border-border px-4 py-2.5 mb-3 flex items-center gap-4 flex-wrap text-xs">
          {pipelineName && (
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber" />
              <span className="text-muted">需求名称：</span>
              <span className="text-ink font-medium">{pipelineName}</span>
            </div>
          )}
          {projectId && (
            <div className="flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-amber" />
              <span className="text-muted">所属项目：</span>
              <span className="text-ink font-medium">
                {projects.find(p => p.id === projectId)?.name || "—"}
              </span>
            </div>
          )}
          {versionId && (
            <div className="flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-amber" />
              <span className="text-muted">所属版本：</span>
              <span className="text-ink font-medium">
                {versions.find(v => v.id === versionId)?.name || "—"}
              </span>
            </div>
          )}
          {currentRecord?.status && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                currentRecord.status === "success" ? "bg-pass/10 text-pass" :
                currentRecord.status === "failed" ? "bg-fail/10 text-fail" :
                currentRecord.status === "running" ? "bg-info/10 text-info" :
                "bg-cream text-muted"
              }`}>
                {currentRecord.status === "success" ? "成功" :
                 currentRecord.status === "failed" ? "失败" :
                 currentRecord.status === "running" ? "执行中" : "待执行"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 配置区 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-4 mb-4">
        <h3 className="text-sm font-semibold text-ink mb-4">流水线配置</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* 左侧：输入区 */}
          <div className="flex flex-col space-y-4 h-full">
            <div>
              <label className="text-xs font-medium text-muted mb-2 block">需求名称</label>
              <input
                value={pipelineName}
                onChange={e => setPipelineName(e.target.value)}
                placeholder="例如：用户登录模块测试"
                disabled={isRunning}
                className="w-full h-10 px-3 text-sm bg-cream border border-border rounded-xl input-focus disabled:opacity-50"
              />
            </div>

            {/* 关联项目 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-ink mb-1.5 block">所属项目</label>
                <select
                  value={projectId || ''}
                  onChange={(e) => { setProjectId(e.target.value ? Number(e.target.value) : null); setVersionId(null) }}
                  className="w-full h-10 px-3 pr-8 text-sm bg-cream border border-border rounded-xl input-focus appearance-none cursor-pointer"
                >
                  <option value="">请选择项目</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-ink mb-1.5 block">所属版本</label>
                <select
                  value={versionId || ''}
                  onChange={(e) => setVersionId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-10 px-3 pr-8 text-sm bg-cream border border-border rounded-xl input-focus appearance-none cursor-pointer"
                >
                  <option value="">请选择版本</option>
                  {versions.filter(v => !projectId || v.project_id === projectId).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <label className="text-xs font-medium text-muted mb-2 block">需求描述</label>
              <textarea
                value={requirementInput}
                onChange={e => setRequirementInput(e.target.value)}
                placeholder="请描述要测试的需求，例如：
用户登录功能，支持账号密码、手机验证码两种方式登录。
需要支持记住密码、忘记密码功能。
登录失败3次后锁定账户30分钟。"
                rows={8}
                disabled={isRunning}
                className="w-full flex-1 px-3 py-2 text-sm bg-cream border border-border rounded-xl input-focus resize-none disabled:opacity-50 min-h-[180px]"
              />
            </div>
          </div>

          {/* 右侧：上传区 */}
          <div className="flex flex-col h-full">
            <label className="text-xs font-medium text-muted mb-2 block">上传文档（可选）</label>
            <div
              onClick={handleUploadClick}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex-1 border-2 border-dashed rounded-xl p-4 text-center transition-all flex flex-col items-center justify-center min-h-[260px] cursor-pointer ${
                isDragging 
                  ? "border-amber bg-amber/5" 
                  : "border-border hover:border-amber/40 hover:bg-cream/50"
              } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Upload className="w-8 h-8 mx-auto text-muted mb-2" />
              <p className="text-xs text-muted mb-1">拖拽文件到此处或</p>
              <span className="text-xs text-amber font-medium">
                点击选择文件
              </span>
              <p className="text-[10px] text-muted mt-2">
                支持 PDF、Word、Excel、PPT、Markdown、图片等格式
              </p>
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

            {uploadedFiles.length > 0 && (
              <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                {uploadedFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cream border border-border text-xs"
                  >
                    <FileIcon className="w-4 h-4 text-amber flex-shrink-0" />
                    <span className="flex-1 truncate text-ink">{file.name}</span>
                    <span className="text-muted">{formatFileSize(file.size)}</span>
                    <button
                      onClick={() => handleFileRemove(file.id)}
                      className="text-muted hover:text-fail transition-colors"
                      disabled={isRunning}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 执行按钮组：紧跟「上传文档」区域后面 */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {!isRunning && !isFailedRecord && (
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber to-orange-500 text-white text-sm font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  开始执行
                </button>
              )}

              {isRunning && (
                <button
                  onClick={handleStop}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-fail to-red-500 text-white text-sm font-medium shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  停止
                </button>
              )}

              {isFailedRecord && !isRunning && (
                <button
                  onClick={handleContinue}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-info to-blue-500 text-white text-sm font-medium shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  继续执行
                </button>
              )}

              <button
                onClick={handleReset}
                disabled={isRunning}
                className="h-10 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream transition-colors disabled:opacity-50"
              >
                重置
              </button>
            </div>
          </div>
        </div>

        {/* 状态信息行 */}
        {currentRecord?.startedAt && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted">
            <Clock className="w-3.5 h-3.5" />
            <span>开始时间: {new Date(currentRecord.startedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* 横向流水线 */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">AI 测试流水线</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted">总进度</span>
              <div className="w-32 h-2 bg-cream rounded-full overflow-hidden">
                <div
                  className="h-full gradient-amber transition-all duration-500"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
              <span className="font-medium text-ink">{totalProgress.toFixed(0)}%</span>
              <span className="text-muted">已完成 {completedCount}/{steps.length}</span>
            </div>
          </div>
        </div>

        {/* 横向步骤条 */}
        <div className="p-4 overflow-x-auto">
          <div className="flex items-start gap-0 min-w-max pb-2">
            {steps.map((step, index) => {
              const Icon = ICON_MAP[step.icon] || FileText
              const isCurrent = step.status === "running"
              const isDone = step.status === "completed"
              const isFailed = step.status === "failed"
              const isPending = step.status === "pending"
              const isExpanded = expandedStep === step.key
              
              // 计算产出数量
              const resultCount = step.result ? (Array.isArray(step.result) ? step.result.length : 0) : 0

              return (
                <div key={step.key} className="flex items-start">
                  {/* 步骤节点 */}
                  <div className="flex flex-col items-center w-48 flex-shrink-0">
                    <button
                      onClick={() => toggleStep(step.key)}
                      className={`w-full p-3.5 rounded-xl border-[3px] transition-all text-left ${
                        isExpanded 
                          ? "border-amber-600 bg-amber-50 shadow-lg ring-4 ring-amber-200/60" 
                          : isDone
                            ? "border-emerald-600 bg-emerald-50/80 hover:bg-emerald-50 hover:border-emerald-700 shadow-sm"
                            : isFailed
                              ? "border-red-600 bg-red-50/80 hover:bg-red-50 hover:border-red-700 shadow-sm"
                              : isCurrent
                                ? "border-blue-600 bg-blue-50/80 hover:bg-blue-50 hover:border-blue-700 animate-pulse shadow-md"
                                : "border-gray-400 hover:border-gray-500 bg-white hover:shadow-sm"
                      }`}
                    >
                      {/* 步骤头部：图标 + 标题 */}
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all flex-shrink-0 shadow-md ${
                            isDone
                              ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                              : isCurrent
                                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                                : isFailed
                                  ? "bg-gradient-to-br from-red-500 to-red-600 text-white"
                                  : isPending
                                    ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white"
                                    : "bg-gradient-to-br from-amber-400 to-amber-500 text-white"
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : isCurrent ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : isFailed ? (
                            <AlertCircle className="w-5 h-5" />
                          ) : (
                            <Icon className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-ink truncate leading-tight">
                            {step.label}
                          </div>
                          <div className="text-[10px] text-muted mt-0.5">步骤 {index + 1}/5</div>
                        </div>
                      </div>
                      
                      {/* 状态和数量行 */}
                      <div className="flex items-center justify-between mb-2 gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isDone ? "bg-emerald-200/80 text-emerald-800" :
                          isCurrent ? "bg-blue-200/80 text-blue-800" :
                          isFailed ? "bg-red-200/80 text-red-800" :
                          "bg-gray-200 text-gray-700"
                        }`}>
                          {isPending ? "待执行" : isCurrent ? "执行中" : isDone ? "已完成" : "失败"}
                        </span>
                        {(isCurrent || isDone) && (
                          <span className="text-[10px] text-ink-light font-semibold">{step.progress}%</span>
                        )}
                        {resultCount > 0 && (
                          <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5 bg-amber-100/60 px-1.5 py-0.5 rounded">
                            <FileText className="w-3 h-3" />
                            {resultCount}条
                          </span>
                        )}
                      </div>

                      {/* 进度条 */}
                      {(isCurrent || isDone) && (
                        <div className="h-2 bg-cream rounded-full overflow-hidden mb-2.5 shadow-inner">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${isDone ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-blue-400 to-blue-500"}`}
                            style={{ width: `${step.progress}%` }}
                          />
                        </div>
                      )}

                      {/* 描述和展开箭头 */}
                      <div className="flex items-center justify-between text-[10px] gap-1">
                        <span className="text-muted truncate flex-1 leading-relaxed">{step.description}</span>
                        <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors ${isExpanded ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-500"}`}>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </div>

                      {/* 展示当前步骤所使用的 Skills 技能 */}
                      {(() => {
                        const cfg = getStepConfig(step.key)
                        const skills = cfg?.skills ?? []
                        if (skills.length === 0) return null
                        return (
                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {skills.slice(0, 2).map((s, i) => (
                              <span
                                key={i}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 truncate max-w-full font-medium"
                                title={s.description}
                              >
                                {s.name}
                              </span>
                            ))}
                            {skills.length > 2 && (
                              <span className="text-[9px] text-muted font-medium">+{skills.length - 2}</span>
                            )}
                          </div>
                        )
                      })()}
                    </button>

                    {/* 展开的日志区域 */}
                    {isExpanded && (
                      <div className="w-full mt-2">
                        <StepLogs step={step} />
                      </div>
                    )}
                  </div>

                  {/* 连接线 */}
                  {index < steps.length - 1 && (
                    <div className="flex items-center h-16 px-1 -mt-4">
                      <div className={`w-10 h-1 flex-shrink-0 rounded-full transition-all shadow-sm ${
                        steps[index + 1].status === "completed" || isDone 
                          ? "bg-gradient-to-r from-emerald-400 to-emerald-500" 
                          : isCurrent 
                            ? "bg-gradient-to-r from-blue-400 to-blue-500 animate-pulse" 
                            : "bg-gradient-to-r from-gray-300 to-gray-400"
                      }`} />
                      <ArrowRight className={`w-4 h-4 flex-shrink-0 ml-0.5 ${
                        steps[index + 1].status === "completed" || isDone 
                          ? "text-emerald-500" 
                          : isCurrent 
                            ? "text-blue-500" 
                            : "text-gray-400"
                      }`} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 完成总结和底部操作区 */}
        {(completedCount > 0 || steps.length > 0) && (
          <div className="border-t border-border p-4 bg-gradient-to-r from-amber-50/50 to-emerald-50/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                  completedCount === steps.length 
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                    : "bg-gradient-to-br from-amber-500 to-amber-600 text-white"
                }`}>
                  {completedCount === steps.length ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink">
                    {completedCount === steps.length ? "🎉 流水线执行完成" : "🚀 执行中..."}
                  </h4>
                  <p className="text-xs text-muted">
                    {completedCount === steps.length 
                      ? "所有步骤均已成功完成，结果已同步到对应菜单"
                      : `已完成 ${completedCount}/${steps.length} 个步骤`
                    }
                  </p>
                </div>
              </div>
              
              {/* 总耗时和总产出 */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-border">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-[10px] text-muted">总耗时</p>
                    <p className="text-sm font-bold text-ink">
                      {currentRecord?.startedAt 
                        ? Math.round((Date.now() - new Date(currentRecord.startedAt).getTime()) / 1000)
                        : 0}s
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-border">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <div>
                    <p className="text-[10px] text-muted">总产出</p>
                    <p className="text-sm font-bold text-ink">
                      {(currentRecord?.results?.requirements?.length || 0) +
                       (currentRecord?.results?.plans?.length || 0) +
                       (currentRecord?.results?.points?.length || 0) +
                       (currentRecord?.results?.cases?.length || 0)} 条
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 各步骤产出统计 */}
            <div className="grid grid-cols-5 gap-3 mb-4">
              <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-border">
                <p className="text-xs text-muted mb-1">需求分析</p>
                <p className="text-lg font-bold text-amber-600">{currentRecord?.results?.requirements?.length || 0}</p>
                <p className="text-[10px] text-muted">条</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-border">
                <p className="text-xs text-muted mb-1">测试方案</p>
                <p className="text-lg font-bold text-blue-600">{currentRecord?.results?.plans?.length || 0}</p>
                <p className="text-[10px] text-muted">条</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-border">
                <p className="text-xs text-muted mb-1">测试点</p>
                <p className="text-lg font-bold text-purple-600">{currentRecord?.results?.points?.length || 0}</p>
                <p className="text-[10px] text-muted">条</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-border">
                <p className="text-xs text-muted mb-1">测试用例</p>
                <p className="text-lg font-bold text-indigo-600">{currentRecord?.results?.cases?.length || 0}</p>
                <p className="text-[10px] text-muted">条</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-border">
                <p className="text-xs text-muted mb-1">用例评审</p>
                <p className="text-lg font-bold text-emerald-600">
                  {currentRecord?.results?.reviews?.status === "passed" ? "通过" : 
                   currentRecord?.results?.reviews ? "完成" : "待评审"}
                </p>
              </div>
            </div>

            {/* 底部操作栏：导航和日志控制台 */}
            <div className="flex items-center justify-between pt-3 border-t border-border bg-white/50 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                {/* 上一步 */}
                <button
                  onClick={() => {
                    if (expandedStep) {
                      const currentIndex = steps.findIndex(s => s.key === expandedStep)
                      if (currentIndex > 0) {
                        setExpandedStep(steps[currentIndex - 1].key)
                      }
                    }
                  }}
                  disabled={!expandedStep || steps.findIndex(s => s.key === expandedStep) <= 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-ink-light hover:bg-cream hover:border-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronDown className="w-3 h-3 rotate-90" />
                  上一步
                </button>
                
                {/* 下一步 */}
                <button
                  onClick={() => {
                    if (expandedStep) {
                      const currentIndex = steps.findIndex(s => s.key === expandedStep)
                      if (currentIndex < steps.length - 1) {
                        setExpandedStep(steps[currentIndex + 1].key)
                      }
                    } else {
                      const firstCompleted = steps.find(s => s.status === "completed")
                      if (firstCompleted) {
                        setExpandedStep(firstCompleted.key)
                      }
                    }
                  }}
                  disabled={steps.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-ink-light hover:bg-cream hover:border-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一步
                  <ChevronDown className="w-3 h-3 -rotate-90" />
                </button>

                <span className="text-xs text-muted ml-2">
                  当前步骤: {expandedStep ? steps.find(s => s.key === expandedStep)?.label : "未选择"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* 日志控制台 */}
                <button
                  onClick={() => {
                    const logContainer = document.querySelector('.pipeline-log-container')
                    if (logContainer) {
                      logContainer.scrollIntoView({ behavior: 'smooth' })
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-ink-light hover:bg-cream hover:border-info-400 transition-all"
                >
                  <Code className="w-3 h-3" />
                  日志控制台
                </button>

                {/* 查看生成记录 */}
                {completedCount === steps.length && (
                  <button
                    onClick={() => navigate("/test-management/records")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium hover:shadow-md transition-all"
                  >
                    <Eye className="w-3 h-3" />
                    查看生成记录
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div ref={logsEndRef} />

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
                className="h-9 px-4 rounded-lg bg-gradient-to-r from-amber to-orange-500 text-white text-sm font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50"
              >
                确认并上传
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StepLogs({ step }: { step: any }) {
  const logsRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<"source" | "rendered">(step.status === "completed" ? "rendered" : "source")
  
  useEffect(() => {
    if (step.status === "completed" && viewMode === "source") {
      setViewMode("rendered")
    }
  }, [step.status])

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [step.logs, viewMode])

  const combinedMarkdown = useMemo(() => {
    return step.logs
      .filter((log: PipelineLog) => log.type !== "error")
      .map((log: PipelineLog) => log.content)
      .join("\n\n")
  }, [step.logs])

  const isRunning = step.status === "running"
  const isCompleted = step.status === "completed"
  const lastLogIndex = step.logs.length - 1

  // 计算产出数量和补充数量
  const resultStats = useMemo(() => {
    if (!step.result) return { generated: 0, supplemented: 0 }
    
    // 测试点、用例生成等步骤的数量统计
    if (Array.isArray(step.result)) {
      // 从日志中解析补充数量信息
      const supplementMatch = step.logs
        .filter((log: PipelineLog) => log.type !== "error")
        .map((log: PipelineLog) => log.content)
        .join("\n")
        .match(/补充[了]?\s*(\d+)\s*条/g)
      
      const supplemented = supplementMatch 
        ? supplementMatch.reduce((sum: number, m: string) => {
            const num = parseInt(m.match(/\d+/)?.[0] || "0")
            return sum + num
          }, 0)
        : 0
      
      return { 
        generated: step.result.length, 
        supplemented 
      }
    }
    
    // 用例评审的数量统计
    if (typeof step.result === "object" && step.result !== null) {
      const totalItems = (step.result as any).total || (step.result as any).total_cases || 0
      const passCount = (step.result as any).passed || 0
      const supplementMatch = step.logs
        .filter((log: PipelineLog) => log.type !== "error")
        .map((log: PipelineLog) => log.content)
        .join("\n")
        .match(/补充[了]?\s*(\d+)\s*条/g)
      
      const supplemented = supplementMatch 
        ? supplementMatch.reduce((sum: number, m: string) => {
            const num = parseInt(m.match(/\d+/)?.[0] || "0")
            return sum + num
          }, 0)
        : 0
      
      return { 
        generated: totalItems, 
        supplemented 
      }
    }
    
    return { generated: 0, supplemented: 0 }
  }, [step.result, step.logs])

  // 判断当前步骤是否需要显示数量统计
  const showStats = step.key === "point" || step.key === "case" || step.key === "review"

  return (
    <div className="bg-cream/50 rounded-xl border-2 border-border overflow-hidden w-full flex flex-col shadow-inner" style={{ height: '420px' }}>
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber" />
          <span className="text-xs font-medium text-ink">
            {isRunning ? "实时流式输出中..." : "AI处理结果"}
          </span>
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-info">
              <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
              SSE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 数量统计 - 针对特定步骤显示 */}
          {showStats && isCompleted && (
            <div className="flex items-center gap-2">
              {resultStats.generated > 0 && (
                <div className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                  <FileText className="w-3 h-3" />
                  <span>生成 {resultStats.generated} 条</span>
                </div>
              )}
              {resultStats.supplemented > 0 && (
                <div className="flex items-center gap-1 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                  <Plus className="w-3 h-3" />
                  <span>补充 {resultStats.supplemented} 条</span>
                </div>
              )}
            </div>
          )}
          {/* 通用产出数量 */}
          {!showStats && resultStats.generated > 0 && (
            <div className="flex items-center gap-1 text-[10px] bg-amber/10 text-amber px-2 py-0.5 rounded-full">
              <FileText className="w-3 h-3" />
              <span>产出 {resultStats.generated} 条</span>
            </div>
          )}
          {isCompleted && step.logs.length > 0 && (
            <div className="flex items-center gap-1 bg-cream rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("source")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
                  viewMode === "source" 
                    ? "bg-white shadow-sm text-ink" 
                    : "text-muted hover:text-ink"
                }`}
              >
                <Code className="w-3 h-3" />
                源码
              </button>
              <button
                onClick={() => setViewMode("rendered")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
                  viewMode === "rendered" 
                    ? "bg-white shadow-sm text-ink" 
                    : "text-muted hover:text-ink"
                }`}
              >
                <Eye className="w-3 h-3" />
                渲染
              </button>
            </div>
          )}
          <span className="text-[10px] text-muted">{step.logs.length} 条</span>
        </div>
      </div>

      {/* 固定高度的内容区 - 打字机穿透显示 */}
      {viewMode === "source" ? (
        <div 
          ref={logsRef}
          className="flex-1 px-4 py-3 overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-thin"
          style={{ minHeight: '0', maxHeight: '100%' }}
        >
          {step.logs.length === 0 ? (
            <p className="text-muted text-center py-8">等待执行...</p>
          ) : (
            <div className="space-y-1.5">
              {step.logs.map((log: PipelineLog, idx: number) => (
                <div 
                  key={idx}
                  className={`flex gap-2 border-l-2 pl-2 py-0.5 ${
                    log.type === "error" ? "border-fail text-fail" :
                    log.type === "success" ? "border-pass text-pass" :
                    log.type === "warning" ? "border-amber text-amber" :
                    log.type === "info" ? "border-info text-ink-light" :
                    "border-border text-ink-light"
                  }`}
                >
                  <span className="text-muted flex-shrink-0 text-[10px] opacity-60">[{log.timestamp}]</span>
                  <div className="whitespace-pre-wrap flex-1 break-words">
                    {log.content}
                    {isRunning && idx === lastLogIndex && log.content.length > 0 && (
                      <span className="inline-block w-[2px] h-[12px] bg-info animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div 
          ref={logsRef}
          className="flex-1 px-4 py-3 overflow-y-auto scrollbar-thin"
          style={{ minHeight: '0', maxHeight: '100%' }}
        >
          {step.logs.length === 0 ? (
            <p className="text-muted text-center py-8">等待执行...</p>
          ) : (
            <div className="pipeline-markdown prose prose-sm max-w-none">
              <ReactMarkdown>{combinedMarkdown}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
