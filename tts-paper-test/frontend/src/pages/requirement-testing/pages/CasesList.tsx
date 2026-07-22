/**
 * 用例管理 - 完整CRUD + AI用例生成 + 优先级 + 执行状态 + API对接
 */
import { useState, useRef, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, Eye, FlaskConical, X, Download, Sparkles, Play, Copy, RefreshCw, Loader2 } from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import PreviewModal from "../components/PreviewModal"
import DataTable, { type ColumnDef } from "../components/DataTable"
import { lifecycleApi } from "@/lib/api"

const priorityOptions = ["P0", "P1", "P2", "P3"]
const statusOptions = ["草稿", "待确认", "已确认", "已驳回", "已完成"]
const moduleOptions = ["登录模块", "搜索模块", "购物车", "支付模块", "用户管理", "订单模块", "通知模块"]

const initialCases: Record<string, any>[] = [
  { id: 1, title: "TC01-登录成功验证", module: "登录模块", priority: "P0", status: "已确认", source: "AI生成", preconditions: "用户已注册账号", steps: "1. 打开登录页\n2. 输入用户名\n3. 输入密码\n4. 点击登录", expected: "登录成功，跳转到首页", executor: "zhangsan", executedAt: "2026-07-18 14:20", result: "通过", createdAt: "2026-07-15 10:00" },
  { id: 2, title: "TC02-登录失败提示", module: "登录模块", priority: "P1", status: "已完成", source: "AI生成", preconditions: "用户已注册账号", steps: "1. 打开登录页\n2. 输入错误密码\n3. 点击登录", expected: "提示密码错误", executor: "zhangsan", executedAt: "2026-07-18 14:25", result: "通过", createdAt: "2026-07-15 10:05" },
  { id: 3, title: "TC03-搜索功能验证", module: "搜索模块", priority: "P1", status: "已确认", source: "手动", preconditions: "用户已登录", steps: "1. 在搜索框输入关键词\n2. 点击搜索\n3. 查看搜索结果", expected: "搜索结果匹配关键词", executor: "", executedAt: "", result: "", createdAt: "2026-07-16 09:00" },
  { id: 4, title: "TC04-购物车添加商品", module: "购物车", priority: "P0", status: "草稿", source: "AI生成", preconditions: "用户已登录", steps: "1. 进入商品列表\n2. 点击加入购物车\n3. 查看购物车", expected: "商品成功添加到购物车", executor: "", executedAt: "", result: "", createdAt: "2026-07-16 11:30" },
  { id: 5, title: "TC05-支付流程验证", module: "支付模块", priority: "P0", status: "已确认", source: "AI生成", preconditions: "购物车中有商品", steps: "1. 进入购物车\n2. 点击结算\n3. 选择支付方式\n4. 完成支付", expected: "支付成功，订单创建", executor: "", executedAt: "", result: "", createdAt: "2026-07-17 10:00" },
  { id: 6, title: "TC06-搜索空结果提示", module: "搜索模块", priority: "P2", status: "待确认", source: "手动", preconditions: "用户已登录", steps: "1. 输入不存在的关键词\n2. 点击搜索", expected: "显示暂无搜索结果", executor: "", executedAt: "", result: "", createdAt: "2026-07-17 14:00" },
  { id: 7, title: "TC07-用户注册验证", module: "用户管理", priority: "P0", status: "已完成", source: "AI生成", preconditions: "未注册用户", steps: "1. 进入注册页\n2. 填写信息\n3. 点击注册", expected: "注册成功，跳转登录页", executor: "wangwu", executedAt: "2026-07-19 09:30", result: "通过", createdAt: "2026-07-18 08:00" },
  { id: 8, title: "TC08-购物车删除商品", module: "购物车", priority: "P1", status: "已确认", source: "手动", preconditions: "购物车中有商品", steps: "1. 进入购物车\n2. 点击删除商品\n3. 确认删除", expected: "商品从购物车移除", executor: "", executedAt: "", result: "", createdAt: "2026-07-18 11:00" },
  { id: 9, title: "TC09-订单列表查看", module: "订单模块", priority: "P1", status: "已驳回", source: "AI生成", preconditions: "用户有历史订单", steps: "1. 进入订单页\n2. 查看订单列表", expected: "正确显示订单列表", executor: "", executedAt: "", result: "", createdAt: "2026-07-18 15:00" },
  { id: 10, title: "TC10-邮件通知验证", module: "通知模块", priority: "P2", status: "草稿", source: "手动", preconditions: "系统配置了邮件服务", steps: "1. 触发通知事件\n2. 检查邮件", expected: "收到通知邮件", executor: "", executedAt: "", result: "", createdAt: "2026-07-19 10:00" },
  { id: 11, title: "TC11-密码重置流程", module: "登录模块", priority: "P1", status: "已确认", source: "AI生成", preconditions: "用户已注册", steps: "1. 点击忘记密码\n2. 输入邮箱\n3. 接收重置链接\n4. 设置新密码", expected: "密码重置成功", executor: "", executedAt: "", result: "", createdAt: "2026-07-19 11:00" },
  { id: 12, title: "TC12-支付失败回退", module: "支付模块", priority: "P0", status: "待确认", source: "手动", preconditions: "购物车有商品", steps: "1. 进入结算\n2. 选择支付\n3. 取消支付", expected: "订单状态回退为待支付", executor: "", executedAt: "", result: "", createdAt: "2026-07-20 09:00" },
]

