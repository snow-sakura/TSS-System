/**
 * 用户管理 - 主页面
 * 布局：顶部导航 + 左侧边栏 + 右侧内容区
 */
import { useState, memo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Users, Shield, ScrollText, UserCog, Activity, Smartphone, ShieldCheck } from "lucide-react"
import Sidebar, { type SidebarItem } from "../requirement-testing/components/Sidebar"
import UserList from "./pages/UserList"
import UserStatus from "./pages/UserStatus"
import LoginLog from "./pages/LoginLog"
import DeviceMgmt from "./pages/DeviceMgmt"
import RolePermission from "./pages/RolePermission"

const MENU_ITEMS: SidebarItem[] = [
  { key: "usr-list", label: "用户列表", icon: "requirements" },
  { key: "usr-status", label: "用户状态", icon: "pipeline" },
  { key: "usr-role", label: "角色权限", icon: "cases" },
  { key: "usr-login-log", label: "登录记录", icon: "records" },
  { key: "usr-device", label: "设备管理", icon: "plans" },
]

function UserManagementPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || "usr-list"
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const renderContent = () => {
    switch (activeMenu) {
      case "usr-list": return <UserList />
      case "usr-status": return <UserStatus />
      case "usr-role": return <RolePermission />
      case "usr-login-log": return <LoginLog />
      case "usr-device": return <DeviceMgmt />
      default: return <UserList />
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
            <Users className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>用户管理</h1>
            <p className="text-[11px] text-muted truncate">系统用户CRUD与状态管理、登录日志审计</p>
          </div>
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
        {/* 侧边栏 */}
        <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200`}>
          <Sidebar items={MENU_ITEMS} activeKey={activeMenu} onSelect={(key) => { navigate(`/users?menu=${key}`); setSidebarOpen(false) }} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 bg-cream/30">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default memo(UserManagementPage)
