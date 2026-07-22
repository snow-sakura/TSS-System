/**
 * 需求测试 - 主页面（优化版）
 * 
 * 清理冗余模块后的结构：
 * - 需求管理: 上传/管理需求文档
 * - 测试用例: 从需求生成的用例（合并原 CasesList + AICaseGeneration）
 * - AI自动化: 一键全流程 Pipeline（需求分析→方案→测试点→用例→评审）
 * - 流程记录: Pipeline执行历史
 * 
 * 已删除的冗余模块：
 * - 方案管理 (plans): Pipeline内部已处理，无需独立CRUD
 * - 评审管理 (reviews): Pipeline内部已处理，无需独立CRUD
 * - AI用例生成 (ai-cases): 与Pipeline的用例生成阶段完全重复
 */
import { useState, useCallback, memo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Sparkles, FileText, FlaskConical, Play, Clock } from "lucide-react"
import Sidebar, { type SidebarItem } from "./components/Sidebar"
import RequirementsList from "./pages/RequirementsList"
import CasesList from "./pages/CasesList"
import AIPipeline from "./pages/AIPipeline"
import ProcessRecords from "./pages/ProcessRecords"
import { useAutomationStore } from "@/stores/automationStore"

// 优化后的菜单：仅保留核心功能，消除冗余
const MENU_ITEMS: SidebarItem[] = [
  { key: "requirements", label: "需求管理", icon: "requirements" },
  { key: "cases", label: "测试用例", icon: "cases" },
  { key: "pipeline", label: "AI自动化", icon: "pipeline" },
  { key: "records", label: "流程记录", icon: "plans" },
]

// 流程步骤：与Pipeline的5个阶段对齐
const STAGES = [
  { key: "requirements", label: "需求分析", icon: FileText },
  { key: "plans", label: "规划方案", icon: FileText },
  { key: "cases", label: "用例生成", icon: FlaskConical },
  { key: "reviews", label: "用例评审", icon: FlaskConical },
  { key: "pipeline", label: "AI自动化", icon: Play },
]

type StageStatus = "waiting" | "running" | "completed" | "failed"

function RequirementTestingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || "pipeline"
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>({
    requirements: "waiting", plans: "waiting", cases: "waiting",
    reviews: "waiting", pipeline: "waiting",
  })

  const handleStageUpdate = useCallback((key: string, status: StageStatus) => {
    setStageStatuses((prev) => ({ ...prev, [key]: status }))
  }, [])

  const { currentRecord } = useAutomationStore()

  const renderContent = () => {
    switch (activeMenu) {
      case "requirements": return <RequirementsList />
      case "cases": return <CasesList />
      case "pipeline": return <AIPipeline key={currentRecord?.id || "empty"} onStageUpdate={handleStageUpdate} />
      case "records": return <ProcessRecords />
      default: return <AIPipeline key={currentRecord?.id || "empty"} onStageUpdate={handleStageUpdate} />
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
            <p className="text-[11px] text-muted truncate">需求分析 → 用例生成 → AI自动化 → 流程记录</p>
          </div>
        </div>
      </div>

      {/* 流程状态步骤 */}
      <div className="bg-white border-b border-border px-2 sm:px-4 md:px-6 py-2 sm:py-2.5 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center justify-start sm:justify-center gap-0.5 sm:gap-1 min-w-max">
          {STAGES.map((stage, idx) => {
            const isActive = activeMenu === stage.key || (activeMenu === "pipeline" && stage.key === "pipeline")
            const status = stageStatuses[stage.key] || "waiting"
            return (
              <div key={stage.key} className="flex items-center">
                <button
                  onClick={() => {
                    // 点击流程步骤跳转到对应功能
                    if (stage.key === "requirements") navigate("/requirement-testing?menu=requirements")
                    else if (stage.key === "cases") navigate("/requirement-testing?menu=cases")
                    else if (stage.key === "pipeline") navigate("/requirement-testing?menu=pipeline")
                  }}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all text-[10px] sm:text-xs whitespace-nowrap ${
                    isActive
                      ? "bg-amber-light border border-amber text-ink shadow-sm"
                      : status === "completed" ? "bg-pass/10 text-pass border border-pass/20" : "hover:bg-cream text-muted border border-transparent"
                  }`}
                >
                  {status === "completed" ? <span className="w-3.5 h-3.5 rounded-full bg-pass flex items-center justify-center text-white text-[8px]">✓</span> :
                   status === "running" ? <span className="w-3.5 h-3.5 rounded-full bg-amber flex items-center justify-center text-white text-[8px] animate-pulse">●</span> :
                   <span className="w-3.5 h-3.5 rounded-full bg-cream border border-border flex items-center justify-center text-[8px] text-muted">{idx + 1}</span>}
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
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed bottom-20 left-4 z-50 w-10 h-10 rounded-xl gradient-amber flex items-center justify-center shadow-lg text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />}
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
