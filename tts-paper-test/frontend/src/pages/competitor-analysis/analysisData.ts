/**
 * 平台对标分析 - 静态数据
 *
 * 来源：人工分析（2026-08）本地 TSS 前端/后端实现 vs 竞品 TestHub
 * （官网 https://testhub.aisky.cloud/ · 文档 https://testhub.aisky.cloud/docs/ · 开源 https://github.com/chenjigang4167/testhub_platform）
 * 竞品技术栈：Django 4.2 + DRF + Vue3；playwright 1.57 / selenium 4.15.2 / browser-use / celery / allure
 */

/** 差距级别 */
export type GapLevel = "lead" | "partial" | "gap"

export const GAP_META: Record<GapLevel, { label: string; badge: string; dot: string }> = {
  lead:    { label: "本地领先", badge: "bg-emerald-50 text-emerald-600 border-emerald-200", dot: "bg-emerald-500" },
  partial: { label: "部分实现", badge: "bg-amber/10 text-amber border-amber/30",             dot: "bg-amber" },
  gap:     { label: "重大缺口", badge: "bg-fail/10 text-fail border-fail/20",                dot: "bg-fail" },
}

/** 功能真实性 */
export type TruthStatus = "real" | "partial" | "mock"

export const TRUTH_META: Record<TruthStatus, { label: string; badge: string }> = {
  real:    { label: "真实", badge: "bg-emerald-50 text-emerald-600" },
  partial: { label: "半真", badge: "bg-amber/10 text-amber" },
  mock:    { label: "模拟", badge: "bg-fail/10 text-fail" },
}

export type ModuleKey = "web" | "workflow"

export const MODULE_META: Record<ModuleKey, { label: string; desc: string }> = {
  web:      { label: "AI Web自动化", desc: "视觉驱动网页自动化：探索 → 生成 → 审批 → 执行" },
  workflow: { label: "流程编排",     desc: "DAG 画布编排：引擎任务 / MCP / 知识库 / LLM / 条件分支" },
}

export interface CapabilityRow {
  id: string
  module: ModuleKey
  dimension: string
  competitor: string
  local: string
  gap: GapLevel
  note?: string
}

export interface FeatureTruth {
  id: string
  module: ModuleKey
  feature: string
  status: TruthStatus
  evidence: string
}

export interface ActionItem {
  id: string
  priority: "P0" | "P1" | "P2"
  module: ModuleKey
  title: string
  description: string
  effort: string
  /** 已完成标记 */
  done?: boolean
}

