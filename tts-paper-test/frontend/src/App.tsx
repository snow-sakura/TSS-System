import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"

import LoginPage from "@/pages/auth/LoginPage"
import RegisterPage from "@/pages/auth/RegisterPage"
import DashboardPage from "@/pages/dashboard/DashboardPage"
import ActivitiesPage from "@/pages/dashboard/ActivitiesPage"
import TestLifecyclePage from "@/pages/test-lifecycle/TestLifecyclePage"
import RequirementTestingPage from "@/pages/requirement-testing/RequirementTestingPage"
import ModulePage from "@/pages/module/ModulePage"
import DetailPage from "@/pages/module/DetailPage"
import AiAutomationPage from "@/pages/module/AiAutomationPage"
import UserManagementPage from "@/pages/user-management/UserManagementPage"
import DefectManagementPage from "@/pages/defect-management/DefectManagementPage"
import ExecutionManagementPage from "@/pages/execution-management/ExecutionManagementPage"
import ReportManagementPage from "@/pages/report-management/ReportManagementPage"
import SystemManagementPage from "@/pages/system-management/SystemManagementPage"
import AiAssistant from "@/components/ai-assistant/AiAssistant"
import EnvironmentPage from "@/pages/config-standalone/EnvironmentPage"
import LLMPage from "@/pages/config-standalone/LLMPage"
import PromptPage from "@/pages/config-standalone/PromptPage"
import DeAIPage from "@/pages/config-standalone/DeAIPage"
import MCPPage from "@/pages/config-standalone/MCPPage"
import MCPMarketplacePage from "@/pages/mcp-marketplace/MCPMarketplacePage"
import SkillsPage from "@/pages/config-standalone/SkillsPage"
import HermesPage from "@/pages/config-standalone/HermesPage"
import OperationLogsPage from "@/pages/config-standalone/OperationLogsPage"
import AiWebAutomationPage from "@/pages/ai-web-automation/AiWebAutomationPage"
import KnowledgeBasePage from "@/pages/knowledge-base/KnowledgeBasePage"
import WorkflowEditorPage from "@/pages/workflow-editor/WorkflowEditorPage"

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          {/* AI自动化页面 */}
          <Route path="/ai-automation" element={<AiAutomationPage />} />
          {/* 需求测试 - 全流程自动化详情页 */}
          <Route path="/requirement-testing" element={<RequirementTestingPage />} />
          {/* 测试管理 - 全生命周期流水线页面 */}
          <Route path="/test-lifecycle" element={<TestLifecyclePage />} />
          {/* 用户管理 - 独立页面 */}
          <Route path="/users" element={<UserManagementPage />} />
          {/* 缺陷管理 - 独立页面 */}
          <Route path="/defects" element={<DefectManagementPage />} />
          {/* 执行管理 - 独立页面 */}
          <Route path="/executions" element={<ExecutionManagementPage />} />
          {/* 分析报告 - 独立页面 */}
          <Route path="/reports" element={<ReportManagementPage />} />
          {/* 系统管理 - 独立页面 */}
          <Route path="/system" element={<SystemManagementPage />} />
          {/* 基础配置 - 独立页面（从首页卡片直接进入） */}
          <Route path="/environments" element={<EnvironmentPage />} />
          <Route path="/llm" element={<LLMPage />} />
          <Route path="/prompts" element={<PromptPage />} />
          <Route path="/de-ai" element={<DeAIPage />} />
          <Route path="/mcp" element={<MCPPage />} />
          <Route path="/mcp-marketplace" element={<MCPMarketplacePage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/hermes" element={<HermesPage />} />
          <Route path="/operation-logs" element={<OperationLogsPage />} />
          {/* AI Web自动化 - 独立页面 */}
          <Route path="/ai-web-automation" element={<AiWebAutomationPage />} />
          {/* 知识库 - 独立页面 */}
          <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
          {/* 流程编排 - 独立页面 */}
          <Route path="/workflow-orchestration" element={<WorkflowEditorPage />} />
          {/* 通用模块页面 (AI自动化/知识库等) */}
          <Route path="/:moduleKey/detail/:id" element={<DetailPage />} />
          <Route path="/:moduleKey" element={<ModulePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <AiAssistant />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  )
}
