/**
 * 系统管理 - 主页面
 * 侧边栏包含：系统概览 + 8个配置模块
 */
import { useState, memo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Server, Brain, ScrollText, Settings, MessageSquare, Wand2, Webhook, Puzzle, Key } from "lucide-react"
import Sidebar, { type SidebarItem } from "../requirement-testing/components/Sidebar"
import SystemOverview from "./pages/SystemOverview"
import EnvironmentConfig from "./pages/EnvironmentConfig"
import LLMConfig from "./pages/LLMConfig"
import PromptConfig from "./pages/PromptConfig"
import DeAIConfig from "./pages/DeAIConfig"
import MCPConfig from "./pages/MCPConfig"
import SkillsConfig from "./pages/SkillsConfig"
import HermesConfig from "./pages/HermesConfig"
import OperationLogs from "./pages/OperationLogs"

const MENU_ITEMS: SidebarItem[] = [
  { key: "sys-overview", label: "系统概览", icon: "requirements" },
  { key: "sys-env", label: "环境配置", icon: "cases" },
  { key: "sys-llm", label: "大模型配置", icon: "reviews" },
  { key: "sys-prompts", label: "提示词配置", icon: "plans" },
  { key: "sys-deai", label: "去AI味配置", icon: "records" },
  { key: "sys-mcp", label: "MCP服务", icon: "plans" },
  { key: "sys-skills", label: "Skills技能", icon: "cases" },
  { key: "sys-hermes", label: "Hermes配置", icon: "records" },
  { key: "sys-logs", label: "操作日志", icon: "records" },
]

function SystemManagementPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || "sys-overview"
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const renderContent = () => {
    switch (activeMenu) {
      case "sys-overview": return <SystemOverview />
      case "sys-env": return <EnvironmentConfig />
      case "sys-llm": return <LLMConfig />
      case "sys-prompts": return <PromptConfig />
      case "sys-deai": return <DeAIConfig />
      case "sys-mcp": return <MCPConfig />
      case "sys-skills": return <SkillsConfig />
      case "sys-hermes": return <HermesConfig />
      case "sys-logs": return <OperationLogs />
      default: return <SystemOverview />
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
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-md flex-shrink-0">
            <Settings className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>系统管理</h1>
            <p className="text-[11px] text-muted truncate">系统概览 / 基础配置 / 操作审计</p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed bottom-20 left-4 z-50 w-10 h-10 rounded-xl gradient-amber flex items-center justify-center shadow-lg text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />}
        <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200`}>
          <Sidebar items={MENU_ITEMS} activeKey={activeMenu} onSelect={(key) => { navigate(`/system?menu=${key}`); setSidebarOpen(false) }} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 bg-cream/30">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default memo(SystemManagementPage)
