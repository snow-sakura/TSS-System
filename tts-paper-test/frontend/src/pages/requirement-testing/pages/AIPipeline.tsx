/**
 * AI全流程 — Pipeline 自动化执行页面（Focus + Flow 焦点流式布局）
 *
 * 布局（从上到下）：
 *   1. PipelineHeader     — 顶部概览栏（标题 + 状态 + 操作按钮）
 *   2. InputSection       — 可折叠式输入区域
 *   3. PipelineStepper    — 水平步骤进度条
 *   ─────────────────────────────────────
 *   4. [StepSidebar | StreamingOutput]   — 左右分栏主内容
 *   ─────────────────────────────────────
 *   5. LogPanelFooter     — 嵌入式底部日志（深色终端风格）
 *
 * 状态管理：内部 useState + useSSEStream + 少量外部 Store 引用
 */
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { lifecycleApi, projectApi } from "@/lib/api"
import { useAutomationStore } from "@/stores/automationStore"
import { useSSEStream } from "@/hooks/useSSEStream"
import { useLogStore } from "@/stores/logStore"
import { Folder, GitBranch, FileText } from "lucide-react"

import PipelineHeader from "../components/pipeline/PipelineHeader"
import type { PipelineStatus as HeaderStatus } from "../components/pipeline/PipelineHeader"
import InputSection from "../components/pipeline/InputSection"
import PipelineStepper from "../components/pipeline/PipelineStepper"
import type { StepItem } from "../components/pipeline/PipelineStepper"
import StepSidebar from "../components/pipeline/StepSidebar"
import StreamingOutput from "../components/pipeline/StreamingOutput"
import LogPanelFooter from "../components/pipeline/LogPanelFooter"
import type { LogEntry } from "../components/pipeline/LogPanelFooter"

/* ============ 类型定义 ============ */

type StageStatus = "waiting" | "running" | "completed" | "failed"

/** 5 个阶段定义（与后端 SSE 事件的 data.stage 值保持一致） */
const STAGE_DEFS: { key: string; label: string }[] = [
  { key: "requirements",  label: "需求分析" },
  { key: "test-plans",    label: "测试规划" },
  { key: "test-points",   label: "提取测试点" },
  { key: "test-cases",    label: "用例生成" },
  { key: "test-review",   label: "用例评审" },
]

interface StageData {
  key: string
  label: string
  status: StageStatus
  content: string
  duration: number
  error?: string
}

interface AIPipelineProps {
  onStageUpdate?: (key: string, status: StageStatus) => void
}

/* ============ 工具函数 ============ */

