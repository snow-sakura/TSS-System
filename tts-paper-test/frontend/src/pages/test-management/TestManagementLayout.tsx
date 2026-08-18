/**
 * 测试管理布局组件
 * 
 * 提供左侧边栏导航 + 右侧内容区的经典布局
 * 侧边栏按分组组织菜单：测试流程 / 缺陷管理 / 分析报告（基础配置类入口已移至首页）
 */
import { useState, useEffect, useCallback } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import {
  Home, FileText, ClipboardList, Target, FlaskConical, CheckCircle,
  Play, Bug, BarChart3, Sparkles, ChevronDown, ChevronRight,
  ArrowLeft, Search, Bell, GitCompare, Settings, FolderKanban, Tags, Users,
  Kanban, CalendarClock,
} from "lucide-react"

// ── 菜单配置 ──────────────────────────────────────────────
interface MenuItem {
  key: string
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
}

interface MenuGroup {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  children: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    key: "flow",
    label: "测试流程",
    icon: FileText,
    gradient: "from-blue-500 to-indigo-600",
    children: [
      { key: "requirements", label: "需求管理", path: "requirements", icon: FileText },
      { key: "plans", label: "测试方案", path: "plans", icon: ClipboardList },
      { key: "points", label: "测试点", path: "points", icon: Target },
      { key: "cases", label: "测试用例", path: "cases", icon: FlaskConical },
      { key: "reviews", label: "用例评审", path: "reviews", icon: CheckCircle },
      { key: "pipeline", label: "AI全流程", path: "pipeline", icon: Sparkles },
      { key: "executions", label: "执行列表", path: "executions", icon: Play },
      { key: "schedules", label: "执行调度", path: "schedules", icon: CalendarClock },
    ],
  },
  {
    key: "defect",
    label: "缺陷管理",
    icon: Bug,
    gradient: "from-rose-500 to-red-600",
    children: [
      { key: "defects", label: "缺陷列表", path: "defects", icon: Bug },
      { key: "kanban", label: "缺陷看板", path: "kanban", icon: Kanban },
      { key: "root-cause", label: "AI根因分析", path: "root-cause", icon: Sparkles },
      { key: "trend", label: "趋势分析", path: "trend", icon: BarChart3 },
    ],
  },
  {
    key: "report",
    label: "分析报告",
    icon: BarChart3,
    gradient: "from-teal-500 to-emerald-600",
    children: [
      { key: "reports", label: "报告列表", path: "reports", icon: BarChart3 },
      { key: "ai-report", label: "AI生成报告", path: "ai-report", icon: Sparkles },
      { key: "quality", label: "质量概览", path: "quality", icon: BarChart3 },
      { key: "comparison", label: "平台对标分析", path: "comparison", icon: GitCompare },
    ],
  },
]

// 基础配置页内 Tab（入口在首页「基础配置」，侧边栏不展示）
const configTabs = [
  { key: "project-management", label: "项目管理", path: "project-management", icon: FolderKanban },
  { key: "version-management", label: "版本管理", path: "version-management", icon: Tags },
  { key: "user-management", label: "用户管理", path: "user-management", icon: Users },
  { key: "role-management", label: "角色管理", path: "role-management", icon: Settings },
]

