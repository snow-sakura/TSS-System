import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { Loader2 } from "lucide-react"

import LoginPage from "@/pages/auth/LoginPage"
import RegisterPage from "@/pages/auth/RegisterPage"
import DashboardPage from "@/pages/dashboard/DashboardPage"
import AiAssistant from "@/components/ai-assistant/AiAssistant"
import ConfirmDialog from "@/components/ui/ConfirmDialog"

// 懒加载页面组件（按路由分割代码）
const ActivitiesPage = lazy(() => import("@/pages/dashboard/ActivitiesPage"))
const TestCasePage = lazy(() => import("@/pages/test-cases/TestCasePage"))
const RequirementTestingPage = lazy(() => import("@/pages/requirement-testing/RequirementTestingPage"))
const ModulePage = lazy(() => import("@/pages/module/ModulePage"))
const DetailPage = lazy(() => import("@/pages/module/DetailPage"))
const AiAutomationHub = lazy(() => import("@/pages/ai-automation/AiAutomationHub"))
const AiTestTypeDetail = lazy(() => import("@/pages/ai-automation/AiTestTypeDetail"))
const DataFactoryPage = lazy(() => import("@/pages/data-factory/DataFactoryPage"))
const UserManagementPage = lazy(() => import("@/pages/user-management/UserManagementPage"))
const DefectManagementPage = lazy(() => import("@/pages/defect-management/DefectManagementPage"))
const ExecutionManagementPage = lazy(() => import("@/pages/execution-management/ExecutionManagementPage"))
const ReportManagementPage = lazy(() => import("@/pages/report-management/ReportManagementPage"))
const MCPMarketplacePage = lazy(() => import("@/pages/mcp-marketplace/MCPMarketplacePage"))
const AiWebAutomationPage = lazy(() => import("@/pages/ai-web-automation/AiWebAutomationPage"))
const KnowledgeBasePage = lazy(() => import("@/pages/knowledge-base/KnowledgeBasePage"))
const WorkflowEditorPage = lazy(() => import("@/pages/workflow-editor/WorkflowEditorPage"))

// 新的测试管理模块（带侧边栏布局）
const TestManagementLayout = lazy(() => import("@/pages/test-management/TestManagementLayout"))
const RequirementsPage = lazy(() => import("@/pages/test-management/requirements/RequirementsPage"))
const PlansPage = lazy(() => import("@/pages/test-management/plans/PlansPage"))
const PointsPage = lazy(() => import("@/pages/test-management/points/PointsPage"))
const CasesPage = lazy(() => import("@/pages/test-management/cases/CasesPage"))
const CaseDetailPage = lazy(() => import("@/pages/test-management/cases/CaseDetailPage"))
const ReviewsPage = lazy(() => import("@/pages/test-management/reviews/ReviewsPage"))
const ExecutionsPage = lazy(() => import("@/pages/test-management/executions/ExecutionsPage"))
const SchedulesPage = lazy(() => import("@/pages/test-management/schedules/SchedulesPage"))
const DefectsPage = lazy(() => import("@/pages/test-management/defects/DefectsPage"))
const KanbanPage = lazy(() => import("@/pages/test-management/kanban/KanbanPage"))
const RootCausePage = lazy(() => import("@/pages/test-management/root-cause/RootCausePage"))
const TrendPage = lazy(() => import("@/pages/test-management/trend/TrendPage"))
const ReportsPage = lazy(() => import("@/pages/test-management/reports/ReportsPage"))
const AIReportPage = lazy(() => import("@/pages/test-management/ai-report/AIReportPage"))
const QualityPage = lazy(() => import("@/pages/test-management/quality/QualityPage"))
const AIPipeline = lazy(() => import("@/pages/requirement-testing/pages/AIPipeline"))
const PipelinePage = lazy(() => import("@/pages/test-management/pipeline/PipelinePage"))
const PipelineRecordsPage = lazy(() => import("@/pages/test-management/pipeline/PipelineRecordsPage"))
const StepPromptConfigPage = lazy(() => import("@/pages/test-management/StepPromptConfigPage"))
const TestUserManagementPage = lazy(() => import("@/pages/test-management/UserManagementPage"))
const TestRoleManagementPage = lazy(() => import("@/pages/test-management/RoleManagementPage"))
const ProjectManagementPage = lazy(() => import("@/pages/test-management/ProjectManagementPage"))
const VersionManagementPage = lazy(() => import("@/pages/test-management/VersionManagementPage"))
const CompetitorAnalysisPage = lazy(() => import("@/pages/competitor-analysis/CompetitorAnalysisPage"))

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
            <Route path="/data-factory" element={<DataFactoryPage />} />
            <Route path="/requirement-testing" element={<RequirementTestingPage />} />
            <Route path="/test-cases" element={<TestCasePage />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/defects" element={<DefectManagementPage />} />
            <Route path="/executions" element={<ExecutionManagementPage />} />
            <Route path="/reports" element={<ReportManagementPage />} />
            <Route path="/mcp-marketplace" element={<MCPMarketplacePage />} />
            <Route path="/ai-web-automation" element={<AiWebAutomationPage />} />
            <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
            <Route path="/workflow-orchestration" element={<WorkflowEditorPage />} />
            <Route path="/test-management" element={<TestManagementLayout />}>
              <Route index element={<Navigate to="/test-management/requirements" replace />} />
              {/* 需求测试 */}
              <Route path="requirements" element={<RequirementsPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="points" element={<PointsPage />} />
              <Route path="cases" element={<CasesPage />} />
              {/* 用例详情：嵌套在模块布局内渲染（左右布局壳不变，对标竞品 TestHub） */}
              <Route path="cases/:id" element={<CaseDetailPage />} />
              <Route path="reviews" element={<ReviewsPage />} />
              {/* 执行管理 */}
              <Route path="executions" element={<ExecutionsPage />} />
              <Route path="schedules" element={<SchedulesPage />} />
              {/* 缺陷管理 */}
              <Route path="defects" element={<DefectsPage />} />
              <Route path="kanban" element={<KanbanPage />} />
              <Route path="root-cause" element={<RootCausePage />} />
              <Route path="trend" element={<TrendPage />} />
              {/* 分析报告 */}
              <Route path="reports" element={<ReportsPage />} />
              <Route path="ai-report" element={<AIReportPage />} />
              <Route path="quality" element={<QualityPage />} />
              {/* 平台对标分析 */}
              <Route path="comparison" element={<CompetitorAnalysisPage />} />
              {/* AI全流程（新版页内3Tab：流程/生成记录/步骤提示词） */}
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="records" element={<PipelineRecordsPage />} />
              {/* 基础配置 */}
              <Route path="project-management" element={<ProjectManagementPage />} />
              <Route path="version-management" element={<VersionManagementPage />} />
              <Route path="step-config" element={<StepPromptConfigPage />} />
              {/* 系统管理 */}
              <Route path="user-management" element={<TestUserManagementPage />} />
              <Route path="role-management" element={<TestRoleManagementPage />} />
            </Route>
            {/* 通用详情页（旧模块体系，保留） */}
            <Route path="/:moduleKey/detail/:id" element={<DetailPage />} />
            <Route path="/:moduleKey" element={<ModulePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <AiAssistant />
      <ConfirmDialog />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  )
}
