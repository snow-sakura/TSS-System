/**
 * 详情页布局组件
 *
 * 严格遵循 DESIGN_NOTES.md LAYOUT 规范：
 *   「详情页: 左侧导航 + 面包屑 + 工具栏 + 内容区」
 *
 * 两种模式：
 *   1. 独立全屏（showNav=true，默认）：
 *   ┌ 左侧导航（220px，可折叠至 60px，折叠状态 localStorage 记忆）──┐
 *   │  · 内容锚点导航项（scrollspy：滚动自动高亮当前分区）             │
 *   ├ 右侧 ────────────────────────────────────────────────────────┤
 *   │  · 面包屑（返回列表按钮 + 父级路径链路，当前页由工具栏标题展示）    │
 *   │  · 工具栏（页面标题 + 元信息 subtitle + 操作按钮）              │
 *   │  · 内容区（滚动容器）                                         │
 *   └──────────────────────────────────────────────────────────────┘
 *   2. 嵌套模式（showNav=false）：不渲染左侧导航，仅渲染右侧部分，
 *      用于在模块左右布局壳（如 TestManagementLayout）内展示详情，
 *      对标竞品 TestHub：详情页保持在模块菜单壳内，面包屑定位 + 内容区。
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"

export interface DetailNavItem {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

export interface CrumbItem {
  label: string
  path?: string
}

interface DetailPageLayoutProps {
  /** 面包屑路径（最后一项为当前页，仅用于工具栏标题，不重复渲染在面包屑） */
  crumbs: CrumbItem[]
  /** 返回列表按钮回调（可选，传则显示返回按钮） */
  onBack?: () => void
  /** 工具栏标题下方的元信息条（如 ID、状态徽章等） */
  subtitle?: React.ReactNode
  /** 工具栏右侧操作按钮区 */
  toolbar?: React.ReactNode
  /** 左侧导航锚点项 */
  navItems?: DetailNavItem[]
  /** 左侧导航标题 */
  navTitle?: string
  /** 是否渲染左侧导航（false 时仅渲染右侧：面包屑 + 工具栏 + 内容区，用于模块壳内嵌套） */
  showNav?: boolean
  /** 内容区 */
  children: React.ReactNode
}

const NAV_COLLAPSE_KEY = "detail-nav-collapsed"

/** 左侧导航默认宽度（展开） */
const NAV_WIDTH = 220
/** 左侧导航折叠宽度 */
const NAV_WIDTH_COLLAPSED = 60
/** scrollspy 判定「当前分区」的滚动偏移阈值（px） */
const SCROLLSPY_OFFSET = 120

export default function DetailPageLayout({
  crumbs,
  onBack,
  subtitle,
  toolbar,
  navItems = [],
  navTitle = "详情导航",
  showNav = true,
  children,
}: DetailPageLayoutProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NAV_COLLAPSE_KEY) === "true"
    } catch {
      return false
    }
  })
  const [activeSection, setActiveSection] = useState<string>(navItems[0]?.key || "")
  const contentRef = useRef<HTMLDivElement>(null)

  // 折叠状态持久化记忆
  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSE_KEY, String(collapsed))
    } catch {
      /* 忽略存储异常（隐私模式等） */
    }
  }, [collapsed])

  /** 点击锚点导航，平滑滚动到对应内容分区 */
  const handleNavClick = useCallback((key: string) => {
    setActiveSection(key)
    const el = document.getElementById(`detail-section-${key}`)
    if (!el) return
    // 找到内容区滚动容器（overflow-y-auto），精确计算滚动偏移
    const container = el.closest(".overflow-y-auto") as HTMLElement | null
    if (container) {
      const targetTop =
        el.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        16
      container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" })
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  /** scrollspy：内容区滚动时高亮当前可见分区 */
  const handleContentScroll = useCallback(() => {
    const container = contentRef.current
    if (!container || navItems.length === 0) return
    let current = navItems[0].key
    for (const item of navItems) {
      const el = document.getElementById(`detail-section-${item.key}`)
      if (!el) continue
      const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top
      if (top <= SCROLLSPY_OFFSET) current = item.key
    }
    setActiveSection(current)
  }, [navItems])

  useEffect(() => {
    // navItems 变化后重置高亮
    setActiveSection(navItems[0]?.key || "")
  }, [navItems])

  /** 面包屑链路：crumbs 前 n-1 项为父级路径（最后一项由工具栏标题展示） */
  const breadcrumbs = crumbs.slice(0, -1)
  const currentTitle = crumbs[crumbs.length - 1]?.label || ""

  return (
    <div className="h-full flex min-h-0 bg-cream/30">
      {/* ── 左侧导航（可折叠二级导航，嵌套模式下不渲染） ── */}
      {showNav && (
        <aside
          className={`flex-shrink-0 bg-white border-r border-border flex flex-col overflow-hidden transition-all duration-300 ease-out ${
            collapsed ? "w-[60px]" : "w-[220px]"
          }`}
          style={{ width: collapsed ? NAV_WIDTH_COLLAPSED : NAV_WIDTH }}
        >
        {/* 导航头部：标题 + 折叠按钮 */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border min-h-[57px] flex-shrink-0">
          <span
            className={`text-sm font-semibold text-ink whitespace-nowrap transition-opacity duration-200 ${
              collapsed ? "opacity-0 w-0" : "opacity-100"
            }`}
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {navTitle}
          </span>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:bg-cream hover:text-ink transition-all flex-shrink-0"
            title={collapsed ? "展开菜单" : "折叠菜单"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* 导航项（内容锚点 + scrollspy 高亮） */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.key
            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap ${
                  collapsed ? "justify-center px-2" : ""
                } ${
                  isActive
                    ? "bg-amber/10 text-amber font-medium"
                    : "text-ink-light hover:text-ink hover:bg-cream"
                }`}
                title={item.label}
                aria-current={isActive ? "location" : undefined}
              >
                {Icon && (
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-amber" : ""}`} />
                )}
                <span
                  className={`transition-opacity duration-200 ${
                    collapsed ? "opacity-0 w-0" : "opacity-100"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>
      )}

      {/* ── 右侧：面包屑 + 工具栏 + 内容区 ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 面包屑：返回按钮 + 父级路径链路 */}
        <div className="px-5 pt-4 flex items-center gap-1.5 text-xs text-muted flex-shrink-0 flex-wrap">
          {onBack && (
            <>
              <button
                onClick={onBack}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/60 bg-white hover:bg-cream text-ink-light hover:text-ink transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>返回列表</span>
              </button>
              <span className="mx-1 text-border">/</span>
            </>
          )}
          {breadcrumbs.map((crumb, idx) => (
            <span key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 && <span className="text-border">/</span>}
              {crumb.path ? (
                <Link to={crumb.path} className="text-ink-light hover:text-amber transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-ink-light">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>

        {/* 工具栏：标题 + 元信息 + 操作按钮 */}
        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
          <div className="min-w-0">
            <h1
              className="text-base font-bold text-ink truncate"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {currentTitle}
            </h1>
            {subtitle && (
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted flex-wrap">
                {subtitle}
              </div>
            )}
          </div>
          {toolbar && <div className="flex items-center gap-2 flex-shrink-0">{toolbar}</div>}
        </div>

        {/* 内容区（滚动容器，scrollspy 监听） */}
        <div
          ref={contentRef}
          onScroll={handleContentScroll}
          className="flex-1 overflow-y-auto px-5 pb-6 min-h-0"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
