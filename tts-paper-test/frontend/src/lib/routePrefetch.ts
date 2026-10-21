/**
 * 路由预加载工具
 * 
 * 在鼠标 hover 导航菜单项时，提前触发目标路由的动态 import()。
 * React.lazy() 返回的 Promise 会被浏览器缓存，用户点击时模块已就绪。
 * 
 * 使用方式：
 *   onMouseEnter={() => prefetchRoute("/test-management/plans")}
 *   onMouseLeave={() => cancelPrefetch()}
 */

type ImportFn = () => Promise<{ default: React.ComponentType }>

// 路由路径 → 动态 import 函数的映射（与 App.tsx lazy() 一一对应）
const importMap: Record<string, ImportFn> = {
  // 测试管理子路由（最高频使用）
  "/test-management/requirements":  () => import("@/pages/test-management/requirements/RequirementsPage"),
  "/test-management/plans":         () => import("@/pages/test-management/plans/PlansPage"),
  "/test-management/points":        () => import("@/pages/test-management/points/PointsPage"),
  "/test-management/cases":         () => import("@/pages/test-management/cases/CasesPage"),
  "/test-management/reviews":       () => import("@/pages/test-management/reviews/ReviewsPage"),
  "/test-management/executions":    () => import("@/pages/test-management/executions/ExecutionsPage"),
  "/test-management/schedules":     () => import("@/pages/test-management/schedules/SchedulesPage"),
  "/test-management/defects":       () => import("@/pages/test-management/defects/DefectsPage"),
  "/test-management/kanban":        () => import("@/pages/test-management/kanban/KanbanPage"),
  "/test-management/root-cause":    () => import("@/pages/test-management/root-cause/RootCausePage"),
  "/test-management/trend":         () => import("@/pages/test-management/trend/TrendPage"),
  "/test-management/reports":       () => import("@/pages/test-management/reports/ReportsPage"),
  "/test-management/ai-report":     () => import("@/pages/test-management/ai-report/AIReportPage"),
  "/test-management/quality":       () => import("@/pages/test-management/quality/QualityPage"),
  "/test-management/comparison":    () => import("@/pages/competitor-analysis/CompetitorAnalysisPage"),
  "/test-management/pipeline":      () => import("@/pages/test-management/pipeline/PipelinePage"),
  "/test-management/records":       () => import("@/pages/test-management/pipeline/PipelineRecordsPage"),
  "/test-management/project-management":  () => import("@/pages/test-management/ProjectManagementPage"),
  "/test-management/version-management":  () => import("@/pages/test-management/VersionManagementPage"),
  "/test-management/step-config":         () => import("@/pages/test-management/StepPromptConfigPage"),
  "/test-management/user-management":     () => import("@/pages/test-management/UserManagementPage"),
  "/test-management/role-management":     () => import("@/pages/test-management/RoleManagementPage"),
  // 旧版页面
  "/activities":           () => import("@/pages/dashboard/ActivitiesPage"),
  "/ai-automation":        () => import("@/pages/ai-automation/AiAutomationHub"),
  "/data-factory":         () => import("@/pages/data-factory/DataFactoryPage"),
  "/requirement-testing":  () => import("@/pages/requirement-testing/RequirementTestingPage"),
  "/test-cases":           () => import("@/pages/test-cases/TestCasePage"),
  "/users":                () => import("@/pages/user-management/UserManagementPage"),
  "/defects":              () => import("@/pages/defect-management/DefectManagementPage"),
  "/executions":           () => import("@/pages/execution-management/ExecutionManagementPage"),
  "/reports":              () => import("@/pages/report-management/ReportManagementPage"),
  "/mcp-marketplace":      () => import("@/pages/mcp-marketplace/MCPMarketplacePage"),
  "/ai-web-automation":    () => import("@/pages/ai-web-automation/AiWebAutomationPage"),
  "/knowledge-base":       () => import("@/pages/knowledge-base/KnowledgeBasePage"),
  "/workflow-orchestration": () => import("@/pages/workflow-editor/WorkflowEditorPage"),
}

// 当前正在预加载的 timer（去重 + 取消）
let inflight: ReturnType<typeof setTimeout> | null = null

/**
 * 触发路由预加载（绑定到 onMouseEnter）
 * 延迟 100ms 避免快速划过时的无效加载
 */
export function prefetchRoute(path: string): void {
  cancelPrefetch()
  inflight = setTimeout(() => {
    const importer = importMap[path]
    if (importer) {
      importer().catch(() => { /* 静默吞错 */ })
    }
  }, 100)
}

/**
 * 取消正在进行的预加载（绑定到 onMouseLeave）
 */
export function cancelPrefetch(): void {
  if (inflight !== null) {
    clearTimeout(inflight)
    inflight = null
  }
}
