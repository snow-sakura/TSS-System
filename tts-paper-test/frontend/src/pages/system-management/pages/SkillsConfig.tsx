/**
 * Skills技能配置 — AI技能定义 + 依赖关联 + 执行测试 + 导入/导出
 */
import { useState } from "react"
import { Plus, Edit, Trash2, X, Puzzle, ToggleLeft, ToggleRight, Download, Upload, Eye, Search, Link2, Play, CheckCircle, AlertTriangle, ChevronDown, ChevronRight, Zap, Clock, Cpu, FileText, BarChart3, Bot } from "lucide-react"
import { toast } from "sonner"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

const MOCK_SKILLS = [
  {
    id: 1, name: "test-generator", description: "自动生成测试用例，基于需求文档和代码变更", version: "v2.1", category: "测试", status: "已启用",
    content: { steps: ["解析需求文档", "识别测试场景", "生成测试用例", "输出测试计划"] },
    deps: [
      { type: "mcp", name: "browser_navigate", status: "在线" },
      { type: "mcp", name: "code_scan", status: "在线" },
      { type: "prompt", name: "测试用例生成模板", status: "已发布" },
      { type: "prompt", name: "边界条件模板", status: "已发布" },
    ],
    exec_history: [
      { time: "2025-01-15 10:30", success: true, duration: "12.3s", output: "生成47条测试用例" },
      { time: "2025-01-15 09:00", success: true, duration: "11.8s", output: "生成42条测试用例" },
      { time: "2025-01-14 16:20", success: false, duration: "5.2s", output: "依赖browser_navigate离线" },
    ],
  },
  {
    id: 2, name: "code-reviewer", description: "自动化代码审查，检测代码质量和安全问题", version: "v1.8", category: "代码", status: "已启用",
    content: { steps: ["获取代码变更", "静态分析", "安全扫描", "生成审查报告"] },
    deps: [
      { type: "mcp", name: "code_scan", status: "在线" },
      { type: "mcp", name: "vuln_check", status: "在线" },
      { type: "prompt", name: "代码审查模板", status: "已发布" },
    ],
    exec_history: [
      { time: "2025-01-15 11:00", success: true, duration: "8.7s", output: "发现3个问题，0个高危" },
      { time: "2025-01-15 08:30", success: true, duration: "9.1s", output: "发现5个问题，1个高危" },
    ],
  },
  {
    id: 3, name: "data-analyzer", description: "测试数据智能分析，生成可视化报告和统计", version: "v1.5", category: "分析", status: "已启用",
    content: { steps: ["收集测试数据", "统计分析", "趋势预测", "生成图表"] },
    deps: [
      { type: "mcp", name: "db_query", status: "在线" },
      { type: "mcp", name: "file_read", status: "在线" },
      { type: "prompt", name: "数据分析模板", status: "已发布" },
      { type: "prompt", name: "图表生成模板", status: "草稿" },
    ],
    exec_history: [
      { time: "2025-01-15 14:00", success: true, duration: "15.6s", output: "分析1200条数据，生成5张图表" },
    ],
  },
  {
    id: 4, name: "report-builder", description: "自动生成测试报告，支持多种格式输出", version: "v2.0", category: "报告", status: "已启用",
    content: { steps: ["汇总测试结果", "生成摘要", "格式化输出", "发送通知"] },
    deps: [
      { type: "mcp", name: "file_write", status: "在线" },
      { type: "mcp", name: "notify_send", status: "离线" },
      { type: "prompt", name: "报告生成模板", status: "已发布" },
    ],
    exec_history: [
      { time: "2025-01-15 17:00", success: true, duration: "6.2s", output: "生成PDF报告，共28页" },
      { time: "2025-01-14 17:00", success: true, duration: "5.8s", output: "生成PDF报告，共25页" },
    ],
  },
  {
    id: 5, name: "auto-deployer", description: "自动化部署流水线，支持CI/CD集成", version: "v1.3", category: "自动化", status: "未启用",
    content: { steps: ["代码拉取", "构建打包", "环境部署", "健康检查"] },
    deps: [
      { type: "mcp", name: "custom_execute", status: "离线" },
      { type: "prompt", name: "部署检查模板", status: "已发布" },
    ],
    exec_history: [
      { time: "2025-01-10 12:00", success: false, duration: "0.5s", output: "技能未启用" },
    ],
  },
]

