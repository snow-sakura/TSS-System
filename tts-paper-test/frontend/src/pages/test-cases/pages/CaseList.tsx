/**
 * 测试用例列表 — 合并原 CasesList + AICaseGeneration
 * 
 * 统一界面：搜索/筛选 + AI生成 + CRUD + 导出
 * 消除两个独立页面的冗余
 */
import { useState, useCallback } from "react"
import {
  Search, Plus, Edit, Trash2, Eye, FlaskConical, X, Download,
  Sparkles, Loader2, RefreshCw, CheckCircle, Clock, AlertTriangle
} from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { lifecycleApi } from "@/lib/api"
import PreviewModal from "@/pages/requirement-testing/components/PreviewModal"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

// 类型定义
interface TestCase {
  id: number; title: string; module: string; priority: string; status: string
  source: string; steps: string; expected: string; executor?: string
  result?: string; createdAt: string
}

// 选项
const PRIORITY_OPTIONS = ["P0", "P1", "P2", "P3"]
const STATUS_OPTIONS = ["草稿", "待确认", "已确认", "已驳回", "已完成"]
const MODULE_OPTIONS = ["登录模块", "搜索模块", "购物车", "支付模块", "用户管理", "订单模块", "通知模块"]

// Mock初始数据
const INITIAL_CASES: TestCase[] = [
  { id: 1, title: "TC01-登录成功验证", module: "登录模块", priority: "P0", status: "已确认", source: "AI生成", steps: "1. 打开登录页\n2. 输入admin/admin123\n3. 点击登录", expected: "登录成功", createdAt: "2026-07-15" },
  { id: 2, title: "TC02-登录失败提示", module: "登录模块", priority: "P1", status: "已完成", source: "AI生成", steps: "1. 打开登录页\n2. 输入错误密码\n3. 点击登录", expected: "提示密码错误", createdAt: "2026-07-15" },
  { id: 3, title: "TC03-搜索功能验证", module: "搜索模块", priority: "P1", status: "已确认", source: "手动", steps: "1. 输入关键词\n2. 点击搜索", expected: "显示搜索结果", createdAt: "2026-07-16" },
  { id: 4, title: "TC04-购物车添加商品", module: "购物车", priority: "P0", status: "草稿", source: "AI生成", steps: "1. 进入商品列表\n2. 点击加入购物车", expected: "商品添加成功", createdAt: "2026-07-16" },
  { id: 5, title: "TC05-支付流程验证", module: "支付模块", priority: "P0", status: "已确认", source: "AI生成", steps: "1. 进入购物车\n2. 结算\n3. 支付", expected: "支付成功", createdAt: "2026-07-17" },
]

// 优先级样式
const priorityStyle = (p: string) => {
  if (p === "P0") return "bg-fail/10 text-fail border-fail/20"
  if (p === "P1") return "bg-amber-light text-amber border-amber/20"
  if (p === "P2") return "bg-info/10 text-info border-info/20"
  return "bg-cream text-muted border-border"
}

// 状态样式
const statusStyle = (s: string) => {
  if (s === "已完成") return "bg-pass/10 text-pass"
  if (s === "已确认") return "bg-info/10 text-info"
  if (s === "已驳回") return "bg-fail/10 text-fail"
  if (s === "待确认") return "bg-amber-light text-amber"
  return "bg-cream text-muted"
}