// ── 能力矩阵 ──────────────────────────────────────────────
export const CAPABILITY_MATRIX: CapabilityRow[] = [
  {
    id: "obj-layers", module: "web", dimension: "对象库分层（POM）",
    competitor: "五层 POM：项目 → 集合 → 页面 → 元素 → 用例，另配测试套件（21 张 ui_ 表）",
    local: "四层：项目 → 页面 → 元素 → 用例；无「集合 / 测试套件」层级",
    gap: "gap", note: "缺批量分组与套件级回归入口",
  },
  {
    id: "locator", module: "web", dimension: "元素定位策略",
    competitor: "Selenium 11 种 + Playwright 5 种定位；备用定位器链（backup_locators）；wait_timeout(5s)；force_action；AI 生成定位建议",
    local: "locator_type（css/xpath/text/id/name）+ backup_locators 备用链 + wait_timeout + force_action；AI 探索自动推断",
    gap: "partial", note: "定位策略已补齐，缺 AI 生成定位建议",
  },
  {
    id: "steps", module: "web", dimension: "用例步骤与断言",
    competitor: "10+ 动作（open/click/input/select/assert…）+ 5 种断言，结构化步骤编辑器",
    local: "结构化步骤（action/target/value/locator/assertions）+ 8 种断言类型，执行时逐条校验",
    gap: "partial", note: "结构化步骤与断言已补齐，动作类型待扩展",
  },
  {
    id: "review", module: "web", dimension: "用例审批流",
    competitor: "多人评审：评审模板、检查清单、通知对接",
    local: "单人审批（draft/pending/approved/rejected）",
    gap: "partial",
  },
  {
    id: "engine", module: "web", dimension: "执行引擎",
    competitor: "双引擎 Playwright/Selenium + AI 智能模式（browser-use），后台线程并发执行",
    local: "5 引擎注册表可切换（Mock/Midscene/Playwright MCP/Browser Use/UI-TARS），HTTP 同步执行",
    gap: "partial", note: "引擎注册方向正确，缺双引擎路由与后台化",
  },
  {
    id: "live", module: "web", dimension: "执行实时性",
    competitor: "后台线程执行，执行后查询记录",
    local: "WebSocket 实时进度 + 截图画廊 + 步骤时间线 + 自动播放",
    gap: "lead", note: "本地实时反馈体验更优",
  },
  {
    id: "schedule", module: "web", dimension: "定时任务",
    competitor: "croniter + Celery：CRON / INTERVAL / ONCE 三种触发",
    local: "无定时调度能力",
    gap: "gap",
  },
  {
    id: "notify", module: "web", dimension: "通知集成",
    competitor: "飞书 / 企微 / 钉钉 webhook 通知",
    local: "无",
    gap: "gap",
  },
  {
    id: "env", module: "web", dimension: "环境治理",
    competitor: "浏览器驱动检测与一键安装、AI 模型连通性测试",
    local: "无",
    gap: "gap",
  },
  {
    id: "report", module: "web", dimension: "报告导出",
    competitor: "AI 报告 + PDF 导出 + Allure 集成",
    local: "执行记录 + 截图画廊，无 PDF / Allure",
    gap: "partial",
  },
  {
    id: "skills", module: "web", dimension: "技能库 / AI 资产",
    competitor: "Skills 商店（可发布订阅分享）",
    local: "内置 4 类技能库（选择器/断言/场景/通用），API 优先 + 本地兜底",
    gap: "partial",
  },
  {
    id: "wf-canvas", module: "workflow", dimension: "流程编排画布",
    competitor: "Web 端未公开编排入口（Android 侧有 UI Flow 编排）",
    local: "SVG DAG 画布：节点/边 CRUD、画布全量保存、节点级执行记录",
    gap: "lead", note: "本地画布能力优于竞品公开形态",
  },
  {
    id: "wf-nodes", module: "workflow", dimension: "编排节点真实度",
    competitor: "平台级调度（细节未公开）",
    local: "engine_task→探索真实调用；mcp_tool / knowledge_query / llm_chat / script 4 类返回 (mock)；condition 仅判字符串 == \"true\"",
    gap: "gap",
  },
  {
    id: "wf-trigger", module: "workflow", dimension: "编排调度",
    competitor: "定时任务平台化（CRON/celery）",
    local: "仅手动触发，HTTP 请求内同步阻塞执行",
    gap: "gap",
  },
]

// ── 前端功能真实性清单 ────────────────────────────────────
export const FEATURE_TRUTH: FeatureTruth[] = [
  // Web 自动化
  { id: "w1", module: "web", feature: "项目管理（列表/创建/删除/批量删除）", status: "real", evidence: "ProjectList → webApi.listProjects / createProject / deleteProject" },
  { id: "w2", module: "web", feature: "项目编辑保存", status: "partial", evidence: "提示「更新成功」但 api.ts 无 updateProject，不发请求" },
  { id: "w3", module: "web", feature: "AI 探索（SSE 流式）", status: "real", evidence: "AiExploration → exploreSSE + AbortController 中止" },
  { id: "w4", module: "web", feature: "AI 用例生成 + 审批", status: "real", evidence: "TestCaseManager → generateTestCasesSSE / approve / reject（真实 LLM）" },
  { id: "w5", module: "web", feature: "对象库（页面/元素 CRUD）", status: "real", evidence: "ObjectRepository → webApi 对象库接口，探索自动同步" },
  { id: "w6", module: "web", feature: "测试执行（REST + WebSocket）", status: "real", evidence: "ExecutionView → execute + ws/automation 实时进度" },
  { id: "w7", module: "web", feature: "引擎切换", status: "real", evidence: "EngineSelector → lifecycleApi.getEngineList / switchEngine" },
  { id: "w8", module: "web", feature: "技能库", status: "real", evidence: "TestSkillLibrary → configApi.listSkills，失败降级内置 PRESET" },
  { id: "w9", module: "web", feature: "一键全流程流水线", status: "real", evidence: "FlowChart → handleStartPipeline 真实调用 exploreSSE / generateTestCasesSSE / execute" },
  { id: "w10", module: "web", feature: "AI 智能体面板", status: "real", evidence: "AiAgentPanel 真实串接：项目选择 → exploreSSE → generateTestCasesSSE → execute → 报告" },
  // 流程编排
  { id: "wf1", module: "workflow", feature: "工作流 / 画布 CRUD", status: "real", evidence: "workflowApi：workflows、canvas、nodes、edges 全量真实" },
  { id: "wf2", module: "workflow", feature: "拓扑排序执行 + 执行记录", status: "real", evidence: "workflow_engine：_topological_sort + WorkflowNodeExecution" },
  { id: "wf3", module: "workflow", feature: "engine_task 节点", status: "real", evidence: "_execute_engine_task → ExecutionEngine.explore 真实探索（仅 explore 动作）" },
  { id: "wf4", module: "workflow", feature: "delay 节点", status: "real", evidence: "_execute_delay → asyncio.sleep" },
  { id: "wf5", module: "workflow", feature: "MCP / 知识库 / LLM / 脚本节点", status: "mock", evidence: "4 类全部返回固定 (mock) / 空结果" },
  { id: "wf6", module: "workflow", feature: "condition 条件分支", status: "mock", evidence: "仅比较 expression 字符串是否等于 \"true\"，变量/表达式求值无效" },
  { id: "wf7", module: "workflow", feature: "并行执行与定时触发", status: "mock", evidence: "串行拓扑执行；仅手动触发，无调度器" },
]

