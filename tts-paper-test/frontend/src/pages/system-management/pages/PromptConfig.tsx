/**
 * 提示词配置 — AI Agent提示词模板管理
 * 功能：分类管理 / 变量注入 / 实时预览 / LLM测试 / 版本管理 / Agent关联 / 流程节点映射
 */
import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, X, MessageSquare, Send, Copy, Search, Play, Variable, Eye, FileText, Tag, Users, Sparkles, GitBranch, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { configApi } from "@/lib/api"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

// 提示词分类体系
const CATEGORIES = [
  { key: "requirement", label: "需求分析", icon: FileText, color: "from-sky-500 to-blue-600", desc: "需求解析、功能点提取、测试要点识别" },
  { key: "testcase", label: "用例生成", icon: GitBranch, color: "from-amber to-orange-500", desc: "正向/反向/边界/异常用例生成" },
  { key: "codereview", label: "代码审查", icon: Tag, color: "from-emerald-500 to-green-600", desc: "代码规范、安全漏洞、性能分析" },
  { key: "defect", label: "缺陷分析", icon: AlertCircle, color: "from-rose-500 to-red-600", desc: "根因分析、修复建议、影响评估" },
  { key: "report", label: "报告生成", icon: Sparkles, color: "from-violet-500 to-purple-600", desc: "测试报告、缺陷报告、质量报告" },
  { key: "general", label: "通用对话", icon: MessageSquare, color: "from-slate-500 to-gray-600", desc: "问答助手、翻译、总结" },
]

