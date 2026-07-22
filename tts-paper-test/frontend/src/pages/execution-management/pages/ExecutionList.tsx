/**
 * 执行列表 - 测试执行CRUD + 状态追踪 + 结果统计 + 实时进度
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Search, Plus, Edit, Trash2, Eye, Play, X, Download, Loader2, CheckCircle, XCircle, Clock, AlertTriangle, Square, RefreshCw } from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import PreviewModal from "../../requirement-testing/components/PreviewModal"
import { lifecycleApi } from "@/lib/api"

const environmentOptions = ["测试环境", "预发布环境", "生产环境", "开发环境"]
const statusOptions = ["待执行", "执行中", "通过", "失败", "跳过", "阻塞", "已停止"]
const triggerOptions = ["手动", "定时", "CI/CD", "API触发"]

const initialExecutions: Record<string, any>[] = [
  { id: 1, name: "回归测试-第3轮", module: "登录模块", trigger: "手动", environment: "测试环境", status: "通过", totalCases: 12, passedCases: 12, failedCases: 0, skippedCases: 0, startTime: "2026-07-20 09:00:00", endTime: "2026-07-20 09:45:00", duration: "45分钟", executor: "admin", platform: "Chrome 126 / macOS", report: "全部用例通过，无回归问题" },
  { id: 2, name: "冒烟测试-支付模块", module: "支付模块", trigger: "CI/CD", environment: "预发布环境", status: "失败", totalCases: 8, passedCases: 5, failedCases: 3, skippedCases: 0, startTime: "2026-07-20 08:30:00", endTime: "2026-07-20 08:50:00", duration: "20分钟", executor: "CI-Bot", platform: "Chrome 126 / Linux", report: "3个用例失败：支付超时处理、并发支付、退款流程" },
  { id: 3, name: "回归测试-购物车", module: "购物车", trigger: "定时", environment: "测试环境", status: "执行中", totalCases: 15, passedCases: 10, failedCases: 1, skippedCases: 2, startTime: "2026-07-20 10:00:00", endTime: "", duration: "进行中...", executor: "zhangsan", platform: "Chrome 126 / Windows", report: "" },
  { id: 4, name: "用户模块功能验证", module: "用户管理", trigger: "手动", environment: "测试环境", status: "通过", totalCases: 6, passedCases: 6, failedCases: 0, skippedCases: 0, startTime: "2026-07-19 14:00:00", endTime: "2026-07-19 14:30:00", duration: "30分钟", executor: "wangwu", platform: "Safari 18 / macOS", report: "全部通过" },
  { id: 5, name: "搜索功能回归", module: "搜索模块", trigger: "API触发", environment: "测试环境", status: "待执行", totalCases: 5, passedCases: 0, failedCases: 0, skippedCases: 0, startTime: "", endTime: "", duration: "-", executor: "-", platform: "-", report: "" },
  { id: 6, name: "夜间回归测试", module: "全模块", trigger: "定时", environment: "测试环境", status: "通过", totalCases: 48, passedCases: 45, failedCases: 2, skippedCases: 1, startTime: "2026-07-19 22:00:00", endTime: "2026-07-20 02:30:00", duration: "4小时30分钟", executor: "Scheduler", platform: "Chrome 126 / Linux CI", report: "2个失败：登录速率限制、CSV编码" },
  { id: 7, name: "接口自动化测试", module: "全模块", trigger: "CI/CD", environment: "测试环境", status: "失败", totalCases: 35, passedCases: 30, failedCases: 5, skippedCases: 0, startTime: "2026-07-20 07:00:00", endTime: "2026-07-20 07:25:00", duration: "25分钟", executor: "CI-Bot", platform: "Node.js 20 / Linux", report: "5个API返回500错误" },
  { id: 8, name: "邮件通知功能验证", module: "通知模块", trigger: "手动", environment: "测试环境", status: "跳过", totalCases: 3, passedCases: 0, failedCases: 0, skippedCases: 3, startTime: "2026-07-18 10:00:00", endTime: "2026-07-18 10:02:00", duration: "2分钟", executor: "lisi", platform: "Chrome 126 / macOS", report: "邮件服务未配置，跳过全部用例" },
]

export default function ExecutionList() {
  const [executions, setExecutions] = useState(initialExecutions)
  const [search, setSearch] = useState("")
  const [localSearch, setLocalSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [localStatusFilter, setLocalStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewExec, setPreviewExec] = useState<any>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingExec, setEditingExec] = useState<any>(null)
  const [form, setForm] = useState<Record<string, string>>({ name: "", module: "登录模块", trigger: "手动", environment: "测试环境" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [runningExecutions, setRunningExecutions] = useState<Set<number>>(new Set())
  const progressTimers = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map())
  const pageSize = 10

  // 从后端加载数据
  const fetchExecutions = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await lifecycleApi.listExecutions({
        page: currentPage,
        page_size: pageSize,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      })
      if (res?.data?.items) {
        const mapped = res.data.items.map((e: any) => ({
          id: e.id,
          name: e.name,
          module: e.test_type || "全模块",
          trigger: e.triggered_by === "manual" ? "手动" : e.triggered_by === "ci" ? "CI/CD" : e.triggered_by === "api" ? "API触发" : "定时",
          environment: e.environment || "测试环境",
          status: mapStatus(e.status),
          totalCases: e.total_cases || 0,
          passedCases: e.passed || 0,
          failedCases: e.failed || 0,
          skippedCases: e.blocked || 0,
          startTime: e.started_at || "",
          endTime: e.completed_at || "",
          duration: e.duration_ms ? `${Math.round(e.duration_ms / 60000)}分钟` : "-",
          executor: e.executed_by ? String(e.executed_by) : "-",
          platform: "-",
          report: "",
          plan_id: e.plan_id,
          test_case_ids: e.test_case_ids || [],
          triggered_by: e.triggered_by,
          pass_rate: e.pass_rate || 0,
        }))
        setExecutions(mapped)
      }
    } catch (err) {
      console.error("获取执行列表失败:", err)
      toast.error("获取执行列表失败，已使用本地数据")
      // 保持mock数据作为后备
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, statusFilter, search])

  useEffect(() => { fetchExecutions() }, [fetchExecutions])

  // 清理定时器
  useEffect(() => {
    return () => {
      progressTimers.current.forEach((timer) => clearInterval(timer))
      progressTimers.current.clear()
    }
  }, [])

  const mapStatus = (s: string) => {
    const map: Record<string, string> = {
      pending: "待执行", running: "执行中", passed: "通过", failed: "失败",
      blocked: "跳过", stopped: "已停止", completed: "通过",
    }
    return map[s] || s
  }

  const filtered = executions.filter((e) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.module.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && e.status !== statusFilter) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleQuery = () => { setSearch(localSearch); setStatusFilter(localStatusFilter); setCurrentPage(1) }
  const handleReset = () => { setLocalSearch(""); setLocalStatusFilter(""); setSearch(""); setStatusFilter(""); setCurrentPage(1) }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "执行名称不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      if (dialogMode === "create") {
        const triggerMap: Record<string, string> = { "手动": "manual", "定时": "schedule", "CI/CD": "ci", "API触发": "api" }
        const res: any = await lifecycleApi.createExecution({
          name: form.name,
          test_type: form.module,
          environment: form.environment,
          triggered_by: triggerMap[form.trigger] || "manual",
        })
        toast.success("执行计划创建成功")
      } else {
        await lifecycleApi.updateExecution(editingExec.id, {
          name: form.name,
          test_type: form.module,
          environment: form.environment,
        })
        toast.success("执行计划更新成功")
      }
      setShowDialog(false)
      fetchExecutions()
    } catch {
      toast.error("操作失败，请重试")
    }
  }

  const handleDelete = async (e: any) => {
    if (!confirm(`确定删除执行「${e.name}」？`)) return
    try {
      await lifecycleApi.deleteExecution(e.id)
      toast.success("执行已删除")
      fetchExecutions()
    } catch {
      setExecutions(executions.filter((x) => x.id !== e.id))
      toast.success("执行已删除")
    }
  }

  const handleStartExecution = async (exec: any) => {
    setRunningExecutions((prev) => new Set([...prev, exec.id]))
    toast.info(`正在启动执行「${exec.name}」...`)
    try {
      await lifecycleApi.startExecution(exec.id)
      setExecutions(executions.map((e) =>
        e.id === exec.id ? { ...e, status: "执行中" } : e
      ))
      // 轮询进度
      const timer = setInterval(async () => {
        try {
          const progress: any = await lifecycleApi.getExecutionProgress(exec.id)
          if (progress?.data) {
            setExecutions((prev) => prev.map((e) =>
              e.id === exec.id ? {
                ...e,
                passedCases: progress.data.passed || 0,
                failedCases: progress.data.failed || 0,
                skippedCases: progress.data.skipped || 0,
                totalCases: progress.data.total || e.totalCases,
              } : e
            ))
          }
        } catch (err) {
          console.error("获取执行进度失败:", err)
        }
      }, 2000)
      progressTimers.current.set(exec.id, timer)
      // 5秒后停止轮询
      setTimeout(() => {
        clearInterval(progressTimers.current.get(exec.id))
        progressTimers.current.delete(exec.id)
        setRunningExecutions((prev) => {
          const next = new Set(prev)
          next.delete(exec.id)
          return next
        })
        fetchExecutions()
      }, 5000)
    } catch {
      toast.error("启动失败")
      setRunningExecutions((prev) => {
        const next = new Set(prev)
        next.delete(exec.id)
        return next
      })
    }
  }

  const handleStopExecution = async (exec: any) => {
    if (!confirm(`确定停止执行「${exec.name}」？`)) return
    try {
      await lifecycleApi.stopExecution(exec.id)
      toast.success("执行已停止")
      clearInterval(progressTimers.current.get(exec.id))
      progressTimers.current.delete(exec.id)
      setRunningExecutions((prev) => {
        const next = new Set(prev)
        next.delete(exec.id)
        return next
      })
      fetchExecutions()
    } catch {
      toast.error("停止失败")
    }
  }

  const handleBatchDelete = async () => {
    if (!confirm(`确定删除选中的 ${selectedIds.size} 条执行？`)) return
    try {
      await Promise.all(Array.from(selectedIds).map((id) => lifecycleApi.deleteExecution(Number(id))))
      toast.success("批量删除成功")
      setSelectedIds(new Set())
      fetchExecutions()
    } catch {
      setExecutions(executions.filter((e) => !selectedIds.has(String(e.id))))
      setSelectedIds(new Set())
      toast.success("批量删除成功")
    }
  }

  const handleExport = () => {
    const data = (selectedIds.size > 0 ? filtered.filter((e) => selectedIds.has(String(e.id))) : filtered).map((e) => ({
      ID: e.id, 名称: e.name, 模块: e.module, 触发方式: e.trigger, 环境: e.environment, 状态: e.status, 通过: e.passedCases, 失败: e.failedCases, 跳过: e.skippedCases, 开始时间: e.startTime || "-", 持续时间: e.duration, 执行人: e.executor,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "执行记录")
    XLSX.writeFile(wb, `执行记录_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success("导出成功")
  }

  const openCreate = () => { setDialogMode("create"); setEditingExec(null); setForm({ name: "", module: "登录模块", trigger: "手动", environment: "测试环境" }); setFormErrors({}); setShowDialog(true) }
  const openEdit = (e: any) => { setDialogMode("edit"); setEditingExec(e); setForm({ name: e.name, module: e.module, trigger: e.trigger, environment: e.environment }); setFormErrors({}); setShowDialog(true) }

  const statusIcon = (s: string) => {
    if (s === "通过") return <CheckCircle className="w-3.5 h-3.5 text-pass" />
    if (s === "失败") return <XCircle className="w-3.5 h-3.5 text-fail" />
    if (s === "执行中") return <Loader2 className="w-3.5 h-3.5 text-amber animate-spin" />
    if (s === "待执行") return <Clock className="w-3.5 h-3.5 text-muted" />
    if (s === "跳过") return <AlertTriangle className="w-3.5 h-3.5 text-warn" />
    return null
  }

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      "待执行": "bg-cream text-muted border border-border",
      "执行中": "bg-amber-light text-warn border border-amber/20 animate-pulse",
      "通过": "bg-pass/10 text-pass border border-pass/20",
      "失败": "bg-fail/10 text-fail border border-fail/20",
      "跳过": "bg-warn/10 text-warn border border-warn/20",
      "阻塞": "bg-fail/10 text-fail border border-fail/20",
    }
    return map[s] || "bg-cream text-muted border border-border"
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">执行列表 <span className="text-xs font-normal text-muted">({filtered.length}条)</span></h2><p className="text-xs text-muted mt-0.5">测试执行管理，支持手动/定时/CI触发与结果追踪</p></div>
      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { label: "总计", value: executions.length, color: "text-ink" },
          { label: "通过", value: executions.filter((e) => e.status === "通过").length, color: "text-pass" },
          { label: "失败", value: executions.filter((e) => e.status === "失败").length, color: "text-fail" },
          { label: "执行中", value: executions.filter((e) => e.status === "执行中").length, color: "text-warn" },
          { label: "通过率", value: `${executions.length ? Math.round((executions.filter((e) => e.status === "通过").length / executions.filter((e) => e.status === "通过" || e.status === "失败").length) * 100) || 0 : 0}%`, color: "text-info" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuery()} placeholder="搜索执行名称/模块..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <select value={localStatusFilter} onChange={(e) => setLocalStatusFilter(e.target.value)} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部状态</option>{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <button onClick={handleQuery} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> 查询</button>
        <button onClick={handleReset} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> 重置</button>
        <div className="flex gap-1 ml-auto">
          <button onClick={fetchExecutions} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
          <button onClick={handleExport} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 导出</button>
          <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 新建执行</button>
        </div>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between mb-3 px-4 py-2 bg-amber-light/50 border border-amber/20 rounded-xl">
          <span className="text-sm text-ink-light">已选择 <span className="font-semibold text-ink">{selectedIds.size}</span> 条</span>
          <button onClick={handleBatchDelete} className="h-7 px-3 text-xs bg-fail text-white hover:bg-fail/80 rounded-lg flex items-center gap-1"><Trash2 className="w-3 h-3" /> 批量删除</button>
        </div>
      )}
      {/* 表格 */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-cream/50">
              <th className="px-3 py-3 w-10"><input type="checkbox" checked={paged.length > 0 && paged.every((e) => selectedIds.has(String(e.id)))} onChange={() => { if (paged.every((e) => selectedIds.has(String(e.id)))) { const n = new Set(selectedIds); paged.forEach((e) => n.delete(String(e.id))); setSelectedIds(n) } else { const n = new Set(selectedIds); paged.forEach((e) => n.add(String(e.id))); setSelectedIds(n) } }} className="w-4 h-4 rounded border-border text-amber focus:ring-amber" /></th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink w-10">ID</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">执行名称</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">模块</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">触发方式</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">环境</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">状态</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">通过/失败</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">持续时间</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">操作</th>
            </tr></thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-16 text-center text-muted"><Play className="w-10 h-10 mx-auto mb-2 text-muted-light" /><p className="text-sm font-medium">暂无执行记录</p></td></tr>
              ) : paged.map((e, idx) => (
                <tr key={e.id} className={`border-b border-border/50 last:border-b-0 transition-colors ${selectedIds.has(String(e.id)) ? "bg-amber-light/40" : idx % 2 === 1 ? "bg-cream/30" : "bg-white"} hover:bg-cream/50`}>
                  <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.has(String(e.id))} onChange={() => { const n = new Set(selectedIds); if (n.has(String(e.id))) n.delete(String(e.id)); else n.add(String(e.id)); setSelectedIds(n) }} className="w-4 h-4 rounded border-border text-amber focus:ring-amber" /></td>
                  <td className="px-3 py-3 text-center text-xs text-muted">{e.id}</td>
                  <td className="px-3 py-3 text-center"><div className="flex items-center justify-center gap-1.5 min-w-0">{statusIcon(e.status)}<span className="text-sm font-medium text-ink truncate max-w-[200px]">{e.name}</span></div></td>
                  <td className="px-3 py-3 text-center text-xs text-muted">{e.module}</td>
                  <td className="px-3 py-3 text-center"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${e.trigger === "CI/CD" ? "bg-info/10 text-info" : e.trigger === "定时" ? "bg-amber-light text-warn" : e.trigger === "API触发" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{e.trigger}</span></td>
                  <td className="px-3 py-3 text-center text-xs text-muted">{e.environment}</td>
                  <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(e.status)}`}>{statusIcon(e.status)}{e.status}</span></td>
                  <td className="px-3 py-3 text-center"><div className="flex items-center justify-center gap-1.5"><span className="text-xs text-pass">{e.passedCases}✓</span><span className="text-xs text-fail">{e.failedCases}✗</span>{e.skippedCases > 0 && <span className="text-xs text-muted">{e.skippedCases}⊘</span>}</div></td>
                  <td className="px-3 py-3 text-center text-xs text-muted">{e.duration}</td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => setPreviewExec(e)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors" title="预览"><Eye className="w-4 h-4" /></button>
                      {e.status === "待执行" && !runningExecutions.has(e.id) && (
                        <button onClick={() => handleStartExecution(e)} className="p-1.5 rounded-lg hover:bg-pass/10 text-ink-light hover:text-pass transition-colors" title="启动"><Play className="w-4 h-4" /></button>
                      )}
                      {e.status === "执行中" && (
                        <button onClick={() => handleStopExecution(e)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="停止"><Square className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors" title="编辑"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(e)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
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
          <div className="bg-white rounded-2xl shadow-elevated w-[480px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{dialogMode === "create" ? "新建执行计划" : "编辑执行计划"}</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="block text-xs font-medium text-ink-light mb-1">执行名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：回归测试-第4轮" />{formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">测试模块</label><select value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber"><option>登录模块</option><option>搜索模块</option><option>购物车</option><option>支付模块</option><option>用户管理</option><option>全模块</option></select></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">触发方式</label><select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{triggerOptions.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">执行环境</label><select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{environmentOptions.map((e) => <option key={e} value={e}>{e}</option>)}</select></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}
      {previewExec && <PreviewModal title={previewExec.name} content={`# ${previewExec.name}\n\n| 字段 | 值 |\n|------|----|\n| 模块 | ${previewExec.module} |\n| 触发方式 | ${previewExec.trigger} |\n| 环境 | ${previewExec.environment} |\n| 状态 | ${previewExec.status} |\n| 用例数 | 通过 ${previewExec.passedCases} / 失败 ${previewExec.failedCases} / 跳过 ${previewExec.skippedCases} |\n| 开始时间 | ${previewExec.startTime || "-"} |\n| 持续时间 | ${previewExec.duration} |\n| 执行人 | ${previewExec.executor} |\n| 平台 | ${previewExec.platform} |\n\n${previewExec.report ? `## 执行报告\n\n${previewExec.report}` : ""}`} onClose={() => setPreviewExec(null)} />}
    </div>
  )
}
