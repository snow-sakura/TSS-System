/**
 * 项目管理 - Web自动化项目CRUD
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, Eye, X, Globe, RefreshCw, Play, Clock, CheckCircle, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { webApi } from "@/lib/api"

interface Project {
  id: number
  name: string
  target_url: string
  description: string
  status: string
  page_count?: number
  test_case_count?: number
  created_at: string
  updated_at: string
}

const initialProjects: Project[] = [
  { id: 1, name: "电商网站测试", target_url: "https://demo.testsite.com", description: "测试电商平台核心功能", status: "已完成", page_count: 5, test_case_count: 12, created_at: "2026-07-15 10:00", updated_at: "2026-07-18 16:30" },
  { id: 2, name: "企业官网验证", target_url: "https://example.com", description: "验证企业官网页面加载和导航", status: "空闲", page_count: 3, test_case_count: 6, created_at: "2026-07-18 09:00", updated_at: "2026-07-18 09:30" },
  { id: 3, name: "博客系统测试", target_url: "https://blog.example.com", description: "测试博客系统的文章发布和评论功能", status: "探索中", page_count: 0, test_case_count: 0, created_at: "2026-07-20 08:00", updated_at: "2026-07-20 08:00" },
]

export default function ProjectList() {
  const [projects, setProjects] = useState(initialProjects)
  const [search, setSearch] = useState("")
  const [localSearch, setLocalSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingProject, setEditingProject] = useState<any>(null)
  const [form, setForm] = useState({ name: "", target_url: "", description: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [previewProject, setPreviewProject] = useState<any>(null)
  const pageSize = 10

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await webApi.listProjects(currentPage)
      if (res?.data?.items) {
        setProjects(res.data.items.map((p: any) => ({
          id: p.id, name: p.name, target_url: p.target_url, description: p.description || "",
          status: p.status, page_count: p.page_count || 0, test_case_count: p.test_case_count || 0,
          created_at: p.created_at, updated_at: p.updated_at,
        })))
      }
    } catch {
      // 保持mock数据
    } finally { setLoading(false) }
  }, [currentPage])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const filtered = projects.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.target_url.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleQuery = () => { setSearch(localSearch); setCurrentPage(1) }
  const handleReset = () => { setLocalSearch(""); setSearch(""); setCurrentPage(1) }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "项目名称不能为空"
    if (!form.target_url.trim()) errors.target_url = "目标URL不能为空"
    else if (!form.target_url.match(/^https?:\/\//)) errors.target_url = "请输入有效的URL（以http://或https://开头）"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      if (dialogMode === "create") {
        await webApi.createProject(form)
        toast.success("项目创建成功")
      } else {
        toast.success("项目更新成功")
      }
      setShowDialog(false)
      fetchProjects()
    } catch {
      toast.error("操作失败")
    }
  }

  const handleDelete = async (p: any) => {
    if (!confirm(`确定删除项目「${p.name}」？`)) return
    try {
      await webApi.deleteProject(p.id)
      toast.success("项目已删除")
      fetchProjects()
    } catch {
      toast.error("删除失败")
    }
  }

  const handleBatchDelete = async () => {
    if (!confirm(`确定删除选中的 ${selectedIds.size} 个项目？`)) return
    for (const id of selectedIds) {
      try { await webApi.deleteProject(Number(id)) } catch {}
    }
    toast.success("批量删除成功")
    setSelectedIds(new Set())
    fetchProjects()
  }

  const openCreate = () => { setDialogMode("create"); setEditingProject(null); setForm({ name: "", target_url: "", description: "" }); setFormErrors({}); setShowDialog(true) }
  const openEdit = (p: any) => { setDialogMode("edit"); setEditingProject(p); setForm({ name: p.name, target_url: p.target_url, description: p.description }); setFormErrors({}); setShowDialog(true) }

  const statusColor = (s: string) => {
    if (s === "已完成") return "bg-pass/10 text-pass border border-pass/20"
    if (s === "探索中") return "bg-amber-light text-warn border border-amber/20"
    return "bg-cream text-muted border border-border"
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">项目管理 <span className="text-xs font-normal text-muted">({filtered.length}个)</span></h2><p className="text-xs text-muted mt-0.5">Web自动化测试项目，支持AI探索与自动执行</p></div>
      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "项目总数", value: projects.length, color: "text-ink" },
          { label: "已完成", value: projects.filter((p) => p.status === "已完成").length, color: "text-pass" },
          { label: "总页面数", value: projects.reduce((s, p) => s + (p.page_count || 0), 0), color: "text-info" },
          { label: "总用例数", value: projects.reduce((s, p) => s + (p.test_case_count || 0), 0), color: "text-warn" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuery()} placeholder="搜索项目名称/URL..." className="w-52 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <button onClick={handleQuery} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> 查询</button>
        <button onClick={handleReset} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> 重置</button>
        <button onClick={fetchProjects} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 ml-auto"><Plus className="w-3.5 h-3.5" /> 新建项目</button>
      </div>
      {/* 批量操作 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between mb-3 px-4 py-2 bg-amber-light/50 border border-amber/20 rounded-xl">
          <span className="text-sm text-ink-light">已选择 <span className="font-semibold text-ink">{selectedIds.size}</span> 个项目</span>
          <button onClick={handleBatchDelete} className="h-7 px-3 text-xs bg-fail text-white hover:bg-fail/80 rounded-lg flex items-center gap-1"><Trash2 className="w-3 h-3" /> 批量删除</button>
        </div>
      )}
      {/* 项目卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paged.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-border shadow-card p-5 hover:shadow-card-hover transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm"><Globe className="w-5 h-5 text-white" /></div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(p.status)}`}>{p.status}</span>
            </div>
            <h3 className="text-sm font-semibold text-ink mb-1">{p.name}</h3>
            <p className="text-[11px] text-muted mb-2 truncate">{p.target_url}</p>
            <p className="text-xs text-ink-light mb-3 line-clamp-2">{p.description || "暂无描述"}</p>
            <div className="flex items-center justify-between text-[11px] text-muted mb-3">
              <span>{p.page_count || 0} 个页面</span>
              <span>{p.test_case_count || 0} 条用例</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/50 pt-3">
              <div className="flex items-center gap-1">
                <input type="checkbox" checked={selectedIds.has(String(p.id))} onChange={() => { const n = new Set(selectedIds); if (n.has(String(p.id))) n.delete(String(p.id)); else n.add(String(p.id)); setSelectedIds(n) }} className="w-4 h-4 rounded border-border text-amber focus:ring-amber" />
                <button onClick={() => setPreviewProject(p)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors"><Eye className="w-4 h-4" /></button>
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
              <span className="text-[11px] text-muted">{p.created_at}</span>
            </div>
          </div>
        ))}
      </div>
      {paged.length === 0 && <div className="text-center py-12 text-muted"><Globe className="w-10 h-10 mx-auto mb-2 text-muted-light" /><p className="text-sm font-medium">暂无项目</p><p className="text-xs mt-1">点击「新建项目」开始AI自动化测试</p></div>}
      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-1 mt-4">
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
          <span className="h-8 px-3 text-xs rounded-lg gradient-amber text-white flex items-center">{currentPage}</span>
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
        </div>
      )}
      {/* 弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[520px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{dialogMode === "create" ? "新建项目" : "编辑项目"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="block text-xs font-medium text-ink-light mb-1">项目名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：电商网站测试" />{formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">目标URL *</label><input value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink font-mono focus:border-amber outline-none ${formErrors.target_url ? "border-fail" : "border-border"}`} placeholder="https://example.com" />{formErrors.target_url && <p className="text-[11px] text-fail mt-1">{formErrors.target_url}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">描述</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="项目描述..." /></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}
      {previewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPreviewProject(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[520px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{previewProject.name}</h3>
              <button onClick={() => setPreviewProject(null)} className="p-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted">状态：</span><span className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(previewProject.status)}`}>{previewProject.status}</span></div><div><span className="text-muted">URL：</span><span className="ml-1 text-ink font-mono text-xs">{previewProject.target_url}</span></div></div>
              <div className="text-sm"><span className="text-muted">描述：</span><p className="text-ink mt-1">{previewProject.description || "暂无描述"}</p></div>
              <div className="grid grid-cols-3 gap-3 text-center"><div><p className="text-lg font-bold text-ink">{previewProject.page_count || 0}</p><p className="text-[11px] text-muted">页面</p></div><div><p className="text-lg font-bold text-ink">{previewProject.test_case_count || 0}</p><p className="text-[11px] text-muted">用例</p></div><div><p className="text-lg font-bold text-ink">{previewProject.created_at}</p><p className="text-[11px] text-muted">创建时间</p></div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
