/**
 * 活动记录页 - 筛选 + 分页 + 导出 + 统计
 */
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Search, X, Activity, Play, Bug, FileText, CheckCircle, Users, FlaskConical, Download, RefreshCw, Loader2, BarChart3, Clock, AlertTriangle } from "lucide-react"
import { configApi } from "@/lib/api"
import * as XLSX from "xlsx"

const iconMap: Record<string, any> = {
  execute: Play, start_execution: Play, stop_execution: Play,
  create_defect: Bug, ai_analyze_defect: Bug,
  ai_generate_report: FileText, create_report: FileText,
  review_test_case: CheckCircle, create_test_case: FileText,
  create_requirement: FileText, upload_requirement: FileText,
  ai_generate_cases: FlaskConical, login: Users,
}

const actionLabels: Record<string, string> = {
  execute: "执行测试", start_execution: "开始执行", stop_execution: "停止执行",
  create_defect: "创建缺陷", ai_analyze_defect: "AI分析缺陷",
  ai_generate_report: "AI生成报告", create_report: "创建报告",
  review_test_case: "评审用例", create_test_case: "创建用例",
  create_requirement: "创建需求", upload_requirement: "上传需求",
  ai_generate_cases: "AI生成用例", login: "用户登录",
}

const colorMap = (action: string) => {
  if (action?.includes("error") || action?.includes("delete")) return "text-fail"
  if (action?.includes("create") || action?.includes("generate")) return "text-pass"
  if (action?.includes("execute") || action?.includes("start")) return "text-info"
  return "text-muted"
}