export default function SkillsConfig() {
  const [skills, setSkills] = useState<any[]>(MOCK_SKILLS)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingSkill, setEditingSkill] = useState<any>(null)
  const [form, setForm] = useState({ name: "", description: "", version: "v1.0", category: "测试", content: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [previewSkill, setPreviewSkill] = useState<any>(null)
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [expandedDeps, setExpandedDeps] = useState<Record<number, boolean>>({})
  const [expandedHistory, setExpandedHistory] = useState<Record<number, boolean>>({})

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "技能名称不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const newSkill = {
      id: dialogMode === "create" ? Date.now() : editingSkill.id,
      name: form.name, description: form.description, version: form.version,
      category: form.category, status: "已启用",
      content: form.content ? JSON.parse(form.content) : { steps: [] },
      deps: [], exec_history: [],
    }
    setSkills(dialogMode === "create" ? [...skills, newSkill] : skills.map((s) => s.id === newSkill.id ? { ...s, ...newSkill } : s))
    toast.success(dialogMode === "create" ? "技能创建成功" : "技能更新成功")
    setShowDialog(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setSkills(skills.filter((s) => s.id !== deleteTarget.id))
    toast.success("技能已删除"); setDeleteTarget(null)
  }

  const handleToggle = (s: any) => {
    setSkills(skills.map((sk) => sk.id === s.id ? { ...sk, status: sk.status === "已启用" ? "未启用" : "已启用" } : sk))
    toast.success(`技能「${s.name}」已${s.status === "已启用" ? "禁用" : "启用"}`)
  }

  const handleRunTest = (s: any) => {
    setTestingId(s.id)
    setTimeout(() => {
      const newEntry = { time: new Date().toLocaleString("zh-CN"), success: true, duration: `${(Math.random() * 10 + 2).toFixed(1)}s`, output: `执行完成: ${s.category}技能正常运行` }
      setSkills(skills.map((sk) => sk.id === s.id ? { ...sk, exec_history: [newEntry, ...sk.exec_history] } : sk))
      toast.success(`技能「${s.name}」执行完成`); setTestingId(null)
    }, 1200)
  }

  const handleExport = (s: any) => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${s.name}-${s.version}.json`; a.click()
    URL.revokeObjectURL(url); toast.success("技能导出成功")
  }

  const openCreate = () => { setDialogMode("create"); setEditingSkill(null); setForm({ name: "", description: "", version: "v1.0", category: "测试", content: "" }); setFormErrors({}); setShowDialog(true) }
  const openEdit = (s: any) => { setDialogMode("edit"); setEditingSkill(s); setForm({ name: s.name, description: s.description || "", version: s.version || "v1.0", category: s.category || "测试", content: s.content ? JSON.stringify(s.content, null, 2) : "" }); setFormErrors({}); setShowDialog(true) }

  const allDeps = skills.flatMap((s) => s.deps || [])
  const healthyDeps = allDeps.filter((d) => d.status === "在线" || d.status === "已发布").length

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink">Skills技能</h2><p className="text-xs text-muted mt-0.5">AI技能定义 · MCP+提示词依赖 · 执行历史 · 版本管理</p></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-ink">{skills.length}</p><p className="text-[11px] text-muted">技能总数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-pass">{skills.filter((s) => s.status === "已启用").length}</p><p className="text-[11px] text-muted">已启用</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-info">{new Set(skills.map((s) => s.category)).size}</p><p className="text-[11px] text-muted">分类数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-amber">{healthyDeps}/{allDeps.length || "—"}</p><p className="text-[11px] text-muted">依赖健康</p></div>
      </div>

      <div className="flex items-center mb-3 gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索技能名称/分类..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 ml-auto"><Plus className="w-3.5 h-3.5" /> 创建技能</button>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {skills.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase())).map((s) => {
          const deps = s.deps || []
          const allOk = deps.every((d: any) => d.status === "在线" || d.status === "已发布")
          const isDepsExpanded = expandedDeps[s.id]
          const isHistoryExpanded = expandedHistory[s.id]
          return (
          <div key={s.id} className={`bg-white rounded-2xl border border-border shadow-card p-5 transition-all ${s.status === "未启用" ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${s.status === "已启用" ? "bg-gradient-to-br from-amber to-yellow-500" : "bg-cream"}`}>
                  <Puzzle className={`w-5 h-5 ${s.status === "已启用" ? "text-white" : "text-muted"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{s.name}</h3>
                    <span className="text-[11px] text-muted font-mono">{s.version}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.category === "测试" ? "bg-amber-light text-amber-hover" : s.category === "代码" ? "bg-info/10 text-info" : s.category === "分析" ? "bg-purple-100 text-purple-600" : s.category === "报告" ? "bg-green-100 text-green-600" : "bg-cream text-muted"}`}>{s.category}</span>
                  </div>
                  {s.description && <p className="text-[11px] text-muted mt-0.5">{s.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleRunTest(s)} disabled={testingId === s.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cream text-ink-light hover:bg-border transition-colors disabled:opacity-50">
                  {testingId === s.id ? <Zap className="w-3 h-3 animate-pulse" /> : <Play className="w-3 h-3" />} 执行
                </button>
                <button onClick={() => handleToggle(s)} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${s.status === "已启用" ? "bg-pass/10 text-pass hover:bg-pass/20" : "bg-cream text-muted hover:bg-border"}`}>
                  {s.status === "已启用" ? <><ToggleRight className="w-4 h-4" /> 已启用</> : <><ToggleLeft className="w-4 h-4" /> 已禁用</>}
                </button>
                <button onClick={() => handleExport(s)} className="p-1.5 rounded-lg hover:bg-cream text-ink-light hover:text-ink transition-colors" title="导出"><Download className="w-4 h-4" /></button>
                <button onClick={() => setPreviewSkill(s)} className="p-1.5 rounded-lg hover:bg-cream text-ink-light hover:text-ink transition-colors" title="预览"><Eye className="w-4 h-4" /></button>
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="border-t border-border/50 pt-3">
              <button onClick={() => setExpandedDeps({ ...expandedDeps, [s.id]: !isDepsExpanded })} className="flex items-center gap-1 text-[11px] font-medium text-ink-light hover:text-ink transition-colors mb-2">
                {isDepsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Link2 className="w-3.5 h-3.5 text-info" /> 关联依赖 ({deps.length})
                {allOk ? <CheckCircle className="w-3 h-3 text-pass ml-1" /> : <AlertTriangle className="w-3 h-3 text-warn ml-1" />}
              </button>
              {isDepsExpanded && (
                <div className="space-y-1 pl-5">
                  {deps.map((dep: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 py-1">
                      {dep.type === "mcp" ? <Cpu className="w-3 h-3 text-cyan-600 shrink-0" /> : <FileText className="w-3 h-3 text-pink-500 shrink-0" />}
                      <span className="text-[11px] text-ink">{dep.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${dep.status === "在线" || dep.status === "已发布" ? "bg-pass/10 text-pass" : "bg-fail/10 text-fail"}`}>{dep.status}</span>
                      <span className="text-[9px] text-muted">{dep.type === "mcp" ? "MCP工具" : "提示词"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/50 pt-2.5 mt-1">
              <button onClick={() => setExpandedHistory({ ...expandedHistory, [s.id]: !isHistoryExpanded })} className="flex items-center gap-1 text-[11px] font-medium text-ink-light hover:text-ink transition-colors mb-1">
                {isHistoryExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Clock className="w-3.5 h-3.5 text-amber" /> 执行历史 ({s.exec_history?.length || 0})
              </button>
              {isHistoryExpanded && (
                <div className="pl-5 space-y-1">
                  {(s.exec_history || []).slice(0, 5).map((h: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 py-1 text-[11px]">
                      {h.success ? <CheckCircle className="w-3 h-3 text-pass shrink-0" /> : <AlertTriangle className="w-3 h-3 text-fail shrink-0" />}
                      <span className="text-muted font-mono">{h.time}</span>
                      <span className={h.success ? "text-pass" : "text-fail"}>{h.duration}</span>
                      <span className="text-muted truncate">{h.output}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {s.content && (
              <div className="border-t border-border/50 pt-2.5 mt-1">
                <div className="bg-cream/30 rounded-xl p-3">
                  <p className="text-[10px] font-medium text-ink-light mb-1">技能定义:</p>
                  <pre className="text-xs text-muted font-mono line-clamp-2">{JSON.stringify(s.content, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )})}
      </div>

      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下技能配置？" itemName={deleteTarget?.name || ""} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[580px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{dialogMode === "create" ? "创建技能" : "编辑技能"}</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">技能名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：test-generator" />{formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}</div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">分类</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">
                    {["测试", "代码", "分析", "报告", "自动化"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">版本</label><input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink font-mono focus:border-amber outline-none" placeholder="v1.0" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">描述</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="技能功能描述" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">技能定义 (JSON)</label><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink font-mono focus:border-amber outline-none resize-none" placeholder='{"steps": ["步骤1", "步骤2"]}' /><p className="text-[10px] text-muted mt-0.5">定义技能的执行步骤和参数</p></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {previewSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPreviewSkill(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Puzzle className="w-4 h-4 text-amber" /> {previewSkill.name} <span className="text-[11px] text-muted font-mono font-normal">{previewSkill.version}</span></h3>
              <button onClick={() => setPreviewSkill(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {[["版本", previewSkill.version], ["分类", previewSkill.category], ["状态", previewSkill.status], ["描述", previewSkill.description || "-"]].map(([k, v]) => (
                    <tr key={k as string} className="border-b border-border/30"><td className="py-2 text-muted w-20 font-medium">{k}</td><td className="py-2 text-ink">{v}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4">
                <p className="text-[11px] font-medium text-ink-light mb-1">技能定义</p>
                <pre className="bg-cream/30 rounded-xl p-4 text-xs text-ink font-mono whitespace-pre-wrap overflow-x-auto">{JSON.stringify(previewSkill.content, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
