/**
 * 流程编排 — 可视化测试流程设计与执行
 * 功能：流程设计 / 节点配置 / 连线编排 / 执行监控 / 历史记录
 */
import { useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  Plus, Play, Pause, Square, RotateCcw, Save, Trash2, Edit, X, CheckCircle,
  Clock, Loader2, AlertTriangle, ArrowRight, ChevronDown, ChevronRight,
  FileText, ClipboardList, Target, FlaskConical, Bug, BarChart3, Zap,
  Settings, GitBranch, Layers, Copy, Eye, Download, Upload
} from "lucide-react"
import { toast } from "sonner"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

// 流程节点类型定义
const NODE_TYPES = [
  { key: "requirement", label: "需求分析", icon: FileText, color: "from-blue-500 to-indigo-600", desc: "AI驱动的需求理解与分析", category: "analysis" },
  { key: "plan", label: "规划方案", icon: ClipboardList, color: "from-cyan-500 to-teal-600", desc: "AI规划测试策略与方案", category: "analysis" },
  { key: "testpoint", label: "提取测试点", icon: Target, color: "from-violet-500 to-purple-600", desc: "智能测试点提取与管理", category: "analysis" },
  { key: "testcase", label: "用例生成", icon: FlaskConical, color: "from-emerald-500 to-green-600", desc: "多Agent协作生成测试用例", category: "generation" },
  { key: "review", label: "用例评审", icon: CheckCircle, color: "from-pink-500 to-rose-600", desc: "AI辅助测试用例评审与确认", category: "review" },
  { key: "execution", label: "执行测试", icon: Play, color: "from-sky-500 to-blue-600", desc: "实时执行追踪与结果收集", category: "execution" },
  { key: "defect", label: "缺陷管理", icon: Bug, color: "from-rose-500 to-red-600", desc: "AI缺陷分析与根因定位", category: "execution" },
  { key: "report", label: "分析报告", icon: BarChart3, color: "from-teal-500 to-emerald-600", desc: "智能质量洞察与报告生成", category: "report" },
  { key: "ai_task", label: "AI任务", icon: Zap, color: "from-amber to-orange-500", desc: "自定义AI Agent任务", category: "custom" },
]

// Mock流程模板数据
const mockWorkflows = [
  {
    id: "wf-1",
    name: "标准回归测试流程",
    description: "从需求到报告的完整回归测试流程",
    status: "completed",
    nodes: [
      { id: "n1", type: "requirement", x: 80, y: 120, config: { source: "需求文档", model: "DeepSeek-V3" } },
      { id: "n2", type: "plan", x: 280, y: 120, config: { strategy: "风险优先", coverage_target: "85%" } },
      { id: "n3", type: "testcase", x: 480, y: 120, config: { count: 50, types: ["正向", "反向", "边界"] } },
      { id: "n4", type: "review", x: 680, y: 120, config: { auto_approve: true } },
      { id: "n5", type: "execution", x: 880, y: 120, config: { env: "web-automation", parallel: true } },
      { id: "n6", type: "defect", x: 880, y: 280, config: { auto_analyze: true } },
      { id: "n7", type: "report", x: 1080, y: 200, config: { format: "markdown", recipients: ["team@tss.local"] } },
    ],
    edges: [
      { from: "n1", to: "n2" }, { from: "n2", to: "n3" }, { from: "n3", to: "n4" },
      { from: "n4", to: "n5" }, { from: "n5", to: "n6" }, { from: "n6", to: "n7" },
    ],
    stats: { runs: 12, success: 11, failed: 1, avg_duration: "25m" },
    created_at: "2025-06-01",
    last_run: "2025-07-21T10:30:00Z",
  },
  {
    id: "wf-2",
    name: "快速冒烟测试流程",
    description: "快速验证核心功能的轻量级测试流程",
    status: "idle",
    nodes: [
      { id: "n1", type: "testcase", x: 80, y: 120, config: { count: 10, priority: "P0" } },
      { id: "n2", type: "execution", x: 380, y: 120, config: { env: "web-automation", timeout: "5m" } },
      { id: "n3", type: "report", x: 680, y: 120, config: { format: "text", quick: true } },
    ],
    edges: [{ from: "n1", to: "n2" }, { from: "n2", to: "n3" }],
    stats: { runs: 28, success: 26, failed: 2, avg_duration: "5m" },
    created_at: "2025-06-15",
    last_run: "2025-07-21T08:00:00Z",
  },
  {
    id: "wf-3",
    name: "AI智能分析流程",
    description: "基于AI Agent的智能测试分析流程",
    status: "idle",
    nodes: [
      { id: "n1", type: "requirement", x: 80, y: 120, config: { source: "用户故事", model: "Qwen2.5-72B" } },
      { id: "n2", type: "ai_task", x: 380, y: 120, config: { task: "风险评估", agent: "分析Agent" } },
      { id: "n3", type: "testcase", x: 680, y: 120, config: { ai_generate: true, focus: "高风险区域" } },
      { id: "n4", type: "execution", x: 980, y: 120, config: { env: "api-automation" } },
    ],
    edges: [{ from: "n1", to: "n2" }, { from: "n2", to: "n3" }, { from: "n3", to: "n4" }],
    stats: { runs: 5, success: 5, failed: 0, avg_duration: "18m" },
    created_at: "2025-07-01",
    last_run: "2025-07-20T14:00:00Z",
  },
]

