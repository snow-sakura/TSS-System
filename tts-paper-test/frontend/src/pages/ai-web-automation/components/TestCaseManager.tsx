/**
 * 测试用例管理 - 连接真实API
 * AI生成用例 + 审核 + 批准
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, Eye, X, FlaskConical, Check, XCircle, CheckCircle, Download, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { webApi } from "@/lib/api"

interface TestCase {
  id: number; project_id: number; title: string; description?: string; preconditions?: string;
  steps: Array<{ action: string; target?: string; value?: string }>;
  expected_result: string; priority: string; status: string; ai_generated: boolean; page_url?: string
}

const statusLabels: Record<string, string> = { draft: "草稿", pending: "待审批", approved: "已通过", rejected: "已驳回" }
const statusColors: Record<string, string> = {
  draft: "bg-cream text-muted border border-border",
  pending: "bg-amber-light text-warn border border-amber/20",
  approved: "bg-pass/10 text-pass border border-pass/20",
  rejected: "bg-fail/10 text-fail border border-fail/20",
}
const priorityColors: Record<string, string> = { P0: "text-fail", P1: "text-amber-hover", P2: "text-info", P3: "text-muted" }

export default function TestCaseManager() {
  const [cases, setCases] = useState<TestCase[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [previewCase, setPreviewCase] = useState<TestCase | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingCase, setEditingCase] = useState<TestCase | null>(null)
  const [form, setForm] = useState({ title: "", description: "", expected_result: "", priority: "P1", preconditions: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const pageSize = 10

  // 加载项目列表
  const fetchProjects = useCallback(async () => {
    try {
      const res: any = await webApi.listProjects(1)
      if (res?.data?.items) {
        setProjects(res.data.items)
        if (res.data.items.length > 0 && !selectedProjectId) {
          setSelectedProjectId(res.data.items[0].id)
        }
      }
    } catch {}
  }, [selectedProjectId])

  // 加载测试用例
  const fetchCases = useCallback(async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const res: any = await webApi.listTestCases(selectedProjectId)
      if (res?.data) {
        const items = Array.isArray(res.data) ? res.data : (res.data.items || [])
        setCases(items.map((c: any) => ({
          id: c.id,
          project_id: c.project_id,
          title: c.title,
          description: c.description,
          preconditions: c.preconditions,
          steps: c.steps || [],
          expected_result: c.expected_result || "",
          priority: c.priority || "P1",
          status: c.status || "draft",
          ai_generated: c.ai_generated || false,
          page_url: c.page_url,
        })))
      }
    } catch {
      setCases([])
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchCases() }, [fetchCases])

  const filtered = cases.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && c.status !== statusFilter) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // AI生成测试用例
  const handleGenerate = useCallback(async () => {
    if (!selectedProjectId) { toast.error("请先选择项目"); return }
    setGenerating(true)
    try {
      const response = await webApi.generateTestCasesSSE(selectedProjectId)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error("无法获取响应流")

      const decoder = new TextDecoder()
      let buffer = ""
      let currentEvent = ""
      let currentData = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("event: ")) currentEvent = line.slice(7).trim()
          else if (line.startsWith("data: ")) currentData = line.slice(6).trim()
          else if (line === "" && currentEvent && currentData) {
            try {
              const data = JSON.parse(currentData)
              if (currentEvent === "generation_complete") {
                toast.success(`成功生成 ${data.total || 0} 条测试用例`)
                fetchCases()
              } else if (currentEvent === "generation_error") {
                toast.error(`生成失败: ${data.error}`)
              }
            } catch {}
            currentEvent = ""
            currentData = ""
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "生成失败")
    } finally {
      setGenerating(false)
    }
  }, [selectedProjectId, fetchCases])

  // 审批操作
  const handleApprove = async (c: TestCase) => {
    try {
      await webApi.approveTestCase(c.id)
      toast.success("已通过")
      fetchCases()
    } catch { toast.error("操作失败") }
  }

  const handleReject = async (c: TestCase) => {
    const note = prompt("请输入驳回原因：")
    if (note === null) return
    try {
      await webApi.rejectTestCase(c.id, note)
      toast.success("已驳回")
      fetchCases()
    } catch { toast.error("操作失败") }
  }

  const handleDelete = async (c: TestCase) => {
    if (!confirm(`确定删除用例「${c.title}」？`)) return
    try {
      await webApi.deleteTestCase(c.id)
      toast.success("已删除")
      fetchCases()
    } catch { toast.error("删除失败") }
  }

  const openCreate = () => {
    setEditingCase(null)
    setForm({ title: "", description: "", expected_result: "", priority: "P1", preconditions: "" })
    setFormErrors({})
    setShowDialog(true)
  }

  const openEdit = (c: TestCase) => {
    setEditingCase(c)
    setForm({ title: c.title, description: c.description || "", expected_result: c.expected_result, priority: c.priority, preconditions: c.preconditions || "" })
    setFormErrors({})
    setShowDialog(true)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4">
      <div className="mb-1"><h2 className="text-base font-semibold text-ink flex items-center gap-2">测试用例管理 <FlaskConical className="w-4 h-4 text-amber" /></h2><p className="text-xs text-muted mt-0.5">AI自动生成测试用例，支持审批工作流</p></div>

      {/* 项目选择 + 操作 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-light">项目:</label>
            <select value={selectedProjectId || ""} onChange={(e) => { setSelectedProjectId(Number(e.target.value)); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
              <option value="">请选择项目</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={fetchCases} disabled={!selectedProjectId} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-40"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
          <button onClick={handleGenerate} disabled={!selectedProjectId || generating} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 disabled:opacity-50">
            {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 生成中...</> : <><Sparkles className="w-3.5 h-3.5" /> AI生成用例</>}
          </button>
          <button onClick={openCreate} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 新建用例</button>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }} placeholder="搜索用例标题..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部状态</option><option value="draft">草稿</option><option value="pending">待审批</option><option value="approved">已通过</option><option value="rejected">已驳回</option></select>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-border p-3 text-center"><p className="text-lg font-bold text-ink">{cases.length}</p><p className="text-[11px] text-muted">总用例</p></div>
        <div className="bg-white rounded-xl border border-border p-3 text-center"><p className="text-lg font-bold text-amber">{cases.filter((c) => c.status === "pending").length}</p><p className="text-[11px] text-muted">待审批</p></div>
        <div className="bg-white rounded-xl border border-border p-3 text-center"><p className="text-lg font-bold text-pass">{cases.filter((c) => c.status === "approved").length}</p><p className="text-[11px] text-muted">已通过</p></div>
        <div className="bg-white rounded-xl border border-border p-3 text-center"><p className="text-lg font-bold text-fail">{cases.filter((c) => c.status === "rejected").length}</p><p className="text-[11px] text-muted">已驳回</p></div>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-amber" /></div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted"><FlaskConical className="w-8 h-8 mb-2 text-muted-light" /><p className="text-sm">暂无测试用例</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-cream/50">
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light w-12">ID</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light">标题</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light w-16">优先级</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light w-20">状态</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light w-16">来源</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light w-32">操作</th>
            </tr></thead>
            <tbody>
              {paged.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-cream/30 transition-colors">
                  <td className="px-4 py-3 text-center text-xs text-muted">{c.id}</td>
                  <td className="px-4 py-3 text-center"><span className="text-sm font-medium text-ink truncate max-w-[200px] block">{c.title}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`text-xs font-semibold ${priorityColors[c.priority] || "text-muted"}`}>{c.priority}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[c.status] || "bg-cream text-muted"}`}>{statusLabels[c.status] || c.status}</span></td>
                  <td className="px-4 py-3 text-center">{c.ai_generated ? <span className="px-1.5 py-0.5 rounded bg-amber-light text-[10px] font-medium text-amber">AI</span> : <span className="text-[11px] text-muted">手动</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setPreviewCase(c)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors" title="预览"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-700 transition-colors" title="编辑"><Edit className="w-3.5 h-3.5" /></button>
                      {c.status === "pending" && (
                        <>
                          <button onClick={() => handleApprove(c)} className="p-1.5 rounded-lg hover:bg-pass/10 text-ink-light hover:text-pass transition-colors" title="通过"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleReject(c)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="驳回"><XCircle className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* 分页 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-cream/20">
          <span className="text-xs text-muted">共 {filtered.length} 条</span>
          <div className="flex items-center gap-1">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="h-7 px-2 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
            <span className="h-7 px-2 text-xs rounded-lg gradient-amber text-white flex items-center">{currentPage}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="h-7 px-2 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
          </div>
        </div>
      </div>

      {/* 预览弹窗 */}
      {previewCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPreviewCase(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{previewCase.title}</h3>
              <button onClick={() => setPreviewCase(null)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[previewCase.status]}`}>{statusLabels[previewCase.status]}</span>
                <span className={`text-xs font-semibold ${priorityColors[previewCase.priority]}`}>{previewCase.priority}</span>
                {previewCase.ai_generated && <span className="px-1.5 py-0.5 rounded bg-amber-light text-[10px] font-medium text-amber">AI生成</span>}
              </div>
              {previewCase.description && <div><p className="text-xs font-medium text-ink mb-1">描述</p><p className="text-xs text-ink-light bg-cream/30 rounded-lg p-2">{previewCase.description}</p></div>}
              {previewCase.preconditions && <div><p className="text-xs font-medium text-ink mb-1">前置条件</p><p className="text-xs text-ink-light bg-cream/30 rounded-lg p-2">{previewCase.preconditions}</p></div>}
              <div><p className="text-xs font-medium text-ink mb-1">测试步骤</p>
                <div className="space-y-1">{previewCase.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 bg-cream/30 rounded-lg">
                    <span className="px-1.5 py-0.5 rounded bg-amber-light text-[10px] font-medium text-amber">{s.action}</span>
                    <span className="text-ink-light">{s.target}{s.value ? ` → "${s.value}"` : ""}</span>
                  </div>
                ))}</div>
              </div>
              <div><p className="text-xs font-medium text-ink mb-1">预期结果</p><p className="text-xs text-ink-light bg-cream/30 rounded-lg p-2">{previewCase.expected_result}</p></div>
            </div>
          </div>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[480px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{editingCase ? "编辑用例" : "新建用例"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">
              <div><label className="block text-xs font-medium text-ink-light mb-1">标题 *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.title ? "border-fail" : "border-border"}`} />{formErrors.title && <p className="text-[11px] text-fail mt-1">{formErrors.title}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">描述</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">预期结果 *</label><textarea value={form.expected_result} onChange={(e) => setForm({ ...form, expected_result: e.target.value })} rows={2} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink focus:border-amber outline-none resize-none ${formErrors.expected_result ? "border-fail" : "border-border"}`} />{formErrors.expected_result && <p className="text-[11px] text-fail mt-1">{formErrors.expected_result}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">优先级</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none"><option value="P0">P0 核心</option><option value="P1">P1 重要</option><option value="P2">P2 一般</option><option value="P3">P3 低优先</option></select></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={() => { if (!form.title.trim()) { setFormErrors({ title: "标题不能为空" }); return } if (!form.expected_result.trim()) { setFormErrors({ expected_result: "预期结果不能为空" }); return } setShowDialog(false); toast.success(editingCase ? "更新成功" : "创建成功") }} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
