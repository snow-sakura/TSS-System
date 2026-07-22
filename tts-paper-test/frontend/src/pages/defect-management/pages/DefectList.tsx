/**
 * 缺陷列表 - CRUD + 优先级 + 严重程度 + 状态 + 分配 + API对接
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, Eye, Bug, X, Download, Sparkles, Play, AlertTriangle, User, RefreshCw, Loader2 } from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import PreviewModal from "../../requirement-testing/components/PreviewModal"
import { lifecycleApi } from "@/lib/api"

const severityOptions = ["致命", "严重", "一般", "轻微", "建议"]
const priorityOptions = ["P0", "P1", "P2", "P3"]
const statusOptions = ["新建", "已确认", "修复中", "已修复", "已验证", "已关闭", "重新打开"]
const moduleOptions = ["登录模块", "搜索模块", "购物车", "支付模块", "用户管理", "订单模块", "通知模块"]
const assigneeOptions = ["admin", "zhangsan", "wangwu", "lisi", "zhaoliu"]

const initialDefects: Record<string, any>[] = [
  { id: 1, title: "登录页面密码输入框未显示明文切换按钮", module: "登录模块", severity: "一般", priority: "P1", status: "修复中", assignee: "zhangsan", reporter: "admin", steps: "1. 打开登录页\n2. 输入密码\n3. 无法切换明文", expected: "应有眼睛图标切换明文", actual: "无切换按钮", environment: "Chrome 126 / macOS", createdAt: "2026-07-18 10:00", updatedAt: "2026-07-19 14:30", aiAnalysis: "密码输入框缺少type切换组件，需添加Eye/EyeOff图标" },
  { id: 2, title: "搜索结果分页显示不正确", module: "搜索模块", severity: "严重", priority: "P0", status: "已修复", assignee: "wangwu", reporter: "zhangsan", steps: "1. 搜索关键词\n2. 点击第2页\n3. 显示第1页数据", expected: "正确显示第2页数据", actual: "分页未生效", environment: "Chrome 126 / Windows", createdAt: "2026-07-17 09:00", updatedAt: "2026-07-18 16:00", aiAnalysis: "分页参数未正确传递到API，page参数偏移量计算错误" },
  { id: 3, title: "购物车商品数量不能小于1", module: "购物车", severity: "一般", priority: "P1", status: "已确认", assignee: "zhangsan", reporter: "wangwu", steps: "1. 进入购物车\n2. 点击数量减号\n3. 数量变为0", expected: "最小数量为1", actual: "可以减到0", environment: "Safari 18 / macOS", createdAt: "2026-07-19 11:00", updatedAt: "2026-07-19 11:00", aiAnalysis: "" },
  { id: 4, title: "支付超时后订单状态异常", module: "支付模块", severity: "致命", priority: "P0", status: "新建", assignee: "", reporter: "admin", steps: "1. 进入支付\n2. 等待超时\n3. 查看订单状态", expected: "订单状态回退为待支付", actual: "状态变为未知", environment: "All browsers", createdAt: "2026-07-20 09:00", updatedAt: "2026-07-20 09:00", aiAnalysis: "" },
  { id: 5, title: "用户头像上传超过2MB未提示", module: "用户管理", severity: "轻微", priority: "P2", status: "已修复", assignee: "lisi", reporter: "zhangsan", steps: "1. 上传3MB图片\n2. 无提示直接失败", expected: "提示文件过大", actual: "无任何提示", environment: "Chrome 126 / macOS", createdAt: "2026-07-16 14:00", updatedAt: "2026-07-17 10:00", aiAnalysis: "文件大小校验在前端完成，但错误提示未显示" },
  { id: 6, title: "订单列表导出CSV编码乱码", module: "订单模块", severity: "严重", priority: "P0", status: "已确认", assignee: "wangwu", reporter: "admin", steps: "1. 导出CSV\n2. 用Excel打开", expected: "正常显示中文", actual: "中文乱码", environment: "Windows Excel", createdAt: "2026-07-18 08:00", updatedAt: "2026-07-18 15:00", aiAnalysis: "CSV导出未添加BOM头，Windows默认UTF-8无BOM导致乱码" },
  { id: 7, title: "邮件通知模板格式错乱", module: "通知模块", severity: "轻微", priority: "P2", status: "已关闭", assignee: "lisi", reporter: "wangwu", steps: "1. 触发通知\n2. 查看邮件", expected: "格式正确的邮件", actual: "HTML标签显示为文本", environment: "Gmail", createdAt: "2026-07-15 10:00", updatedAt: "2026-07-16 09:00", aiAnalysis: "邮件内容Content-Type未设置为text/html" },
  { id: 8, title: "登录接口未做速率限制", module: "登录模块", severity: "致命", priority: "P0", status: "修复中", assignee: "admin", reporter: "admin", steps: "1. 连续发送100次登录请求\n2. 无任何限制", expected: "应限制频率", actual: "无限制", environment: "All", createdAt: "2026-07-19 08:00", updatedAt: "2026-07-20 10:00", aiAnalysis: "后端auth路由缺少IP级别的速率限制中间件" },
  { id: 9, title: "购物车并发添加商品数量异常", module: "购物车", severity: "严重", priority: "P0", status: "新建", assignee: "", reporter: "wangwu", steps: "1. 多标签页同时添加\n2. 查看购物车数量", expected: "正确累计", actual: "数量不一致", environment: "Chrome多标签", createdAt: "2026-07-20 11:00", updatedAt: "2026-07-20 11:00", aiAnalysis: "" },
  { id: 10, title: "订单详情页金额显示精度问题", module: "订单模块", severity: "建议", priority: "P3", status: "已关闭", assignee: "zhangsan", reporter: "lisi", steps: "1. 查看订单详情\n2. 金额显示99.999", expected: "金额精确到分", actual: "多位小数", environment: "All", createdAt: "2026-07-14 09:00", updatedAt: "2026-07-15 11:00", aiAnalysis: "浮点数精度问题，需使用toFixed(2)或Decimal类型" },
  { id: 11, title: "搜索关键词高亮未生效", module: "搜索模块", severity: "轻微", priority: "P2", status: "已修复", assignee: "wangwu", reporter: "admin", steps: "1. 搜索关键词\n2. 查看结果", expected: "关键词高亮显示", actual: "无高亮", environment: "All", createdAt: "2026-07-17 15:00", updatedAt: "2026-07-18 12:00", aiAnalysis: "" },
  { id: 12, title: "用户注册邮箱验证链接过期时间太短", module: "用户管理", severity: "建议", priority: "P3", status: "重新打开", assignee: "lisi", reporter: "wangwu", steps: "1. 注册账号\n2. 等2小时后点击验证链接", expected: "链接仍有效", actual: "链接已过期", environment: "All", createdAt: "2026-07-16 10:00", updatedAt: "2026-07-20 08:00", aiAnalysis: "验证链接有效期设置为1小时，建议延长至24小时" },
]

export default function DefectList() {
  const [defects, setDefects] = useState(initialDefects)
  const [search, setSearch] = useState("")
  const [localSearch, setLocalSearch] = useState("")
  const [severityFilter, setSeverityFilter] = useState("")
  const [localSeverityFilter, setLocalSeverityFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [localStatusFilter, setLocalStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewDefect, setPreviewDefect] = useState<any>(null)
  const [sortKey, setSortKey] = useState<string>("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [loading, setLoading] = useState(false)
  const pageSize = 10

  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingDefect, setEditingDefect] = useState<any>(null)
  const [form, setForm] = useState<Record<string, string>>({ title: "", module: "登录模块", severity: "一般", priority: "P1", status: "新建", assignee: "", steps: "", expected: "", actual: "", environment: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // 从后端加载数据
  const fetchDefects = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await lifecycleApi.listDefects({
        page: currentPage,
        page_size: pageSize,
        ...(statusFilter ? { status: statusFilter } : {}),
      })
      if (res?.data?.items) {
        const mapped = res.data.items.map((d: any) => ({
          id: d.id,
          title: d.title,
          module: d.module || "未指定",
          severity: d.severity || "一般",
          priority: d.priority || "P2",
          status: statusMap(d.status),
          assignee: d.assigned_to ? String(d.assigned_to) : "",
          reporter: d.created_by ? String(d.created_by) : "系统",
          steps: Array.isArray(d.steps_to_reproduce) ? d.steps_to_reproduce.map((s: any) => s.action || JSON.stringify(s)).join("\n") : (d.steps_to_reproduce || ""),
          expected: d.expected_result || "",
          actual: d.actual_result || "",
          environment: d.environment || "",
          aiAnalysis: d.root_cause || "",
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }))
        setDefects(mapped)
      }
    } catch (err) {
      console.error("获取缺陷列表失败:", err)
      toast.error("获取缺陷列表失败，已使用本地数据")
      // 保持mock数据
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, statusFilter])

  useEffect(() => { fetchDefects() }, [fetchDefects])

  const statusMap = (s: string) => {
    const map: Record<string, string> = { new: "新建", open: "已确认", in_progress: "修复中", resolved: "已修复", verified: "已验证", closed: "已关闭", reopened: "重新打开" }
    return map[s] || s
  }
  const statusReverseMap: Record<string, string> = { "新建": "new", "已确认": "open", "修复中": "in_progress", "已修复": "resolved", "已验证": "verified", "已关闭": "closed", "重新打开": "reopened" }

  const filtered = defects.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.module.toLowerCase().includes(search.toLowerCase())) return false
    if (severityFilter && d.severity !== severityFilter) return false
    if (statusFilter && d.status !== statusFilter) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0
    const va = a[sortKey] || ""
    const vb = b[sortKey] || ""
    if (sortKey === "priority") {
      const order: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
      return sortDir === "asc" ? (order[va] ?? 0) - (order[vb] ?? 0) : (order[vb] ?? 0) - (order[va] ?? 0)
    }
    if (sortKey === "severity") {
      const order: Record<string, number> = { "致命": 0, "严重": 1, "一般": 2, "轻微": 3, "建议": 4 }
      return sortDir === "asc" ? (order[va] ?? 0) - (order[vb] ?? 0) : (order[vb] ?? 0) - (order[va] ?? 0)
    }
    return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleQuery = () => { setSearch(localSearch); setSeverityFilter(localSeverityFilter); setStatusFilter(localStatusFilter); setCurrentPage(1) }
  const handleReset = () => { setLocalSearch(""); setLocalSeverityFilter(""); setLocalStatusFilter(""); setSearch(""); setSeverityFilter(""); setStatusFilter(""); setCurrentPage(1) }
  const handleSort = (key: string) => { if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("desc") } }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.title.trim()) errors.title = "缺陷标题不能为空"
    if (!form.steps.trim()) errors.steps = "复现步骤不能为空"
    if (!form.expected.trim()) errors.expected = "预期结果不能为空"
    if (!form.actual.trim()) errors.actual = "实际结果不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      if (dialogMode === "create") {
        await lifecycleApi.createDefect({
          title: form.title,
          module: form.module,
          severity: form.severity,
          priority: form.priority,
          status: statusReverseMap[form.status] || "new",
          steps_to_reproduce: form.steps ? [{ action: form.steps }] : [],
          expected_result: form.expected,
          actual_result: form.actual,
          environment: form.environment,
        })
        toast.success("缺陷创建成功")
      } else {
        await lifecycleApi.updateDefect(editingDefect.id, {
          title: form.title,
          module: form.module,
          severity: form.severity,
          priority: form.priority,
          status: statusReverseMap[form.status] || "new",
          steps_to_reproduce: form.steps ? [{ action: form.steps }] : [],
          expected_result: form.expected,
          actual_result: form.actual,
          environment: form.environment,
        })
        toast.success("缺陷更新成功")
      }
      setShowDialog(false)
      fetchDefects()
    } catch {
      toast.error("操作失败，请重试")
    }
  }

  const handleDelete = async (d: any) => {
    if (!confirm(`确定删除缺陷「${d.title}」？`)) return
    try {
      await lifecycleApi.deleteDefect(d.id)
      toast.success("缺陷已删除")
      fetchDefects()
    } catch {
      setDefects(defects.filter((x) => x.id !== d.id))
      toast.success("缺陷已删除")
    }
  }

  const handleBatchDelete = async () => {
    if (!confirm(`确定删除选中的 ${selectedIds.size} 个缺陷？`)) return
    try {
      await lifecycleApi.batchDeleteDefects(Array.from(selectedIds).map(Number))
      toast.success("批量删除成功")
      setSelectedIds(new Set())
      fetchDefects()
    } catch {
      setDefects(defects.filter((d) => !selectedIds.has(String(d.id))))
      setSelectedIds(new Set())
      toast.success("批量删除成功")
    }
  }

  // AI根因分析
  const handleAiAnalyze = async (d: any) => {
    toast.info("正在进行AI根因分析...")
    try {
      const res: any = await lifecycleApi.aiAnalyzeDefect(d.id)
      if (res?.data) {
        setDefects(defects.map((x) => x.id === d.id ? { ...x, aiAnalysis: res.data.root_cause || JSON.stringify(res.data) } : x))
        toast.success("AI根因分析完成")
      }
    } catch {
      toast.error("AI分析失败")
    }
  }

  const handleExport = () => {
    const data = (selectedIds.size > 0 ? sorted.filter((d) => selectedIds.has(String(d.id))) : sorted).map((d) => ({
      ID: d.id, 标题: d.title, 模块: d.module, 严重程度: d.severity, 优先级: d.priority, 状态: d.status, 指派人: d.assignee || "-", 报告人: d.reporter, 创建时间: d.createdAt, 更新时间: d.updatedAt,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "缺陷列表")
    XLSX.writeFile(wb, `缺陷列表_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success("导出成功")
  }

  const openCreate = () => { setDialogMode("create"); setEditingDefect(null); setForm({ title: "", module: "登录模块", severity: "一般", priority: "P1", status: "新建", assignee: "", steps: "", expected: "", actual: "", environment: "" }); setFormErrors({}); setShowDialog(true) }
  const openEdit = (d: any) => { setDialogMode("edit"); setEditingDefect(d); setForm({ title: d.title, module: d.module, severity: d.severity, priority: d.priority, status: d.status, assignee: d.assignee || "", steps: d.steps || "", expected: d.expected || "", actual: d.actual || "", environment: d.environment || "" }); setFormErrors({}); setShowDialog(true) }

  const severityColor = (s: string) => {
    if (s === "致命") return "bg-fail text-white"
    if (s === "严重") return "bg-fail/10 text-fail border border-fail/20"
    if (s === "一般") return "bg-warn/10 text-warn border border-warn/20"
    if (s === "轻微") return "bg-info/10 text-info border border-info/20"
    return "bg-cream text-muted border border-border"
  }

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      "新建": "bg-amber-light text-warn border border-amber/20",
      "已确认": "bg-info/10 text-info border border-info/20",
      "修复中": "bg-purple-100 text-purple-600 border border-purple-200",
      "已修复": "bg-pass/10 text-pass border border-pass/20",
      "已验证": "bg-pass/10 text-pass border border-pass/20",
      "已关闭": "bg-cream text-muted border border-border",
      "重新打开": "bg-fail/10 text-fail border border-fail/20",
    }
    return map[s] || "bg-cream text-muted border border-border"
  }

  const priorityColor = (p: string) => {
    if (p === "P0") return "bg-fail/10 text-fail border border-fail/20"
    if (p === "P1") return "bg-warn/10 text-warn border border-warn/20"
    if (p === "P2") return "bg-info/10 text-info border border-info/20"
    return "bg-cream text-muted border border-border"
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">缺陷列表 <span className="text-xs font-normal text-muted">({filtered.length}条)</span></h2><p className="text-xs text-muted mt-0.5">缺陷跟踪管理，支持AI根因分析与状态流转</p></div>
      {/* 统计 */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-4">
        {[
          { label: "总计", value: defects.length, color: "text-ink" },
          { label: "新建", value: defects.filter((d) => d.status === "新建").length, color: "text-warn" },
          { label: "修复中", value: defects.filter((d) => d.status === "修复中").length, color: "text-purple-600" },
          { label: "已修复", value: defects.filter((d) => d.status === "已修复").length, color: "text-pass" },
          { label: "致命", value: defects.filter((d) => d.severity === "致命").length, color: "text-fail" },
          { label: "严重", value: defects.filter((d) => d.severity === "严重").length, color: "text-fail" },
          { label: "未分配", value: defects.filter((d) => !d.assignee).length, color: "text-muted" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuery()} placeholder="搜索缺陷标题/模块..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <select value={localSeverityFilter} onChange={(e) => setLocalSeverityFilter(e.target.value)} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部严重程度</option>{severityOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={localStatusFilter} onChange={(e) => setLocalStatusFilter(e.target.value)} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部状态</option>{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <button onClick={handleQuery} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> 查询</button>
        <button onClick={handleReset} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> 重置</button>
        <div className="flex gap-1 ml-auto">
          <button onClick={fetchDefects} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
          <button onClick={handleExport} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 导出</button>
          <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 新建缺陷</button>
        </div>
      </div>
      {/* 批量 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between mb-3 px-4 py-2 bg-amber-light/50 border border-amber/20 rounded-xl">
          <span className="text-sm text-ink-light">已选择 <span className="font-semibold text-ink">{selectedIds.size}</span> 个缺陷</span>
          <button onClick={handleBatchDelete} className="h-7 px-3 text-xs bg-fail text-white hover:bg-fail/80 rounded-lg flex items-center gap-1"><Trash2 className="w-3 h-3" /> 批量删除</button>
        </div>
      )}
      {/* 表格 */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-cream/50">
              <th className="px-3 py-3 w-10"><input type="checkbox" checked={paged.length > 0 && paged.every((d) => selectedIds.has(String(d.id)))} onChange={() => { if (paged.every((d) => selectedIds.has(String(d.id)))) { const n = new Set(selectedIds); paged.forEach((d) => n.delete(String(d.id))); setSelectedIds(n) } else { const n = new Set(selectedIds); paged.forEach((d) => n.add(String(d.id))); setSelectedIds(n) } }} className="w-4 h-4 rounded border-border text-amber focus:ring-amber" /></th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink w-10">ID</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink cursor-pointer hover:text-amber" onClick={() => handleSort("title")}>缺陷标题 {sortKey === "title" && (sortDir === "asc" ? "↑" : "↓")}</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">模块</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink cursor-pointer hover:text-amber" onClick={() => handleSort("severity")}>严重程度 {sortKey === "severity" && (sortDir === "asc" ? "↑" : "↓")}</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink cursor-pointer hover:text-amber" onClick={() => handleSort("priority")}>优先级 {sortKey === "priority" && (sortDir === "asc" ? "↑" : "↓")}</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink cursor-pointer hover:text-amber" onClick={() => handleSort("status")}>状态 {sortKey === "status" && (sortDir === "asc" ? "↑" : "↓")}</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">指派人</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">操作</th>
            </tr></thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-muted"><Bug className="w-10 h-10 mx-auto mb-2 text-muted-light" /><p className="text-sm font-medium">暂无缺陷</p><p className="text-xs mt-1">点击「新建缺陷」添加</p></td></tr>
              ) : paged.map((d, idx) => (
                <tr key={d.id} className={`border-b border-border/50 last:border-b-0 transition-colors ${selectedIds.has(String(d.id)) ? "bg-amber-light/40" : idx % 2 === 1 ? "bg-cream/30" : "bg-white"} hover:bg-cream/50`}>
                  <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.has(String(d.id))} onChange={() => { const n = new Set(selectedIds); if (n.has(String(d.id))) n.delete(String(d.id)); else n.add(String(d.id)); setSelectedIds(n) }} className="w-4 h-4 rounded border-border text-amber focus:ring-amber" /></td>
                  <td className="px-3 py-3 text-center text-xs text-muted">{d.id}</td>
                  <td className="px-3 py-3 text-center"><div className="flex items-center justify-center gap-1.5 min-w-0"><Bug className="w-3.5 h-3.5 text-fail flex-shrink-0" /><span className="text-sm font-medium text-ink truncate max-w-[220px]">{d.title}</span>{d.aiAnalysis && <span className="text-[10px] text-amber font-medium">AI</span>}</div></td>
                  <td className="px-3 py-3 text-center text-xs text-muted">{d.module}</td>
                  <td className="px-3 py-3 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${severityColor(d.severity)}`}>{d.severity}</span></td>
                  <td className="px-3 py-3 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${priorityColor(d.priority)}`}>{d.priority}</span></td>
                  <td className="px-3 py-3 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(d.status)}`}>{d.status}</span></td>
                  <td className="px-3 py-3 text-center"><span className="text-xs text-muted">{d.assignee || <span className="text-fail">未分配</span>}</span></td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => setPreviewDefect(d)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors" title="预览"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => handleAiAnalyze(d)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors" title="AI分析"><Sparkles className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors" title="编辑"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(d)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-cream/20">
          <span className="text-xs text-muted">共 {filtered.length} 条，第 {currentPage}/{totalPages || 1} 页</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
            <span className="h-8 px-3 text-xs rounded-lg gradient-amber text-white flex items-center">{currentPage}</span>
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
          </div>
        </div>
      </div>

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[580px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{dialogMode === "create" ? "新建缺陷" : "编辑缺陷"}</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">
              <div><label className="block text-xs font-medium text-ink-light mb-1">缺陷标题 *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.title ? "border-fail" : "border-border"}`} placeholder="简要描述缺陷" />{formErrors.title && <p className="text-[11px] text-fail mt-1">{formErrors.title}</p>}</div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">模块</label><select value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">严重程度</label><select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{severityOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">优先级</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{priorityOptions.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">状态</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">指派人</label><select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber"><option value="">未分配</option>{assigneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">复现步骤 *</label><textarea value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} rows={3} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink focus:border-amber outline-none resize-none ${formErrors.steps ? "border-fail" : "border-border"}`} placeholder={"1. 打开页面\n2. 操作步骤"} />{formErrors.steps && <p className="text-[11px] text-fail mt-1">{formErrors.steps}</p>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">预期结果 *</label><textarea value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} rows={2} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink focus:border-amber outline-none resize-none ${formErrors.expected ? "border-fail" : "border-border"}`} placeholder="正确的行为" />{formErrors.expected && <p className="text-[11px] text-fail mt-1">{formErrors.expected}</p>}</div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">实际结果 *</label><textarea value={form.actual} onChange={(e) => setForm({ ...form, actual: e.target.value })} rows={2} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink focus:border-amber outline-none resize-none ${formErrors.actual ? "border-fail" : "border-border"}`} placeholder="实际发生的行为" />{formErrors.actual && <p className="text-[11px] text-fail mt-1">{formErrors.actual}</p>}</div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">环境信息</label><input value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="如：Chrome 126 / macOS" /></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 预览 */}
      {previewDefect && <PreviewModal title={previewDefect.title} content={`# BUG-${previewDefect.id}: ${previewDefect.title}\n\n| 字段 | 值 |\n|------|----|\n| 严重程度 | ${previewDefect.severity} |\n| 优先级 | ${previewDefect.priority} |\n| 状态 | ${previewDefect.status} |\n| 模块 | ${previewDefect.module} |\n| 指派人 | ${previewDefect.assignee || "未分配"} |\n| 报告人 | ${previewDefect.reporter} |\n| 环境 | ${previewDefect.environment} |\n| 创建时间 | ${previewDefect.createdAt} |\n| 更新时间 | ${previewDefect.updatedAt} |\n\n## 复现步骤\n\n${previewDefect.steps || "无"}\n\n## 预期结果\n\n${previewDefect.expected || "无"}\n\n## 实际结果\n\n${previewDefect.actual || "无"}\n\n${previewDefect.aiAnalysis ? `## AI根因分析\n\n${previewDefect.aiAnalysis}` : ""}`} onClose={() => setPreviewDefect(null)} />}
    </div>
  )
}
