/**
 * API 类型定义
 * 为 lib/api.ts 中的接口提供类型约束，逐步消除 any
 */

// ============================
// 通用类型
// ============================

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

/** 通用 API 响应 */
export interface ApiResponse<T> {
  data: T
  message?: string
}

// ============================
// 认证相关
// ============================

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: UserProfile
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  confirm_password: string
  display_name?: string
}

export interface UserProfile {
  id: number
  username: string
  email: string
  display_name?: string
  role?: string
  avatar?: string
}

// ============================
// 项目与版本
// ============================

export interface Project {
  id: number
  name: string
  description?: string
  status?: string
  created_at?: string
  updated_at?: string
}

export interface Version {
  id: number
  project_id: number
  name: string
  description?: string
  status?: string
  created_at?: string
}

// ============================
// Pipeline 核心类型
// ============================

/** Pipeline 步骤类型 */
export type PipelineStepKey =
  | "analyze"
  | "plan"
  | "point"
  | "case"
  | "review"

/** Pipeline 步骤状态 */
export type PipelineStepStatus = "pending" | "running" | "completed" | "failed"

/** Pipeline 记录状态 */
export type PipelineRecordStatus = "success" | "failed" | "running" | "partial"

/** 单个步骤的后端返回结果 */
export interface StageResult {
  stage: PipelineStepKey
  key?: PipelineStepKey
  label?: string
  status: PipelineStepStatus
  content?: string
  result?: Record<string, unknown>
  duration?: number
  error?: string
}

/** Pipeline 记录（后端返回） */
export interface PipelineRecord {
  id: number | string
  name?: string
  requirement?: string
  requirement_name?: string
  requirement_content?: string
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  current_stage?: string
  status: PipelineRecordStatus
  started_at?: string
  completed_at?: string
  created_at?: string
  updated_at?: string
  stage_results?: StageResult[]
  total_duration?: number
}

/** Pipeline 启动请求 */
export interface PipelineStartRequest {
  requirement_content: string
  requirement_name?: string
  project_id?: number
  version_id?: number
  resume_from?: string
  record_id?: number
}

/** Pipeline SSE 事件类型 */
export type PipelineSSEEventType =
  | "stage_start"
  | "stage_output"
  | "stage_log"
  | "stage_complete"
  | "pipeline_complete"
  | "error"

/** Pipeline SSE 事件数据 */
export interface PipelineSSEEvent {
  type: PipelineSSEEventType
  stage?: PipelineStepKey
  content?: string
  message?: string
  error?: string
  duration?: number
  result?: Record<string, unknown>
}

// ============================
// 测试生命周期
// ============================

export interface Requirement {
  id: number
  name: string
  content?: string
  status?: string
  project_id?: number
  version_id?: number
  created_at?: string
  updated_at?: string
}

export interface TestPlan {
  id: number
  requirement_id?: number
  name: string
  description?: string
  status?: string
  created_at?: string
}

export interface TestPoint {
  id: number
  requirement_id?: number
  name: string
  description?: string
  type?: string
  priority?: string
  created_at?: string
}

export interface TestCase {
  id: number
  requirement_id?: number
  name: string
  description?: string
  preconditions?: string
  steps?: string
  expected_result?: string
  priority?: string
  status?: string
  type?: string
  created_at?: string
}

export interface Review {
  id: number
  requirement_id?: number
  test_case_id?: number
  status?: string
  comment?: string
  reviewer?: string
  created_at?: string
}

export interface TestExecution {
  id: number
  requirement_id?: number
  name: string
  status?: string
  started_at?: string
  completed_at?: string
  result?: string
}

export interface Defect {
  id: number
  title: string
  description?: string
  severity?: string
  priority?: string
  status?: string
  assignee?: string
  created_at?: string
}

export interface TestReport {
  id: number
  name: string
  content?: string
  report_type?: string
  status?: string
  created_at?: string
}

// ============================
// 配置管理
// ============================

export interface Environment {
  id: number
  name: string
  url?: string
  type?: string
  status?: string
  health_status?: string
}

export interface LLMProvider {
  id: number
  name: string
  provider: string
  model?: string
  api_key?: string
  base_url?: string
  status?: string
}

export interface PromptConfig {
  id: number
  name: string
  content?: string
  variables?: string[]
  status?: string
}

export interface StepPromptConfig {
  id: number
  step_key: string
  name: string
  template?: string
  variables?: string[]
  is_default?: boolean
}

export interface MCPServer {
  id: number
  name: string
  url?: string
  type?: string
  status?: string
  config?: Record<string, unknown>
}

export interface Skill {
  id: number
  name: string
  description?: string
  type?: string
  status?: string
  config?: Record<string, unknown>
}

// ============================
// 工作流
// ============================

export interface WorkflowNode {
  id: number
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface WorkflowEdge {
  id: number
  source_node_id: number
  target_node_id: number
  label?: string
}

export interface Workflow {
  id: number
  name: string
  description?: string
  tags?: string[]
  nodes?: WorkflowNode[]
  edges?: WorkflowEdge[]
  status?: string
  created_at?: string
}

// ============================
// 知识库
// ============================

export interface TestPattern {
  id: number
  name: string
  description?: string
  pattern?: string
  category?: string
  created_at?: string
}

export interface BugKnowledge {
  id: number
  title: string
  description?: string
  root_cause?: string
  solution?: string
  category?: string
  created_at?: string
}

// ============================
// Web 自动化
// ============================

export interface WebProject {
  id: number
  name: string
  target_url: string
  description?: string
  status?: string
  created_at?: string
}

export interface WebTestCase {
  id: number
  project_id: number
  name: string
  description?: string
  steps?: WebTestCaseStep[]
  status?: string
  created_at?: string
}

export interface WebTestCaseStep {
  action: string
  target?: string
  value?: string
  description?: string
}

// ============================
// API 测试
// ============================

export interface ApiTestProject {
  id: number
  name: string
  base_url: string
  description?: string
  status?: string
  created_at?: string
}

export interface ApiEndpoint {
  id: number
  project_id: number
  name: string
  method: string
  path: string
  description?: string
}

export interface ApiTestCase {
  id: number
  endpoint_id: number
  name: string
  method: string
  url: string
  headers?: Record<string, string>
  body?: unknown
  expected_status?: number
  created_at?: string
}

// ============================
// APP 测试
// ============================

export interface AppDevice {
  id: number
  name: string
  platform: string
  version?: string
  status?: string
}

// ============================
// 数据工厂
// ============================

export interface DataGenerator {
  name: string
  description?: string
  fields?: DataGeneratorField[]
}

export interface DataGeneratorField {
  name: string
  type: string
  options?: Record<string, unknown>
}

// ============================
// 更多配置类型
// ============================

export interface DeAIStyle {
  id: number
  name: string
  description?: string
  style_config?: Record<string, unknown>
  status?: string
}

export interface HermesChannel {
  id: number
  name: string
  type?: string
  channel_id?: string
  status?: string
  config?: Record<string, unknown>
}

export interface Schedule {
  id: number
  name: string
  cron?: string
  pipeline_config?: Record<string, unknown>
  status?: string
}

export interface MCPMarketplaceService {
  marketplace_id: string
  name?: string
  url?: string
  config?: Record<string, unknown>
}

// ============================
// 工作流执行
// ============================

export interface WorkflowExecution {
  id: number
  workflow_id: number
  status?: string
  started_at?: string
  completed_at?: string
  result?: Record<string, unknown>
}
