/**
 * 需求测试 侧边栏导航
 */
import { memo } from "react"

export interface SidebarItem {
  key: string
  label: string
  icon: string
}

interface SidebarProps {
  items: SidebarItem[]
  activeKey: string
  onSelect: (key: string) => void
}

const iconPaths: Record<string, string> = {
  requirements: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  plans: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z M9 14l2 2 4-4",
  cases: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z",
  reviews: "M9 12l2 2 4-4 M7.835 4.697a3.42 3.42 0 0 1 1.946-.806 3.42 3.42 0 0 1 4.438 2.063 3.42 3.42 0 0 1 .806 1.946 3.42 3.42 0 0 0 2.063 4.438A3.42 3.42 0 0 1 16 14.5v.5a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-.5a3.42 3.42 0 0 0-2.063-4.438A3.42 3.42 0 0 1 5 9.5a3.42 3.42 0 0 1 2.835-4.803",
  pipeline: "M5 3l14 9-14 9V3z",
  records: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13H16 M8 17H16 M8 9H16",
}

function Sidebar({ items, activeKey, onSelect }: SidebarProps) {
  return (
    <nav className="w-52 sm:w-56 h-full flex-shrink-0 bg-white border-r border-border flex flex-col shadow-lg lg:shadow-none">
      {/* 菜单导航 - 和菜单项完全一样的样式 */}
      <div className="px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-amber/10 flex items-center justify-center flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </div>
          <span className="text-sm font-medium text-ink-light">菜单导航</span>
        </div>
      </div>
      {/* 菜单项 */}
      <div className="flex-1 py-2">
        {items.map((item) => {
          const isActive = activeKey === item.key
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-amber-50 text-amber-700 border-r-2 border-amber"
                  : "text-ink-light hover:text-ink hover:bg-cream"
              }`}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                isActive ? "bg-amber text-white" : "bg-cream text-muted"
              }`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={iconPaths[item.icon] || iconPaths.pipeline} />
                </svg>
              </div>
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default memo(Sidebar)
