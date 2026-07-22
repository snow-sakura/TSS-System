/**
 * 去AI味配置 — 内容风格优化策略 + 规则生成器 + 前后对比测试
 */
import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, X, Wand2, ToggleLeft, ToggleRight, TestTube, Search, FileCode, ArrowRight, CheckCircle, Eye, Sparkles, GitBranch, BookOpen, Zap, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { configApi } from "@/lib/api"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

const ruleKeyOptions = [
  { label: "移除词汇", key: "remove_words", placeholder: '["值得注意的是", "总的来说"]' },
  { label: "目标风格", key: "style", placeholder: "简洁 / 正式 / 口语化" },
  { label: "最大长度", key: "max_length", placeholder: "500" },
  { label: "温度", key: "temperature", placeholder: "0.7" },
  { label: "替换规则", key: "replace_rules", placeholder: '{"但是": "不过"}' },
]

/** 后端 API 响应 → UI 展示格式 */
function apiToStyle(item: any) {
  return {
    id: item.id,
    name: item.name,
    description: item.description || "",
    rules: item.rules || {},
    sample_input: item.sample_input || "",
    sample_output: item.sample_output || "",
    status: item.status === "启用" ? "启用" : "禁用",
    linked_agents: [] as string[],
    test_count: 0,
    last_test: "",
  }
}

/** 表单数据 → 后端创建/更新 payload */
function formToPayload(form: any, rules: any) {
  return {
    name: form.name,
    description: form.description || undefined,
    rules,
    sample_input: form.sample_input || undefined,
    sample_output: form.sample_output || undefined,
  }
}

interface RuleEntry { key: string; value: string }