// ── 行动建议 ──────────────────────────────────────────────
export const ACTION_PLAN: ActionItem[] = [
  {
    id: "a1", priority: "P0", module: "web",
    title: "元素定位策略体系",
    description: "WebUIElement 增加 locator_type（css/xpath/text/…）+ backup_locators 备用链 + wait_timeout + force_action；执行引擎按策略解析并逐级回退，AI 探索时自动生成定位建议",
    effort: "后端模型+执行器改造，约 2~3 天",
    done: true,
  },
  {
    id: "a2", priority: "P0", module: "web",
    title: "结构化用例步骤与断言",
    description: "steps 改为结构化 [{action, element, params, assertion}]：支持 10+ 动作（open/click/input/select/assert_text/assert_visible…），执行时实际校验 expected_result 与断言并落库",
    effort: "模型 + 执行引擎，约 2 天",
    done: true,
  },
  {
    id: "a3", priority: "P0", module: "web",
    title: "一键流水线接入真实后端",
    description: "参照 test-management 的 PipelinePage SSE 机制（startPipelineSSE），将 FlowChart 的 sleep 串联替换为真实探索→生成→执行事件流",
    effort: "前端为主，约 1 天",
    done: true,
  },
  {
    id: "a4", priority: "P1", module: "web",
    title: "测试套件 / 集合层级",
    description: "引入套件概念（用例分组 + 批量执行 + 回归入口），补上 POM 缺失的两层",
    effort: "模型 + 对象库 UI，约 2 天",
  },
  {
    id: "a5", priority: "P1", module: "web",
    title: "定时任务 + 通知",
    description: "调度器支持 CRON/INTERVAL/ONCE（可复用测试管理 schedules 模块模式），执行结果推送飞书/企微/钉钉 webhook",
    effort: "后端为主，约 2 天",
  },
  {
    id: "a6", priority: "P1", module: "web",
    title: "AI 智能体面板接通后端",
    description: "AiAgentPanel 从静态演示改为真实串接：意图解析 → 探索 → 生成 → 执行（复用 webApi），移除硬编码与随机数",
    effort: "前端为主，约 1 天",
    done: true,
  },
  {
    id: "a7", priority: "P2", module: "web",
    title: "报告导出与环境治理",
    description: "AI 报告 PDF 导出（可复用 ai_report_service）+ Allure 兼容；浏览器驱动检测/一键安装、AI 模型连通性自检",
    effort: "后端，约 2 天",
  },
  {
    id: "a8", priority: "P2", module: "workflow",
    title: "编排节点真实化",
    description: "mcp_tool → mcp_marketplace 服务；knowledge_query → knowledge_service；llm_chat → ai_chat；script → 沙箱执行；condition 支持变量/表达式求值",
    effort: "后端 workflow_engine，约 3 天",
  },
  {
    id: "a9", priority: "P2", module: "workflow",
    title: "编排调度与并行",
    description: "执行改后台任务（避免 HTTP 同步阻塞），支持并行分支 + 定时触发，执行记录补齐轮询/订阅",
    effort: "后端 + 前端执行面板，约 3 天",
  },
]

/** 概览统计（供头部卡片使用） */
export interface OverviewStats {
  total: number
  lead: number
  partial: number
  gap: number
  mockFeatures: number
  realFeatures: number
}

export function buildOverview(modules?: ModuleKey[]): OverviewStats {
  const rows = CAPABILITY_MATRIX.filter(r => !modules || modules.includes(r.module))
  const features = FEATURE_TRUTH.filter(f => !modules || modules.includes(f.module))
  return {
    total: rows.length,
    lead: rows.filter(r => r.gap === "lead").length,
    partial: rows.filter(r => r.gap === "partial").length,
    gap: rows.filter(r => r.gap === "gap").length,
    mockFeatures: features.filter(f => f.status === "mock").length,
    realFeatures: features.filter(f => f.status === "real").length,
  }
}
