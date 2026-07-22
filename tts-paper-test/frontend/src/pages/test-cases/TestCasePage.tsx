/**
 * 测试用例管理 — 统一入口
 * 合并原 CasesList + AICaseGeneration + ReviewsList
 * 消除冗余，按职责划分：列表管理 | AI生成 | 评审
 */
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { FlaskConical } from "lucide-react"
import PageLayout from "@/components/layout/PageLayout"
import CaseList from "./pages/CaseList"
import CaseReview from "./pages/CaseReview"

const MENU_ITEMS = [
  { key: "cases", label: "用例列表", icon: "cases" },
  { key: "review", label: "用例评审", icon: "reviews" },
]

export default function TestCasePage() {
  const [searchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || "cases"

  const renderContent = () => {
    switch (activeMenu) {
      case "cases": return <CaseList />
      case "review": return <CaseReview />
      default: return <CaseList />
    }
  }

  return (
    <PageLayout
      title="测试用例管理"
      subtitle="用例编写、AI生成、评审审批全流程"
      icon={<FlaskConical className="w-4.5 h-4.5 text-white" />}
      iconGradient="from-emerald-500 to-green-600"
      menuItems={MENU_ITEMS}
      activeMenu={activeMenu}
    >
      {renderContent()}
    </PageLayout>
  )
}
