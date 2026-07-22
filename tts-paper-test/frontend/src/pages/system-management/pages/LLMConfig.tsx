/**
 * 大模型配置 — 多提供商模型路由中枢
 * 功能：最新国产大模型管理 / 用量监控 / 成本对比 / 连接测试 / 路由规则 / Agent关联
 */
import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, X, Brain, ToggleLeft, ToggleRight, Zap, Activity, Search, BarChart3, DollarSign, Route, Gauge, TrendingUp, RefreshCw, CheckCircle, XCircle, Clock, List, Cpu, Sparkles, Code, Eye, MessageSquare, Layers } from "lucide-react"
import { toast } from "sonner"
import { configApi } from "@/lib/api"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

const MODEL_TYPES = [
  { key: "chat", label: "Chat模型", icon: MessageSquare, color: "from-sky-500 to-blue-600" },
  { key: "vision", label: "视觉模型", icon: Eye, color: "from-violet-500 to-purple-600" },
  { key: "multimodal", label: "多模态模型", icon: Layers, color: "from-amber to-orange-500" },
  { key: "code", label: "代码模型", icon: Code, color: "from-emerald-500 to-green-600" },
  { key: "embedding", label: "Embedding模型", icon: Cpu, color: "from-rose-500 to-red-600" },
]

// 最新国产大模型预设（2025-2026）
const PRESET_MODELS = [
  { name: "DeepSeek-V3", provider: "深度求索", model: "deepseek-chat", type: "chat", params: "671B MoE", context: 64000, price: { input: 0.001, output: 0.002 }, features: ["Function Calling", "JSON Mode", "Streaming"], desc: "推理能力强，代码生成优秀" },
  { name: "DeepSeek-R1", provider: "深度求索", model: "deepseek-reasoner", type: "chat", params: "671B MoE", context: 64000, price: { input: 0.004, output: 0.008 }, features: ["深度推理", "链式思考"], desc: "深度推理模型，擅长数学和代码" },
  { name: "Qwen3-235B-A22B", provider: "阿里通义", model: "qwen3-235b-a22b", type: "chat", params: "235B MoE", context: 131072, price: { input: 0.002, output: 0.006 }, features: ["Function Calling", "多语言", "长上下文"], desc: "多语言通用大模型" },
  { name: "Qwen2.5-72B-Instruct", provider: "阿里通义", model: "qwen2.5-72b-instruct", type: "chat", params: "72B", context: 131072, price: { input: 0.001, output: 0.002 }, features: ["Function Calling", "JSON Mode"], desc: "性价比最高的通用模型" },
  { name: "Qwen-VL-Max", provider: "阿里通义", model: "qwen-vl-max", type: "vision", params: "72B", context: 32000, price: { input: 0.002, output: 0.002 }, features: ["图像理解", "OCR", "视频分析"], desc: "视觉理解最强模型" },
  { name: "GLM-4-Plus", provider: "智谱AI", model: "glm-4-plus", type: "chat", params: "130B", context: 128000, price: { input: 0.005, output: 0.005 }, features: ["Function Calling", "工具调用", "联网搜索"], desc: "对话+工具调用能力强" },
  { name: "GLM-4V-Plus", provider: "智谱AI", model: "glm-4v-plus", type: "multimodal", params: "130B", context: 8192, price: { input: 0.01, output: 0.01 }, features: ["图像理解", "视频理解", "多模态"], desc: "多模态理解能力突出" },
  { name: "Moonshot-v1-128k", provider: "月之暗面", model: "moonshot-v1-128k", type: "chat", params: "未公开", context: 131072, price: { input: 0.006, output: 0.006 }, features: ["超长上下文", "文档理解"], desc: "超长上下文处理能力" },
  { name: "Doubao-pro-256k", provider: "字节豆包", model: "doubao-pro-256k", type: "chat", params: "未公开", context: 262144, price: { input: 0.0008, output: 0.002 }, features: ["超长文本", "Function Calling"], desc: "超长文本处理，性价比高" },
  { name: "ERNIE 4.5", provider: "百度文心", model: "ernie-4.5", type: "chat", params: "未公开", context: 128000, price: { input: 0.004, output: 0.008 }, features: ["中文理解", "知识推理", "创作"], desc: "中文理解能力最强" },
  { name: "Spark 4.0 Ultra", provider: "讯飞星火", model: "spark-4.0-ultra", type: "multimodal", params: "未公开", context: 32000, price: { input: 0.005, output: 0.01 }, features: ["语音交互", "多模态", "实时对话"], desc: "语音+多模态能力突出" },
  { name: "Yi-Lightning", provider: "零一万物", model: "yi-lightning", type: "chat", params: "未公开", context: 16384, price: { input: 0.001, output: 0.001 }, features: ["高速推理", "低延迟"], desc: "高速推理，响应速度快" },
  { name: "Hunyuan-Turbo", provider: "腾讯混元", model: "hunyuan-turbo", type: "chat", params: "未公开", context: 32000, price: { input: 0.003, output: 0.006 }, features: ["中文创作", "多轮对话"], desc: "中文创作能力强" },
  { name: "MiniMax-Text-01", provider: "MiniMax", model: "minimax-text-01", type: "chat", params: "456B MoE", context: 1000000, price: { input: 0.001, output: 0.001 }, features: ["超长上下文(1M)", "函数调用"], desc: "支持100万token超长上下文" },
  { name: "Step-2-16K", provider: "阶跃星辰", model: "step-2-16k", type: "chat", params: "未公开", context: 16384, price: { input: 0.002, output: 0.002 }, features: ["长文本分析", "逻辑推理"], desc: "长文本分析能力突出" },
  { name: "GPT-4o", provider: "OpenAI", model: "gpt-4o", type: "multimodal", params: "未公开", context: 128000, price: { input: 0.005, output: 0.015 }, features: ["多模态", "Function Calling", "视觉"], desc: "综合能力最强" },
  { name: "Claude 3.5 Sonnet", provider: "Anthropic", model: "claude-3-5-sonnet", type: "chat", params: "未公开", context: 200000, price: { input: 0.003, output: 0.015 }, features: ["代码生成", "长文本", "工具调用"], desc: "代码生成能力最强" },
]

