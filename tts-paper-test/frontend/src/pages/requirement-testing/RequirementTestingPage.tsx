/**
 * 需求测试 - 主页面
 * 布局：顶部导航 + 流程状态步骤 + 左侧边栏 + 右侧内容区
 */
import { useState, useEffect, useCallback, memo } from "react"
import { useNavigate, useSearchParams, useLocation } from "react-router-dom"
import { ArrowLeft, Sparkles, FileText, ClipboardList, FlaskConical, CheckCircle, Play, Clock, Loader2 } from "lucide-react"
import Sidebar, { type SidebarItem } from "./components/Sidebar"
import RequirementsList from "./pages/RequirementsList"
import { useAutomationStore } from "@/stores/automationStore"
import PlansList from "./pages/PlansList"
import CasesList from "./pages/CasesList"
import ReviewsList from "./pages/ReviewsList"
import AIPipeline from "./pages/AIPipeline"
import ProcessRecords from "./pages/ProcessRecords"
import AICaseGeneration from "./pages/AICaseGeneration"

const MENU_ITEMS: SidebarItem[] = [
  { key: "requirements", label: "需求管理", icon: "requirements" },
  { key: "plans", label: "方案管理", icon: "plans" },
  { key: "cases", label: "用例管理", icon: "cases" },
  { key: "ai-cases", label: "AI用例生成", icon: "reviews" },
  { key: "reviews", label: "评审管理", icon: "records" },
  { key: "pipeline", label: "AI自动化", icon: "pipeline" },
  { key: "records", label: "流程记录", icon: "plans" },
]

const STAGES = [
  { key: "requirements", label: "需求分析", icon: FileText },
  { key: "plans", label: "规划方案", icon: ClipboardList },
  { key: "cases", label: "用例生成", icon: FlaskConical },
  { key: "reviews", label: "用例评审", icon: CheckCircle },
  { key: "pipeline", label: "AI自动化", icon: Play },
  { key: "records", label: "流程记录", icon: Clock },
]

type StageStatus = "waiting" | "running" | "completed" | "failed"

function RequirementTestingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // 直接从URL读取activeMenu，确保每次渲染都同步
  const activeMenu = searchParams.get("menu") || "pipeline"
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>({
    requirements: "waiting", plans: "waiting", cases: "waiting",
    reviews: "waiting", pipeline: "waiting", records: "waiting",
  })

  // 从AIPipeline接收状态更新
  const handleStageUpdate = useCallback((key: string, status: StageStatus) => {
    setStageStatuses((prev) => ({ ...prev, [key]: status }))
  }, [])

  // 使用Zustand读取当前活动记录
  const { currentRecord } = useAutomationStore()

  const renderContent = () => {
    switch (activeMenu) {
      case "requirements": return <RequirementsList />
      case "plans": return <PlansList />
      case "cases": return <CasesList />
      case "ai-cases": return <AICaseGeneration />
      case "reviews": return <ReviewsList />
      case "pipeline": return <AIPipeline key={currentRecord?.id || "empty"} onStageUpdate={handleStageUpdate} />
      case "records": return <ProcessRecords />
      default: return <AIPipeline key={currentRecord?.id || "empty"} onStageUpdate={handleStageUpdate} />
    }
  }

  const getStageIcon = (status: StageStatus) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-pass" />
      case "running": return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
      case "failed": return <span className="w-4 h-4 rounded-full bg-fail flex items-center justify-center text-white text-[10px]">!</span>
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group">
            <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
            <span className="text-xs font-medium text-ink-light group-hover:text-ink transition-colors hidden sm:block">返回</span>
          </button>
          <div className="h-8 w-px bg-border/60" />
          <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md flex-shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>需求测试 · 全流程自动化</h1>
            <p className="text-[11px] text-muted truncate">需求分析 → 规划方案 → 用例生成 → 用例评审 → AI自动化 → 流程记录</p>
          </div>
        </div>
      </div>

      {/* 流程状态步骤 - 居中布局 */}
      <div className="bg-white border-b border-border px-2 sm:px-4 md:px-6 py-2 sm:py-2.5 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center justify-start sm:justify-center gap-0.5 sm:gap-1 min-w-max">
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon
            const isActive = activeMenu === stage.key
            const status = stageStatuses[stage.key] || "waiting"
            return (
              <div key={stage.key} className="flex items-center">
                <button
                  onClick={() => navigate(`/requirement-testing?menu=${stage.key}`)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all text-[10px] sm:text-xs whitespace-nowrap ${
                    isActive
                      ? "bg-amber-light border border-amber text-ink shadow-sm"
                      : status === "completed" ? "bg-pass/10 text-pass border border-pass/20" : "hover:bg-cream text-muted border border-transparent"
                  }`}
                >
                  {status === "completed" ? <CheckCircle className="w-3.5 h-3.5" /> :
                   status === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> :
                   <Icon className="w-3.5 h-3.5" />}
                  <span className="hidden md:inline">{stage.label}</span>
                </button>
                {idx < STAGES.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 主体：侧边栏 + 内容区 */}
      <div className="flex-1 flex min-h-0">
        {/* 移动端汉堡菜单按钮 */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed bottom-20 left-4 z-50 w-10 h-10 rounded-xl gradient-amber flex items-center justify-center shadow-lg text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        {/* 移动端遮罩 */}
        {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />}
        {/* 侧边栏：移动端绝对定位覆盖，桌面端正常布局 */}
        <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200`}>
          <Sidebar items={MENU_ITEMS} activeKey={activeMenu} onSelect={(key) => { navigate(`/requirement-testing?menu=${key}`); setSidebarOpen(false) }} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 bg-cream/30">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default memo(RequirementTestingPage)
