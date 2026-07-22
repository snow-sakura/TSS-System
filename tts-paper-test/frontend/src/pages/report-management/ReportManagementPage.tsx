/**
 * 分析报告 - 主页面（使用共享PageLayout）
 */
import { memo } from "react"
import { useSearchParams } from "react-router-dom"
import { BarChart3 } from "lucide-react"
import PageLayout from "@/components/layout/PageLayout"
import { type SidebarItem } from "../requirement-testing/components/Sidebar"
import ReportList from "./pages/ReportList"
import AiReport from "./pages/AiReport"
import QualityOverview from "./pages/QualityOverview"
import TrendCharts from "./pages/TrendCharts"

const MENU_ITEMS: SidebarItem[] = [
  { key: "rp-list", label: "报告列表", icon: "requirements" },
  { key: "rp-generate", label: "AI生成报告", icon: "reviews" },
  { key: "rp-overview", label: "质量概览", icon: "cases" },
  { key: "rp-trends", label: "趋势图表", icon: "pipeline" },
]

function ReportManagementPage() {
  const [searchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || "rp-list"

  const renderContent = () => {
    switch (activeMenu) {
      case "rp-list": return <ReportList />
      case "rp-generate": return <AiReport />
      case "rp-overview": return <QualityOverview />
      case "rp-trends": return <TrendCharts />
      default: return <ReportList />
    }
  }

  return (
    <PageLayout
      title="分析报告"
      subtitle="智能质量洞察与报告生成，支持自动汇总与图表"
      icon={<BarChart3 className="w-4.5 h-4.5 text-white" />}
      iconGradient="from-teal-500 to-emerald-600"
      menuItems={MENU_ITEMS}
      activeMenu={activeMenu}
      basePath="/reports"
      renderContent={renderContent}
    />
  )
}

export default memo(ReportManagementPage)