// 路由规则预设
const ROUTE_RULES = [
  { id: "chat", label: "通用对话", targetType: "chat", icon: MessageSquare, desc: "需求分析、测试问答" },
  { id: "code", label: "代码生成", targetType: "code", icon: Code, desc: "测试脚本、自动化代码" },
  { id: "vision", label: "图像理解", targetType: "vision", icon: Eye, desc: "UI截图对比、视觉回归" },
  { id: "analysis", label: "深度分析", targetType: "chat", icon: Brain, desc: "缺陷根因、质量评估" },
  { id: "report", label: "报告生成", targetType: "chat", icon: BarChart3, desc: "测试报告、质量报告" },
  { id: "embed", label: "向量嵌入", targetType: "embedding", icon: Cpu, desc: "知识库检索、语义搜索" },
]

// Mock已配置的模型
const mockProviders = [
  { id: "llm-1", name: "DeepSeek-V3", provider: "深度求索", model: "deepseek-chat", type: "chat", params: "671B MoE", context: 64000, maxTokens: 8192, temperature: 0.7, status: "enabled", price: { input: 0.001, output: 0.002 }, features: ["Function Calling", "JSON Mode", "Streaming"], stats: { today_calls: 1250, today_tokens: 2500000, today_cost: 5.0, avg_latency: 1200, success_rate: 99.2 }, linked_agents: ["测试用例生成Agent", "缺陷分析Agent", "代码审查Agent"], route: { weight: 40, priority: 1 } },
  { id: "llm-2", name: "Qwen2.5-72B-Instruct", provider: "阿里通义", model: "qwen2.5-72b-instruct", type: "chat", params: "72B", context: 131072, maxTokens: 8192, temperature: 0.7, status: "enabled", price: { input: 0.001, output: 0.002 }, features: ["Function Calling", "JSON Mode"], stats: { today_calls: 890, today_tokens: 1800000, today_cost: 3.6, avg_latency: 980, success_rate: 99.5 }, linked_agents: ["需求分析Agent", "报告生成Agent"], route: { weight: 30, priority: 2 } },
  { id: "llm-3", name: "GLM-4-Plus", provider: "智谱AI", model: "glm-4-plus", type: "chat", params: "130B", context: 128000, maxTokens: 4096, temperature: 0.7, status: "enabled", price: { input: 0.005, output: 0.005 }, features: ["Function Calling", "工具调用"], stats: { today_calls: 320, today_tokens: 640000, today_cost: 6.4, avg_latency: 1500, success_rate: 98.8 }, linked_agents: ["工具调用Agent", "多步骤推理Agent"], route: { weight: 15, priority: 3 } },
  { id: "llm-4", name: "Qwen-VL-Max", provider: "阿里通义", model: "qwen-vl-max", type: "vision", params: "72B", context: 32000, maxTokens: 4096, temperature: 0.7, status: "enabled", price: { input: 0.002, output: 0.002 }, features: ["图像理解", "OCR", "视频分析"], stats: { today_calls: 156, today_tokens: 312000, today_cost: 1.25, avg_latency: 2100, success_rate: 99.0 }, linked_agents: ["视觉回归Agent", "UI截图分析Agent"], route: { weight: 10, priority: 4 } },
  { id: "llm-5", name: "text-embedding-3-small", provider: "OpenAI", model: "text-embedding-3-small", type: "embedding", params: "1536d", context: 8191, maxTokens: 8191, temperature: 0, status: "enabled", price: { input: 0.00013, output: 0 }, features: ["向量嵌入", "语义搜索"], stats: { today_calls: 4500, today_tokens: 9000000, today_cost: 1.17, avg_latency: 120, success_rate: 99.9 }, linked_agents: ["知识库检索Agent", "语义匹配Agent"], route: { weight: 5, priority: 5 } },
  { id: "llm-6", name: "DeepSeek-R1", provider: "深度求索", model: "deepseek-reasoner", type: "chat", params: "671B MoE", context: 64000, maxTokens: 8192, temperature: 0.1, status: "disabled", price: { input: 0.004, output: 0.008 }, features: ["深度推理", "链式思考"], stats: { today_calls: 0, today_tokens: 0, today_cost: 0, avg_latency: 0, success_rate: 0 }, linked_agents: [], route: { weight: 0, priority: 6 } },
]

