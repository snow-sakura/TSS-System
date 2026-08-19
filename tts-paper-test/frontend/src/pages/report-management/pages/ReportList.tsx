/**
 * 报告列表 - 测试报告CRUD + 状态 + 预览 + 导出
 * 已对接真实 API，含 apiToReport 转换层
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, Eye, BarChart3, X, Download, FileText, CheckCircle, Clock, Loader2, Filter } from "lucide-react"
import { toast } from "sonner"
import { lifecycleApi } from "@/lib/api"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

const REPORT_TYPES = [
  { key: "version", label: "版本报告", color: "bg-info/10 text-info" },
  { key: "regression", label: "回归报告", color: "bg-pass/10 text-pass" },
  { key: "smoke", label: "冒烟报告", color: "bg-amber-light text-warn" },
  { key: "special", label: "专项报告", color: "bg-purple-100 text-purple-600" },
  { key: "daily", label: "日报", color: "bg-cream text-muted" },
  { key: "weekly", label: "周报", color: "bg-cream text-muted" },
]

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-warn/10 text-warn" },
  published: { label: "已发布", color: "bg-pass/10 text-pass" },
  archived: { label: "已归档", color: "bg-cream text-muted" },
}

/** 后端 API 报告 → UI 展示格式 */
function apiToReport(item: any) {
  const summaryJson = item.summary || {}
  const totalCases = summaryJson.total_cases || summaryJson.totalCases || 0
  const passedCases = summaryJson.passed || summaryJson.passedCases || 0
  const failedCases = summaryJson.failed || summaryJson.failedCases || 0
  const defects = summaryJson.total_defects || summaryJson.defects || (Array.isArray(item.defect_ids) ? item.defect_ids.length : 0)
  const coverage = summaryJson.coverage || summaryJson.pass_rate || 0
  // 由 summary JSON 生成可读的摘要文本
  const summaryText = item.description || (
    totalCases
      ? `共执行 ${totalCases} 个测试用例，通过 ${passedCases} 个，失败 ${failedCases} 个，缺陷 ${defects} 个`
      : "暂无摘要数据"
  )
  return {
    id: item.id,
    title: item.name || item.title || "",
    type: item.report_type || "version",
    status: item.status || "draft",
    author: item.created_by_username || "系统",
    summary: summaryText,
    totalCases,
    passedCases,
    failedCases,
    coverage: typeof coverage === "number" ? Math.round(coverage) : 0,
    defects,
    ai_generated: !!item.ai_generated,
    createdAt: item.created_at ? new Date(item.created_at).toLocaleString("zh-CN") : "",
    publishedAt: item.published_at ? new Date(item.published_at).toLocaleString("zh-CN") : "",
  }
}

/** UI 格式 → 后端 API payload */
function formToPayload(form: any) {
  return {
    name: form.title || "",
    report_type: form.type || "version",
    description: form.summary || "",
  }
}

