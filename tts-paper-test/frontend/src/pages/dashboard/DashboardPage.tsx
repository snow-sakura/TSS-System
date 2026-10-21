/**
 * 首页仪表盘 - 连接真实API，更多统计维度
 */
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { useAppStore } from "@/stores/appStore"
import {
  FlaskConical, LogOut, User, Activity, ArrowRight, X, Zap, Play,
  Settings, FileText, Globe, BookOpen, GitBranch, Monitor, Brain, MessageSquare,
  Table, Blocks, Puzzle, Bot, ScrollText, Shield, UserCog, ChevronDown,
  type LucideIcon,
} from "lucide-react"
import { moduleTabs } from "@/lib/modules"
import { lifecycleApi } from "@/lib/api"
import { prefetchRoute, cancelPrefetch } from "@/lib/routePrefetch"

/* ---------- 模块 key → Lucide 图标映射 ---------- */
const iconMap: Record<string, LucideIcon> = {
  "test-mgmt-config": Settings,
  "test-management": FileText,
  "web-automation": Globe,
  knowledge: BookOpen,
  "workflow-orchestration": GitBranch,
  environments: Monitor,
  llm: Brain,
  prompts: MessageSquare,
  "de-ai": Table,
  mcp: Blocks,
  skills: Puzzle,
  hermes: Bot,
  "operation-logs": ScrollText,
  users: UserCog,
  roles: Shield,
  profile: User,
}

const quickLinks = [
  { label: "测试管理", path: "/test-management", icon: FlaskConical, gradient: "from-amber to-orange-500" },
  { label: "AI Web自动化", path: "/ai-web-automation", icon: Play, gradient: "from-emerald-500 to-green-600" },
  { label: "知识库", path: "/knowledge-base", icon: BookOpen, gradient: "from-purple-500 to-violet-600" },
  { label: "流程编排", path: "/workflow-orchestration", icon: GitBranch, gradient: "from-violet-500 to-purple-600" },
]