const countWords = (text: string): number => {
  if (!text) return 0
  return text.replace(/[#*`[\]]/g, "").split(/\s+/).filter(Boolean).length
}

/** 从步骤内容中解析「生成 X 条」和「补充 X 条」
 *  支持常见中文表述，如：
 *    「共生成 15 条测试点」「提取了 12 个测试点」
 *    「测试点分解（4个）」「测试用例撰写（12个）」
 *    「补充了 3 条」「新增 8 个用例」
 */
function parseCounts(content: string): { generated?: number; supplemented?: number } {
  if (!content) return {}
  const result: { generated?: number; supplemented?: number } = {}

  // ── 生成数量 ──
  // 优先统计表格行数（TC-xxx / TP-xxx）
  const tcRows = content.match(/\|\s*(TC[-_]?\d+)\s*\|/gi)
  const tpRows = content.match(/\|\s*(TP[-_]?\d+)\s*\|/gi)
  if (tcRows && tcRows.length > 0) {
    result.generated = tcRows.length
  } else if (tpRows && tpRows.length > 0) {
    result.generated = tpRows.length
  }

  // 备用：通过文本模式解析
  if (!result.generated) {
    const genPatterns = [
      /总用例[数]\s*[:：]\s*(\d+)\s*条/,
      /总测试[点数]\s*[:：]\s*(\d+)/,
      /(?:生[成产]|提取|编写|撰写|创建|分解)(?:了(?:\s*|的))?\s*[（(]?\s*(\d+)\s*[）)]?\s*[条个项]/,
      /共\s*(?:生[成产]|提取|编写|创建|撰写|分解)\s*(?:了)?\s*(\d+)\s*[条个项]/,
      /共\s*(\d+)\s*[条个项]/,
      /[（(]\s*(\d+)\s*[）)]\s*[条个项]/,
    ]
    for (const p of genPatterns) {
      const m = content.match(p)
      if (m) { result.generated = parseInt(m[1], 10); break }
    }
  }

  // ── 补充/新增/追加数量 ──
  const supPatterns = [
    /补充\s*[:：]\s*(\d+)\s*条/,
    /补充了\s*(\d+)\s*条/,
    /(?:补充|新增|追加)(?:了(?:\s*|的))?\s*[（(]?\s*(\d+)\s*[）)]?\s*[条个项]/,
  ]
  for (const p of supPatterns) {
    const m = content.match(p)
    if (m) { result.supplemented = parseInt(m[1], 10); break }
  }

  return result
}

let logIdCounter = 0
function nextLogId(): string {
  return `log_${Date.now()}_${++logIdCounter}`
}

/* ============ 主组件 ============ */

export default function AIPipeline({ onStageUpdate }: AIPipelineProps) {
  const { currentRecord } = useAutomationStore()

  /* ─── 输入区状态 ─── */
  const [requirementName, setRequirementName] = useState(currentRecord?.name || "")
  const [requirementContent, setRequirementContent] = useState(
    currentRecord?.requirementContent || ""
  )

  /* ─── Pipeline 运行时状态 ─── */
  const [pipelineStatus, setPipelineStatus] = useState<HeaderStatus>(
    currentRecord?.requirementContent ? "completed" : "idle"
  )
  const [currentStageKey, setCurrentStageKey] = useState<string | null>(null)
  const [stageStates, setStageStates] = useState<StageData[]>(() =>
    STAGE_DEFS.map((def) => ({
      key: def.key,
      label: def.label,
      status: "waiting" as StageStatus,
      content: "",
      duration: 0,
    }))
  )

  /* ─── UI 选择状态 ─── */
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(null)
  const userSelectedRef = useRef(false)

  /* ─── 数据持久化缓存 ───
   *  存储每个步骤的 content，防止意外丢失后无法回显
   */
  const contentCacheRef = useRef<Record<string, string>>({})

  /* ─── SSE 控制 ─── */
  const [sseResponse, setSseResponse] = useState<Response | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  /* ─── 文件上传 ─── */
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  /* ─── 项目/版本管理 ─── */
  const [projectId, setProjectId] = useState<number | undefined>(undefined)
  const [versionId, setVersionId] = useState<number | undefined>(undefined)
  const [projects, setProjects] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])

  /* ─── 继续执行模式（URL 参数 recordId + mode=continue/replay） ─── */
  const [searchParams] = useSearchParams()
  const recordId = searchParams.get("recordId")
  const mode = searchParams.get("mode")
  const isContinueMode = mode === "continue" && !!recordId
  const isReplayMode = mode === "replay" && !!recordId
  const [resumeFrom, setResumeFrom] = useState<string | null>(null)
  const [loadingRecord, setLoadingRecord] = useState(false)
  /* 本次运行的 record_id（SSE record_created 事件写入，用于重连） */
  const [liveRecordId, setLiveRecordId] = useState<number | null>(null)

  /* ─── 派生：当前选中项目名/版本名（用于回显条） ─── */
  const selectedProjectName = useMemo(
    () => projects.find((p: any) => p.id === projectId)?.name || "",
    [projects, projectId]
  )
  const selectedVersionName = useMemo(
    () => versions.find((v: any) => v.id === versionId)?.name || "",
    [versions, versionId]
  )

  /* ─── 嵌入式日志 ─── */
  const [logs, setLogs] = useState<LogEntry[]>([])

  const pushLog = useCallback(
    (level: LogEntry["level"], message: string, step?: string) => {
      const entry: LogEntry = {
        id: nextLogId(),
        timestamp: new Date().toISOString(),
        level,
        message,
        step,
      }
      setLogs((prev) => [...prev, entry])
    },
    []
  )

  const clearLogs = useCallback(() => setLogs([]), [])

  /* ─── 同步状态到父组件 ─── */
  useEffect(() => {
    if (onStageUpdate) {
      stageStates.forEach((s) => onStageUpdate(s.key, s.status))
    }
  }, [stageStates, onStageUpdate])

  /* ─── 加载项目/版本列表 ─── */
  useEffect(() => {
    projectApi
      .listProjects()
      .then((res: any) => setProjects(res?.data?.items || res?.items || []))
      .catch(() => {})
    projectApi
      .listVersions()
      .then((res: any) => setVersions(res?.data?.items || res?.items || []))
      .catch(() => {})
  }, [])

  /* ─── 继续执行模式：加载历史记录并回显 ─── */
  useEffect(() => {
    if (!recordId) return
    setLoadingRecord(true)
    lifecycleApi
      .getPipelineRecord(Number(recordId))
      .then((res: any) => {
        // axios 拦截器已返回 response.data，兼容嵌套 data
        const data = res?.data || res
        if (!data) return
        // 回显基础信息
        setRequirementContent(data.requirement_content || "")
        setRequirementName(data.requirement_name || "")
        setProjectId(data.project_id)
        setVersionId(data.version_id)
        // 回显各阶段状态
        if (Array.isArray(data.stage_results)) {
          setStageStates((prev) =>
            prev.map((s) => {
              const match = data.stage_results.find(
                (sr: any) => sr.key === s.key || sr.stage === s.key
              )
              if (match) {
                const isFailed = match.status === "failed" || (!match.content && !match.result)
                return {
                  ...s,
                  content: match.content || "",
                  duration: match.duration || 0,
                  status: (isFailed ? "failed" : "completed") as StageStatus,
                }
              }
              return s
            })
          )
          // 缓存已完成阶段内容，确保切换步骤不丢失
          data.stage_results.forEach((sr: any) => {
            if (sr.content) {
              contentCacheRef.current[sr.key || sr.stage] = sr.content
            }
          })
          // 继续执行模式：定位失败阶段
          if (isContinueMode) {
            const failedStage = data.stage_results.find(
              (sr: any) => sr.status === "failed" || (!sr.content && !sr.result)
            )
            if (failedStage) {
              const failedKey = failedStage.key || failedStage.stage
              setResumeFrom(failedKey)
              setSelectedStepKey(failedKey)
              userSelectedRef.current = true
            }
          }
        }
        // 继续执行模式：状态设为 failed（待继续）；执行中：重连实时流；查看模式：按原状态
        if (data.status === "running") {
          setPipelineStatus("running")
          setLiveRecordId(Number(recordId))
          if (isReplayMode || isContinueMode) {
            // 后端执行仍在进行（SPEC-001 断连不终止）：重连接续传
            const controller = new AbortController()
            abortRef.current = controller
            lifecycleApi
              .reconnectPipelineSSE(Number(recordId), 0, controller.signal)
              .then((res) => {
                if (res.ok) setSseResponse(res)
              })
              .catch(() => {})
          }
        } else {
          setPipelineStatus(
            isContinueMode
              ? "failed"
              : data.status === "completed"
                ? "completed"
                : "idle"
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRecord(false))
  }, [recordId, isContinueMode, isReplayMode])

  /* ─── 步骤操作 ─── */
  const updateStage = useCallback(
    (key: string, updates: Partial<StageData>) => {
      setStageStates((prev) =>
        prev.map((s) => (s.key === key ? { ...s, ...updates } : s))
      )
    },
    []
  )

  const appendStageContent = useCallback(
    (key: string, content: string) => {
      setStageStates((prev) =>
        prev.map((s) => {
          if (s.key === key) {
            return { ...s, content: s.content + content }
          }
          return s
        })
      )
    },
    []
  )

  /* ─── 步骤选择逻辑 ───
   *   • 当用户手动点击步骤时 → 锁定该步骤（userSelectedRef=true）
   *   • 当新步骤开始运行时 → 自动跟随到该步骤（重置 userSelectedRef=false）
   *   • 当步骤完成/失败但没有用户选择时 → 选中第一个有内容的步骤
   */
  const prevRunningRef = useRef<string | null>(null)
  useEffect(() => {
    const running = stageStates.find((s) => s.status === "running")
    const runningKey = running?.key || null

    // 检测到新的 running 步骤 → 自动跟随（清除用户选择）
    if (runningKey && runningKey !== prevRunningRef.current) {
      userSelectedRef.current = false
    }

    // 未锁定用户选择时，自动跟随运行中的步骤
    if (!userSelectedRef.current) {
      if (running) {
        setSelectedStepKey(running.key)
      } else if (!selectedStepKey) {
        // 没有任何选中 → 选第一个完成/失败的
        const first = stageStates.find(
          (s) => s.status === "completed" || s.status === "failed"
        )
        if (first) setSelectedStepKey(first.key)
      }
    }

    prevRunningRef.current = runningKey
  }, [stageStates, selectedStepKey])

  /* ─── SSE 流处理 ─── */
  useSSEStream({
    response: sseResponse,
    onEvent: useCallback(
      (eventType: string, data: any) => {
        const stage = data.stage || "pipeline"

        // 推送到旧版 LogStore（保证向后兼容）
        if (eventType === "stage_log" || eventType === "stage_output") {
          useLogStore.getState().pushLog({
            level: eventType === "stage_log" ? "INFO" : "AGENT",
            message: data.content?.slice(0, 200) || eventType,
            stage: stage,
          })
        } else if (eventType === "stage_error") {
          useLogStore.getState().pushLog({
            level: "ERROR",
            message: data.error?.slice(0, 200) || "Stage error",
            stage: stage,
          })
        }

        switch (eventType) {
          case "record_created": {
            // 后端已落库 running 记录：保存用于断线重连定位
            if (data.record_id) setLiveRecordId(data.record_id)
            pushLog("info", `💾 执行记录已创建 #${data.record_id}（刷新/断线不丢失进度）`, "pipeline")
            break
          }

          case "stage_start": {
            // 保存上一步完成的内容到缓存
            const prevContent = stageStates.find((s) => s.key === stage)?.content
            if (prevContent) {
              contentCacheRef.current[stage] = prevContent
            }
            setCurrentStageKey(stage)
            setStageStates((prev) =>
              prev.map((s) => ({
                ...s,
                status: s.key === stage ? ("running" as StageStatus) : s.status,
                content: s.key === stage ? "" : s.content,
              }))
            )
            pushLog("info", `▶️ 步骤「${data.stage_label || stage}」开始执行`, stage)
            break
          }

          case "stage_output": {
            if (data.content) {
              // 写入缓存
              contentCacheRef.current[stage] = (contentCacheRef.current[stage] || "") + data.content
              appendStageContent(stage, data.content)
            }
            break
          }

          case "stage_log": {
            const lvl = String(data.level || "").toLowerCase()
            const level: LogEntry["level"] =
              lvl === "error"
                ? "error"
                : lvl === "warn"
                  ? "warn"
                  : lvl === "agent"
                    ? "agent"
                    : "info"
            pushLog(level, data.message?.slice(0, 500) || data.content?.slice(0, 500) || "", stage)
            break
          }

          case "stage_complete": {
            // 继续执行模式：skipped 事件表示该阶段已完成（从原记录恢复）
            if (data.skipped) {
              const cachedSkipped = contentCacheRef.current[stage] || ""
              updateStage(stage, {
                status: "completed" as StageStatus,
                duration: data.duration || 0,
                content: cachedSkipped,
              })
              pushLog("info", `⏭ 步骤「${data.stage_label || stage}」已完成（跳过，继续执行模式）`, stage)
              break
            }
            // 正常完成：确保内容完整保存到缓存
            const currentContent = stageStates.find((s) => s.key === stage)?.content || ""
            if (currentContent) {
              contentCacheRef.current[stage] = currentContent
            }
            // 如果缓存有内容但 stage 没有，则从缓存恢复
            const cachedContent = contentCacheRef.current[stage]
            if (cachedContent && !currentContent) {
              updateStage(stage, { content: cachedContent })
            }
            updateStage(stage, {
              status: (data.status === "completed"
                ? "completed"
                : "failed") as StageStatus,
              duration: data.duration || 0,
            })
            pushLog(
              data.status === "completed" ? "info" : "error",
              `✅ 步骤「${data.stage_label || stage}」完成 (${Math.round(data.duration || 0)}ms)`,
              stage
            )
            break
          }

          case "stage_error": {
            const errorMsg = data.error || "步骤执行异常"
            updateStage(stage, {
              status: "failed" as StageStatus,
              duration: data.duration || 0,
              error: errorMsg,
            })
            // 针对 429 速率限制错误提供友好提示
            if (errorMsg.includes("429") || errorMsg.includes("Rate limit") || errorMsg.includes("FreeUsageLimit")) {
              pushLog("error", `❌ 步骤「${data.stage_label || stage}」失败: AI 服务调用频率超限，请等待几分钟后重试`, stage)
              pushLog("warn", `💡 提示: 这是 AI 服务商的免费额度/速率限制，等待 1-2 分钟后可重新执行`, stage)
            } else {
              pushLog("error", `❌ 步骤「${data.stage_label || stage}」失败: ${errorMsg}`, stage)
            }
            break
          }

          case "pipeline_complete": {
            const done = data.status === "completed"
            setPipelineStatus(done ? "completed" : "failed")
            setCurrentStageKey(null)
            pushLog(
              done ? "info" : "error",
              done ? "🏁 全流程执行完成" : "❌ 全流程执行失败",
              "pipeline"
            )
            break
          }
        }
      },
      [appendStageContent, updateStage, pushLog]
    ),
    onComplete: useCallback(() => {
      setSseResponse(null)
    }, []),
  })

  /* ─── 启动 / 停止 Pipeline ─── */
  const startPipeline = useCallback(async () => {
    if (!requirementContent.trim() || pipelineStatus === "running") return

    // 计算继续执行的起始索引（resumeFrom 之前的阶段保留为已完成）
    const resumeIndex = resumeFrom
      ? STAGE_DEFS.findIndex((s) => s.key === resumeFrom)
      : -1

    // 重置状态：继续执行模式保留已完成阶段，否则全重置
    setStageStates((prev) =>
      STAGE_DEFS.map((def, idx) => {
        if (isContinueMode && resumeIndex > 0 && idx < resumeIndex) {
          // 保留已完成阶段的状态和内容
          const existing = prev[idx]
          return {
            key: def.key,
            label: def.label,
            status: "completed" as StageStatus,
            content: existing?.content || "",
            duration: existing?.duration || 0,
          }
        }
        return {
          key: def.key,
          label: def.label,
          status: "waiting" as StageStatus,
          content: "",
          duration: 0,
        }
      })
    )
    setCurrentStageKey(null)
    if (!isContinueMode) {
      setSelectedStepKey(null)
    }
    setLiveRecordId(null)
    setPipelineStatus("running")
    setLogs([])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await lifecycleApi.startPipelineSSE(
        {
          requirement_content: requirementContent,
          requirement_name: requirementName || "未命名需求",
          project_id: projectId,
          version_id: versionId,
          // 继续执行模式：传递 resume_from 和 record_id，后端从失败处追加
          ...(isContinueMode && resumeFrom
            ? { resume_from: resumeFrom, record_id: Number(recordId) }
            : {}),
        },
        controller.signal
      )
      // 启动即失败（如 424 模型不可用）：明确提示，不进入静默失败
      if (!response.ok) {
        let detail = `HTTP ${response.status}`
        try {
          const body = await response.json()
          detail = body?.detail || detail
        } catch { /* 忽略解析失败 */ }
        setPipelineStatus("failed")
        pushLog("error", `❌ 启动失败: ${detail}`)
        if (response.status === 424) {
          pushLog("warn", "💡 可在「系统管理→模型配置」更新密钥/模型，或使用「序列任务中心→模拟执行」演示调度流程")
        }
        return
      }
      setSseResponse(response)
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setPipelineStatus("failed")
        // 针对常见错误提供友好提示
        const errMsg = err?.message || ""
        if (errMsg.includes("429") || errMsg.includes("Rate limit") || errMsg.includes("FreeUsageLimit")) {
          pushLog("error", "❌ AI 服务调用频率超限（429），请稍后等待几分钟后重试")
        } else if (errMsg.includes("Failed to fetch") || errMsg.includes("ERR_ABORTED")) {
          pushLog("error", "❌ 网络请求失败，请检查后端服务是否正常运行")
        } else {
          pushLog("error", errMsg || "启动失败")
        }
      }
    }
  }, [requirementContent, requirementName, pipelineStatus, pushLog, projectId, versionId, isContinueMode, resumeFrom, recordId])

  const stopPipeline = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setSseResponse(null)
    setPipelineStatus("idle")
    setCurrentStageKey(null)
    pushLog("warn", "⏹ 用户手动停止", "pipeline")
  }, [pushLog])

  /* ─── 文件上传 ─── */
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        const res: any = await lifecycleApi.uploadRequirement(formData)
        const data = res?.data
        const fileContent = data?.raw_content || data?.content
        if (fileContent) {
          setRequirementContent(fileContent)
          if (!requirementName)
            setRequirementName(
              data.name || file.name.replace(/\.[^.]+$/, "")
            )
        } else {
          setUploadError("文件内容为空或无法提取文本")
        }
      } catch (err: any) {
        setUploadError(
          err?.response?.data?.detail || err?.message || "上传失败"
        )
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [requirementName]
  )

  // 清理
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  /* ─── 计算统计与派生数据 ─── */
  const pipelineStats = useMemo(() => {
    const total = stageStates.length
    const completed = stageStates.filter((s) => s.status === "completed").length
    const failed = stageStates.filter((s) => s.status === "failed").length
    const running = stageStates.filter((s) => s.status === "running").length
    const totalDuration = stageStates.reduce((acc, s) => acc + (s.duration || 0), 0)
    const totalWords = stageStates.reduce((acc, s) => acc + countWords(s.content), 0)
    return { total, completed, failed, running, totalDuration, totalWords }
  }, [stageStates])

  /** 给 PipelineStepper 和 StepSidebar 用的 StepItem 数组 */
  const stepItems: StepItem[] = useMemo(
    () =>
      stageStates.map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
        durationMs: s.duration,
        wordCount: countWords(s.content),
        ...parseCounts(s.content),
      })),
    [stageStates]
  )

  /** 当前选中步骤在数组中的索引 */
  const selectedIndex = useMemo(
    () => stageStates.findIndex((s) => s.key === selectedStepKey),
    [stageStates, selectedStepKey]
  )

  /** 给 StreamingOutput 用的当前选中步骤输出 */
  const currentStepOutput = useMemo(() => {
    if (!selectedStepKey) return null
    const s = stageStates.find((st) => st.key === selectedStepKey)
    if (!s) return null
    // 优先使用 stage 中的 content，如果为空则从缓存恢复
    // 这样可以确保切换步骤时内容不会丢失
    const cachedContent = contentCacheRef.current[s.key] || ""
    const content = s.content || cachedContent
    // 如果 stage 的 content 为空但缓存有内容，更新 stage 的 content
    if (!s.content && cachedContent && (s.status === "completed" || s.status === "failed")) {
      // 异步更新，避免在 useMemo 中直接修改状态
      setTimeout(() => {
        updateStage(s.key, { content: cachedContent })
      }, 0)
    }
    return {
      key: s.key,
      status: s.status,
      content,
      error: s.error,
    }
  }, [selectedStepKey, stageStates, updateStage])

  /** 步骤导航 */
  const goToPrevStep = useCallback(() => {
    if (selectedIndex > 0) {
      setSelectedStepKey(stageStates[selectedIndex - 1].key)
    }
  }, [selectedIndex, stageStates])

  const goToNextStep = useCallback(() => {
    if (selectedIndex < stageStates.length - 1) {
      setSelectedStepKey(stageStates[selectedIndex + 1].key)
    }
  }, [selectedIndex, stageStates])

  /** 传递给 StreamingOutput 的统计数据 */
  const outputStats = useMemo(() => {
    return {
      totalDuration: pipelineStats.totalDuration,
      totalWords: pipelineStats.totalWords,
      completedCount: pipelineStats.completed + pipelineStats.failed,
      totalCount: pipelineStats.total,
    }
  }, [pipelineStats])

  /* ================================================================ */
  /* ====================== 渲染 ===================================== */
  /* ================================================================ */

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-cream/20">
      {/* ========== ① 顶栏 ========== */}
      <PipelineHeader
        status={pipelineStatus}
        stats={pipelineStats}
        requirementName={requirementName}
        onStart={startPipeline}
        onStop={stopPipeline}
        canStart={
          requirementContent.trim().length > 0 &&
          (isContinueMode || (!!projectId && !!versionId))
        }
        continueMode={isContinueMode}
      />

      {/* ========== ② 输入区 ========== */}
      <InputSection
        requirementName={requirementName}
        requirementContent={requirementContent}
        pipelineStatus={pipelineStatus}
        uploading={uploading}
        uploadError={uploadError}
        onNameChange={setRequirementName}
        onContentChange={setRequirementContent}
        onFileUpload={handleFileUpload}
        projectId={projectId}
        versionId={versionId}
        projects={projects}
        versions={versions}
        onProjectChange={setProjectId}
        onVersionChange={setVersionId}
        onStart={startPipeline}
        canStart={
          requirementContent.trim().length > 0 &&
          (isContinueMode || (!!projectId && !!versionId))
        }
        continueMode={isContinueMode}
      />

      {/* ========== ②.5 运行时回显条（项目/版本/需求摘要） ========== */}
      {(isContinueMode || pipelineStatus === "running" || pipelineStatus === "completed" || pipelineStatus === "failed") &&
        (selectedProjectName || selectedVersionName || requirementName) && (
        <div className="flex-shrink-0 bg-gradient-to-r from-amber-light/30 via-cream/40 to-amber-light/30 border-b border-amber/20 px-5 py-1.5">
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="text-muted font-semibold">当前执行：</span>
            {selectedProjectName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-ink border border-amber/30 shadow-sm">
                <Folder className="w-3 h-3 text-amber" />
                {selectedProjectName}
              </span>
            )}
            {selectedVersionName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-ink border border-amber/30 shadow-sm">
                <GitBranch className="w-3 h-3 text-amber" />
                {selectedVersionName}
              </span>
            )}
            {requirementName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-ink border border-border shadow-sm">
                <FileText className="w-3 h-3 text-muted" />
                {requirementName}
              </span>
            )}
            <span className="text-muted-light font-mono">{requirementContent.length} 字符</span>
            {isContinueMode && (
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fail/10 text-fail border border-fail/20 font-semibold">
                继续执行模式 · 从「{STAGE_DEFS.find((s) => s.key === resumeFrom)?.label || resumeFrom}」开始
              </span>
            )}
          </div>
        </div>
      )}

      {/* ========== ③ 水平进度条 ========== */}
      {stageStates.some((s) => s.status !== "waiting") && (
        <PipelineStepper
          steps={stepItems}
          currentStepKey={currentStageKey}
          onStepClick={(key) => {
            userSelectedRef.current = true
            setSelectedStepKey(key)
          }}
        />
      )}

      {/* ========== ④ 左右分栏主内容（固定大小，不随内容拉伸） ========== */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        <StepSidebar
          steps={stepItems}
          selectedStepKey={selectedStepKey}
          pipelineStatus={pipelineStatus}
          onStepSelect={(key) => {
            userSelectedRef.current = true
            setSelectedStepKey(key)
          }}
          onFocusOutput={() => {
            // 滚动右侧输出区域到视野中心
            const el = document.querySelector('[data-streaming-output]')
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }}
        />

        <StreamingOutput
          step={currentStepOutput}
          stepIndex={selectedIndex < 0 ? 0 : selectedIndex}
          totalSteps={stageStates.length}
          onPrev={goToPrevStep}
          onNext={goToNextStep}
          stats={outputStats}
        />
      </div>

      {/* ========== ⑤ 嵌入式日志面板 ========== */}
      <LogPanelFooter
        logs={logs}
        pipelineStatus={pipelineStatus}
        onClearLogs={clearLogs}
      />
    </div>
  )
}