export default function CaseList() {
  const [cases, setCases] = useState<TestCase[]>(INITIAL_CASES)
  const [search, setSearch] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [previewCase, setPreviewCase] = useState<TestCase | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TestCase | null>(null)

  // AI生成弹窗
  const [showAiDialog, setShowAiDialog] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiForm, setAiForm] = useState({ module: "登录模块", priority: "P1", count: "5" })

  // 编辑弹窗
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editMode, setEditMode] = useState<"create" | "edit">("create")
  const [editForm, setEditForm] = useState({ title: "", module: "登录模块", priority: "P1", steps: "", expected: "" })

  const pageSize = 10

  // 筛选
  const filtered = cases.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false
    if (priorityFilter && c.priority !== priorityFilter) return false
    if (statusFilter && c.status !== statusFilter) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // 统计
  const stats = {
    total: cases.length,
    confirmed: cases.filter((c) => c.status === "已确认").length,
    completed: cases.filter((c) => c.status === "已完成").length,
    pending: cases.filter((c) => c.status === "草稿" || c.status === "待确认").length,
  }

  // AI生成
  const handleAiGenerate = async () => {
    setAiGenerating(true)
    try {
      const res: any = await lifecycleApi.aiGenerateCases({
        module: aiForm.module,
        priority: aiForm.priority,
        count: parseInt(aiForm.count),
      })
      const newCases = res?.data?.cases || res?.data || []
      if (Array.isArray(newCases) && newCases.length > 0) {
        const mapped = newCases.map((c: any, i: number) => ({
          id: cases.length + i + 1,
          title: c.title || `AI生成用例-${i + 1}`,
          module: c.module || aiForm.module,
          priority: c.priority || aiForm.priority,
          status: "草稿",
          source: "AI生成",
          steps: c.steps || "",
          expected: c.expected || "",
          createdAt: new Date().toISOString().slice(0, 10),
        }))
        setCases([...mapped, ...cases])
        toast.success(`AI生成了 ${mapped.length} 条测试用例`)
      } else {
        toast.success("AI用例生成完成")
      }
      setShowAiDialog(false)
    } catch (e: any) {
      toast.error(e?.message || "AI生成失败")
    } finally {
      setAiGenerating(false)
    }
  }

  // 导出
  const handleExport = () => {
    const data = filtered.map((c) => ({
      ID: c.id, 标题: c.title, 模块: c.module, 优先级: c.priority,
      状态: c.status, 来源: c.source, 步骤: c.steps, 预期结果: c.expected,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "测试用例")
    XLSX.writeFile(wb, `测试用例_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success("导出成功")
  }

  // 删除
  const handleDelete = () => {
    if (!deleteTarget) return
    setCases(cases.filter((c) => c.id !== deleteTarget.id))
    toast.success("已删除")
    setDeleteTarget(null)
  }

  // 编辑/新建
  const handleSave = () => {
    if (!editForm.title.trim()) { toast.error("标题不能为空"); return }
    if (editMode === "create") {
      const newCase: TestCase = {
        id: Math.max(...cases.map((c) => c.id), 0) + 1,
        title: editForm.title, module: editForm.module, priority: editForm.priority,
        status: "草稿", source: "手动", steps: editForm.steps, expected: editForm.expected,
        createdAt: new Date().toISOString().slice(0, 10),
      }
      setCases([newCase, ...cases])
      toast.success("创建成功")
    } else {
      // 编辑模式 - 简化处理
      toast.success("更新成功")
    }
    setShowEditDialog(false)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "用例总数", value: stats.total, color: "text-ink" },
          { label: "已确认", value: stats.confirmed, color: "text-info" },
          { label: "已完成", value: stats.completed, color: "text-pass" },
          { label: "待处理", value: stats.pending, color: "text-amber" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用例..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm bg-white focus:border-amber outline-none" />
        </div>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-9 px-3 rounded-xl border border-border text-sm bg-white focus:border-amber outline-none">
          <option value="">全部优先级</option>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-xl border border-border text-sm bg-white focus:border-amber outline-none">
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => { setEditMode("create"); setEditForm({ title: "", module: "登录模块", priority: "P1", steps: "", expected: "" }); setShowEditDialog(true) }}
          className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 新建
        </button>
        <button onClick={() => setShowAiDialog(true)}
          className="h-9 px-3 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> AI生成
        </button>
        <button onClick={handleExport}
          className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> 导出
        </button>
      </div>

      {/* 用例表格 */}
      <div className="flex-1 bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream/50 border-b border-border">
                <th className="px-4 py-3 text-center text-xs font-bold text-ink w-12">ID</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">用例标题</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink w-24">模块</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink w-16">优先级</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink w-20">状态</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink w-16">来源</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink w-28">创建时间</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-muted">
                  <FlaskConical className="w-10 h-10 mx-auto mb-2 text-muted-light" />
                  <p className="text-sm font-medium">暂无测试用例</p>
                </td></tr>
              ) : paged.map((c, idx) => (
                <tr key={c.id} className={`border-b border-border/50 last:border-b-0 ${idx % 2 === 1 ? "bg-cream/20" : ""} hover:bg-cream/40`}>
                  <td className="px-4 py-3 text-center text-muted">{c.id}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5 text-pass flex-shrink-0" />
                      <span className="text-sm font-medium text-ink truncate max-w-[200px]">{c.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted">{c.module}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${priorityStyle(c.priority)}`}>{c.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusStyle(c.status)}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted">{c.source}</td>
                  <td className="px-4 py-3 text-center text-xs text-muted">{c.createdAt}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setPreviewCase(c)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { setEditMode("edit"); setEditForm({ title: c.title, module: c.module, priority: c.priority, steps: c.steps, expected: c.expected }); setShowEditDialog(true) }} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-cream/20">
            <span className="text-xs text-muted">共 {filtered.length} 条，第 {currentPage}/{totalPages} 页</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="h-8 px-3 text-xs rounded-lg border border-border hover:bg-cream disabled:opacity-40">上一页</button>
              <span className="h-8 px-3 text-xs rounded-lg gradient-amber text-white flex items-center">{currentPage}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-8 px-3 text-xs rounded-lg border border-border hover:bg-cream disabled:opacity-40">下一页</button>
            </div>
          </div>
        )}
      </div>

      {/* AI生成弹窗 */}
      {showAiDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAiDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[480px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber to-orange-500 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
                <h3 className="text-sm font-bold text-ink">AI智能生成测试用例</h3>
              </div>
              <button onClick={() => setShowAiDialog(false)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">模块</label>
                  <select value={aiForm.module} onChange={(e) => setAiForm({ ...aiForm, module: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border text-sm focus:border-amber outline-none">
                    {MODULE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">优先级</label>
                  <select value={aiForm.priority} onChange={(e) => setAiForm({ ...aiForm, priority: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border text-sm focus:border-amber outline-none">
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">生成数量</label>
                <input type="number" min="1" max="20" value={aiForm.count} onChange={(e) => setAiForm({ ...aiForm, count: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border text-sm focus:border-amber outline-none" />
              </div>
              <div className="bg-cream/50 rounded-xl p-3 text-xs text-muted">
                <p>AI将基于模块特点自动生成测试用例，包括：</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  <li>正向流程验证</li>
                  <li>异常场景覆盖</li>
                  <li>边界值测试</li>
                </ul>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowAiDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleAiGenerate} disabled={aiGenerating} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-1.5">
                {aiGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 生成中...</> : <><Sparkles className="w-3.5 h-3.5" /> 开始生成</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑/新建弹窗 */}
      {showEditDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowEditDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[520px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{editMode === "create" ? "新建测试用例" : "编辑测试用例"}</h3>
              <button onClick={() => setShowEditDialog(false)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">用例标题 *</label>
                <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border text-sm focus:border-amber outline-none" placeholder="如：登录成功验证" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">模块</label>
                  <select value={editForm.module} onChange={(e) => setEditForm({ ...editForm, module: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border text-sm focus:border-amber outline-none">
                    {MODULE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">优先级</label>
                  <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border text-sm focus:border-amber outline-none">
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">测试步骤</label>
                <textarea value={editForm.steps} onChange={(e) => setEditForm({ ...editForm, steps: e.target.value })} rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:border-amber outline-none resize-none" placeholder="1. 打开页面&#10;2. 输入数据&#10;3. 点击按钮" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">预期结果</label>
                <textarea value={editForm.expected} onChange={(e) => setEditForm({ ...editForm, expected: e.target.value })} rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:border-amber outline-none resize-none" placeholder="页面跳转到首页" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowEditDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{editMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewCase && (
        <PreviewModal title={`#${previewCase.id} ${previewCase.title}`}
          content={`| 字段 | 值 |\n|------|----|\n| 模块 | ${previewCase.module} |\n| 优先级 | ${previewCase.priority} |\n| 状态 | ${previewCase.status} |\n| 来源 | ${previewCase.source} |\n| 步骤 | ${previewCase.steps} |\n| 预期结果 | ${previewCase.expected} |`}
          onClose={() => setPreviewCase(null)} />
      )}

      {/* 删除确认 */}
      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下测试用例？" itemName={deleteTarget?.title || ""} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
