/**
 * 执行管理 - 主页面（使用共享PageLayout）
 */
import { memo } from "react"
import { useSearchParams } from "react-router-dom"
import { Play } from "lucide-react"
import PageLayout from "@/components/layout/PageLayout"
import { type SidebarItem } from "../requirement-testing/components/Sidebar"
import ExecutionList from "./pages/ExecutionList"
import ExecutionDetail from "./pages/ExecutionDetail"
import ScheduleConfig from "./pages/ScheduleConfig"

const MENU_ITEMS: SidebarItem[] = [
  { key: "ex-list", label: "执行列表", icon: "requirements" },
  { key: "ex-detail", label: "执行详情", icon: "cases" },
  { key: "ex-schedule", label: "调度配置", icon: "plans" },
]

function ExecutionManagementPage() {
  const [searchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || "ex-list"

  const renderContent = () => {
    switch (activeMenu) {
      case "ex-list": return <ExecutionList />
      case "ex-detail": return <ExecutionDetail />
      case "ex-schedule": return <ScheduleConfig />
      default: return <ExecutionList />
    }
  }

  return (
    <PageLayout
      title="执行管理"
      subtitle="实时执行追踪与结果收集，支持调度与CI触发"
      icon={<Play className="w-4.5 h-4.5 text-white" />}
      iconGradient="from-sky-500 to-blue-600"
      menuItems={MENU_ITEMS}
      activeMenu={activeMenu}
      basePath="/executions"
      renderContent={renderContent}
    />
  )
}

export default memo(ExecutionManagementPage)