export default function ActivitiesPage() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState("")
  const [moduleFilter, setModuleFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const pageSize = 15

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page: currentPage, page_size: pageSize }
      if (moduleFilter) params.module = moduleFilter
      const res: any = await configApi.listOperationLogs(params)
      if (res?.success !== false && res?.data) {
        const items = res.data.items || res.data || []
        setLogs(items)
        setTotal(res.data.total || items.length)
      } else {
        setLogs([])
        setTotal(0)
      }
    } catch {
      setLogs([])
      setTotal(0)
    }
    setLoading(false)
  }, [currentPage, moduleFilter])

  useEffect(() => { loadLogs() }, [loadLogs])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // 提取唯一值
  const moduleOptions = [...new Set(logs.map((l) => l.module).filter(Boolean))]
  const actionOptions = [...new Set(logs.map((l) => l.action).filter(Boolean))]

  // 客户端筛选
  const filtered = logs.filter((l) => {
    if (search) {
      const q = search.toLowerCase()
      const matchSearch = (l.action || "").toLowerCase().includes(q) ||
        (l.detail || "").toLowerCase().includes(q) ||
        (l.username || "").toLowerCase().includes(q)
      if (!matchSearch) return false
    }
    if (actionFilter && l.action !== actionFilter) return false
    if (dateFrom && l.created_at && new Date(l.created_at) < new Date(dateFrom)) return false
    if (dateTo && l.created_at && new Date(l.created_at) > new Date(dateTo + "T23:59:59")) return false
    return true
  })

  // 统计
  const stats = {
    total: logs.length,
    today: logs.filter((l) => {
      if (!l.created_at) return false
      const d = new Date(l.created_at)
      const now = new Date()
      return d.toDateString() === now.toDateString()
    }).length,
    actions: actionOptions.length,
    users: new Set(logs.map((l) => l.username).filter(Boolean)).size,
  }

  // 导出Excel
  const exportToExcel = () => {
    const data = filtered.map((l) => ({
      ID: l.id,
      时间: l.created_at?.replace("T", " ").slice(0, 19) || "-",
      模块: l.module || "-",
      用户: l.username || "system",
      操作: actionLabels[l.action] || l.action || "-",
      详情: (typeof l.detail === "object" ? l.detail?.message || JSON.stringify(l.detail) : l.detail) || "-",
      IP: l.ip_address || "-",
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "活动记录")
    XLSX.writeFile(wb, `活动记录_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleReset = () => {
    setSearch("")
    setModuleFilter("")
    setActionFilter("")
    setDateFrom("")
    setDateTo("")
    setCurrentPage(1)
  }

  const _time = (l: any) => l.created_at?.replace("T", " ").slice(0, 19) || "-"
  const _module = (l: any) => l.module || "-"
  const _user = (l: any) => l.username || "system"
  const _detail = (l: any) => typeof l.detail === "object" ? l.detail?.message || JSON.stringify(l.detail) : l.detail || "-"
  const _ip = (l: any) => l.ip_address || "-"

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group">
            <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
            <span className="text-xs font-medium text-ink-light group-hover:text-ink transition-colors hidden sm:block">返回</span>
          </button>
          <div className="h-8 w-px bg-border/60" />
          <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md flex-shrink-0">
            <Activity className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>活动记录</h1>
            <p className="text-[11px] text-muted truncate">查看系统中所有活动操作记录</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-cream/30">
        <div className="flex-1 flex flex-col min-h-0 max-w-[1200px] mx-auto">
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-500" /></div>
                <div><p className="text-xs text-ink-light">总记录</p><p className="text-xl font-bold text-ink">{stats.total}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Clock className="w-5 h-5 text-amber" /></div>
                <div><p className="text-xs text-ink-light">今日</p><p className="text-xl font-bold text-ink">{stats.today}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-pass" /></div>
                <div><p className="text-xs text-ink-light">操作类型</p><p className="text-xl font-bold text-ink">{stats.actions}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Users className="w-5 h-5 text-purple-500" /></div>
                <div><p className="text-xs text-ink-light">活跃用户</p><p className="text-xl font-bold text-ink">{stats.users}</p></div>
              </div>
            </div>
          </div>

          {/* 筛选栏 */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索操作/详情/用户..."
                className="w-56 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"
              />
            </div>
            <select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
              <option value="">全部模块</option>
              {moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
              <option value="">全部操作</option>
              {actionOptions.map((a) => <option key={a} value={a}>{actionLabels[a] || a}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
            <span className="text-xs text-muted">至</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
            <button onClick={handleReset} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" /> 重置
            </button>
            <div className="flex gap-1 ml-auto">
              <button onClick={loadLogs} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
              </button>
              <button onClick={exportToExcel} className="h-9 px-3 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> 导出
              </button>
            </div>
          </div>

          {/* 表格 */}
          <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-cream/50">
                    <th className="px-3 py-3 text-center text-xs font-bold text-ink w-10">ID</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-ink">时间</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-ink">模块</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-ink">用户</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-ink">操作</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-ink">详情</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-ink">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-16 text-center text-muted text-sm"><Loader2 className="w-5 h-5 animate-spin text-amber mx-auto mb-2" />加载中...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-16 text-center text-muted"><Activity className="w-10 h-10 mx-auto mb-2 text-muted-light" /><p className="text-sm font-medium">暂无活动记录</p></td></tr>
                  ) : (
                    filtered.map((l, idx) => {
                      const Icon = iconMap[l.action] || Activity
                      return (
                        <tr key={l.id ?? idx} className={`border-b border-border/50 last:border-b-0 ${idx % 2 === 1 ? "bg-cream/30" : ""} hover:bg-cream/50 transition-colors`}>
                          <td className="px-3 py-3 text-center text-xs text-muted">{l.id}</td>
                          <td className="px-3 py-3 text-center text-[11px] text-muted font-mono">{_time(l)}</td>
                          <td className="px-3 py-3 text-center"><span className="text-[11px] text-muted bg-cream px-1.5 py-0.5 rounded">{_module(l)}</span></td>
                          <td className="px-3 py-3 text-center text-xs text-muted">{_user(l)}</td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Icon className={`w-3.5 h-3.5 ${colorMap(l.action)}`} />
                              <span className="text-xs font-medium text-ink">{actionLabels[l.action] || l.action || "-"}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center text-xs text-muted truncate max-w-[300px]" title={_detail(l)}>{_detail(l)}</td>
                          <td className="px-3 py-3 text-center text-[11px] text-muted font-mono">{_ip(l)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-cream/20">
              <span className="text-xs text-muted">共 {filtered.length} 条，第 {currentPage}/{totalPages || 1} 页</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page: number
                  if (totalPages <= 7) page = i + 1
                  else if (currentPage <= 4) page = i + 1
                  else if (currentPage >= totalPages - 3) page = totalPages - 6 + i
                  else page = currentPage - 3 + i
                  return (
                    <button key={page} onClick={() => setCurrentPage(page)} className={`h-8 w-8 text-xs rounded-lg flex items-center justify-center ${currentPage === page ? "gradient-amber text-white" : "border border-border text-ink-light hover:bg-cream"}`}>{page}</button>
                  )
                })}
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
