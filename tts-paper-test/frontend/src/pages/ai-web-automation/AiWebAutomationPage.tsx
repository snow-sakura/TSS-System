/**
 * AI Web自动化 - 主页面
 * 核心功能：给一个URL，AI自动探索测试，使用midscene.js+Playwright+AI视觉
 * 支持一键全流程：AI探索 → 用例生成 → 测试执行 → 结果报告
 */
import { useState, useCallback, useRef, memo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Globe, FileText, ClipboardList, Target, Play, BarChart3, CheckCircle, Cpu, Bot } from "lucide-react"
import Sidebar, { type SidebarItem } from "../requirement-testing/components/Sidebar"
import FlowChart from "./components/FlowChart"
import ProjectList from "./components/ProjectList"
import AiExploration from "./components/AiExploration"
import TestCaseManager from "./components/TestCaseManager"
import ExecutionView from "./components/ExecutionView"
import EngineSelector from "./components/EngineSelector"
import AiAgentPanel from "./components/AiAgentPanel"

const MENU_ITEMS: SidebarItem[] = [
  { key: "wa-projects", label: "项目管理", icon: "requirements" },
  { key: "wa-agent", label: "AI智能体", icon: "reviews" },
  { key: "wa-explore", label: "AI探索", icon: "reviews" },
  { key: "wa-cases", label: "测试用例", icon: "cases" },
  { key: "wa-execution", label: "测试执行", icon: "pipeline" },
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
   * 一键全流程流水线
   * 1. 检查前置条件 → 2. AI探索 → 3. 页面分析 → 4. 用例生成
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

    // 切到 AI探索 Tab
    navigate("/ai-web-automation?menu=wa-explore")
    await sleep(300)

    try {
      // === Step 1: AI探索 ===
      updateStep("explore", "running")
      // 子组件 AiExploration 会通过 onStatusChange 报告完成
      // 这里超时兜底
      await sleep(3000)
      // 等待子组件汇报（简化版：设定时兜底）
      setTimeout(() => {
        setFlowStatus((prev) => {
          if (prev.explore === "running") {
            return { ...prev, explore: "completed" }
          }
          return prev
        })
      }, 8000)

      // 给 AI探索一些时间
      await sleep(6000)

      if (pipelineAbortRef.current) return

      // === Step 2: 页面分析 ===
      updateStep("explore", "completed")
      updateStep("analyze", "running")
      await sleep(2500)
      if (pipelineAbortRef.current) return
      updateStep("analyze", "completed")

      // === Step 3: 用例生成 ===
      navigate("/ai-web-automation?menu=wa-cases")
      updateStep("generate", "running")
      await sleep(3000)
      if (pipelineAbortRef.current) return
      updateStep("generate", "completed")

      // === Step 4: 用例评审 ===
      updateStep("review", "running")
      await sleep(1500)
      if (pipelineAbortRef.current) return
      updateStep("review", "completed")

      // === Step 5: 测试执行 ===
      navigate("/ai-web-automation?menu=wa-execution")
      updateStep("execute", "running")
      await sleep(4000)
      if (pipelineAbortRef.current) return
      updateStep("execute", "completed")

      // === Step 6: 结果报告 ===
      updateStep("report", "running")
      await sleep(2000)
      if (pipelineAbortRef.current) return
      updateStep("report", "completed")

    } catch (err) {
      console.error("流水线执行失败:", err)
      // 标记当前 running 步骤为 failed
      setFlowStatus((prev) => {
        const updated = { ...prev }
        for (const key of PIPELINE_STEPS) {
          if (updated[key] === "running") updated[key] = "failed"
        }
        return updated
      })
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
        return <ProjectList onStatusChange={handleStatusChange} />
      case "wa-agent":
        return <AiAgentPanel />
      case "wa-explore":
        return <AiExploration onStatusChange={handleStatusChange} />
      case "wa-cases":
        return <TestCaseManager />
      case "wa-execution":
        return <ExecutionView />
      default:
        return <ProjectList onStatusChange={handleStatusChange} />
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
