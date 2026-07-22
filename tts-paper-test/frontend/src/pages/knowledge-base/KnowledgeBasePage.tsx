/**
 * 知识库 - 主页面
 * 测试模式库 + Bug知识库 + RAG智能搜索
 */
import { useState, memo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, BookOpen, Bug, Search as SearchIcon, Brain, Sparkles } from "lucide-react"
import Sidebar, { type SidebarItem } from "../requirement-testing/components/Sidebar"
import TestPatterns from "./components/TestPatterns"
import BugKnowledge from "./components/BugKnowledge"
import RagSearch from "./components/RagSearch"
import AIKnowledgeAnalyzer from "./components/AIKnowledgeAnalyzer"

const MENU_ITEMS: SidebarItem[] = [
  { key: "kb-patterns", label: "测试模式库", icon: "requirements" },
  { key: "kb-bugs", label: "Bug知识库", icon: "cases" },
  { key: "kb-search", label: "RAG搜索", icon: "reviews" },
  { key: "kb-ai", label: "AI 增强", icon: "cases" },
]

function KnowledgeBasePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || "kb-patterns"
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const renderContent = () => {
    switch (activeMenu) {
      case "kb-patterns": return <TestPatterns />
      case "kb-bugs": return <BugKnowledge />
      case "kb-search": return <RagSearch />
      case "kb-ai": return <AIKnowledgeAnalyzer />
      default: return <TestPatterns />
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
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md flex-shrink-0">
            <BookOpen className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>知识库</h1>
            <p className="text-[11px] text-muted truncate">测试模式与Bug知识库，支持RAG智能搜索</p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed bottom-20 left-4 z-50 w-10 h-10 rounded-xl gradient-amber flex items-center justify-center shadow-lg text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />}
        <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200`}>
          <Sidebar items={MENU_ITEMS} activeKey={activeMenu} onSelect={(key) => { navigate(`/knowledge-base?menu=${key}`); setSidebarOpen(false) }} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 bg-cream/30">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default memo(KnowledgeBasePage)
