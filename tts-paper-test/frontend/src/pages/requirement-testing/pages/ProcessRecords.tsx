/**
 * 流程记录 - 表格列表布局（与需求管理一致）
 * 列表展示 + 搜索筛选 + 新建/编辑弹窗 + 删除确认 + 点击跳转AI自动化
 */
import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus, Search, Edit, Trash2, Eye, X, AlertTriangle, Download, RotateCcw,
  Clock, CheckCircle2, Loader2, FileText, Play, ChevronLeft, ChevronRight
} from "lucide-react"
import { useAutomationStore } from "@/stores/automationStore"

interface ProcessRecord {
  id: number
  name: string
  description: string
  requirementContent: string
  status: "草稿" | "执行中" | "已完成" | "失败"
  createdAt: string
  updatedAt: string
  stagesCompleted: number
  totalStages: number
}

const initialData: ProcessRecord[] = [
  { id: 1, name: "用户登录功能全流程", description: "测试用户登录功能的完整流程", requirementContent: "实现用户登录功能，支持用户名+密码登录方式，需要支持记住密码和自动登录功能。", status: "已完成", createdAt: "2026-07-15 10:30", updatedAt: "2026-07-18 14:20", stagesCompleted: 5, totalStages: 5 },
  { id: 2, name: "商品搜索功能全流程", description: "测试商品搜索功能的完整流程", requirementContent: "实现商品搜索功能，支持关键词搜索、分类筛选、价格区间筛选。", status: "已完成", createdAt: "2026-07-16 09:15", updatedAt: "2026-07-17 11:30", stagesCompleted: 5, totalStages: 5 },
  { id: 3, name: "购物车管理全流程", description: "测试购物车管理功能", requirementContent: "实现购物车功能，支持添加商品、修改数量、删除商品、清空购物车。", status: "执行中", createdAt: "2026-07-17 14:00", updatedAt: "2026-07-17 16:00", stagesCompleted: 3, totalStages: 5 },
  { id: 4, name: "订单支付流程", description: "测试订单支付功能", requirementContent: "实现订单支付流程，支持多种支付方式（支付宝、微信支付、银行卡）。", status: "草稿", createdAt: "2026-07-18 08:45", updatedAt: "2026-07-18 08:45", stagesCompleted: 0, totalStages: 5 },
  { id: 5, name: "用户注册流程", description: "测试用户注册功能", requirementContent: "实现用户注册功能，支持手机号注册、邮箱注册。", status: "已完成", createdAt: "2026-07-19 09:00", updatedAt: "2026-07-19 11:30", stagesCompleted: 5, totalStages: 5 },
  { id: 6, name: "商品详情页流程", description: "测试商品详情页展示", requirementContent: "实现商品详情页，展示商品图片、价格、描述、评价等信息。", status: "草稿", createdAt: "2026-07-19 10:00", updatedAt: "2026-07-19 10:00", stagesCompleted: 0, totalStages: 5 },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  "草稿": { label: "草稿", color: "bg-cream text-muted" },
  "执行中": { label: "执行中", color: "bg-amber-light text-warn" },
  "已完成": { label: "已完成", color: "bg-pass/15 text-pass" },
  "失败": { label: "失败", color: "bg-fail/15 text-fail" },
}