export default function CasesList() {
  const [cases, setCases] = useState(initialCases)
  const [search, setSearch] = useState("")
  const [moduleFilter, setModuleFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [previewCase, setPreviewCase] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [showAiDialog, setShowAiDialog] = useState(false)
  const [aiForm, setAiForm] = useState({ requirement_content: "", requirement_name: "", module: "登录模块", priority: "P1", count: "5" })
  const pageSize = 10

  const columns: ColumnDef[] = [
    { key: "id", label: "ID", width: "60px" },
    { key: "title", label: "用例标题", width: "25%", render: (v, r) => (
      <div className="flex items-center justify-center gap-1.5 min-w-0">
        <FlaskConical className="w-3.5 h-3.5 text-pass flex-shrink-0" />
        <span className="text-sm font-medium text-ink truncate max-w-[200px]">{v}</span>
        {r.source === "AI生成" && <Sparkles className="w-3 h-3 text-amber flex-shrink-0" />}
      </div>
    )},
    { key: "module", label: "模块", width: "12%" },
    { key: "priority", label: "优先级", width: "8%", render: (v) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${priorityColor(v)}`}>{v}</span>
    )},
    { key: "status", label: "状态", width: "10%", render: (v) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(v)}`}>{v}</span>
    )},
    { key: "source", label: "来源", width: "8%", render: (v) => (
      <span className={`text-[11px] ${v === "AI生成" ? "text-amber" : "text-muted"}`}>{v}</span>
    )},
    { key: "result", label: "执行结果", width: "10%", render: (v) => (
      <span className={`text-[11px] ${v === "通过" ? "text-pass" : v === "失败" ? "text-fail" : "text-muted"}`}>{v || "-"}</span>
    )},
  ]

  // 新建/编辑弹窗
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingCase, setEditingCase] = useState<any>(null)
  const [form, setForm] = useState<Record<string, string>>({ title: "", module: "登录模块", priority: "P1", status: "草稿", source: "手动", preconditions: "", steps: "", expected: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // 从后端加载数据
  const fetchCases = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await lifecycleApi.listTestCases({
        page: currentPage,
        page_size: pageSize,
        ...(statusFilter ? { status: statusFilter } : {}),
      })
      if (res?.data?.items) {
        const mapped = res.data.items.map((c: any) => ({
          id: c.id,
          title: c.name,
          module: c.test_type || "通用模块",
          priority: c.priority || "P2",
          status: statusMap(c.status),
          source: c.ai_generated ? "AI生成" : "手动",
          preconditions: c.preconditions || "",
          steps: Array.isArray(c.steps) ? c.steps.map((s: any) => s.action || s.description || JSON.stringify(s)).join("\n") : (c.steps || ""),
          expected: c.expected_result || "",
          executor: c.reviewed_by ? String(c.reviewed_by) : "",
          executedAt: c.updated_at || "",
          result: c.status === "completed" ? "通过" : "",
          ai_generated: c.ai_generated,
          ai_model: c.ai_model,
          created_at: c.created_at,
        }))
        setCases(mapped)
      }
    } catch {
      // 保持mock数据
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, statusFilter])

  useEffect(() => { fetchCases() }, [fetchCases])

  const statusMap = (s: string) => {
    const map: Record<string, string> = { draft: "草稿", pending: "待确认", approved: "已确认", rejected: "已驳回", completed: "已完成", needs_modification: "待确认" }
    return map[s] || s
  }
  const statusReverseMap: Record<string, string> = { "草稿": "draft", "待确认": "pending", "已确认": "approved", "已驳回": "rejected", "已完成": "completed" }

  const filtered = cases.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.module.toLowerCase().includes(search.toLowerCase())) return false
    if (moduleFilter && c.module !== moduleFilter) return false
    if (priorityFilter && c.priority !== priorityFilter) return false
    if (statusFilter && c.status !== statusFilter) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.title.trim()) errors.title = "用例标题不能为空"
    if (!form.steps.trim()) errors.steps = "测试步骤不能为空"
    if (!form.expected.trim()) errors.expected = "预期结果不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      if (dialogMode === "create") {
        const stepsArr = form.steps.split("\n").filter((s) => s.trim()).map((s, i) => ({ step: i + 1, action: s.replace(/^\d+\.\s*/, "") }))
        await lifecycleApi.createTestCase({
          name: form.title,
          test_type: form.module,
          priority: form.priority,
          status: statusReverseMap[form.status] || "draft",
          preconditions: form.preconditions,
          steps: stepsArr,
          expected_result: form.expected,
        })
        toast.success("用例创建成功")
      } else {
        const stepsArr = form.steps.split("\n").filter((s) => s.trim()).map((s, i) => ({ step: i + 1, action: s.replace(/^\d+\.\s*/, "") }))
        await lifecycleApi.updateTestCase(editingCase.id, {
          name: form.title,
          test_type: form.module,
          priority: form.priority,
          status: statusReverseMap[form.status] || "draft",
          preconditions: form.preconditions,
          steps: stepsArr,
          expected_result: form.expected,
        })
        toast.success("用例更新成功")
      }
      setShowDialog(false)
      fetchCases()
    } catch {
      toast.error("操作失败，请重试")
    }
  }

  const handleDelete = async (c: any) => {
    if (!confirm(`确定删除用例「${c.title}」？`)) return
    try {
      await lifecycleApi.deleteTestCase(c.id)
      toast.success("用例已删除")
      fetchCases()
    } catch {
      toast.error("删除失败，请重试")
    }
  }

  const handleBatchDelete = async (ids: Set<string>) => {
    if (!confirm(`确定删除选中的 ${ids.size} 条用例？`)) return
    try {
      await lifecycleApi.batchDeleteTestCases(Array.from(ids).map(Number))
      toast.success("批量删除成功")
      fetchCases()
    } catch {
      toast.error("批量删除失败，请重试")
    }
  }

  // 复制用例
  const handleCopy = async (c: any) => {
    try {
      const stepsArr = typeof c.steps === "string"
        ? c.steps.split("\n").filter((s: string) => s.trim()).map((s: string, i: number) => ({ step: i + 1, action: s.replace(/^\d+\.\s*/, "") }))
        : c.steps || []
      await lifecycleApi.createTestCase({
        name: c.title + " (副本)",
        test_type: c.module,
        priority: c.priority,
        status: "draft",
        preconditions: c.preconditions,
        steps: stepsArr,
        expected_result: c.expected,
      })
      toast.success("用例复制成功")
      fetchCases()
    } catch {
      toast.error("复制失败")
    }
  }

  // 执行用例
  const handleExecute = async (c: any) => {
    try {
      await lifecycleApi.updateTestCase(c.id, { status: "completed" })
      toast.success(`用例「${c.title}」已标记为通过`)
      fetchCases()
    } catch {
      toast.error(`用例「${c.title}」标记失败，请重试`)
    }
  }

  // AI生成用例
  const handleAiGenerate = async () => {
    if (!aiForm.requirement_content.trim()) {
      toast.error("请输入需求内容")
      return
    }
    setAiGenerating(true)
    try {
      const res: any = await lifecycleApi.aiGenerateCases({
        requirement_content: aiForm.requirement_content,
        requirement_name: aiForm.requirement_name,
        module: aiForm.module,
        priority: aiForm.priority,
        count: parseInt(aiForm.count) || 5,
      })
      if (res?.data?.cases) {
        toast.success(`AI成功生成 ${res.data.count} 条测试用例`)
        setShowAiDialog(false)
        setAiForm({ requirement_content: "", requirement_name: "", module: "登录模块", priority: "P1", count: "5" })
        fetchCases()
      }
    } catch {
      toast.error("AI生成失败")
    } finally {
      setAiGenerating(false)
    }
  }

  const openCreate = () => { setDialogMode("create"); setEditingCase(null); setForm({ title: "", module: "登录模块", priority: "P1", status: "草稿", source: "手动", preconditions: "", steps: "", expected: "" }); setFormErrors({}); setShowDialog(true) }
  const openEdit = (c: any) => { setDialogMode("edit"); setEditingCase(c); setForm({ title: c.title, module: c.module, priority: c.priority, status: c.status, source: c.source, preconditions: c.preconditions || "", steps: c.steps || "", expected: c.expected || "" }); setFormErrors({}); setShowDialog(true) }

  // 导出
  const handleExport = () => {
    const data = filtered.map((c) => ({
      ID: c.id, 用例标题: c.title, 所属模块: c.module, 优先级: c.priority, 状态: c.status, 来源: c.source, 前置条件: c.preconditions || "", 测试步骤: (c.steps || "").replace(/\n/g, " | "), 预期结果: c.expected || "", 执行人: c.executor || "", 执行结果: c.result || "", 创建时间: c.createdAt,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "测试用例")
    XLSX.writeFile(wb, `测试用例_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success("导出成功")
  }

  const priorityColor = (p: string) => {
    if (p === "P0") return "bg-fail/10 text-fail border border-fail/20"
    if (p === "P1") return "bg-warn/10 text-warn border border-warn/20"
    if (p === "P2") return "bg-info/10 text-info border border-info/20"
    return "bg-cream text-muted border border-border"
  }

  const statusColor = (s: string) => {
    if (s === "已确认" || s === "已完成") return "bg-pass/10 text-pass border border-pass/20"
    if (s === "待确认") return "bg-amber-light text-warn border border-amber/20"
    if (s === "已驳回") return "bg-fail/10 text-fail border border-fail/20"
    return "bg-cream text-muted border border-border"
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">用例管理 <span className="text-xs font-normal text-muted">({filtered.length}条)</span></h2><p className="text-xs text-muted mt-0.5">测试用例管理，支持优先级排序、执行状态追踪与批量导出</p></div>
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { label: "总计", value: cases.length, color: "text-ink" },
          { label: "草稿", value: cases.filter((c) => c.status === "草稿").length, color: "text-muted" },
          { label: "已确认", value: cases.filter((c) => c.status === "已确认").length, color: "text-pass" },
          { label: "已驳回", value: cases.filter((c) => c.status === "已驳回").length, color: "text-fail" },
          { label: "已完成", value: cases.filter((c) => c.status === "已完成").length, color: "text-pass" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <DataTable
        title=""
        columns={columns}
        data={paged}
        pagination={{
          page: currentPage,
          page_size: pageSize,
          total: filtered.length,
          total_pages: totalPages,
        }}
        search={search}
        sourceFilter={""}
        loading={loading}
        onSearch={setSearch}
        onSourceFilter={() => {}}
        onPageChange={setCurrentPage}
        onPageSizeChange={() => {}}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        onBatchDelete={handleBatchDelete}
        onRowClick={setPreviewCase}
        renderActions={(c) => (
          <>
            <button onClick={() => handleCopy(c)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors" title="复制"><Copy className="w-3.5 h-3.5" /></button>
            {c.status !== "已完成" && <button onClick={() => handleExecute(c)} className="p-1.5 rounded-lg hover:bg-pass/10 text-ink-light hover:text-pass transition-colors" title="执行通过"><Play className="w-3.5 h-3.5" /></button>}
          </>
        )}
        extraActions={
          <div className="flex items-center gap-2">
            <select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部模块</option>{moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部优先级</option>{priorityOptions.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部状态</option>{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <button onClick={fetchCases} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
            <button onClick={() => setShowAiDialog(true)} className="h-9 px-3 rounded-xl bg-amber-light text-amber-hover border border-amber/30 text-sm font-medium hover:bg-amber hover:text-white flex items-center gap-1.5 transition-colors"><Sparkles className="w-3.5 h-3.5" /> AI生成</button>
            <button onClick={handleExport} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 导出</button>
          </div>
        }
      />

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{dialogMode === "create" ? "新建测试用例" : "编辑测试用例"}</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div><label className="block text-xs font-medium text-ink-light mb-1">用例标题 *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.title ? "border-fail" : "border-border"}`} placeholder="如：TC01-登录成功验证" />{formErrors.title && <p className="text-[11px] text-fail mt-1">{formErrors.title}</p>}</div>
              <div className="flex gap-4">
                <div className="flex-1"><label className="block text-xs font-medium text-ink-light mb-1">所属模块</label><select value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                <div className="w-24"><label className="block text-xs font-medium text-ink-light mb-1">优先级</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{priorityOptions.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
                <div className="flex-1"><label className="block text-xs font-medium text-ink-light mb-1">状态</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">前置条件</label><input value={form.preconditions} onChange={(e) => setForm({ ...form, preconditions: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="执行此用例的前置条件" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">测试步骤 *</label><textarea value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} rows={4} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink focus:border-amber outline-none resize-none ${formErrors.steps ? "border-fail" : "border-border"}`} placeholder={"1. 打开页面\n2. 输入数据\n3. 点击提交"} />{formErrors.steps && <p className="text-[11px] text-fail mt-1">{formErrors.steps}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">预期结果 *</label><textarea value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} rows={2} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink focus:border-amber outline-none resize-none ${formErrors.expected ? "border-fail" : "border-border"}`} placeholder="预期的正确行为" />{formErrors.expected && <p className="text-[11px] text-fail mt-1">{formErrors.expected}</p>}</div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewCase && <PreviewModal title={previewCase.title} content={`# ${previewCase.title}\n\n| 字段 | 值 |\n|------|----|\n| ID | ${previewCase.id} |\n| 所属模块 | ${previewCase.module} |\n| 优先级 | ${previewCase.priority} |\n| 状态 | ${previewCase.status} |\n| 来源 | ${previewCase.source} |\n| 创建时间 | ${previewCase.createdAt} |\n\n## 前置条件\n\n${previewCase.preconditions || "无"}\n\n## 测试步骤\n\n${(previewCase.steps || "").split("\n").map((s: string, i: number) => `${i + 1}. ${s.replace(/^\d+\.\s*/, "")}`).join("\n")}\n\n## 预期结果\n\n${previewCase.expected || "无"}\n\n${previewCase.executor ? `## 执行信息\n\n| 字段 | 值 |\n|------|----|\n| 执行人 | ${previewCase.executor} |\n| 执行时间 | ${previewCase.executedAt} |\n| 执行结果 | ${previewCase.result} |` : ""}`} onClose={() => setPreviewCase(null)} />}

      {/* AI生成用例弹窗 */}
      {showAiDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !aiGenerating && setShowAiDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber" />
                <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>AI智能生成测试用例</h3>
              </div>
              <button onClick={() => !aiGenerating && setShowAiDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div><label className="block text-xs font-medium text-ink-light mb-1">需求名称</label><input value={aiForm.requirement_name} onChange={(e) => setAiForm({ ...aiForm, requirement_name: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="如：用户登录功能" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">模块</label><select value={aiForm.module} onChange={(e) => setAiForm({ ...aiForm, module: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">优先级</label><select value={aiForm.priority} onChange={(e) => setAiForm({ ...aiForm, priority: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{priorityOptions.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">生成数量</label><select value={aiForm.count} onChange={(e) => setAiForm({ ...aiForm, count: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{["3", "5", "8", "10"].map((n) => <option key={n} value={n}>{n}条</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">需求内容 *</label><textarea value={aiForm.requirement_content} onChange={(e) => setAiForm({ ...aiForm, requirement_content: e.target.value })} rows={6} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="请描述需求内容，AI将根据此内容自动生成测试用例...&#10;&#10;示例：&#10;- 用户登录功能需要支持用户名和密码登录&#10;- 登录失败时需要显示错误提示&#10;- 支持记住密码功能" /></div>
              {aiGenerating && (
                <div className="flex items-center gap-3 p-4 bg-amber-light/30 rounded-xl border border-amber/20">
                  <Loader2 className="w-5 h-5 text-amber animate-spin" />
                  <div><p className="text-sm font-medium text-ink">AI正在生成测试用例...</p><p className="text-[11px] text-muted">基于需求内容智能分析并生成</p></div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => !aiGenerating && setShowAiDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleAiGenerate} disabled={aiGenerating || !aiForm.requirement_content.trim()} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 disabled:opacity-50">
                {aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</> : <><Sparkles className="w-4 h-4" /> 开始生成</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