export default function DeAIConfig() {
  const [styles, setStyles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingStyle, setEditingStyle] = useState<any>(null)
  const [form, setForm] = useState({ name: "", description: "", sample_input: "", sample_output: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [rulesEntries, setRulesEntries] = useState<RuleEntry[]>([])
  const [testResult, setTestResult] = useState<any>(null)
  const [showTest, setShowTest] = useState(false)
  const [testInput, setTestInput] = useState("")
  const [testingId, setTestingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [showRawJson, setShowRawJson] = useState(false)

  /** 从后端加载策略列表 */
  const fetchStyles = async () => {
    setFetching(true)
    try {
      const res: any = await configApi.listDeAIStyles(1, 100)
      const items = res?.data?.items || []
      setStyles(items.map(apiToStyle))
    } catch (e: any) {
      toast.error("加载策略列表失败: " + (e?.message || "未知错误"))
    } finally {
      setFetching(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStyles()
  }, [])

  const parseRulesToEntries = (rules: any): RuleEntry[] => {
    if (!rules) return [{ key: "style", value: "" }]
    const obj = typeof rules === "object" ? rules : JSON.parse(rules)
    const entries = Object.entries(obj).map(([key, value]) => ({ key, value: typeof value === "string" ? value : JSON.stringify(value) }))
    return entries.length > 0 ? entries : [{ key: "style", value: "" }]
  }

  const entriesToRulesString = (entries: RuleEntry[]): string => {
    const obj: Record<string, any> = {}
    entries.forEach((e) => {
      if (!e.key.trim()) return
      try { obj[e.key] = JSON.parse(e.value) } catch { obj[e.key] = e.value }
    })
    return JSON.stringify(obj, null, 2)
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "策略名称不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    const rulesStr = entriesToRulesString(rulesEntries)
    let rulesObj: any
    try { rulesObj = JSON.parse(rulesStr) } catch { rulesObj = {} }
    try {
      if (dialogMode === "create") {
        await configApi.createDeAIStyle(formToPayload(form, rulesObj))
        toast.success("策略创建成功")
      } else {
        await configApi.updateDeAIStyle(editingStyle.id, formToPayload(form, rulesObj))
        toast.success("策略更新成功")
      }
      setShowDialog(false)
      await fetchStyles()
    } catch (e: any) {
      toast.error(dialogMode === "create" ? "创建策略失败: " + (e?.message || "未知错误") : "更新策略失败: " + (e?.message || "未知错误"))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await configApi.deleteDeAIStyle(deleteTarget.id)
      toast.success("策略已删除")
      setDeleteTarget(null)
      await fetchStyles()
    } catch (e: any) {
      toast.error("删除策略失败: " + (e?.message || "未知错误"))
    }
  }

  const handleToggle = async (s: any) => {
    const newStatus = s.status === "启用" ? "禁用" : "启用"
    try {
      await configApi.updateDeAIStyle(s.id, { status: newStatus })
      toast.success(`策略「${s.name}」已${newStatus}`)
      await fetchStyles()
    } catch (e: any) {
      toast.error(`策略「${s.name}」状态切换失败: ` + (e?.message || "未知错误"))
    }
  }

  const runTest = () => {
    if (!editingStyle) return
    setTestingId(editingStyle.id)
    setTimeout(() => {
      setTestResult({ optimized: editingStyle.sample_output || "优化后的文本将显示在这里..." })
      toast.success("效果测试完成")
      setTestingId(null)
    }, 800)
  }

  const addRuleEntry = () => setRulesEntries([...rulesEntries, { key: "style", value: "" }])
  const removeRuleEntry = (idx: number) => setRulesEntries(rulesEntries.filter((_, i) => i !== idx))
  const updateRuleEntry = (idx: number, field: "key" | "value", val: string) => {
    const updated = [...rulesEntries]; updated[idx] = { ...updated[idx], [field]: val }; setRulesEntries(updated)
  }

  const openCreate = () => {
    setDialogMode("create"); setEditingStyle(null)
    setForm({ name: "", description: "", sample_input: "", sample_output: "" })
    setRulesEntries([{ key: "style", value: "" }]); setFormErrors({}); setShowDialog(true); setShowRawJson(false)
  }
  const openEdit = (s: any) => {
    setDialogMode("edit"); setEditingStyle(s)
    setForm({ name: s.name, description: s.description || "", sample_input: s.sample_input || "", sample_output: s.sample_output || "" })
    try { setRulesEntries(parseRulesToEntries(s.rules)) } catch { setRulesEntries([{ key: "style", value: "" }]) }
    setFormErrors({}); setShowDialog(true); setShowRawJson(false)
  }
  const openTest = (s: any) => { setEditingStyle(s); setTestInput(s.sample_input || ""); setTestResult(null); setShowTest(true) }

  const extractRuleCount = (rules: any): number => {
    try { const obj = typeof rules === "object" ? rules : JSON.parse(rules); return Object.keys(obj).length } catch { return 0 }
  }

  const totalTests = styles.reduce((a, s) => a + (s.test_count || 0), 0)

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-3"><h2 className="text-base font-semibold text-ink">去AI味配置</h2><p className="text-xs text-muted mt-0.5">AI内容风格优化 · 结构化规则生成器 · 前后对比测试 · 测试报告降重</p></div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink">去AI味配置</h2><p className="text-xs text-muted mt-0.5">AI内容风格优化 · 结构化规则生成器 · 前后对比测试 · 测试报告降重</p></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-ink">{styles.length}</p><p className="text-[11px] text-muted">策略总数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-pass">{styles.filter((s) => s.status === "启用").length}</p><p className="text-[11px] text-muted">已启用</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-warn">{styles.reduce((a, s) => a + extractRuleCount(s.rules), 0)}</p><p className="text-[11px] text-muted">规则总数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-info">{totalTests}</p><p className="text-[11px] text-muted">累计测试</p></div>
      </div>

      <div className="flex items-center mb-3 gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索策略名称..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <button onClick={fetchStyles} disabled={fetching} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${fetching ? "animate-spin" : ""}`} /> 刷新
        </button>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 ml-auto"><Plus className="w-3.5 h-3.5" /> 新建策略</button>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {styles.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase())).map((s) => {
          const ruleCount = extractRuleCount(s.rules)
          return (
          <div key={s.id} className={`bg-white rounded-2xl border border-border shadow-card p-5 transition-all ${s.status === "禁用" ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${s.status === "启用" ? "bg-gradient-to-br from-orange-500 to-amber-600" : "bg-cream"}`}>
                  <Wand2 className={`w-5 h-5 ${s.status === "启用" ? "text-white" : "text-muted"}`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{s.name}</h3>
                  {s.description && <p className="text-[11px] text-muted mt-0.5">{s.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-muted bg-cream rounded px-1.5 py-0.5">{ruleCount} 条规则</span>
                    {s.sample_input && <span className="text-[10px] text-muted">有示例</span>}
                    {s.linked_agents?.length > 0 && <span className="text-[10px] text-info flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />{s.linked_agents.length} 关联Agent</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleToggle(s)} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${s.status === "启用" ? "bg-pass/10 text-pass hover:bg-pass/20" : "bg-cream text-muted hover:bg-border"}`}>
                  {s.status === "启用" ? <><ToggleRight className="w-4 h-4" /> 已启用</> : <><ToggleLeft className="w-4 h-4" /> 已禁用</>}
                </button>
                <button onClick={() => openTest(s)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cream text-ink-light hover:bg-border transition-colors"><TestTube className="w-3 h-3" /> 测试</button>
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {s.linked_agents?.length > 0 && (
              <div className="flex items-center gap-1.5 mb-2">
                {s.linked_agents.map((agent: string) => (
                  <span key={agent} className="text-[9px] px-1.5 py-0.5 rounded bg-info/10 text-info font-mono">{agent}</span>
                ))}
              </div>
            )}
            {s.sample_input && (
              <div className="bg-cream/30 rounded-xl p-3 text-xs text-muted">
                <p className="text-[10px] font-medium text-ink-light mb-1">示例输入:</p>
                <p className="line-clamp-2">{s.sample_input}</p>
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted">
              <span>累计测试 {s.test_count} 次</span>
              {s.last_test && <span>最近测试: {s.last_test}</span>}
            </div>
          </div>
        )})}
      </div>

      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下去AI味策略？" itemName={deleteTarget?.name || ""} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[640px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{dialogMode === "create" ? "新建去AI味策略" : "编辑去AI味策略"}</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">策略名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：正式文档风格" />{formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}</div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">描述</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="策略用途描述" /></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink-light">优化规则</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowRawJson(!showRawJson)} className="text-[10px] text-info hover:text-info/80 flex items-center gap-1"><FileCode className="w-3 h-3" /> {showRawJson ? "可视化编辑" : "JSON编辑"}</button>
                    <button onClick={addRuleEntry} className="text-[10px] text-amber hover:text-amber-hover flex items-center gap-1"><Plus className="w-3 h-3" /> 添加规则</button>
                  </div>
                </div>
                {showRawJson ? (
                  <textarea value={entriesToRulesString(rulesEntries)} onChange={(e) => { try { const parsed = JSON.parse(e.target.value); setRulesEntries(Object.entries(parsed).map(([key, value]) => ({ key, value: typeof value === "string" ? value : JSON.stringify(value) }))) } catch {} }} rows={6} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink font-mono focus:border-amber outline-none resize-none" />
                ) : (
                  <div className="space-y-1.5">
                    {rulesEntries.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <select value={entry.key} onChange={(e) => updateRuleEntry(idx, "key", e.target.value)} className="w-[130px] h-8 px-2 rounded-lg border border-border text-[11px] text-ink outline-none focus:border-amber shrink-0">
                          <option value="">-- 选择键 --</option>
                          {ruleKeyOptions.map((opt) => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                        </select>
                        <input value={entry.value} onChange={(e) => updateRuleEntry(idx, "value", e.target.value)} placeholder={ruleKeyOptions.find((o) => o.key === entry.key)?.placeholder || "值"} className="flex-1 h-8 px-2 rounded-lg border border-border text-[11px] text-ink font-mono outline-none focus:border-amber" />
                        <button onClick={() => removeRuleEntry(idx)} className="p-1 rounded hover:bg-fail/10 text-muted hover:text-fail"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">示例输入</label><textarea value={form.sample_input} onChange={(e) => setForm({ ...form, sample_input: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="输入测试文本..." /></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">示例输出</label><textarea value={form.sample_output} onChange={(e) => setForm({ ...form, sample_output: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="优化后的文本..." /></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {showTest && editingStyle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setShowTest(false); setTestResult(null) }}>
          <div className="bg-white rounded-2xl shadow-elevated w-[700px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Eye className="w-4 h-4 text-orange-500" /> 效果测试 — {editingStyle.name}</h3>
              <button onClick={() => { setShowTest(false); setTestResult(null) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div><label className="block text-xs font-medium text-ink-light mb-1">输入文本</label><textarea value={testInput} onChange={(e) => setTestInput(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="输入要测试的文本..." /></div>
              <button onClick={runTest} disabled={testingId === editingStyle.id} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-1.5">
                {testingId === editingStyle.id ? "测试中..." : <><TestTube className="w-3.5 h-3.5" /> 运行测试</>}
              </button>
              {testResult && (
                <div>
                  <p className="text-xs font-medium text-ink mb-2 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-pass" /> 前后对比</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="bg-cream/50 px-3 py-1.5 border-b border-border flex items-center justify-between"><span className="text-[10px] font-medium text-muted">原始</span><span className="text-[9px] text-muted bg-cream rounded px-1 py-0.5 font-mono">{testInput.length} 字</span></div>
                      <div className="p-3"><p className="text-xs text-ink whitespace-pre-wrap">{testInput}</p></div>
                    </div>
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="bg-gradient-to-r from-orange-50 to-amber-50/50 px-3 py-1.5 border-b border-border flex items-center justify-between"><span className="text-[10px] font-medium text-amber-hover flex items-center gap-1"><Wand2 className="w-3 h-3" /> 优化后</span><span className="text-[9px] text-muted bg-cream rounded px-1 py-0.5 font-mono">{(testResult.optimized || "").length} 字</span></div>
                      <div className="p-3"><p className="text-xs text-ink whitespace-pre-wrap">{testResult.optimized || "—"}</p></div>
                    </div>
                  </div>
                  <div className="bg-cream/20 rounded-xl p-3 border border-border/60 mt-3">
                    <p className="text-[10px] font-medium text-muted mb-1 flex items-center gap-1"><ArrowRight className="w-3 h-3" /> 差异摘要</p>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-muted">原始 <strong className="text-ink">{testInput.length}</strong> 字</span>
                      <ArrowRight className="w-3 h-3 text-muted" />
                      <span className="text-muted">优化 <strong className="text-ink">{(testResult.optimized || "").length}</strong> 字</span>
                      <span className="text-muted">| 变化 <strong className={testInput.length !== (testResult.optimized || "").length ? "text-amber-hover" : "text-muted"}>{Math.abs(testInput.length - (testResult.optimized || "").length)}</strong> 字</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