export default function ReportList() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [previewReport, setPreviewReport] = useState<any>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingReport, setEditingReport] = useState<any>(null)
  const [form, setForm] = useState({ title: "", type: "version", summary: "" })
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  const PAGE_SIZE = 10

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: PAGE_SIZE }
      if (filterStatus) params.status = filterStatus
      const res: any = await lifecycleApi.listReports(params)
      const data = res?.data || res
      const items = data?.items || data?.data || []
      setReports(items.map(apiToReport))
      setTotal(data?.total || items.length)
    } catch (e: any) {
      toast.error("加载报告列表失败: " + (e?.message || "未知错误"))
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus])

  useEffect(() => { fetchReports() }, [fetchReports])

  const filtered = reports.filter((r) => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || r.type === filterType
    return matchSearch && matchType
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const stats = {
    total,
    published: reports.filter((r) => r.status === "published").length,
    draft: reports.filter((r) => r.status === "draft").length,
    totalCases: reports.reduce((s, r) => s + r.totalCases, 0),
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("标题不能为空"); return }
    try {
      const payload = formToPayload(form)
      if (dialogMode === "create") {
        await lifecycleApi.createReport(payload)
        toast.success("报告创建成功")
      } else if (editingReport) {
        await lifecycleApi.updateReport(editingReport.id, payload)
        toast.success("报告更新成功")
      }
      setShowDialog(false)
      fetchReports()
    } catch (e: any) {
      toast.error("保存失败: " + (e?.message || "未知错误"))
    }
  }

  const confirmDelete = async () => {
    try {
      await lifecycleApi.deleteReport(deleteTarget.id)
      toast.success("报告已删除")
      setDeleteTarget(null)
      fetchReports()
    } catch (e: any) {
      toast.error("删除失败: " + (e?.message || "未知错误"))
    }
  }

  const handleExport = () => {
    if (filtered.length === 0) { toast.error("没有可导出的数据"); return }
    const data = filtered.map((r) => ({
      ID: r.id, 标题: r.title, 类型: REPORT_TYPES.find((t) => t.key === r.type)?.label || r.type,
      状态: STATUS_MAP[r.status]?.label || r.status, 用例总数: r.totalCases, 通过: r.passedCases,
      失败: r.failedCases, 覆盖率: `${r.coverage}%`, 缺陷数: r.defects, 创建时间: r.createdAt,
    }))
    const csv = [Object.keys(data[0]).join(","), ...data.map((d) => Object.values(d).join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `测试报告_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success("导出成功")
  }

  const getPassRate = (r: any) => r.totalCases ? Math.round((r.passedCases / r.totalCases) * 100) : 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink">报告列表</h2>
        <p className="text-xs text-muted mt-0.5">测试报告管理 · AI生成 · 发布归档 · 数据导出</p>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-ink">{stats.total}</p><p className="text-[11px] text-muted">报告总数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-pass">{stats.published}</p><p className="text-[11px] text-muted">已发布</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-warn">{stats.draft}</p><p className="text-[11px] text-muted">草稿</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-info">{stats.totalCases}</p><p className="text-[11px] text-muted">总用例数</p></div>
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="搜索报告标题..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
          <option value="">全部类型</option>
          {REPORT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
        <button onClick={handleExport} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 导出</button>
        <button onClick={() => { setDialogMode("create"); setEditingReport(null); setForm({ title: "", type: "version", summary: "" }); setShowDialog(true) }} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 新建报告</button>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-amber animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream/30 border-b border-border">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-10">ID</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">报告标题</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">类型</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">状态</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">用例数</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">通过率</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">缺陷数</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">作者</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted"><BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-light" /><p className="text-sm">暂无报告</p></td></tr>
              ) : filtered.map((r) => {
                const passRate = getPassRate(r)
                const typeInfo = REPORT_TYPES.find((t) => t.key === r.type)
                const statusInfo = STATUS_MAP[r.status]
                return (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-cream/20 transition-colors">
                    <td className="px-4 py-2.5 text-[11px] text-muted font-mono">#{r.id}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-ink truncate max-w-[200px]">{r.title}</span>
                        {r.ai_generated && <span className="px-1 py-0.5 rounded bg-amber/10 text-amber text-[9px] font-medium">AI</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${typeInfo?.color || "bg-cream text-muted"}`}>{typeInfo?.label || r.type}</span></td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusInfo?.color || "bg-cream text-muted"}`}>{statusInfo?.label || r.status}</span></td>
                    <td className="px-4 py-2.5 text-[11px] text-ink">{r.totalCases}</td>
                    <td className="px-4 py-2.5"><span className={`text-[11px] font-medium ${passRate >= 90 ? "text-pass" : passRate >= 70 ? "text-warn" : "text-fail"}`}>{r.totalCases ? `${passRate}%` : "-"}</span></td>
                    <td className="px-4 py-2.5 text-[11px] text-ink">{r.defects}</td>
                    <td className="px-4 py-2.5 text-[11px] text-muted">{r.author}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setPreviewReport(r)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => { setDialogMode("edit"); setEditingReport(r); setForm({ title: r.title, type: r.type, summary: r.summary }); setShowDialog(true) }} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-cream/20">
            <span className="text-xs text-muted">共 {total} 条，第 {page}/{totalPages} 页</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
              <span className="h-8 px-3 text-xs rounded-lg gradient-amber text-white flex items-center">{page}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
            </div>
          </div>
        )}
      </div>

      {/* 预览弹窗 */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPreviewReport(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[640px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Eye className="w-4 h-4 text-amber" /> 报告预览 — {previewReport.title}</h3>
              <button onClick={() => setPreviewReport(null)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 rounded-xl bg-cream/30"><p className="text-2xl font-bold text-ink">{previewReport.totalCases}</p><p className="text-[11px] text-muted">用例总数</p></div>
                <div className="text-center p-3 rounded-xl bg-pass/5"><p className="text-2xl font-bold text-pass">{getPassRate(previewReport)}%</p><p className="text-[11px] text-muted">通过率</p></div>
                <div className="text-center p-3 rounded-xl bg-fail/5"><p className="text-2xl font-bold text-fail">{previewReport.defects}</p><p className="text-[11px] text-muted">缺陷数</p></div>
              </div>
              <div className="bg-cream/30 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-ink mb-2">报告摘要</h4>
                <p className="text-sm text-ink leading-relaxed">{previewReport.summary || "暂无摘要"}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button onClick={() => setPreviewReport(null)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">关闭</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下报告？" itemName={deleteTarget?.title || ""} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[520px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{dialogMode === "create" ? "新建报告" : "编辑报告"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="block text-xs font-medium text-ink-light mb-1">报告标题 *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="如：v2.1.0版本测试报告" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">报告类型</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none bg-white">{REPORT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">报告摘要</label><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={4} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="报告摘要..." /></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
