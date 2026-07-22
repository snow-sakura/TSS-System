import { useState, useEffect, useCallback } from "react"
import { lifecycleApi } from "@/lib/api"
import DataTable, { type ColumnDef } from "../components/DataTable"
import PreviewModal from "../components/PreviewModal"
import { Sparkles, ClipboardList } from "lucide-react"

export default function PlansList() {
  const [items, setItems] = useState<any[]>([])
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 })
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [form, setForm] = useState({ title: "", content: "", source: "manual", status: "draft" })
  const [previewItem, setPreviewItem] = useState<any>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await lifecycleApi.listData("plans", {
        page: pagination.page, page_size: pagination.page_size, search,
        source: sourceFilter || undefined, sort_by: "created_at", sort_order: "desc",
      })
      setItems(res.items || [])
      setPagination((p) => ({ ...p, total: res.total, total_pages: res.total_pages }))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [pagination.page, pagination.page_size, search, sourceFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const columns: ColumnDef[] = [
    { key: "title", label: "方案标题", width: "30%", render: (v, r) => (
      <div className="flex items-center justify-center gap-2"><ClipboardList className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" /><span className="truncate max-w-[200px]">{v?.length > 10 ? v.slice(0, 10) + "..." : v || "未命名"}</span>{r.source === "ai" && <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}</div>
    )},
    { key: "source", label: "来源", width: "10%", render: (v) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${v === "ai" ? "bg-amber-light text-warn" : "bg-info/10 text-info"}`}>{v === "ai" ? "AI" : "手动"}</span>
    )},
    { key: "status", label: "状态", width: "10%", render: (v) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${v === "completed" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{v === "completed" ? "已完成" : "草稿"}</span>
    )},
    { key: "created_at", label: "创建时间", width: "18%", render: (v) => v ? new Date(v).toLocaleString("zh-CN") : "-" },
  ]

  const openCreate = () => { setEditingItem(null); setForm({ title: "", content: "", source: "manual", status: "draft" }); setShowModal(true) }
  const openEdit = (item: any) => { setEditingItem(item); setForm({ title: item.title || "", content: item.content || "", source: item.source || "manual", status: item.status || "draft" }); setShowModal(true) }
  const handleDelete = async (item: any) => { if (!confirm(`确定删除「${item.title || "未命名"}」？`)) return; await lifecycleApi.deleteData("plans", item.id); fetchData() }
  const handleBatchDelete = async (ids: Set<string>) => { if (!confirm(`确定删除选中的 ${ids.size} 条数据？`)) return; for (const id of ids) { await lifecycleApi.deleteData("plans", id) }; fetchData() }
  const handleSave = async () => { if (!form.title.trim()) return; editingItem ? await lifecycleApi.updateData("plans", editingItem.id, form) : await lifecycleApi.createData("plans", form); setShowModal(false); fetchData() }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">方案管理 <span className="text-xs font-normal text-ink-light">({pagination.total}条)</span></h2><p className="text-xs text-ink-light mt-0.5">测试策略与方案管理，点击行预览详情</p></div>
      <DataTable columns={columns} data={items} pagination={pagination} search={search} sourceFilter={sourceFilter} loading={loading}
        onSearch={setSearch} onSourceFilter={setSourceFilter}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        onPageSizeChange={(s) => setPagination((prev) => ({ ...prev, page_size: s, page: 1 }))}
        onCreate={openCreate} onEdit={openEdit} onDelete={handleDelete} onBatchDelete={handleBatchDelete} onRowClick={setPreviewItem} title="" />
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[520px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border"><h3 className="text-sm font-semibold text-ink">{editingItem ? "编辑方案" : "新建方案"}</h3></div>
            <div className="px-6 py-4 space-y-4">
              <div><label className="block text-xs font-medium text-ink-light mb-1">标题 *</label><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="方案标题" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">内容</label><textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={6} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="方案描述..." /></div>
              <div className="flex gap-4">
                <div className="flex-1"><label className="block text-xs font-medium text-ink-light mb-1">来源</label><select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none"><option value="manual">手动</option><option value="ai" disabled={!editingItem}>AI生成</option></select></div>
                <div className="flex-1"><label className="block text-xs font-medium text-ink-light mb-1">状态</label><select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none"><option value="draft">草稿</option><option value="completed">已完成</option></select></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{editingItem ? "保存" : "创建"}</button>
            </div>
          </div>
        </div>
      )}
      {previewItem && <PreviewModal title={previewItem.title || "方案预览"} content={previewItem.content || ""} onClose={() => setPreviewItem(null)} />}
    </div>
  )
}