// Mock执行历史
const mockExecutions = [
  { id: "exec-1", workflow_id: "wf-1", workflow_name: "标准回归测试流程", status: "completed", start_time: "2025-07-21T10:30:00Z", end_time: "2025-07-21T10:55:00Z", duration: "25m", triggered_by: "admin", results: { passed: 45, failed: 3, skipped: 2 } },
  { id: "exec-2", workflow_id: "wf-2", workflow_name: "快速冒烟测试流程", status: "completed", start_time: "2025-07-21T08:00:00Z", end_time: "2025-07-21T08:05:00Z", duration: "5m", triggered_by: "CI/CD", results: { passed: 9, failed: 1, skipped: 0 } },
  { id: "exec-3", workflow_id: "wf-1", workflow_name: "标准回归测试流程", status: "failed", start_time: "2025-07-20T16:00:00Z", end_time: "2025-07-20T16:12:00Z", duration: "12m", triggered_by: "admin", error: "环境连接超时" },
  { id: "exec-4", workflow_id: "wf-3", workflow_name: "AI智能分析流程", status: "completed", start_time: "2025-07-20T14:00:00Z", end_time: "2025-07-20T14:18:00Z", duration: "18m", triggered_by: "admin", results: { passed: 15, failed: 0, skipped: 1 } },
]