export default function DashboardPage() {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeDrawerTab, setActiveDrawerTab] = useState<"quicklinks" | "activities">("quicklinks")
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { selectedModule, setSelectedModule, activeTab, setActiveTab } = useAppStore()

  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await lifecycleApi.getDashboardStats()
      if (res?.data?.recent_activities?.length) {
        setActivities(res.data.recent_activities.map((a: any) => ({
          time: a.time,
          action: a.action,
          detail: a.detail || "",
          icon: Activity,
          color: a.action?.includes("error") || a.action?.includes("delete") ? "text-fail" :
                 a.action?.includes("create") || a.action?.includes("generate") ? "text-pass" : "text-muted",
        })))
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchActivities() }, [fetchActivities])

  // ESC 关闭抽屉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape" && drawerOpen) setDrawerOpen(false) }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [drawerOpen])

  // 抽屉锁定滚动
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [drawerOpen])

  /* ---------- 路由映射 ---------- */
  const routeMap: Record<string, string> = {
    "test-management": "/test-management",
    "web-automation": "/ai-web-automation",
    knowledge: "/knowledge-base",
    "workflow-orchestration": "/workflow-orchestration",
    "test-mgmt-config": "/test-management/project-management",
    environments: "/environments",
    llm: "/llm",
    prompts: "/prompts",
    "de-ai": "/de-ai",
    mcp: "/mcp-marketplace",
    skills: "/skills",
    hermes: "/hermes",
    "operation-logs": "/operation-logs",
    users: "/users",
  }

  const currentTab = moduleTabs.find(t => t.key === activeTab) || moduleTabs[0]
  const displayModules = currentTab.modules.slice(0, 9)

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* ===== 顶部导航栏 ===== */}
      <header className="sticky top-0 z-20 bg-paper/80 backdrop-blur-sm border-b border-border shrink-0">
        <div className="flex items-center justify-between px-4 sm:px-8 h-14">
          {/* 左侧：Logo + 标题 */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl gradient-amber flex items-center justify-center shadow-md shadow-amber/20 shrink-0">
              <FlaskConical className="w-4.5 h-4.5 text-white" />
            </div>
            <h1
              className="text-base sm:text-lg font-bold text-ink"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              TSS AI测试平台
            </h1>
          </div>

          {/* 右侧：Activity按钮 + 快捷入口按钮 + 用户菜单 */}
          <div className="flex items-center gap-2">
            {/* Activity 按钮 */}
            <div className="relative">
              <button
                onClick={() => { setDrawerOpen(true); setActiveDrawerTab("activities") }}
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
                title="最近活动"
              >
                <Activity className="w-4.5 h-4.5 text-white" />
              </button>
              {activities.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm animate-pulse">
                  {activities.length > 9 ? "9+" : activities.length}
                </span>
              )}
            </div>

            {/* 快捷入口按钮 */}
            <button
              onClick={() => { setDrawerOpen(true); setActiveDrawerTab("quicklinks") }}
              className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 group"
              title="快捷入口"
            >
              <Blocks className="w-4.5 h-4.5 text-white group-hover:rotate-12 transition-transform duration-200" />
            </button>

            {/* 用户菜单 */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-white/80 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg gradient-amber flex items-center justify-center shadow-sm">
                  <span className="text-xs font-semibold text-white">
                    {(user?.display_name || user?.username || "U")[0].toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-ink-light hidden sm:block">
                  {user?.display_name || user?.username}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-border z-50 py-1.5 shadow-elevated">
                    <button
                      onClick={() => { setShowUserMenu(false); navigate("/profile") }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-ink-light hover:bg-cream"
                    >
                      <User className="w-4 h-4" /> 个人设置
                    </button>
                    <button
                      onClick={() => { logout(); navigate("/login") }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-fail hover:bg-fail-light"
                    >
                      <LogOut className="w-4 h-4" /> 退出登录
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ===== 主内容区 ===== */}
      <main className="flex-1 px-4 sm:px-8 py-8 sm:py-10">
        {/* 欢迎标题区 */}
        <div className="text-center mb-6 sm:mb-8">
          <h2
            className="text-xl sm:text-3xl font-bold text-ink leading-tight"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            欢迎使用 TSS AI测试平台
          </h2>
          <p className="text-xs sm:text-base text-ink-light mt-1">
            基于多智能体的AI软件测试平台
          </p>
        </div>

        {/* ===== Tab 导航 ===== */}
        <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-6 sm:mb-8 bg-white rounded-2xl border border-border shadow-card p-1 sm:p-1.5 max-w-xl mx-auto overflow-x-auto">
          {moduleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.key ? "gradient-amber text-white shadow-md" : "text-ink-light hover:text-ink hover:bg-cream"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== 模块卡片网格 ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {displayModules.map((mod) => {
            const Icon = iconMap[mod.key] || FlaskConical
            const targetPath = routeMap[mod.key] || `/${mod.key}`

            return (
              <div
                key={mod.key}
                onClick={() => { setSelectedModule(mod.key); navigate(targetPath) }}
                onMouseEnter={() => prefetchRoute(targetPath)}
                onMouseLeave={cancelPrefetch}
                className={`group p-5 sm:p-6 rounded-2xl bg-white border transition-all duration-300 cursor-pointer hover:-translate-y-1.5 ${
                  selectedModule === mod.key
                    ? "border-amber shadow-card-hover ring-2 ring-amber/20"
                    : "border-border shadow-card hover:shadow-card-hover hover:border-amber/40"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center group-hover:scale-110 transition-transform shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-ink mb-1">{mod.title}</h3>
                <p className="text-xs sm:text-sm text-ink-light leading-relaxed">{mod.desc}</p>
              </div>
            )
          })}
        </div>
      </main>

      {/* ===== 抽屉遮罩 ===== */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ===== 右侧抽屉面板 ===== */}
      <div className={`fixed top-0 right-0 h-full w-[85vw] sm:w-[380px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
        drawerOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-border rounded-r-full hidden sm:block" />

        {/* 抽屉头部 */}
        <div className="relative p-4 border-b border-border bg-gradient-to-r from-white to-cream/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeDrawerTab === "quicklinks"
                  ? "bg-gradient-to-br from-amber to-orange-500"
                  : "bg-gradient-to-br from-sky-500 to-blue-600"
              } shadow-md`}>
                {activeDrawerTab === "quicklinks"
                  ? <FlaskConical className="w-5 h-5 text-white" />
                  : <Activity className="w-5 h-5 text-white" />
                }
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink">
                  {activeDrawerTab === "quicklinks" ? "快捷入口" : "最近活动"}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {activeDrawerTab === "quicklinks" ? "常用功能快速访问" : "最近操作记录"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-9 h-9 rounded-xl hover:bg-cream flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted" />
            </button>
          </div>
        </div>

        {/* 抽屉 Tabs */}
        <div className="flex border-b border-border bg-cream/20">
          <button
            onClick={() => setActiveDrawerTab("quicklinks")}
            className={`flex-1 py-3.5 text-sm font-medium transition-all duration-200 relative ${
              activeDrawerTab === "quicklinks" ? "text-amber" : "text-muted hover:text-ink"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <FlaskConical className="w-4 h-4" /> 快捷入口
            </span>
            {activeDrawerTab === "quicklinks" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />}
          </button>
          <button
            onClick={() => setActiveDrawerTab("activities")}
            className={`flex-1 py-3.5 text-sm font-medium transition-all duration-200 relative ${
              activeDrawerTab === "activities" ? "text-amber" : "text-muted hover:text-ink"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Activity className="w-4 h-4" /> 最近活动
            </span>
            {activeDrawerTab === "activities" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />}
          </button>
        </div>

        {/* 抽屉内容 */}
        <div className="p-4 overflow-y-auto h-[calc(100%-140px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <div className="w-10 h-10 border-2 border-amber/30 border-t-amber rounded-full animate-spin mb-4" />
              <p className="text-sm text-muted">加载中...</p>
            </div>
          ) : activeDrawerTab === "quicklinks" ? (
            <div className="space-y-2.5">
              {quickLinks.map((link, idx) => {
                const LinkIcon = link.icon
                return (
                  <button
                    key={link.label}
                    onClick={() => { navigate(link.path); setDrawerOpen(false) }}
                    onMouseEnter={() => prefetchRoute(link.path)}
                    onMouseLeave={cancelPrefetch}
                    className="w-full flex items-center gap-3.5 p-4 rounded-2xl border border-border hover:border-amber/50 hover:bg-amber-50/50 transition-all duration-200 group text-left animate-fade-in-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${link.gradient} flex items-center justify-center shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-200`}>
                      <LinkIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-ink group-hover:text-amber transition-colors">
                        {link.label}
                      </span>
                      <p className="text-xs text-muted mt-0.5">快速访问</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-cream group-hover:bg-amber-100 flex items-center justify-center transition-colors">
                      <ArrowRight className="w-4 h-4 text-muted group-hover:text-amber group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-muted-light" />
              </div>
              <p className="text-sm font-medium text-ink mb-1">暂无活动记录</p>
              <p className="text-xs text-muted text-center">还没有操作记录</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.slice(0, 8).map((act, idx) => {
                const ActIcon = act.icon
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-cream/50 transition-colors animate-fade-in-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-cream flex items-center justify-center shrink-0">
                      <ActIcon className={`w-4.5 h-4.5 ${act.color}`} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">{act.action}</span>
                        <span className="text-xs text-muted bg-cream px-2 py-0.5 rounded-full shrink-0">
                          {act.time}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1 leading-relaxed truncate">{act.detail}</p>
                    </div>
                  </div>
                )
              })}
              <div className="pt-3 mt-3 border-t border-border">
                <button
                  onClick={() => { navigate("/activities"); setDrawerOpen(false) }}
                  className="w-full py-3 rounded-xl bg-cream hover:bg-amber-100 flex items-center justify-center gap-2 text-sm font-medium text-amber hover:text-orange-500 transition-all duration-200 group"
                >
                  查看全部活动 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
