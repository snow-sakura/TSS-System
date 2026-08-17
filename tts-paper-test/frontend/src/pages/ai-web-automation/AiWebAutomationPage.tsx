/**
 * AI Web自动化 - 主页面
 * 核心功能：给一个URL，AI自动探索测试，使用midscene.js+Playwright+AI视觉
 * 支持一键全流程：AI探索 → 用例生成 → 测试执行 → 结果报告
 */
import { useState, useCallback, useRef, memo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Globe, FileText, ClipboardList, Target, Play, BarChart3, CheckCircle, Cpu, Bot } from "lucide-react"
import { toast } from "sonner"
import Sidebar, { type SidebarItem } from "../requirement-testing/components/Sidebar"
import FlowChart from "./components/FlowChart"
import ProjectList from "./components/ProjectList"
import AiExploration from "./components/AiExploration"
import TestCaseManager from "./components/TestCaseManager"
import ExecutionView from "./components/ExecutionView"
import ObjectRepository from "./components/ObjectRepository"
import EngineSelector from "./components/EngineSelector"
import AiAgentPanel from "./components/AiAgentPanel"
import CompetitorAnalysisPage from "../competitor-analysis/CompetitorAnalysisPage"
import { webApi } from "@/lib/api"

const MENU_ITEMS: SidebarItem[] = [
  { key: "wa-projects", label: "项目管理", icon: "requirements" },
  { key: "wa-agent", label: "AI智能体", icon: "reviews" },
  { key: "wa-explore", label: "AI探索", icon: "reviews" },
  { key: "wa-cases", label: "测试用例", icon: "cases" },
  { key: "wa-objects", label: "对象库", icon: "records" },
  { key: "wa-execution", label: "测试执行", icon: "pipeline" },
  { key: "wa-analysis", label: "对标分析", icon: "analysis" },
]

/** 步骤 → Tab 菜单映射 */
const STEP_TO_MENU: Record<string, string> = {
  project: "wa-projects",
  url: "wa-explore",
  explore: "wa-explore",
  analyze: "wa-explore",
  generate: "wa-cases",
  review: "wa-cases",
  execute: "wa-execution",
  report: "wa-execution",
}

// 流程步骤定义
const FLOW_STEPS = [
  { key: "project", label: "创建项目", icon: FileText },
  { key: "url", label: "输入URL", icon: Globe },
  { key: "explore", label: "AI探索", icon: Target },
  { key: "analyze", label: "页面分析", icon: ClipboardList },
  { key: "generate", label: "用例生成", icon: FileText },
  { key: "review", label: "用例评审", icon: CheckCircle },
  { key: "execute", label: "测试执行", icon: Play },
  { key: "report", label: "结果报告", icon: BarChart3 },
]

/** 流水线步骤（跳过 project/url — 它们是前置条件） */
const PIPELINE_STEPS = ["explore", "analyze", "generate", "review", "execute", "report"]

type StepStatus = "pending" | "running" | "completed" | "failed"

/** 读取 SSE 流，返回事件列表 [{event, data}] */
async function readSSEStream(
  response: Response,
  onEvent?: (event: string, data: any) => void,
  shouldAbort?: () => boolean,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("无法获取响应流")

  const decoder = new TextDecoder()
  let buffer = ""
  let currentEvent = ""
  let currentData = ""

  while (true) {
    if (shouldAbort?.()) return
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith("data: ")) {
        currentData = line.slice(6).trim()
      } else if (line === "") {
        if (currentEvent && currentData) {
          try {
            onEvent?.(currentEvent, JSON.parse(currentData))
          } catch {}
        }
        currentEvent = ""
        currentData = ""
      }
    }
  }

  if (currentEvent && currentData) {
    try {
      onEvent?.(currentEvent, JSON.parse(currentData))
    } catch {}
  }
}

function AiWebAutomationPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || "wa-projects"
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [flowStatus, setFlowStatus] = useState<Record<string, StepStatus>>({
    project: "pending", url: "pending", explore: "pending", analyze: "pending",
    generate: "pending", review: "pending", execute: "pending", report: "pending",
  })
  const [isPipelineRunning, setIsPipelineRunning] = useState(false)
  const pipelineAbortRef = useRef(false)

  /** 切换菜单（Tab） */
  const switchMenu = useCallback((menu: string) => {
    setSearchParams({ menu }, { replace: true })
  }, [setSearchParams])

  /** 步骤点击 → 跳转到对应 Tab */
  const handleStepClick = useCallback((stepKey: string) => {
    const menu = STEP_TO_MENU[stepKey]
    if (menu) switchMenu(menu)
  }, [switchMenu])

  /** 步骤点击 → 跳转到对应 Tab */
  const handleStepClickWithNav = useCallback((stepKey: string) => {
    const menu = STEP_TO_MENU[stepKey]
    if (menu) navigate(`/ai-web-automation?menu=${menu}`)
  }, [navigate])

  /** 更新单个步骤状态 */
  const updateStep = useCallback((key: string, status: StepStatus) => {
    setFlowStatus((prev) => ({ ...prev, [key]: status }))
  }, [])

  /** 延迟工具 */
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  /** 等待步骤完成 (轮询式) — 子组件通过 onStatusChange 汇报 */
  const waitForStep = async (key: string, timeoutMs = 120000): Promise<boolean> => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (pipelineAbortRef.current) return false
      // 检查当前状态
      const current = flowStatus[key]
      if (current === "completed") return true
      if (current === "failed") return false
      await sleep(500)
    }
    return false
  }

  /**
   * 一键全流程流水线 — 接入真实后端
   * 1. 获取项目 → 2. AI探索(SSE) → 3. 页面分析 → 4. 用例生成(SSE)
   * → 5. 用例评审 → 6. 测试执行 → 7. 结果报告
   */
  const handleStartPipeline = useCallback(async () => {
    if (isPipelineRunning) {
      pipelineAbortRef.current = true
      setIsPipelineRunning(false)
      return
    }

    pipelineAbortRef.current = false
    setIsPipelineRunning(true)

    // 重置所有步骤
    const resetStatus: Record<string, StepStatus> = {}
    FLOW_STEPS.forEach((s) => { resetStatus[s.key] = "pending" })
    resetStatus.project = "completed"
    resetStatus.url = "completed"
    setFlowStatus(resetStatus)

    try {
      // === Step 0: 获取项目 ===
      const projRes: any = await webApi.listProjects(1)
      const items = projRes?.data?.items || []
      if (items.length === 0) {
        toast.error("请先在「项目管理」中创建项目")
        updateStep("explore", "failed")
        return
      }
      const projectId = items[0].id
      const projectName = items[0].name || `项目 #${projectId}`
      resetStatus.project = "completed"
      resetStatus.url = "completed"
      setFlowStatus(resetStatus)

      // === Step 1: AI探索 (SSE) ===
      navigate(`/ai-web-automation?menu=wa-explore&project=${projectId}`)
      await sleep(300)
      updateStep("explore", "running")
      toast.info(`开始探索项目「${projectName}」...`)

      const exploreRes = await webApi.exploreSSE(projectId)
      if (!exploreRes.ok) throw new Error(`AI探索失败: HTTP ${exploreRes.status}`)

      let exploreError = ""
      await readSSEStream(
        exploreRes,
        (event, data) => {
          if (event === "page_analyzed") {
            // 页面分析进度
          } else if (event === "exploration_complete") {
            // 探索完成
          } else if (event === "exploration_error") {
            exploreError = data.error || "探索失败"
          } else if (event === "status") {
            // 状态消息
          }
        },
        () => pipelineAbortRef.current,
      )

      if (pipelineAbortRef.current) return
      if (exploreError) throw new Error(exploreError)

      updateStep("explore", "completed")
      updateStep("analyze", "completed")
      toast.success("AI探索完成")

      // === Step 2: 用例生成 (SSE) ===
      navigate(`/ai-web-automation?menu=wa-cases&project=${projectId}`)
      updateStep("generate", "running")
      toast.info("AI生成测试用例中...")

      const genRes = await webApi.generateTestCasesSSE(projectId)
      if (!genRes.ok) throw new Error(`用例生成失败: HTTP ${genRes.status}`)

      let genError = ""
      await readSSEStream(
        genRes,
        (event, data) => {
          if (event === "generation_error") {
            genError = data.error || "用例生成失败"
          } else if (event === "case_generated") {
            // 单条用例生成
          } else if (event === "generation_complete") {
            // 生成完成
          }
        },
        () => pipelineAbortRef.current,
      )

      if (pipelineAbortRef.current) return
      if (genError) throw new Error(genError)

      updateStep("generate", "completed")
      updateStep("review", "completed")
      toast.success("用例生成完成")

      // === Step 3: 测试执行 ===
      navigate(`/ai-web-automation?menu=wa-execution&project=${projectId}`)
      updateStep("execute", "running")
      toast.info("开始执行测试用例...")

      const execRes: any = await webApi.execute(projectId)
      if (execRes?.data) {
        const count = execRes.data.cases_count || 0
        updateStep("execute", "completed")
        updateStep("report", "completed")
        toast.success(`测试执行完成，共 ${count} 条用例`)
      } else {
        throw new Error("测试执行失败")
      }

    } catch (error: any) {
      // 标记当前 running 步骤为 failed
      setFlowStatus((prev) => {
        const updated = { ...prev }
        for (const key of PIPELINE_STEPS) {
          if (updated[key] === "running") updated[key] = "failed"
        }
        return updated
      })
      toast.error(error?.message || "流水线执行失败")
    } finally {
      setIsPipelineRunning(false)
    }
  }, [isPipelineRunning, navigate, updateStep])

  const stepsWithStatus = FLOW_STEPS.map((s) => ({ ...s, status: flowStatus[s.key] || "pending" }))

  /** 子组件汇报状态变更 */
  const handleStatusChange = useCallback((status: Record<string, StepStatus>) => {
    setFlowStatus((prev) => ({ ...prev, ...status }))
  }, [])

  const renderContent = () => {
    switch (activeMenu) {
      case "wa-projects":
        return <ProjectList />
      case "wa-agent":
        return <AiAgentPanel />
      case "wa-explore":
        return <AiExploration onStatusChange={handleStatusChange} />
      case "wa-cases":
        return <TestCaseManager />
      case "wa-objects":
        return <ObjectRepository />
      case "wa-execution":
        return <ExecutionView />
      case "wa-analysis":
        return <CompetitorAnalysisPage scope={["web"]} embedded />
      default:
        return <ProjectList />
    }
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group">
            <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
            <span className="text-xs font-medium text-ink-light group-hover:text-ink transition-colors hidden sm:block">返回</span>
          </button>
          <div className="h-8 w-px bg-border/60" />
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
            <Globe className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>AI Web自动化</h1>
            <p className="text-[11px] text-muted truncate">视觉驱动的网页自动化测试，AI自动探索与执行</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed bottom-20 left-4 z-50 w-10 h-10 rounded-xl gradient-amber flex items-center justify-center shadow-lg text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />}
        <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200`}>
          <Sidebar items={MENU_ITEMS} activeKey={activeMenu} onSelect={(key) => { navigate(`/ai-web-automation?menu=${key}`); setSidebarOpen(false) }} />
        </div>

        <main className="flex-1 overflow-y-auto p-4 bg-cream/30">
          <div className="max-w-[1400px] mx-auto space-y-4">
            {/* 引擎选择器（可折叠） */}
            <EngineSelector />

            {/* 流程图 + 一键运行 */}
            <FlowChart
              steps={stepsWithStatus}
              onStepClick={handleStepClickWithNav}
              onStartPipeline={handleStartPipeline}
              isPipelineRunning={isPipelineRunning}
            />

            {/* 内容区 */}
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  )
}

export default memo(AiWebAutomationPage)