// ── 主组件 ──────────────────────────────────────────────
export default function TestManagementLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["flow"]))
  const [activeKey, setActiveKey] = useState<string>("")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 从路径解析当前激活的菜单
  useEffect(() => {
    const pathParts = location.pathname.split("/").filter(Boolean)
    // 已知菜单路径集合（用于详情页 :id 路径回退，如 cases/123 → cases）
    const knownPaths = new Set(menuGroups.flatMap(g => g.children.map(item => item.path)))
    // 从末段向前查找第一个已知菜单段
    const currentPath =
      [...pathParts].reverse().find(part => knownPaths.has(part)) || "requirements"
    setActiveKey(currentPath)

    // 自动展开包含当前菜单的分组
    menuGroups.forEach(group => {
      if (group.children.some(item => item.path === currentPath)) {
        setExpandedGroups(prev => new Set([...prev, group.key]))
      }
    })
  }, [location.pathname])

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleNavigate = useCallback((path: string) => {
    navigate(`/test-management/${path}`)
    setSidebarOpen(false)
  }, [navigate])

  return (
    <div className="h-screen bg-paper flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-border px-4 md:px-6 py-3 flex-shrink-0 shadow-sm z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
              <span className="text-xs font-medium text-ink-light group-hover:text-ink transition-colors hidden sm:block">
                返回首页
              </span>
            </button>
            <div className="h-8 w-px bg-border/60" />
            <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md flex-shrink-0">
              <FlaskConical className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1
                className="text-sm font-bold text-ink truncate"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                测试管理
              </h1>
              <p className="text-[11px] text-muted truncate">
                AI驱动的全流程测试管理平台
              </p>
            </div>
          </div>

          {/* 顶部操作区 */}
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                placeholder="搜索功能..."
                className="w-48 h-9 pl-9 pr-3 text-sm bg-cream border border-border rounded-xl input-focus"
              />
            </div>
            <button className="relative p-2 rounded-xl hover:bg-cream transition-colors">
              <Bell className="w-5 h-5 text-ink-light" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                3
              </span>
            </button>
            <button
              onClick={() => navigate("/users")}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-cream transition-colors"
            >
              <div className="w-7 h-7 rounded-lg gradient-amber flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        {/* 移动端菜单按钮 */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed bottom-20 left-4 z-50 w-12 h-12 rounded-2xl gradient-amber flex items-center justify-center shadow-lg text-white"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* 移动端遮罩 */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/30 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 侧边栏 */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40
            w-64 bg-white border-r border-border flex flex-col
            transition-transform duration-300 ease-out
            will-change-transform
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            lg:translate-x-0
          `}
        >
          {/* 侧边栏顶部 */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center">
                <Home className="w-4 h-4 text-amber" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink">工作台</h2>
                <p className="text-[10px] text-muted">导航菜单</p>
              </div>
            </div>
          </div>

          {/* 侧边栏菜单 */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
            {/* 分组菜单 */}
            {menuGroups.map(group => {
              const Icon = group.icon
              const isExpanded = expandedGroups.has(group.key)
              const hasActiveChild = group.children.some(item => item.path === activeKey)

              return (
                <div key={group.key} className="space-y-1">
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      hasActiveChild
                        ? "bg-cream text-ink"
                        : "text-ink-light hover:text-ink hover:bg-cream/50"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${group.gradient} flex items-center justify-center`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="flex-1 text-left">{group.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted" />
                    )}
                  </button>

                  {/* 子菜单 */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="ml-3 pl-4 border-l-2 border-border/60 space-y-0.5 py-1">
                      {group.children.map(item => {
                        const ItemIcon = item.icon
                        const isActive = activeKey === item.path
                        return (
                          <button
                            key={item.key}
                            onClick={() => handleNavigate(item.path)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                              isActive
                                ? "bg-amber text-white font-semibold shadow-sm"
                                : "text-ink-light hover:text-ink hover:bg-cream/50"
                            }`}
                          >
                            <ItemIcon className="w-3.5 h-3.5" />
                            <span>{item.label}</span>
                            {item.badge !== undefined && (
                              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${
                                isActive ? "bg-white/20 text-white" : "bg-cream text-muted"
                              }`}>
                                {item.badge}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>

          
        </aside>

        {/* 主内容区：可滚动容器，列表数据超过一屏时可下拉查看全部（含分页栏） */}
        <main className="flex-1 overflow-y-auto bg-cream/30 min-h-0">
          {/* 基础配置页内 Tab：从首页「基础配置」进入后，可在项目/版本/用户/角色间切换 */}
          {configTabs.some(tab => location.pathname.includes(`/test-management/${tab.path}`)) && (
            <div className="px-4 md:px-6 pt-4 pb-0">
              <div className="bg-white rounded-xl border border-border shadow-card px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
                {configTabs.map(tab => {
                  const TabIcon = tab.icon
                  const isActive = location.pathname.includes(`/test-management/${tab.path}`)
                  return (
                    <button
                      key={tab.key}
                      onClick={() => { navigate(`/test-management/${tab.path}`); setSidebarOpen(false) }}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-amber text-white shadow-sm"
                          : "text-muted hover:text-ink hover:bg-cream"
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