export default function WorkflowOrchestration() {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<any[]>(mockWorkflows)
  const [executions, setExecutions] = useState<any[]>(mockExecutions)
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)
  const [showDesigner, setShowDesigner] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingWorkflow, setEditingWorkflow] = useState<any>(null)
  const [form, setForm] = useState({ name: "", description: "" })
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"workflows" | "executions">("workflows")
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const totalRuns = workflows.reduce((sum, w) => sum + (w.stats?.runs || 0), 0)
  const totalSuccess = workflows.reduce((sum, w) => sum + (w.stats?.success || 0), 0)

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("名称不能为空"); return }
    if (dialogMode === "create") {
      const newWf = {
        id: `wf-${Date.now()}`, name: form.name, description: form.description, status: "idle",
        nodes: [{ id: "n1", type: "requirement", x: 80, y: 120, config: {} }],
        edges: [], stats: { runs: 0, success: 0, failed: 0, avg_duration: "-" },
        created_at: new Date().toISOString().slice(0, 10), last_run: "-",
      }
      setWorkflows([newWf, ...workflows])
      toast.success("流程创建成功")
    } else {
      setWorkflows(workflows.map((w) => w.id === editingWorkflow.id ? { ...w, name: form.name, description: form.description } : w))
      toast.success("流程更新成功")
    }
    setShowDialog(false)
  }

  const handleDelete = (w: any) => setDeleteTarget(w)
  const confirmDelete = () => {
    setWorkflows(workflows.filter((w) => w.id !== deleteTarget.id))
    toast.success("流程已删除")
    setDeleteTarget(null)
  }

  const handleRun = async (w: any) => {
    setRunningId(w.id)
    toast.success(`开始执行: ${w.name}`)
    await new Promise((r) => setTimeout(r, 3000))
    const newExec = {
      id: `exec-${Date.now()}`, workflow_id: w.id, workflow_name: w.name, status: "completed",
      start_time: new Date().toISOString(), end_time: new Date().toISOString(),
      duration: "3m", triggered_by: "admin", results: { passed: 8, failed: 0, skipped: 0 },
    }
    setExecutions([newExec, ...executions])
    setWorkflows(workflows.map((wf) => wf.id === w.id ? { ...wf, stats: { ...wf.stats, runs: wf.stats.runs + 1, success: wf.stats.success + 1 }, last_run: new Date().toISOString() } : wf))
    setRunningId(null)
    toast.success(`${w.name} 执行完成`)
  }

  const handleDuplicate = (w: any) => {
    const dup = { ...w, id: `wf-${Date.now()}`, name: `${w.name} (副本)`, status: "idle", stats: { runs: 0, success: 0, failed: 0, avg_duration: "-" }, last_run: "-" }
    setWorkflows([dup, ...workflows])
    toast.success("流程已复制")
  }

  const getNodeInfo = (key: string) => NODE_TYPES.find((n) => n.key === key) || NODE_TYPES[0]

  return (
    <div className="min-h-screen bg-paper">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 bg-white border-b border-border shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-cream transition-colors">
              <ArrowRight className="w-4 h-4 text-muted rotate-180" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber to-orange-500 flex items-center justify-center shadow-sm">
                <GitBranch className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-ink">流程编排</h1>
                <p className="text-[10px] text-muted">可视化测试流程设计与执行</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setDialogMode("create"); setEditingWorkflow(null); setForm({ name: "", description: "" }); setShowDialog(true) }} className="h-8 px-3 rounded-lg gradient-amber text-white text-xs font-medium shadow-sm hover:shadow-md flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> 新建流程
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* 统计概览 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className="text-xl font-bold text-ink">{workflows.length}</p>
            <p className="text-[11px] text-muted">流程总数</p>
          </div>
          <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className="text-xl font-bold text-pass">{totalSuccess}</p>
            <p className="text-[11px] text-muted">成功执行</p>
          </div>
          <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className="text-xl font-bold text-amber">{totalRuns}</p>
            <p className="text-[11px] text-muted">总执行次数</p>
          </div>
          <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className="text-xl font-bold text-info">{executions.length}</p>
            <p className="text-[11px] text-muted">执行记录</p>
          </div>
          <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className="text-xl font-bold text-ink">{workflows.filter((w) => w.status === "running").length}</p>
            <p className="text-[11px] text-muted">运行中</p>
          </div>
        </div>

        {/* 标签切换 */}
        <div className="flex items-center gap-1 mb-4 bg-white rounded-xl border border-border p-0.5 w-fit">
          <button onClick={() => setActiveTab("workflows")} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === "workflows" ? "bg-cream text-ink" : "text-muted hover:text-ink"}`}>
            <Layers className="w-3.5 h-3.5" /> 流程设计
          </button>
          <button onClick={() => setActiveTab("executions")} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === "executions" ? "bg-cream text-ink" : "text-muted hover:text-ink"}`}>
            <Clock className="w-3.5 h-3.5" /> 执行历史
          </button>
        </div>

        {/* 流程设计视图 */}
        {activeTab === "workflows" ? (
          <div className="space-y-4">
            {workflows.length === 0 ? (
              <div className="text-center py-16 text-muted bg-white rounded-2xl border border-border shadow-card">
                <GitBranch className="w-12 h-12 mx-auto mb-3 text-muted-light" />
                <p className="text-sm font-medium">暂无流程</p>
                <p className="text-xs text-muted mt-1">点击"新建流程"创建第一个测试流程</p>
              </div>
            ) : workflows.map((wf) => {
              const isExpanded = expandedWorkflow === wf.id
              return (
                <div key={wf.id} className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
                  {/* 流程头部 */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber to-orange-500 flex items-center justify-center shadow-sm">
                          <GitBranch className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-ink">{wf.name}</h3>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${wf.status === "running" ? "bg-amber/10 text-amber" : wf.status === "completed" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>
                              {wf.status === "running" ? "运行中" : wf.status === "completed" ? "已完成" : "空闲"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted mt-0.5">{wf.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleRun(wf)} disabled={runningId === wf.id} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium gradient-amber text-white shadow-sm hover:shadow-md disabled:opacity-50">
                          {runningId === wf.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} 执行
                        </button>
                        <button onClick={() => handleDuplicate(wf)} className="p-1.5 rounded-lg hover:bg-cream text-ink-light hover:text-ink transition-colors"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => { setDialogMode("edit"); setEditingWorkflow(wf); setForm({ name: wf.name, description: wf.description }); setShowDialog(true) }} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(wf)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>

                    {/* 流程可视化 */}
                    <div className="bg-cream/30 rounded-xl p-4 mb-3 overflow-x-auto">
                      <div className="flex items-center gap-2 min-w-max">
                        {wf.nodes.map((node: any, idx: number) => {
                          const nodeInfo = getNodeInfo(node.type)
                          const NodeIcon = nodeInfo.icon
                          return (
                            <div key={node.id} className="flex items-center gap-2">
                              <div className="flex flex-col items-center">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${nodeInfo.color} flex items-center justify-center shadow-md`}>
                                  <NodeIcon className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-[10px] text-ink font-medium mt-1 whitespace-nowrap">{nodeInfo.label}</span>
                              </div>
                              {idx < wf.nodes.length - 1 && (
                                <ArrowRight className="w-4 h-4 text-muted flex-shrink-0" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* 统计信息 */}
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-center p-2 rounded-lg bg-cream/30">
                        <p className="text-sm font-bold text-ink">{wf.stats?.runs || 0}</p>
                        <p className="text-[10px] text-muted">执行次数</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-cream/30">
                        <p className="text-sm font-bold text-pass">{wf.stats?.success || 0}</p>
                        <p className="text-[10px] text-muted">成功</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-cream/30">
                        <p className="text-sm font-bold text-fail">{wf.stats?.failed || 0}</p>
                        <p className="text-[10px] text-muted">失败</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-cream/30">
                        <p className="text-sm font-bold text-ink">{wf.stats?.avg_duration || "-"}</p>
                        <p className="text-[10px] text-muted">平均耗时</p>
                      </div>
                    </div>

                    {/* 底部信息 */}
                    <div className="flex items-center justify-between text-[11px] text-muted border-t border-border/50 pt-3">
                      <span>节点数: {wf.nodes.length} · 连线数: {wf.edges.length}</span>
                      <span>上次执行: {wf.last_run && wf.last_run !== "-" ? new Date(wf.last_run).toLocaleString("zh-CN") : "-"}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* 执行历史视图 */
          <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream/30 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">ID</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">流程</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">状态</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">开始时间</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">耗时</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">触发者</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">结果</th>
                </tr>
              </thead>
              <tbody>
                {executions.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted"><Clock className="w-8 h-8 mx-auto mb-2 text-muted-light" /><p className="text-sm">暂无执行记录</p></td></tr>
                ) : executions.map((exec) => (
                  <tr key={exec.id} className="border-b border-border/50 hover:bg-cream/20 transition-colors">
                    <td className="px-4 py-2.5 text-[11px] text-muted font-mono">#{exec.id}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink font-medium">{exec.workflow_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${exec.status === "completed" ? "bg-pass/10 text-pass" : exec.status === "running" ? "bg-amber/10 text-amber" : "bg-fail/10 text-fail"}`}>
                        {exec.status === "completed" ? <CheckCircle className="w-3 h-3" /> : exec.status === "running" ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                        {exec.status === "completed" ? "成功" : exec.status === "running" ? "运行中" : "失败"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-ink font-mono">{new Date(exec.start_time).toLocaleString("zh-CN")}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink">{exec.duration}</td>
                    <td className="px-4 py-2.5 text-[11px] text-muted">{exec.triggered_by}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink">
                      {exec.results ? `${exec.results.passed}通过 ${exec.results.failed}失败` : exec.error || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[480px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{dialogMode === "create" ? "新建流程" : "编辑流程"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream transition-colors"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">流程名称 *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="如：标准回归测试流程" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">流程描述</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="流程用途描述..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 确认删除 */}
      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下流程？此操作不可恢复。" itemName={deleteTarget?.name || ""} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
