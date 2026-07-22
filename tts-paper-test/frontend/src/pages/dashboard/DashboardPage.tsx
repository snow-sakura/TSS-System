/**
 * 首页仪表盘 - 连接真实API，更多统计维度
 */
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { useAppStore } from "@/stores/appStore"
import { FlaskConical, LogOut, User, Bug, Play, FileText, BarChart3, Users, CheckCircle, TrendingUp, Activity, ArrowRight, PanelRightOpen, X, Zap, Target, Clock, AlertTriangle } from "lucide-react"
import { moduleTabs } from "@/lib/modules"
import { lifecycleApi, configApi } from "@/lib/api"

const cardIcons: Record<string, string> = {
  "test-lifecycle": `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
  "web-automation": `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  knowledge: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
  environments: `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/>`,
  llm: `<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>`,
  prompts: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  "de-ai": `<path d="M3 3v18h18"/><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/>`,
  mcp: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  skills: `<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>`,
  hermes: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  "operation-logs": `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/>`,
  users: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  roles: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  profile: `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="4"/><path d="M4.93 17.54A8 8 0 0 1 12 14a8 8 0 0 1 7.07 3.54"/>`,
}

// 默认Mock数据
const defaultStats = {
  cases: { total: 0, passed: 0, failed: 0 },
  defects: { total: 0, open: 0, critical: 0 },
  executions: { total: 0, today: 0, running: 0, passed: 0 },
  requirements: { total: 0, analyzed: 0 },
  reports: { total: 0 },
  coverage: 0,
}

const quickLinks = [
  { label: "需求测试", path: "/requirement-testing", icon: FileText, gradient: "from-amber to-orange-500" },
  { label: "执行管理", path: "/executions", icon: Play, gradient: "from-sky-500 to-blue-600" },
  { label: "缺陷管理", path: "/defects", icon: Bug, gradient: "from-rose-500 to-red-600" },
  { label: "分析报告", path: "/reports", icon: BarChart3, gradient: "from-teal-500 to-emerald-600" },
  { label: "知识库", path: "/knowledge-base", icon: FlaskConical, gradient: "from-purple-500 to-violet-600" },
  { label: "AI Web自动化", path: "/ai-web-automation", icon: Target, gradient: "from-emerald-500 to-green-600" },
]

