// ============================================================
// TSS AI测试平台 — TypeScript 类型定义
// ============================================================

// 用户
export interface User {
  id: string
  username: string
  email: string
  display_name: string
  avatar_url?: string
  role: 'admin' | 'test_manager' | 'test_engineer' | 'viewer'
  status: 'active' | 'inactive' | 'locked'
  created_at: string
  last_login_at?: string
}

// 登录/注册
export interface LoginRequest {
  username: string
  password: string
  captcha_token?: string
  captcha_answer?: number
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  confirm_password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface CaptchaResponse {
  question: string
  token: string
  captcha_svg?: string
}

// 需求
export interface Requirement {
  id: string
  title: string
  content: string
  doc_type: string
  status: 'pending' | 'analyzing' | 'analyzed' | 'approved' | 'rejected'
  ai_analysis?: any
  version: number
  test_points_count: number
  created_by?: string
  approved_by?: string
  created_at: string
  updated_at: string
}

// 测试点
export interface TestPoint {
  id: string
  requirement_id: string
  title: string
  description?: string
  type: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  category?: string
  status: 'draft' | 'active' | 'covered' | 'obsolete'
  ai_generated: boolean
  created_at: string
}

// 测试方案
export interface TestPlan {
  id: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'completed' | 'archived'
  ai_suggestion?: any
  requirement_ids: string[]
  test_point_ids: string[]
  created_at: string
}

// 测试用例
export interface TestCase {
  id: string
  plan_id?: string
  test_point_id?: string
  title: string
  precondition?: string
  steps: TestStep[]
  expected_result: string
  actual_result?: string
  status: 'draft' | 'approved' | 'failed' | 'passed' | 'blocked'
  priority: 'p0' | 'p1' | 'p2' | 'p3'
  type: string
  ai_generated: boolean
  reviewed_by?: string
  confirmed_by?: string
  created_at: string
}

export interface TestStep {
  step: number
  action: string
  expected?: string
}

// 缺陷
export interface Defect {
  id: string
  title: string
  description: string
  severity: 'critical' | 'major' | 'minor' | 'trivial'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  status: 'new' | 'confirmed' | 'in_progress' | 'resolved' | 'closed'
  root_cause?: string
  solution?: string
  test_case_id?: string
  ai_analysis?: any
  assigned_to?: string
  created_at: string
}

// 通用
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface ModuleCard {
  id: string
  name: string
  description: string
  icon: string
  category: string
  path: string
  count?: number
  status?: 'active' | 'coming_soon'
}

// 操作日志
export interface OperationLog {
  id: string
  user_id?: string
  username?: string
  action: string
  resource_type: string
  resource_id?: string
  details?: any
  ip_address?: string
  created_at: string
}

// AI生成记录
export interface AIGeneration {
  id: string
  agent_type: string
  resource_type: string
  resource_id?: string
  input_data: any
  output_data: any
  status: 'draft' | 'reviewed' | 'confirmed' | 'rejected'
  reviewed_by?: string
  confirmed_by?: string
  model_used: string
  token_usage?: any
  created_at: string
}