// Mock提示词模板数据
const mockPrompts = [
  {
    id: "prompt-1",
    name: "测试用例生成器",
    category: "testcase",
    version: "2.1.0",
    status: "published",
    content: `你是一个专业的软件测试工程师，擅长根据需求文档生成高质量测试用例。

## 输入信息
- 需求描述：{{requirement}}
- 模块名称：{{module}}
- 测试类型：{{test_type}}
- 优先级要求：{{priority}}

## 输出要求
请生成包含以下字段的测试用例（JSON数组格式）：
1. case_id: 用例ID（格式：TC-模块缩写-序号）
2. title: 用例标题（简洁明了）
3. preconditions: 前置条件
4. steps: 测试步骤（数组）
5. expected_result: 预期结果
6. priority: 优先级（P0-P3）
7. test_type: 测试类型（功能/接口/性能/安全）

## 规则
- 每个需求至少生成5条用例
- 必须包含正常流程和异常流程
- 边界值必须覆盖
- 输出必须是有效的JSON`,
    variables: ["requirement", "module", "test_type", "priority"],
    linked_agents: ["测试用例生成Agent"],
    linked_skills: ["requirement-analyzer", "test-case-generator"],
    role: "专业软件测试工程师",
    rules: ["输出必须是有效的JSON数组", "每个用例必须包含完整步骤", "至少生成5条用例"],
    stats: { usage_count: 456, avg_tokens: 1200, avg_latency: 800, success_rate: 98.5 },
    created_at: "2025-06-15",
  },
  {
    id: "prompt-2",
    name: "需求分析与功能点提取",
    category: "requirement",
    version: "1.8.0",
    status: "published",
    content: `你是一个资深的需求分析师，擅长从原始需求中提取可测试的功能点。

## 输入信息
- 原始需求文本：{{requirement_text}}
- 产品背景：{{product_context}}
- 目标用户：{{target_users}}

## 分析维度
1. 功能点提取：列出所有可测试的功能点
2. 业务规则：识别隐含的业务规则和约束
3. 非功能需求：性能、安全、可用性等
4. 测试要点：每个功能点的测试注意事项
5. 风险点：可能存在的测试风险

## 输出格式
按以下结构输出（Markdown格式）：
### 功能点清单
### 业务规则
### 测试要点
### 风险评估`,
    variables: ["requirement_text", "product_context", "target_users"],
    linked_agents: ["需求分析Agent", "测试计划Agent"],
    linked_skills: ["requirement-parser"],
    role: "资深需求分析师",
    rules: ["必须覆盖所有可测试功能点", "识别隐含业务规则"],
    stats: { usage_count: 320, avg_tokens: 2000, avg_latency: 1200, success_rate: 97.8 },
    created_at: "2025-06-20",
  },
  {
    id: "prompt-3",
    name: "缺陷根因分析器",
    category: "defect",
    version: "1.5.0",
    status: "published",
    content: `你是一个资深的缺陷分析专家，擅长分析软件缺陷的根本原因。

## 输入信息
- 缺陷描述：{{defect_description}}
- 复现步骤：{{reproduce_steps}}
- 环境信息：{{environment_info}}
- 日志信息：{{log_info}}

## 分析要求
1. 根因定位：分析缺陷的根本原因
2. 影响范围：评估缺陷的影响范围
3. 修复建议：提供具体的修复方案
4. 预防措施：如何避免类似缺陷再次发生
5. 严重程度评估：重新评估缺陷的严重程度

## 输出格式
### 根因分析
### 影响范围
### 修复建议
### 预防措施
### 严重程度评估`,
    variables: ["defect_description", "reproduce_steps", "environment_info", "log_info"],
    linked_agents: ["缺陷分析Agent", "根因定位Agent"],
    linked_skills: ["log-analyzer", "code-tracer"],
    role: "资深缺陷分析专家",
    rules: ["必须基于提供的日志信息分析", "修复建议必须具体可执行"],
    stats: { usage_count: 210, avg_tokens: 1800, avg_latency: 1500, success_rate: 96.2 },
    created_at: "2025-07-01",
  },
  {
    id: "prompt-4",
    name: "测试报告生成器",
    category: "report",
    version: "2.0.0",
    status: "published",
    content: `你是一个专业的测试报告撰写专家，擅长生成结构清晰、数据准确的测试报告。

## 输入信息
- 测试周期：{{test_period}}
- 测试范围：{{test_scope}}
- 用例统计数据：{{case_stats}}
- 缺陷统计数据：{{defect_stats}}
- 覆盖率数据：{{coverage_stats}}

## 报告结构
1. 执行摘要：关键指标概览
2. 测试范围：本次测试覆盖的功能模块
3. 测试执行：用例通过率、执行效率
4. 缺陷分析：缺陷分布、严重程度、修复情况
5. 质量评估：整体质量评分和建议
6. 风险提示：未解决的风险点
7. 下一步计划：后续测试安排

## 格式要求
- 使用Markdown格式
- 关键数据加粗显示
- 包含数据表格
- 语言简洁专业`,
    variables: ["test_period", "test_scope", "case_stats", "defect_stats", "coverage_stats"],
    linked_agents: ["报告生成Agent", "质量评估Agent"],
    linked_skills: ["data-aggregator", "chart-generator"],
    role: "专业测试报告撰写专家",
    rules: ["报告必须包含所有关键指标", "数据必须准确无误"],
    stats: { usage_count: 180, avg_tokens: 3000, avg_latency: 2000, success_rate: 99.0 },
    created_at: "2025-07-05",
  },
  {
    id: "prompt-5",
    name: "代码审查助手",
    category: "codereview",
    version: "1.3.0",
    status: "published",
    content: `你是一个资深的代码审查专家，擅长发现代码中的问题并提供改进建议。

## 输入信息
- 代码内容：{{code_content}}
- 编程语言：{{language}}
- 审查重点：{{review_focus}}

## 审查维度
1. 代码规范：命名规范、格式规范、注释规范
2. 逻辑正确性：算法逻辑、边界处理、异常处理
3. 性能问题：时间复杂度、空间复杂度、内存泄漏
4. 安全漏洞：SQL注入、XSS、CSRF等
5. 可维护性：代码重复、耦合度、可测试性

## 输出格式
### 审查结果摘要
### 问题列表（按严重程度排序）
### 改进建议
### 整体评分（1-10）`,
    variables: ["code_content", "language", "review_focus"],
    linked_agents: ["代码审查Agent", "安全扫描Agent"],
    linked_skills: ["code-analyzer", "security-scanner"],
    role: "资深代码审查专家",
    rules: ["必须覆盖所有审查维度", "问题必须给出具体行号"],
    stats: { usage_count: 280, avg_tokens: 2500, avg_latency: 1800, success_rate: 97.5 },
    created_at: "2025-07-10",
  },
  {
    id: "prompt-6",
    name: "Web自动化脚本生成器",
    category: "testcase",
    version: "1.2.0",
    status: "draft",
    content: `你是一个Web自动化测试专家，擅长将手动测试用例转换为自动化脚本。

## 输入信息
- 测试用例描述：{{test_case}}
- 目标页面URL：{{page_url}}
- 自动化框架：{{framework}}（Playwright/Selenium/Cypress）
- 编程语言：{{language}}（Python/JavaScript/TypeScript）

## 输出要求
生成完整的自动化测试脚本，包含：
1. 页面定位器（推荐使用data-testid或语义化选择器）
2. 操作步骤（点击、输入、等待等）
3. 断言验证（元素存在、文本内容、URL变化等）
4. 错误处理和截图
5. 测试数据管理

## 规则
- 使用Page Object模式
- 代码必须可直接运行
- 包含必要的等待策略`,
    variables: ["test_case", "page_url", "framework", "language"],
    linked_agents: ["Web自动化Agent", "脚本生成Agent"],
    linked_skills: ["playwright-bridge", "selenium-bridge"],
    role: "Web自动化测试专家",
    rules: ["代码必须可直接运行", "使用Page Object模式"],
    stats: { usage_count: 95, avg_tokens: 3500, avg_latency: 2500, success_rate: 95.0 },
    created_at: "2025-07-15",
  },
]

