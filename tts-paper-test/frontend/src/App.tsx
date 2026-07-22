import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { Loader2 } from "lucide-react"

import LoginPage from "@/pages/auth/LoginPage"
import RegisterPage from "@/pages/auth/RegisterPage"
import DashboardPage from "@/pages/dashboard/DashboardPage"
import AiAssistant from "@/components/ai-assistant/AiAssistant"

// 懒加载页面组件（按路由分割代码）
const ActivitiesPage = lazy(() => import("@/pages/dashboard/ActivitiesPage"))
const TestCasePage = lazy(() => import("@/pages/test-cases/TestCasePage"))
const RequirementTestingPage = lazy(() => import("@/pages/requirement-testing/RequirementTestingPage"))
const ModulePage = lazy(() => import("@/pages/module/ModulePage"))
const DetailPage = lazy(() => import("@/pages/module/DetailPage"))
const AiAutomationHub = lazy(() => import("@/pages/ai-automation/AiAutomationHub"))
const AiTestTypeDetail = lazy(() => import("@/pages/ai-automation/AiTestTypeDetail"))
const UserManagementPage = lazy(() => import("@/pages/user-management/UserManagementPage"))
const DefectManagementPage = lazy(() => import("@/pages/defect-management/DefectManagementPage"))
const ExecutionManagementPage = lazy(() => import("@/pages/execution-management/ExecutionManagementPage"))
const ReportManagementPage = lazy(() => import("@/pages/report-management/ReportManagementPage"))
const SystemManagementPage = lazy(() => import("@/pages/system-management/SystemManagementPage"))
const MCPMarketplacePage = lazy(() => import("@/pages/mcp-marketplace/MCPMarketplacePage"))
const AiWebAutomationPage = lazy(() => import("@/pages/ai-web-automation/AiWebAutomationPage"))
const KnowledgeBasePage = lazy(() => import("@/pages/knowledge-base/KnowledgeBasePage"))
const WorkflowEditorPage = lazy(() => import("@/pages/workflow-editor/WorkflowEditorPage"))

const queryClient = new QueryClient()

function PageLoader() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber" />
        <p className="text-sm text-muted">加载中...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<DashboardPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/ai-automation" element={<AiAutomationHub />} />
            <Route path="/ai-automation/:typeId" element={<AiTestTypeDetail />} />
            <Route path="/requirement-testing" element={<RequirementTestingPage />} />
            <Route path="/test-cases" element={<TestCasePage />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/defects" element={<DefectManagementPage />} />
            <Route path="/executions" element={<ExecutionManagementPage />} />
            <Route path="/reports" element={<ReportManagementPage />} />
            <Route path="/system" element={<SystemManagementPage />} />
            <Route path="/mcp-marketplace" element={<MCPMarketplacePage />} />
            <Route path="/ai-web-automation" element={<AiWebAutomationPage />} />
            <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
            <Route path="/workflow-orchestration" element={<WorkflowEditorPage />} />
            <Route path="/:moduleKey/detail/:id" element={<DetailPage />} />
            <Route path="/:moduleKey" element={<ModulePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <AiAssistant />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  )
}