export default function DashboardPage() {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeDrawerTab, setActiveDrawerTab] = useState<"quicklinks" | "activities">("quicklinks")
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { selectedModule, setSelectedModule, activeTab, setActiveTab } = useAppStore()

  const [stats, setStats] = useState(defaultStats)
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await lifecycleApi.getDashboardStats()
      if (res?.data) {
        const d = res.data
        setStats({
          cases: d.cases || defaultStats.cases,
          defects: d.defects || defaultStats.defects,
          executions: d.executions || defaultStats.executions,
          requirements: d.requirements || defaultStats.requirements,
          reports: d.reports || defaultStats.reports,
          coverage: d.coverage || defaultStats.coverage,
        })
        if (d.recent_activities?.length) {
          const iconMap: Record<string, any> = {
            "execute": Play, "start_execution": Play, "stop_execution": Play,
            "create_defect": Bug, "ai_analyze_defect": Bug,
            "ai_generate_report": FileText, "create_report": FileText,
            "review_test_case": CheckCircle, "create_test_case": FileText,
            "create_requirement": FileText, "upload_requirement": FileText,
            "ai_generate_cases": FlaskConical, "login": Users,
          }
          setActivities(d.recent_activities.map((a: any) => ({
            time: a.time,
            action: a.action,
            detail: a.detail || "",
            icon: iconMap[a.action] || Activity,
            color: a.action?.includes("error") || a.action?.includes("delete") ? "text-fail" :
                   a.action?.includes("create") || a.action?.includes("generate") ? "text-pass" : "text-muted",
          })))
        }
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDashboardData() }, [fetchDashboardData])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape" && drawerOpen) setDrawerOpen(false) }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [drawerOpen])

  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [drawerOpen])

  const currentTab = moduleTabs.find(t => t.key === activeTab) || moduleTabs[0]
  const displayModules = currentTab.modules.slice(0, 9)

  // 统计卡片配置
  const statCards = [
    { label: "测试用例", sub: `${stats.cases.passed}/${stats.cases.total} 通过`, value: stats.cases.total, icon: FileText, gradient: "from-amber to-orange-500", path: "/requirement-testing?menu=cases" },
    { label: "缺陷跟踪", sub: `${stats.defects.open}个未修复`, value: stats.defects.total, icon: Bug, gradient: "from-rose-500 to-red-600", path: "/defects" },
    { label: "测试执行", sub: `${stats.executions.passed}通过 ${stats.executions.running}进行中`, value: stats.executions.total, icon: Play, gradient: "from-sky-500 to-blue-600", path: "/executions" },
    { label: "需求分析", sub: `${stats.requirements.analyzed}/${stats.requirements.total} 已分析`, value: stats.requirements.total, icon: Target, gradient: "from-violet-500 to-purple-600", path: "/requirement-testing" },
  ]

  return (
    <div className="min-h-screen bg-paper">
      {/* 右上角用户菜单 */}
      <div className="absolute top-3 right-4 sm:top-4 sm:right-6 z-10">
        <div className="relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:bg-white/80 transition-colors">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg gradient-amber flex items-center justify-center shadow-sm"><span className="text-xs sm:text-sm font-semibold text-white">{(user?.display_name || user?.username || "U")[0].toUpperCase()}</span></div>
            <span className="text-xs sm:text-sm text-ink-light hidden sm:block">{user?.display_name || user?.username}</span>
            <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showUserMenu && (<><div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} /><div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-border z-50 py-1.5 shadow-elevated">
            <button onClick={() => { setShowUserMenu(false); navigate("/profile") }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-ink-light hover:bg-cream"><User className="w-4 h-4" /> 个人设置</button>
            <button onClick={() => { logout(); navigate("/login") }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-fail hover:bg-fail-light"><LogOut className="w-4 h-4" /> 退出登录</button>
          </div></>)}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Logo + 标题 */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl gradient-amber flex items-center justify-center shadow-lg shadow-amber/25 flex-shrink-0">
            <FlaskConical className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="text-left min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-ink leading-tight" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>欢迎使用 TSS AI测试平台</h1>
            <p className="text-xs sm:text-base text-ink-light mt-0.5 truncate sm:whitespace-normal">基于多智能体的AI软件测试平台</p>
          </div>
        </div>

        {/* 仪表盘概览统计 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {statCards.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} onClick={() => navigate(s.path)} className="bg-white rounded-2xl border border-border shadow-card p-4 sm:p-5 hover:shadow-card-hover transition-all cursor-pointer group">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-pass opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-ink">{s.value}</p>
                <p className="text-xs text-muted mt-0.5">{s.label}</p>
                <p className="text-[11px] text-ink-light mt-1">{s.sub}</p>
              </div>
            )
          })}
        </div>

        {/* 第二行统计：覆盖率 + 报告 + 运行中 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-2xl border border-border shadow-card p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted">测试覆盖率</p>
                <p className="text-xl font-bold text-ink">{stats.coverage}%</p>
              </div>
            </div>
            <div className="mt-3 w-full h-2 bg-cream rounded-full overflow-hidden">
              <div className="h-full gradient-amber rounded-full transition-all duration-500" style={{ width: `${Math.min(stats.coverage, 100)}%` }} />
            </div>
            <p className="text-[10px] text-muted mt-1">目标 ≥ 85%</p>
          </div>
          <div className="bg-white rounded-2xl border border-border shadow-card p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted">测试报告</p>
                <p className="text-xl font-bold text-ink">{stats.reports.total}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted mt-3">已生成报告总数</p>
          </div>
          <div className="bg-white rounded-2xl border border-border shadow-card p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
                <Play className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted">今日执行</p>
                <p className="text-xl font-bold text-ink">{stats.executions.today}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted mt-3">{stats.executions.running} 个正在运行</p>
          </div>
        </div>

        {/* Tab 导航 */}
        <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-6 sm:mb-8 bg-white rounded-2xl border border-border shadow-card p-1 sm:p-1.5 max-w-xl mx-auto overflow-x-auto">
          {moduleTabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.key ? "gradient-amber text-white shadow-md" : "text-ink-light hover:text-ink hover:bg-cream"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 模块卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {displayModules.map((mod) => {
            const iconSvg = cardIcons[mod.key] || cardIcons["test-lifecycle"]
            const routeMap: Record<string, string> = {
              environments: "/system?menu=sys-env", llm: "/system?menu=sys-llm", prompts: "/system?menu=sys-prompts",
              "de-ai": "/system?menu=sys-deai", mcp: "/system?menu=sys-mcp", skills: "/system?menu=sys-skills",
              hermes: "/system?menu=sys-hermes",
              "operation-logs": "/system?menu=sys-logs", "web-automation": "/ai-web-automation", "knowledge": "/knowledge-base",
              "workflow-orchestration": "/workflow-orchestration",
            }
            const targetPath = mod.key === "requirement-testing" ? "/requirement-testing"
              : mod.key === "executions" ? "/executions"
              : mod.key === "defects" ? "/defects"
              : mod.key === "reports" ? "/reports"
              : mod.key === "users" ? "/users"
              : routeMap[mod.key] || `/${mod.key}`
            return (
              <div key={mod.key} onClick={() => { setSelectedModule(mod.key); navigate(targetPath) }}
                className={`group p-5 sm:p-6 rounded-2xl bg-white border transition-all duration-300 cursor-pointer hover:-translate-y-1.5 ${
                  selectedModule === mod.key ? "border-amber shadow-card-hover ring-2 ring-amber/20" : "border-border shadow-card hover:shadow-card-hover hover:border-amber/40"
                }`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center group-hover:scale-110 transition-transform shadow-md`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white" dangerouslySetInnerHTML={{ __html: iconSvg }} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-ink mb-1">{mod.title}</h3>
                <p className="text-xs sm:text-sm text-ink-light leading-relaxed">{mod.desc}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 右侧浮动按钮组 */}
      <div className={`fixed right-6 bottom-[92px] z-30 flex flex-col gap-3 transition-all duration-300 ${drawerOpen ? "opacity-0 pointer-events-none translate-x-20" : "opacity-100 translate-x-0"}`}>
        <div className="relative">
          <button onClick={() => { setDrawerOpen(true); setActiveDrawerTab("activities") }}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-110 transition-all duration-300" title="最近活动">
            <Activity className="w-6 h-6 text-white" />
          </button>
          {activities.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md animate-pulse">{activities.length > 9 ? "9+" : activities.length}</span>
          )}
        </div>
        <button onClick={() => { setDrawerOpen(true); setActiveDrawerTab("quicklinks") }}
          className="w-14 h-14 rounded-full gradient-amber flex items-center justify-center shadow-lg shadow-amber/30 hover:shadow-xl hover:shadow-amber/40 hover:scale-110 transition-all duration-300 group" title="快捷入口">
          <PanelRightOpen className="w-6 h-6 text-white group-hover:rotate-12 transition-transform duration-300" />
        </button>
      </div>

      {/* 抽屉遮罩 */}
      {drawerOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300" onClick={() => setDrawerOpen(false)} />}

      {/* 右侧抽屉面板 */}
      <div className={`fixed top-0 right-0 h-full w-[85vw] sm:w-[380px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-border rounded-r-full hidden sm:block" />
        <div className="relative p-4 border-b border-border bg-gradient-to-r from-white to-cream/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeDrawerTab === "quicklinks" ? "bg-gradient-to-br from-amber to-orange-500" : "bg-gradient-to-br from-sky-500 to-blue-600"} shadow-md`}>
                {activeDrawerTab === "quicklinks" ? <FlaskConical className="w-5 h-5 text-white" /> : <Activity className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink">{activeDrawerTab === "quicklinks" ? "快捷入口" : "最近活动"}</h3>
                <p className="text-xs text-muted mt-0.5">{activeDrawerTab === "quicklinks" ? "常用功能快速访问" : "最近操作记录"}</p>
              </div>
            </div>
            <button onClick={() => setDrawerOpen(false)} className="w-9 h-9 rounded-xl hover:bg-cream flex items-center justify-center transition-colors"><X className="w-4 h-4 text-muted" /></button>
          </div>
        </div>
        <div className="flex border-b border-border bg-cream/20">
          <button onClick={() => setActiveDrawerTab("quicklinks")} className={`flex-1 py-3.5 text-sm font-medium transition-all duration-200 relative ${activeDrawerTab === "quicklinks" ? "text-amber" : "text-muted hover:text-ink"}`}>
            <span className="flex items-center justify-center gap-2"><FlaskConical className="w-4 h-4" /> 快捷入口</span>
            {activeDrawerTab === "quicklinks" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />}
          </button>
          <button onClick={() => setActiveDrawerTab("activities")} className={`flex-1 py-3.5 text-sm font-medium transition-all duration-200 relative ${activeDrawerTab === "activities" ? "text-amber" : "text-muted hover:text-ink"}`}>
            <span className="flex items-center justify-center gap-2"><Activity className="w-4 h-4" /> 最近活动</span>
            {activeDrawerTab === "activities" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />}
          </button>
        </div>
        <div className="p-4 overflow-y-auto h-[calc(100%-140px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <div className="w-10 h-10 border-2 border-amber/30 border-t-amber rounded-full animate-spin mb-4" />
              <p className="text-sm text-muted">加载中...</p>
            </div>
          ) : activeDrawerTab === "quicklinks" ? (
            <div className="space-y-2.5">
              {quickLinks.map((link, idx) => {
                const Icon = link.icon
                return (
                  <button key={link.label} onClick={() => { navigate(link.path); setDrawerOpen(false) }}
                    className="w-full flex items-center gap-3.5 p-4 rounded-2xl border border-border hover:border-amber/50 hover:bg-amber-50/50 transition-all duration-200 group text-left animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${link.gradient} flex items-center justify-center shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-200`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-ink group-hover:text-amber transition-colors">{link.label}</span>
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
              <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center mb-4"><Zap className="w-8 h-8 text-muted-light" /></div>
              <p className="text-sm font-medium text-ink mb-1">暂无活动记录</p>
              <p className="text-xs text-muted text-center">还没有操作记录</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.slice(0, 8).map((act, idx) => {
                const Icon = act.icon
                return (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl hover:bg-cream/50 transition-colors animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="w-9 h-9 rounded-xl bg-cream flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4.5 h-4.5 ${act.color}`} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">{act.action}</span>
                        <span className="text-xs text-muted bg-cream px-2 py-0.5 rounded-full">{act.time}</span>
                      </div>
                      <p className="text-xs text-muted mt-1 leading-relaxed truncate">{act.detail}</p>
                    </div>
                  </div>
                )
              })}
              <div className="pt-3 mt-3 border-t border-border">
                <button onClick={() => { navigate("/activities"); setDrawerOpen(false) }}
                  className="w-full py-3 rounded-xl bg-cream hover:bg-amber-100 flex items-center justify-center gap-2 text-sm font-medium text-amber hover:text-orange-500 transition-all duration-200 group">
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
