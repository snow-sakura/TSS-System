/**
 * AI Web自动化 - 主页面
 * 核心功能：给一个URL，AI自动探索测试，使用midscene.js+Playwright+AI视觉
 */
import { useState, memo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Globe, FileText, ClipboardList, Target, Play, BarChart3, CheckCircle } from "lucide-react"
import Sidebar, { type SidebarItem } from "../requirement-testing/components/Sidebar"
import FlowChart from "./components/FlowChart"
import ProjectList from "./components/ProjectList"
import AiExploration from "./components/AiExploration"
import TestCaseManager from "./components/TestCaseManager"
import ExecutionView from "./components/ExecutionView"

const MENU_ITEMS: SidebarItem[] = [
  { key: "wa-projects", label: "项目管理", icon: "requirements" },
  { key: "wa-explore", label: "AI探索", icon: "reviews" },
  { key: "wa-cases", label: "测试用例", icon: "cases" },
  { key: "wa-execution", label: "测试执行", icon: "pipeline" },
]

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

function AiWebAutomationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || "wa-projects"
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [flowStatus, setFlowStatus] = useState<Record<string, "pending" | "running" | "completed" | "failed">>({
    project: "pending", url: "pending", explore: "pending", analyze: "pending",
    generate: "pending", review: "pending", execute: "pending", report: "pending",
  })

  const stepsWithStatus = FLOW_STEPS.map((s) => ({ ...s, status: flowStatus[s.key] || "pending" }))

  const renderContent = () => {
    switch (activeMenu) {
      case "wa-projects": return <ProjectList onStatusChange={setFlowStatus} />
      case "wa-explore": return <AiExploration onStatusChange={setFlowStatus} />
      case "wa-cases": return <TestCaseManager />
      case "wa-execution": return <ExecutionView />
      default: return <ProjectList onStatusChange={setFlowStatus} />
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
            {/* 流程图 */}
            <FlowChart steps={stepsWithStatus} />

            {/* 内容区 */}
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  )
}

export default memo(AiWebAutomationPage)
