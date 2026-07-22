/**
 * Bug知识库 - 连接真实API
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, Eye, X, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { knowledgeApi } from "@/lib/api"
import { Skeleton } from "@/components/ui/Skeleton"

interface BugKnowledgeItem {
  id: number
  title: string
  module: string
  severity: string
  root_cause: string
  solution: string
  symptoms: string
  reproduction_steps: string
  environment: string
  tags: string
  occurrence_count: number
  status: string
}

export default function BugKnowledge() {
  const [bugs, setBugs] = useState<BugKnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [severityFilter, setSeverityFilter] = useState("")
  const [selectedBug, setSelectedBug] = useState<BugKnowledgeItem | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingBug, setEditingBug] = useState<BugKnowledgeItem | null>(null)
  const [form, setForm] = useState({ title: "", module: "", severity: "P1", root_cause: "", solution: "", symptoms: "", reproduction_steps: "", environment: "", tags: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 })

  const fetchBugs = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await knowledgeApi.listBugKnowledge({
        page: pagination.page,
        page_size: pagination.page_size,
        search: search || undefined,
        severity: severityFilter || undefined,
      })
      if (res?.data) {
        setBugs(res.data.items || [])
        setPagination((p) => ({ ...p, total: res.data.total, total_pages: res.data.total_pages }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.page_size, search, severityFilter])

  useEffect(() => { fetchBugs() }, [fetchBugs])

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.title.trim()) errors.title = "标题不能为空"
    if (!form.root_cause.trim()) errors.root_cause = "根因不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      if (editingBug) {
        await knowledgeApi.updateBugKnowledge(editingBug.id, form)
        toast.success("Bug更新成功")
      } else {
        await knowledgeApi.createBugKnowledge(form)
        toast.success("Bug创建成功")
      }
      setShowDialog(false)
      fetchBugs()
    } catch (e) {
      toast.error("操作失败")
    }
  }

  const handleDelete = async (b: BugKnowledgeItem) => {
    if (!confirm(`确定删除Bug「${b.title}」？`)) return
    try {
      await knowledgeApi.deleteBugKnowledge(b.id)
      toast.success("Bug已删除")
      fetchBugs()
    } catch (e) {
      toast.error("删除失败")
    }
  }

  const openCreate = () => {
    setEditingBug(null)
    setForm({ title: "", module: "", severity: "P1", root_cause: "", solution: "", symptoms: "", reproduction_steps: "", environment: "", tags: "" })
    setFormErrors({})
    setShowDialog(true)
  }

  const openEdit = (b: BugKnowledgeItem) => {
    setEditingBug(b)
    setForm({ title: b.title, module: b.module || "", severity: b.severity, root_cause: b.root_cause || "", solution: b.solution || "", symptoms: b.symptoms || "", reproduction_steps: b.reproduction_steps || "", environment: b.environment || "", tags: b.tags || "" })
    setFormErrors({})
    setShowDialog(true)
  }

  const severityColor = (s: string) => {
    if (s === "P0") return "bg-fail/10 text-fail border border-fail/20"
    if (s === "P1") return "bg-warn/10 text-warn border border-warn/20"
    if (s === "P2") return "bg-info/10 text-info border border-info/20"
    return "bg-cream text-muted border border-border"
  }

  const statusColor = (s: string) => {
    if (s === "已解决") return "bg-pass/10 text-pass border border-pass/20"
    if (s === "待解决") return "bg-warn/10 text-warn border border-warn/20"
    return "bg-cream text-muted border border-border"
  }

  const parseTags = (tags: string) => tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : []

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">Bug知识库 <span className="text-xs font-normal text-muted">({pagination.total}条)</span></h2><p className="text-xs text-muted mt-0.5">常见Bug根因和解决方案，支持严重程度分类和AI分析</p></div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchBugs()} placeholder="搜索Bug标题/根因..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部严重程度</option><option value="P0">P0 致命</option><option value="P1">P1 严重</option><option value="P2">P2 一般</option><option value="P3">P3 轻微</option></select>
        <button onClick={fetchBugs} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 ml-auto"><Plus className="w-3.5 h-3.5" /> 新建Bug</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Skeleton className="h-4 w-48" count={3} /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 overflow-y-auto">
          {bugs.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-border shadow-card p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${severityColor(b.severity)}`}>{b.severity}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(b.status)}`}>{b.status}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSelectedBug(b)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-700 transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(b)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h4 className="text-sm font-semibold text-ink mb-1">{b.title}</h4>
              {b.module && <p className="text-[11px] text-muted mb-1">模块：{b.module}</p>}
              <p className="text-xs text-ink-light mb-2 line-clamp-2">{b.root_cause}</p>
              <div className="flex flex-wrap gap-1 mb-2">{parseTags(b.tags).map((t) => (<span key={t} className="px-1.5 py-0.5 rounded bg-cream text-[10px] text-muted">{t}</span>))}</div>
              {b.occurrence_count > 1 && <p className="text-[11px] text-warn">出现 {b.occurrence_count} 次</p>}
            </div>
          ))}
          {bugs.length === 0 && <div className="col-span-2 text-center py-12 text-muted text-sm">暂无Bug记录</div>}
        </div>
      )}

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{editingBug ? "编辑Bug" : "新建Bug"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">
              <div><label className="block text-xs font-medium text-ink-light mb-1">标题 *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.title ? "border-fail" : "border-border"}`} placeholder="如：登录接口未做速率限制" />{formErrors.title && <p className="text-[11px] text-fail mt-1">{formErrors.title}</p>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">所属模块</label><input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="如：登录模块" /></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">严重程度</label><select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none"><option value="P0">P0 致命</option><option value="P1">P1 严重</option><option value="P2">P2 一般</option><option value="P3">P3 轻微</option></select></div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">根本原因 *</label><textarea value={form.root_cause} onChange={(e) => setForm({ ...form, root_cause: e.target.value })} rows={3} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink focus:border-amber outline-none resize-none ${formErrors.root_cause ? "border-fail" : "border-border"}`} placeholder="分析Bug的根本原因..." />{formErrors.root_cause && <p className="text-[11px] text-fail mt-1">{formErrors.root_cause}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">解决方案</label><textarea value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="如何修复这个Bug..." /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">症状描述</label><textarea value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="Bug的表现症状..." /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">标签（逗号分隔）</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="安全, 认证, 限流" /></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">保存</button>
            </div>
          </div>
        </div>
      )}

      {selectedBug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedBug(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{selectedBug.title}</h3>
              <button onClick={() => setSelectedBug(null)} className="p-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${severityColor(selectedBug.severity)}`}>{selectedBug.severity}</span><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(selectedBug.status)}`}>{selectedBug.status}</span></div>
              {selectedBug.module && <div><p className="text-xs font-medium text-ink mb-1">所属模块</p><p className="text-xs text-ink-light bg-cream/30 rounded-lg p-2">{selectedBug.module}</p></div>}
              <div><p className="text-xs font-medium text-ink mb-1">根本原因</p><p className="text-xs text-ink-light bg-cream/30 rounded-lg p-2">{selectedBug.root_cause}</p></div>
              {selectedBug.solution && <div><p className="text-xs font-medium text-ink mb-1">解决方案</p><p className="text-xs text-ink-light bg-cream/30 rounded-lg p-2">{selectedBug.solution}</p></div>}
              {selectedBug.symptoms && <div><p className="text-xs font-medium text-ink mb-1">症状描述</p><p className="text-xs text-ink-light bg-cream/30 rounded-lg p-2">{selectedBug.symptoms}</p></div>}
              <div><p className="text-xs font-medium text-ink mb-1">标签</p><div className="flex flex-wrap gap-1">{parseTags(selectedBug.tags).map((t) => <span key={t} className="px-2 py-0.5 rounded bg-cream text-[11px] text-muted">{t}</span>)}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
