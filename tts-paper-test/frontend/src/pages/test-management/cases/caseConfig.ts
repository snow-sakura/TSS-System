/**
 * 测试用例共享配置
 *
 * 供测试用例列表页（CasesPage）与详情页（CaseDetailPage）复用：
 * - 状态/优先级/类型展示映射
 * - 筛选与表单选项
 * - 表单字段定义（key 与后端 TestCaseResponse / TestCaseUpdate schema 保持一致）
 */
import type { CrudField } from "@/components/crud/CrudDialog"

/** 测试用例接口（与后端 /test-lifecycle/test-cases 返回字段对齐） */
export interface TestCase {
  id: number
  name: string
  module?: string
  description?: string
  preconditions?: string
  steps?: string[] | string
  expected_result?: string
  status: "draft" | "active" | "deprecated" | "approved" | "rejected" | "needs_modification"
  priority: "P0" | "P1" | "P2" | "P3"
  test_type?: string
  tags?: string[]
  reviewed_by?: number
  reviewed_at?: string
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  ai_generated?: boolean
  ai_model?: string
  created_by?: number
  created_at?: string
  updated_at?: string
}

/** 评审状态展示配置 */
export const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "待评审", color: "bg-amber/10 text-amber border border-amber/20" },
  active: { label: "活跃", color: "bg-info/10 text-info border border-info/20" },
  deprecated: { label: "已废弃", color: "bg-fail/10 text-fail border border-fail/20" },
  approved: { label: "已通过", color: "bg-pass/10 text-pass border border-pass/20" },
  rejected: { label: "已驳回", color: "bg-fail/10 text-fail border border-fail/20" },
  needs_modification: { label: "需修改", color: "bg-amber/10 text-amber border border-amber/20" },
}

/** 优先级展示配置 */
export const priorityConfig: Record<string, { label: string; color: string }> = {
  P0: { label: "P0 - 紧急", color: "text-fail font-semibold" },
  P1: { label: "P1 - 高", color: "text-amber font-semibold" },
  P2: { label: "P2 - 中", color: "text-info font-semibold" },
  P3: { label: "P3 - 低", color: "text-muted" },
}

/** 用例类型英文值 → 中文映射 */
export const testTypeConfig: Record<string, string> = {
  functional: "功能",
  performance: "性能",
  security: "安全",
  compatibility: "兼容",
  api: "接口",
  interface: "接口",
}

/** 状态筛选选项 */
export const statusOptions = [
  { label: "待评审", value: "draft" },
  { label: "已通过", value: "approved" },
  { label: "已驳回", value: "rejected" },
  { label: "需修改", value: "needs_modification" },
  { label: "活跃", value: "active" },
  { label: "已废弃", value: "deprecated" },
]

/** 优先级筛选选项 */
export const priorityOptions = [
  { label: "P0 - 紧急", value: "P0" },
  { label: "P1 - 高", value: "P1" },
  { label: "P2 - 中", value: "P2" },
  { label: "P3 - 低", value: "P3" },
]

/** 用例类型选项 */
export const testTypeOptions = [
  { label: "功能", value: "功能" },
  { label: "性能", value: "性能" },
  { label: "安全", value: "安全" },
  { label: "兼容", value: "兼容" },
  { label: "接口", value: "接口" },
]

/**
 * 表单字段定义（新建/编辑弹窗共用）
 * 注意：前置条件字段 key 为 preconditions（与后端 schema 一致）
 */
export const caseFields: CrudField[] = [
  { key: "project_id", label: "项目", type: "select" },
  { key: "version_id", label: "版本", type: "select" },
  { key: "name", label: "用例标题", type: "text", required: true, placeholder: "请输入用例标题" },
  { key: "module", label: "所属模块", type: "text", placeholder: "请输入所属模块" },
  {
    key: "tags",
    label: "标签",
    type: "text",
    array: true,
    placeholder: "多个标签用逗号分隔，如：冒烟,回归,核心流程",
    helpText: "用逗号分隔多个标签（如 冒烟、回归、核心流程）",
  },
  { key: "description", label: "描述", type: "textarea", placeholder: "请输入用例描述" },
  { key: "preconditions", label: "前置条件", type: "textarea", placeholder: "请输入前置条件" },
  { key: "steps", label: "测试步骤", type: "textarea", placeholder: "请输入测试步骤" },
  { key: "expected_result", label: "预期结果", type: "textarea", placeholder: "请输入预期结果" },
  { key: "status", label: "状态", type: "select", options: statusOptions, default: "draft" },
  { key: "priority", label: "优先级", type: "select", options: priorityOptions, default: "P2" },
  { key: "test_type", label: "用例类型", type: "select", options: testTypeOptions },
]