export default function LLMConfig() {
  const [providers, setProviders] = useState<any[]>(mockProviders)
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingProvider, setEditingProvider] = useState<any>(null)
  const [form, setForm] = useState({ name: "", provider: "", model: "", apiKey: "", baseUrl: "", type: "chat", maxTokens: "8192", temperature: "0.7" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [showTestResult, setShowTestResult] = useState<any>(null)
  const [viewMode, setViewMode] = useState<"list" | "router">("list")

  const enabledCount = providers.filter((p) => p.status === "enabled").length
  const totalCalls = providers.reduce((sum, p) => sum + (p.stats?.today_calls || 0), 0)
  const totalCost = providers.reduce((sum, p) => sum + (p.stats?.today_cost || 0), 0)
  const avgLatency = providers.filter((p) => p.stats?.avg_latency > 0).reduce((sum, p, _, arr) => sum + p.stats.avg_latency / arr.length, 0)

  const filteredProviders = providers.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.provider.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === "all" || p.type === filterType
    return matchSearch && matchType
  })

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "模型名称不能为空"
    if (!form.model.trim()) errors.model = "模型标识不能为空"
    if (!form.apiKey.trim()) errors.apiKey = "API Key不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    if (dialogMode === "create") {
      const newProvider = {
        id: `llm-${Date.now()}`,
        name: form.name, provider: form.provider, model: form.model,
        type: form.type, context: 128000, maxTokens: parseInt(form.maxTokens),
        temperature: parseFloat(form.temperature), status: "enabled",
        price: { input: 0.001, output: 0.002 }, features: [], stats: { today_calls: 0, today_tokens: 0, today_cost: 0, avg_latency: 0, success_rate: 0 },
        linked_agents: [], route: { weight: 0, priority: providers.length + 1 },
      }
      setProviders([newProvider, ...providers])
      toast.success("模型添加成功")
    } else {
      setProviders(providers.map((p) => p.id === editingProvider.id ? { ...p, name: form.name, model: form.model, type: form.type, maxTokens: parseInt(form.maxTokens), temperature: parseFloat(form.temperature) } : p))
      toast.success("模型更新成功")
    }
    setShowDialog(false)
  }

  const handleDelete = (p: any) => setDeleteTarget(p)
  const confirmDelete = () => {
    if (!deleteTarget) return
    setProviders(providers.filter((p) => p.id !== deleteTarget.id))
    toast.success("模型已删除")
    setDeleteTarget(null)
  }

  const handleToggle = (p: any) => {
    setProviders(providers.map((item) => item.id === p.id ? { ...item, status: item.status === "enabled" ? "disabled" : "enabled" } : item))
    toast.success(`${p.name} 已${p.status === "enabled" ? "禁用" : "启用"}`)
  }

  const handleTestConnection = async (p: any) => {
    setTestingId(p.id)
    await new Promise((r) => setTimeout(r, 1500))
    setShowTestResult({ name: p.name, status: "success", latency: "1.2s", model: p.model })
    setTestingId(null)
    toast.success(`${p.name} 连接测试成功`)
  }

  const openCreate = () => {
    setDialogMode("create"); setEditingProvider(null)
    setForm({ name: "", provider: "", model: "", apiKey: "", baseUrl: "", type: "chat", maxTokens: "8192", temperature: "0.7" })
    setFormErrors({}); setShowDialog(true)
  }
  const openEdit = (p: any) => {
    setDialogMode("edit"); setEditingProvider(p)
    setForm({ name: p.name, provider: p.provider, model: p.model, apiKey: "••••••••", baseUrl: "", type: p.type, maxTokens: String(p.maxTokens), temperature: String(p.temperature) })
    setFormErrors({}); setShowDialog(true)
  }

  const getTypeInfo = (typeKey: string) => MODEL_TYPES.find((t) => t.key === typeKey) || MODEL_TYPES[0]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink">大模型配置</h2>
        <p className="text-xs text-muted mt-0.5">最新国产大模型管理 · 用量监控 · 成本追踪 · 路由规则 · Agent关联</p>
      </div>

      {/* 统计仪表盘 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-ink">{providers.length}</p>
          <p className="text-[11px] text-muted">模型总数</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-pass">{enabledCount}</p>
          <p className="text-[11px] text-muted">已启用</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-info">{totalCalls.toLocaleString()}</p>
          <p className="text-[11px] text-muted">今日调用</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-amber">¥{totalCost.toFixed(2)}</p>
          <p className="text-[11px] text-muted">今日费用</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-ink">{avgLatency > 0 ? `${Math.round(avgLatency)}ms` : "-"}</p>
          <p className="text-[11px] text-muted">平均延迟</p>
        </div>
      </div>

      {/* 视图切换 + 搜索 + 操作 */}
      <div className="flex flex-wrap items-center mb-3 gap-2">
        <div className="flex items-center bg-white rounded-xl border border-border p-0.5">
          <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === "list" ? "bg-cream text-ink" : "text-muted hover:text-ink"}`}><List className="w-3.5 h-3.5" /> 模型列表</button>
          <button onClick={() => setViewMode("router")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === "router" ? "bg-cream text-ink" : "text-muted hover:text-ink"}`}><Route className="w-3.5 h-3.5" /> 路由视图</button>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索模型名称/厂商..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-border p-0.5">
          <button onClick={() => setFilterType("all")} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filterType === "all" ? "bg-cream text-ink" : "text-muted hover:text-ink"}`}>全部</button>
          {MODEL_TYPES.map((t) => (
            <button key={t.key} onClick={() => setFilterType(t.key)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filterType === t.key ? "bg-cream text-ink" : "text-muted hover:text-ink"}`}>{t.label}</button>
          ))}
        </div>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 添加模型
        </button>
      </div>

      {/* 模型列表视图 */}
      {viewMode === "list" ? (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {filteredProviders.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <Brain className="w-10 h-10 mx-auto mb-2 text-muted-light" />
              <p className="text-sm font-medium">暂无模型</p>
              <p className="text-xs text-muted mt-1">点击"添加模型"配置第一个大模型</p>
            </div>
          ) : filteredProviders.map((p) => {
            const typeInfo = getTypeInfo(p.type)
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-border shadow-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${typeInfo.color} flex items-center justify-center shadow-sm`}>
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink">{p.name}</h3>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cream text-muted">{p.provider}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.status === "enabled" ? "bg-pass/10 text-pass" : "bg-muted/10 text-muted"}`}>{p.status === "enabled" ? "启用" : "禁用"}</span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">模型: <span className="font-mono">{p.model}</span> · {p.params} · 上下文: {p.context?.toLocaleString()} tokens</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleTestConnection(p)} disabled={testingId === p.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cream text-ink-light hover:bg-border transition-colors disabled:opacity-50">
                      {testingId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} 测试
                    </button>
                    <button onClick={() => handleToggle(p)} className="p-1.5 rounded-lg hover:bg-cream transition-colors">
                      {p.status === "enabled" ? <ToggleRight className="w-5 h-5 text-pass" /> : <ToggleLeft className="w-5 h-5 text-muted" />}
                    </button>
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* 模型信息网格 */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-cream/30 rounded-xl p-3 mb-3">
                  <div><p className="text-[10px] text-muted mb-0.5">类型</p><p className="text-xs text-ink">{typeInfo.label}</p></div>
                  <div><p className="text-[10px] text-muted mb-0.5">最大输出</p><p className="text-xs text-ink">{p.maxTokens?.toLocaleString()} tokens</p></div>
                  <div><p className="text-[10px] text-muted mb-0.5">温度</p><p className="text-xs text-ink">{p.temperature}</p></div>
                  <div><p className="text-[10px] text-muted mb-0.5">价格(输入/输出)</p><p className="text-xs text-ink">¥{p.price?.input}/{p.price?.output}</p></div>
                  <div><p className="text-[10px] text-muted mb-0.5">路由权重</p><p className="text-xs text-ink">{p.route?.weight || 0}</p></div>
                </div>

                {/* 功能标签 */}
                {p.features && p.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {p.features.map((f: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-cream text-[10px] font-medium text-muted">{f}</span>
                    ))}
                  </div>
                )}

                {/* 使用统计 */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="text-center p-2 rounded-lg bg-cream/30">
                    <p className="text-sm font-bold text-ink">{p.stats?.today_calls?.toLocaleString() || 0}</p>
                    <p className="text-[10px] text-muted">今日调用</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-cream/30">
                    <p className="text-sm font-bold text-ink">{p.stats?.today_tokens ? `${(p.stats.today_tokens / 1000000).toFixed(1)}M` : "0"}</p>
                    <p className="text-[10px] text-muted">Token消耗</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-cream/30">
                    <p className="text-sm font-bold text-amber">¥{p.stats?.today_cost?.toFixed(2) || "0.00"}</p>
                    <p className="text-[10px] text-muted">今日费用</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-cream/30">
                    <p className="text-sm font-bold text-ink">{p.stats?.avg_latency ? `${p.stats.avg_latency}ms` : "-"}</p>
                    <p className="text-[10px] text-muted">平均延迟</p>
                  </div>
                </div>

                {/* 关联Agent */}
                {p.linked_agents && p.linked_agents.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-muted border-t border-border/50 pt-3">
                    <Sparkles className="w-3 h-3 text-muted-light" />
                    <span>关联Agent: </span>
                    {p.linked_agents.map((a: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-amber/10 text-amber text-[10px] font-medium">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* 路由视图 */
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-border shadow-card p-5">
            <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2"><Route className="w-4 h-4 text-amber" /> 路由规则配置</h3>
            <p className="text-xs text-muted mb-4">根据任务类型自动选择最优模型，权重越高优先级越高</p>
            <div className="space-y-3">
              {ROUTE_RULES.map((rule) => {
                const RuleIcon = rule.icon
                const matchedModels = providers.filter((p) => p.type === rule.targetType && p.status === "enabled")
                return (
                  <div key={rule.id} className="flex items-center gap-4 p-3 rounded-xl bg-cream/30 border border-border/50">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-sm">
                      <RuleIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink">{rule.label}</span>
                        <span className="text-[10px] text-muted">→ {rule.targetType}</span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">{rule.desc}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedModels.length === 0 ? (
                        <span className="text-[10px] text-muted">无可用模型</span>
                      ) : matchedModels.map((m) => (
                        <span key={m.id} className="px-2 py-0.5 rounded bg-pass/10 text-pass text-[10px] font-medium">
                          {m.name} (权重:{m.route?.weight || 0})
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 测试结果弹窗 */}
      {showTestResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowTestResult(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[400px] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pass/10 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-pass" /></div>
              <div>
                <h3 className="text-sm font-bold text-ink">连接测试成功</h3>
                <p className="text-xs text-muted">{showTestResult.name}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">模型标识</span><span className="text-ink font-mono">{showTestResult.model}</span></div>
              <div className="flex justify-between"><span className="text-muted">响应延迟</span><span className="text-ink">{showTestResult.latency}</span></div>
              <div className="flex justify-between"><span className="text-muted">状态</span><span className="text-pass">正常</span></div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowTestResult(null)} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium">确定</button>
            </div>
          </div>
        </div>
      )}

      {/* 确认删除 */}
      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下模型配置？此操作不可恢复。" itemName={deleteTarget?.name || ""} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{dialogMode === "create" ? "添加模型" : "编辑模型"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream transition-colors"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {dialogMode === "create" && (
                <div className="p-3 rounded-xl bg-cream/50 border border-border/50">
                  <p className="text-xs font-medium text-ink-light mb-2">快速选择预设模型</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_MODELS.slice(0, 8).map((pm) => (
                      <button key={pm.model} onClick={() => setForm({ ...form, name: pm.name, provider: pm.provider, model: pm.model, type: pm.type })} className="px-2 py-1 rounded-lg bg-white border border-border text-[10px] text-ink hover:border-amber hover:bg-amber-50 transition-colors">
                        {pm.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">模型名称 *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：DeepSeek-V3" />
                {formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">厂商</label>
                  <input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="如：深度求索" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">模型类型 *</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none bg-white">
                    {MODEL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">模型标识 *</label>
                <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink font-mono focus:border-amber outline-none ${formErrors.model ? "border-fail" : "border-border"}`} placeholder="如：deepseek-chat" />
                {formErrors.model && <p className="text-[11px] text-fail mt-1">{formErrors.model}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">API Key *</label>
                <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink font-mono focus:border-amber outline-none ${formErrors.apiKey ? "border-fail" : "border-border"}`} placeholder="sk-..." />
                {formErrors.apiKey && <p className="text-[11px] text-fail mt-1">{formErrors.apiKey}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">Base URL</label>
                <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink font-mono focus:border-amber outline-none" placeholder="https://api.deepseek.com (可选)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">最大输出Tokens</label>
                  <input value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="8192" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">温度</label>
                  <input value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="0.7" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "添加" : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