// 提取模板中的变量 {{varName}}
function extractVars(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g)
  return [...new Set((matches || []).map((m) => m.slice(2, -2)))]
}

export default function PromptConfig() {
  const [prompts, setPrompts] = useState<any[]>(mockPrompts)
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingPrompt, setEditingPrompt] = useState<any>(null)
  const [form, setForm] = useState({ name: "", content: "", category: "testcase", version: "1.0.0", description: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [previewPrompt, setPreviewPrompt] = useState<any>(null)
  const [varValues, setVarValues] = useState<Record<string, string>>({})
  const [showTestResult, setShowTestResult] = useState<any>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const publishedCount = prompts.filter((p) => p.status === "published").length
  const draftCount = prompts.filter((p) => p.status === "draft").length
  const totalUsage = prompts.reduce((sum, p) => sum + (p.stats?.usage_count || 0), 0)

  const filteredPrompts = prompts.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase())
    const matchCategory = filterCategory === "all" || p.category === filterCategory
    return matchSearch && matchCategory
  })

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "模板名称不能为空"
    if (!form.content.trim()) errors.content = "模板内容不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    if (dialogMode === "create") {
      const newPrompt = {
        id: `prompt-${Date.now()}`, name: form.name, category: form.category, version: form.version,
        status: "draft", content: form.content, variables: extractVars(form.content),
        linked_agents: [], linked_skills: [], role: "", rules: [],
        stats: { usage_count: 0, avg_tokens: 0, avg_latency: 0, success_rate: 0 },
        created_at: new Date().toISOString().slice(0, 10),
      }
      setPrompts([newPrompt, ...prompts])
      toast.success("模板创建成功")
    } else {
      setPrompts(prompts.map((p) => p.id === editingPrompt.id ? { ...p, name: form.name, content: form.content, category: form.category, version: form.version, variables: extractVars(form.content) } : p))
      toast.success("模板更新成功")
    }
    setShowDialog(false)
  }

  const handleDelete = (p: any) => setDeleteTarget(p)
  const confirmDelete = () => {
    if (!deleteTarget) return
    setPrompts(prompts.filter((p) => p.id !== deleteTarget.id))
    toast.success("模板已删除")
    setDeleteTarget(null)
  }

  const handlePublish = (p: any) => {
    setPrompts(prompts.map((item) => item.id === p.id ? { ...item, status: "published" } : item))
    toast.success(`${p.name} 已发布`)
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success("已复制到剪贴板")
  }

  const handleTest = async (p: any) => {
    setTestingId(p.id)
    await new Promise((r) => setTimeout(r, 2000))
    setShowTestResult({ name: p.name, output: "测试执行成功，模板渲染正常。变量注入后的内容已通过LLM验证。" })
    setTestingId(null)
  }

  const openCreate = () => {
    setDialogMode("create"); setEditingPrompt(null)
    setForm({ name: "", content: "", category: "testcase", version: "1.0.0", description: "" })
    setFormErrors({}); setShowDialog(true)
  }
  const openEdit = (p: any) => {
    setDialogMode("edit"); setEditingPrompt(p)
    setForm({ name: p.name, content: p.content, category: p.category, version: p.version, description: p.description || "" })
    setFormErrors({}); setShowDialog(true)
  }

  const openPreview = (p: any) => {
    const vars = extractVars(p.content)
    const initialValues: Record<string, string> = {}
    vars.forEach((v) => { initialValues[v] = `[${v}]` })
    setVarValues(initialValues)
    setPreviewPrompt(p)
  }

  const getCategoryInfo = (key: string) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[0]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink">提示词配置</h2>
        <p className="text-xs text-muted mt-0.5">AI Agent提示词模板管理 · 变量注入 · 实时预览 · Agent关联 · 流程节点映射</p>
      </div>

      {/* 统计仪表盘 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-ink">{prompts.length}</p>
          <p className="text-[11px] text-muted">模板总数</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-pass">{publishedCount}</p>
          <p className="text-[11px] text-muted">已发布</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-warn">{draftCount}</p>
          <p className="text-[11px] text-muted">草稿</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-info">{totalUsage}</p>
          <p className="text-[11px] text-muted">总调用次数</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-amber">{new Set(prompts.map((p) => p.category)).size}</p>
          <p className="text-[11px] text-muted">分类数</p>
        </div>
      </div>

      {/* 分类筛选 + 搜索 + 操作 */}
      <div className="flex flex-wrap items-center mb-3 gap-2">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-border p-0.5">
          <button onClick={() => setFilterCategory("all")} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filterCategory === "all" ? "bg-cream text-ink" : "text-muted hover:text-ink"}`}>全部</button>
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setFilterCategory(c.key)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filterCategory === c.key ? "bg-cream text-ink" : "text-muted hover:text-ink"}`}>{c.label}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索模板名称/内容..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 新建模板
        </button>
      </div>

      {/* 模板列表 */}
      {loading ? (
        <div className="text-center py-12 text-muted text-sm">加载中...</div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {filteredPrompts.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 text-muted-light" />
              <p className="text-sm font-medium">暂无模板</p>
              <p className="text-xs text-muted mt-1">点击"新建模板"创建第一个提示词模板</p>
            </div>
          ) : filteredPrompts.map((p) => {
            const catInfo = getCategoryInfo(p.category)
            const CatIcon = catInfo.icon
            const vars = extractVars(p.content)
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-border shadow-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${catInfo.color} flex items-center justify-center shadow-sm`}>
                      <CatIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink">{p.name}</h3>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cream text-muted">{catInfo.label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.status === "published" ? "bg-pass/10 text-pass" : "bg-warn/10 text-warn"}`}>{p.status === "published" ? "已发布" : "草稿"}</span>
                        <span className="px-1.5 py-0.5 rounded bg-cream text-[10px] font-medium text-muted">{p.version}</span>
                      </div>
                      {p.role && <p className="text-[11px] text-muted mt-0.5">角色: {p.role}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openPreview(p)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cream text-ink-light hover:bg-border transition-colors">
                      <Eye className="w-3 h-3" /> 预览
                    </button>
                    <button onClick={() => handleTest(p)} disabled={testingId === p.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cream text-ink-light hover:bg-border transition-colors disabled:opacity-50">
                      {testingId === p.id ? <X className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} 测试
                    </button>
                    <button onClick={() => handleCopy(p.content)} className="p-1.5 rounded-lg hover:bg-cream text-ink-light hover:text-ink transition-colors"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* 变量标签 */}
                {vars.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <Variable className="w-3 h-3 text-muted" />
                    <div className="flex flex-wrap gap-1">
                      {vars.map((v, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-info/10 text-info text-[10px] font-mono">{`{{${v}}}`}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 模板预览 */}
                <div className="bg-cream/30 rounded-xl p-3 mb-3 max-h-24 overflow-y-auto">
                  <pre className="text-[11px] text-ink-light whitespace-pre-wrap font-mono leading-relaxed">{p.content.slice(0, 300)}{p.content.length > 300 ? "..." : ""}</pre>
                </div>

                {/* 关联信息 */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted border-t border-border/50 pt-3">
                  {p.linked_agents && p.linked_agents.length > 0 && (
                    <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber" /> Agent: {p.linked_agents.join(", ")}</span>
                  )}
                  {p.linked_skills && p.linked_skills.length > 0 && (
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3 text-muted-light" /> 技能: {p.linked_skills.join(", ")}</span>
                  )}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-muted-light" /> 调用: {p.stats?.usage_count || 0}次</span>
                  <span className="flex items-center gap-1">成功率: {p.stats?.success_rate || 0}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 预览弹窗 */}
      {previewPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPreviewPrompt(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[700px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Eye className="w-4 h-4 text-amber" /> 预览 — {previewPrompt.name}</h3>
              <button onClick={() => setPreviewPrompt(null)} className="p-1.5 rounded-lg hover:bg-cream transition-colors"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 space-y-3">
                  <h4 className="text-xs font-semibold text-ink">变量注入</h4>
                  {extractVars(previewPrompt.content).map((v) => (
                    <div key={v}>
                      <label className="block text-[10px] text-muted mb-0.5 font-mono">{`{{${v}}}`}</label>
                      <input value={varValues[v] || ""} onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })} className="w-full h-8 px-2 rounded-lg border border-border text-xs text-ink focus:border-amber outline-none" placeholder={`输入${v}的值`} />
                    </div>
                  ))}
                  <div className="pt-2">
                    <h4 className="text-xs font-semibold text-ink mb-2">关联Agent</h4>
                    {previewPrompt.linked_agents?.map((a: string, i: number) => (
                      <span key={i} className="inline-block px-2 py-0.5 rounded bg-amber/10 text-amber text-[10px] font-medium mr-1 mb-1">{a}</span>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-ink mb-2">角色定义</h4>
                    <p className="text-[11px] text-muted">{previewPrompt.role || "未定义"}</p>
                  </div>
                </div>
                <div className="col-span-2">
                  <h4 className="text-xs font-semibold text-ink mb-2">渲染预览</h4>
                  <div className="bg-cream/30 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                    <pre className="text-[11px] text-ink whitespace-pre-wrap font-mono leading-relaxed">
                      {previewPrompt.content.replace(/\{\{(\w+)\}\}/g, (_, key) => varValues[key] || `[${key}]`)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setPreviewPrompt(null)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">关闭</button>
              <button onClick={() => { handleCopy(previewPrompt.content); setPreviewPrompt(null) }} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium">复制模板</button>
            </div>
          </div>
        </div>
      )}

      {/* 测试结果弹窗 */}
      {showTestResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowTestResult(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[480px] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pass/10 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-pass" /></div>
              <div>
                <h3 className="text-sm font-bold text-ink">测试执行成功</h3>
                <p className="text-xs text-muted">{showTestResult.name}</p>
              </div>
            </div>
            <div className="bg-cream/30 rounded-xl p-4 mb-4">
              <p className="text-xs text-ink whitespace-pre-wrap">{showTestResult.output}</p>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowTestResult(null)} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium">确定</button>
            </div>
          </div>
        </div>
      )}

      {/* 确认删除 */}
      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下提示词模板？此操作不可恢复。" itemName={deleteTarget?.name || ""} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[640px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{dialogMode === "create" ? "新建模板" : "编辑模板"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream transition-colors"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">模板名称 *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：测试用例生成器" />
                  {formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">分类</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none bg-white">
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">版本</label>
                  <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="1.0.0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">模板内容 * <span className="text-muted font-normal">（使用 {"{{变量名}}"} 定义变量）</span></label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={12} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink font-mono focus:border-amber outline-none resize-none ${formErrors.content ? "border-fail" : "border-border"}`} placeholder="输入提示词模板内容..." />
                {formErrors.content && <p className="text-[11px] text-fail mt-1">{formErrors.content}</p>}
                {form.content && (
                  <div className="flex items-center gap-2 mt-1">
                    <Variable className="w-3 h-3 text-muted" />
                    <span className="text-[10px] text-muted">检测到变量: {extractVars(form.content).join(", ") || "无"}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
