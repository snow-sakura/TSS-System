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
  /** 账号状态（active/inactive），也可作为更新请求字段 */
  status?: string
  /** 创建用户时的初始密码（仅请求方向） */
  password?: string
  /** 重置密码标志（仅更新请求方向） */
  reset_password?: boolean
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

/** Pipeline 记录状态（兼容历史数据中的 completed） */
export type PipelineRecordStatus = "success" | "completed" | "failed" | "running" | "partial"

/** 单个步骤的后端返回结果 */
export interface StageResult {
  stage: PipelineStepKey
  key?: PipelineStepKey
  label?: string
  description?: string
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

/** 用例步骤（后端 steps 为 JSON 数组，也兼容纯文本） */
export interface TestCaseStep {
  step: number
  action: string
  expected?: string
}

export interface TestCase {
  id: number
  requirement_id?: number
  name: string
  description?: string
  preconditions?: string
  steps?: string | TestCaseStep[]
  expected_result?: string
  priority?: string
  status?: string
  type?: string
  /** 测试类型：功能/性能/安全（后端 test_type 列） */
  test_type?: string
  tags?: string[]
  project_id?: number
  version_id?: number
  created_at?: string
}

export interface Review {
  id: number
  requirement_id?: number
  test_case_id?: number
  title?: string
  content?: string
  review_type?: string
  status?: string
  source?: string
  comment?: string
  /** 评审意见（后端 Review.comments 列） */
  comments?: string
  summary?: string
  reviewer?: string
  reviewer2?: string
  case_count?: number
  passed_count?: number
  rejected_count?: number
  checklist?: Array<{ id: string; label: string; required?: boolean; passed?: boolean; comment?: string }>
  completed_at?: string
  created_at?: string
}

export interface TestExecution {
  id: number
  requirement_id?: number
  name: string
  status?: string
  /** 测试类型：功能/性能/安全（后端 test_type 列） */
  test_type?: string
  environment?: string
  total_cases?: number
  passed?: number
  failed?: number
  pass_rate?: number
  plan_id?: number
  /** 触发人（后端 triggered_by 列） */
  triggered_by?: string
  started_at?: string
  completed_at?: string
  result?: string
}

export interface Defect {
  id: number
  title: string
  description?: string
  /** 所属模块（后端 Defect.module 列） */
  module?: string
  /** 复现步骤（后端 JSON 列，结构 [{action,expected?}...]） */
  steps_to_reproduce?: Array<Record<string, unknown>> | string
  expected_result?: string
  actual_result?: string
  environment?: string
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

/** 步骤提示词配置（对齐后端 StepPromptConfigBase） */
export interface StepPromptConfig {
  id?: number
  step_key: string
  step_name: string
  step_order?: number
  icon?: string
  description?: string
  system_prompt: string
  user_prompt_template: string
  skill_prompt?: string
  output_template?: string
  skills?: Array<{ name: string; description?: string; content?: string }>
  variables?: Array<{ name: string; type?: string; description?: string; required?: boolean }>
  output_logs_template?: Array<{ content: string; delay_ms?: number }>
  created_at?: string
  updated_at?: string
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
  /** 技能分类：通用/测试/开发/分析（后端 Skill.category 列） */
  category?: string
  /** 版本号（后端 Skill.version 列） */
  version?: string
  /** 技能内容（JSON 配置） */
  content?: Record<string, unknown>
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