export default function ProcessRecords() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<ProcessRecord[]>(initialData)
  const [searchTerm, setSearchTerm] = useState("")
  const [localSearch, setLocalSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [localStatusFilter, setLocalStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [previewRecord, setPreviewRecord] = useState<ProcessRecord | null>(null)
  const [pageSize] = useState(10)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingRecord, setEditingRecord] = useState<ProcessRecord | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "", requirementContent: "" })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingRecord, setDeletingRecord] = useState<ProcessRecord | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // 搜索+筛选（使用localSearch和localStatusFilter）
  const filteredRecords = useMemo(() => {
    let result = records
    if (localSearch) {
      result = result.filter((r) =>
        r.name.toLowerCase().includes(localSearch.toLowerCase()) ||
        r.description.toLowerCase().includes(localSearch.toLowerCase())
      )
    }
    if (localStatusFilter) {
      result = result.filter((r) => r.status === localStatusFilter)
    }
    return result
  }, [records, localSearch, localStatusFilter])

  // 查询按钮
  const handleQuery = () => { setSearchTerm(localSearch); setStatusFilter(localStatusFilter); setCurrentPage(1) }
  // 重置按钮
  const handleReset = () => { setLocalSearch(""); setLocalStatusFilter(""); setSearchTerm(""); setStatusFilter(""); setCurrentPage(1) }

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const pagedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // CRUD操作
  const openCreate = () => {
    setDialogMode("create")
    setEditingRecord(null)
    setFormData({ name: "", description: "", requirementContent: "" })
    setShowDialog(true)
  }

  const openEdit = (record: ProcessRecord) => {
    setDialogMode("edit")
    setEditingRecord(record)
    setFormData({ name: record.name, description: record.description, requirementContent: record.requirementContent })
    setShowDialog(true)
  }

  const handleSave = () => {
    if (!formData.name.trim()) return
    if (dialogMode === "create") {
      const newRecord: ProcessRecord = {
        id: records.length > 0 ? Math.max(...records.map((r) => r.id)) + 1 : 1,
        ...formData,
        status: "草稿",
        createdAt: new Date().toLocaleString("zh-CN"),
        updatedAt: new Date().toLocaleString("zh-CN"),
        stagesCompleted: 0,
        totalStages: 5,
      }
      setRecords((prev) => [newRecord, ...prev])
    } else if (editingRecord) {
      setRecords((prev) => prev.map((r) =>
        r.id === editingRecord.id ? { ...r, ...formData, updatedAt: new Date().toLocaleString("zh-CN") } : r
      ))
    }
    setShowDialog(false)
  }

  const handleDelete = () => {
    if (!deletingRecord) return
    setRecords((prev) => prev.filter((r) => r.id !== deletingRecord.id))
    setShowDeleteConfirm(false)
    setDeletingRecord(null)
  }

  const handleBatchDelete = () => {
    setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)))
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const toggleSelectAll = () => {
    const pageIds = pagedRecords.map((r) => r.id)
    const allSelected = pageIds.every((id) => selectedIds.has(id))
    if (allSelected) setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.delete(id)); return n })
    else setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.add(id)); return n })
  }

  // 跳转AI自动化 - 使用Zustand存储数据
  const { setCurrentRecord } = useAutomationStore()
  const jumpToAutomation = (record: ProcessRecord) => {
    setCurrentRecord({
      id: record.id,
      name: record.name,
      description: record.description,
      requirementContent: record.requirementContent,
      status: record.status,
      stagesCompleted: record.stagesCompleted,
      totalStages: record.totalStages,
    })
    navigate("/requirement-testing?menu=pipeline")
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-ink">流程记录</h2>
          <span className="text-xs text-ink-light bg-cream px-2 py-1 rounded-md">{filteredRecords.length} 条</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <Input placeholder="搜索记录..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              className="w-44 h-9 pl-9 text-sm bg-white border-border focus:border-amber" />
          </div>
          <select value={localStatusFilter} onChange={(e) => setLocalStatusFilter(e.target.value)}
            className="h-9 px-3 text-sm rounded-xl bg-white border border-border text-ink focus:border-amber focus:outline-none">
            <option value="">全部状态</option>
            <option value="草稿">草稿</option>
            <option value="执行中">执行中</option>
            <option value="已完成">已完成</option>
            <option value="失败">失败</option>
          </select>
          <Button className="h-9 gradient-amber text-white text-sm shadow-sm" onClick={handleQuery}>
            <Search className="w-4 h-4 mr-1" /> 查询
          </Button>
          <Button variant="outline" className="h-9 border-border text-ink-light text-sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" /> 重置
          </Button>
          <Button className="h-9 gradient-amber text-white text-sm shadow-sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> 新建记录
          </Button>
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-sm text-amber-700">已选择 <span className="font-semibold">{selectedIds.size}</span> 条</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-ink-light hover:text-ink">取消选择</button>
            <Button onClick={handleBatchDelete} className="h-7 px-2 text-xs bg-red-500 text-white hover:bg-red-600"><Trash2 className="w-3 h-3 mr-1" /> 批量删除</Button>
          </div>
        </div>
      )}

      {/* 数据表格 */}
      {pagedRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-ink-light">
          <FileText className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-sm font-medium">{searchTerm || statusFilter ? "没有匹配的记录" : "暂无流程记录"}</p>
          <p className="text-xs mt-1 text-gray-400">点击"新建记录"添加流程记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-cream/30">
                <th className="px-4 py-3 w-10 text-center"><input type="checkbox" checked={pagedRecords.length > 0 && pagedRecords.every((r) => selectedIds.has(r.id))} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-amber focus:ring-amber" /></th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-ink-light uppercase">ID</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-ink-light uppercase">记录名称</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-ink-light uppercase">状态</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-ink-light uppercase">进度</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-ink-light uppercase">创建时间</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-ink-light uppercase">更新时间</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-ink-light uppercase">操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((record) => (
                <tr key={record.id} onClick={() => jumpToAutomation(record)} className="border-b border-border/50 last:border-0 hover:bg-cream/50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(record.id)} onChange={() => toggleSelect(record.id)} className="w-4 h-4 rounded border-gray-300 text-amber focus:ring-amber" />
                  </td>
                  <td className="px-5 py-3 text-center text-sm text-ink-light">{record.id}</td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-medium text-ink truncate max-w-[200px]" title={record.name}>{record.name.length > 15 ? record.name.slice(0, 15) + "..." : record.name}</span>
                    </div>
                    <p className="text-xs text-ink-light truncate max-w-[200px] mt-0.5" title={record.description}>{record.description.length > 20 ? record.description.slice(0, 20) + "..." : record.description}</p>
                  </td>
                  <td className="px-5 py-3 text-center"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[record.status]?.color}`}>{record.status}</span></td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full gradient-amber rounded-full" style={{ width: `${(record.stagesCompleted / record.totalStages) * 100}%` }} /></div>
                      <span className="text-xs text-ink-light">{record.stagesCompleted}/{record.totalStages}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center text-xs text-ink-light">{record.createdAt}</td>
                  <td className="px-5 py-3 text-center text-xs text-ink-light">{record.updatedAt}</td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setPreviewRecord(record)} className="p-1.5 rounded-md hover:bg-cream transition-colors" title="预览"><Eye className="w-4 h-4 text-ink-light" /></button>
                      <button onClick={() => openEdit(record)} className="p-1.5 rounded-md hover:bg-cream transition-colors" title="编辑"><Edit className="w-4 h-4 text-ink-light" /></button>
                      <button onClick={() => { setDeletingRecord(record); setShowDeleteConfirm(true) }} className="p-1.5 rounded-md hover:bg-red-50 transition-colors" title="删除"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* 分页 */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-cream/30">
            <span className="text-xs text-ink-light">共 {filteredRecords.length} 条，第 {currentPage}/{totalPages} 页</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => { let page = i + 1; return <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 text-xs rounded-lg ${page === currentPage ? "bg-amber text-white" : "border border-border text-ink-light hover:bg-cream"}`}>{page}</button> })}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-3 py-1 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
            </div>
          </div>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowDialog(false)} />
          <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-lg mx-4 animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-ink">{dialogMode === "create" ? "新建" : "编辑"}流程记录</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">记录名称 <span className="text-red-500">*</span></label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="请输入记录名称" className="h-10 bg-white border-border focus:border-amber" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">描述</label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="请输入描述" className="h-10 bg-white border-border focus:border-amber" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">需求内容</label>
                <textarea value={formData.requirementContent} onChange={(e) => setFormData({ ...formData, requirementContent: e.target.value })} rows={4} placeholder="请输入需求内容..." className="w-full px-3 py-2.5 rounded-xl bg-white border border-border text-sm text-ink placeholder:text-muted focus:border-amber focus:ring-1 focus:ring-amber outline-none resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="h-9 border-border text-ink-light hover:bg-cream">取消</Button>
              <Button onClick={handleSave} className="h-9 gradient-amber text-white">{dialogMode === "create" ? "创建" : "保存"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-sm mx-4 animate-fade-in-up">
            <div className="px-6 py-5 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-red-500" /></div>
              <h3 className="text-base font-semibold text-ink mb-1">确认删除</h3>
              <p className="text-sm text-ink-light">确定要删除 <span className="text-ink font-medium">{deletingRecord?.name}</span> 吗？此操作不可撤销。</p>
            </div>
            <div className="flex items-center justify-center gap-2 px-6 pb-5">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="h-9 border-border text-ink-light hover:bg-cream">取消</Button>
              <Button onClick={handleDelete} className="h-9 bg-red-500 text-white hover:bg-red-600">确认删除</Button>
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setPreviewRecord(null)} />
          <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-lg mx-4 animate-fade-in-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h3 className="text-base font-semibold text-ink">{previewRecord.name}</h3>
              <button onClick={() => setPreviewRecord(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1"><span className="text-xs text-ink-light">ID</span><p className="text-sm font-medium text-ink">{previewRecord.id}</p></div>
                <div className="space-y-1"><span className="text-xs text-ink-light">状态</span><p className="text-sm"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[previewRecord.status]?.color}`}>{previewRecord.status}</span></p></div>
                <div className="space-y-1"><span className="text-xs text-ink-light">创建时间</span><p className="text-sm text-ink">{previewRecord.createdAt}</p></div>
                <div className="space-y-1"><span className="text-xs text-ink-light">更新时间</span><p className="text-sm text-ink">{previewRecord.updatedAt}</p></div>
              </div>
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-ink mb-2">描述</h4>
                <div className="bg-cream/50 rounded-xl p-4 text-sm text-ink-light">{previewRecord.description || "无描述"}</div>
              </div>
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-ink mb-2">需求内容</h4>
                <div className="bg-cream/50 rounded-xl p-4 text-sm text-ink-light whitespace-pre-wrap">{previewRecord.requirementContent || "无内容"}</div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-ink mb-2">执行进度</h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full gradient-amber rounded-full" style={{ width: `${(previewRecord.stagesCompleted / previewRecord.totalStages) * 100}%` }} /></div>
                  <span className="text-sm text-ink">{previewRecord.stagesCompleted}/{previewRecord.totalStages}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
              <Button variant="outline" onClick={() => setPreviewRecord(null)} className="h-9 border-border text-ink-light hover:bg-cream">关闭</Button>
              <Button onClick={() => { setPreviewRecord(null); jumpToAutomation(previewRecord) }} className="h-9 gradient-amber text-white">执行</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
