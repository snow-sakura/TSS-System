/**
 * 缺陷管理 - 主页面（使用共享PageLayout）
 */
import { memo } from "react"
import { useSearchParams } from "react-router-dom"
import { Bug } from "lucide-react"
import PageLayout from "@/components/layout/PageLayout"
import { type SidebarItem } from "../requirement-testing/components/Sidebar"
import DefectList from "./pages/DefectList"
import DefectKanban from "./pages/DefectKanban"
import RootCauseAnalysis from "./pages/RootCauseAnalysis"
import TrendAnalysis from "./pages/TrendAnalysis"

const MENU_ITEMS: SidebarItem[] = [
  { key: "df-list", label: "缺陷列表", icon: "requirements" },
  { key: "df-kanban", label: "看板视图", icon: "cases" },
  { key: "df-root-cause", label: "AI根因分析", icon: "reviews" },
  { key: "df-trend", label: "趋势分析", icon: "pipeline" },
]

function DefectManagementPage() {
  const [searchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || "df-list"

  const renderContent = () => {
    switch (activeMenu) {
      case "df-list": return <DefectList />
      case "df-kanban": return <DefectKanban />
      case "df-root-cause": return <RootCauseAnalysis />
      case "df-trend": return <TrendAnalysis />
      default: return <DefectList />
    }
  }

  return (
    <PageLayout
      title="缺陷管理"
      subtitle="AI缺陷分析与根因定位，看板视图与趋势追踪"
      icon={<Bug className="w-4.5 h-4.5 text-white" />}
      iconGradient="from-rose-500 to-red-600"
      menuItems={MENU_ITEMS}
      activeMenu={activeMenu}
      basePath="/defects"
      renderContent={renderContent}
    />
  )
}

export default memo(DefectManagementPage)
