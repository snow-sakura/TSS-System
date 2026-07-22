/**
 * 操作日志 — 全量操作审计日志
 * 功能：多维度筛选 / 时间倒序 / 详细记录 / 导出 / AI操作追踪
 */
import { useState, useEffect, useMemo } from "react"
import { Search, Filter, Download, Eye, X, ScrollText, User, Bot, Clock, CheckCircle, AlertTriangle, Info, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { configApi } from "@/lib/api"

// 日志级别
const LOG_LEVELS = [
  { key: "INFO", label: "INFO", color: "bg-pass/10 text-pass", icon: Info },
  { key: "WARN", label: "WARN", color: "bg-warn/10 text-warn", icon: AlertTriangle },
  { key: "ERROR", label: "ERROR", color: "bg-fail/10 text-fail", icon: AlertTriangle },
  { key: "DEBUG", label: "DEBUG", color: "bg-muted/10 text-muted", icon: Info },
]

/** 后端操作日志 → UI 展示格式 */
function apiToLog(item: any) {
  // 后端字段：username, module; 前端使用：operator, operator_type
  const action = item.action || ""
  const operator = item.username || item.operator || "system"
  // 推断操作者类型
  const operator_type = operator.toLowerCase().includes("agent") || operator.toLowerCase().includes("bot")
    ? "ai" : (item.operator_type || (action === "消息发送" ? "system" : "user"))
  return {
    id: item.id,
    time: item.created_at || item.time,
    operator,
    operator_type,
    action,
    module: item.module || "-",
    detail: item.detail || item.message || "",
    input: item.input || item.request_data || "",
    output: item.output || item.response_data || "",
    status: item.status === "成功" ? "success" : item.status === "失败" ? "error" : item.level === "WARN" ? "warning" : "success",
    ip: item.ip || item.ip_address || "-",
    device: item.device || item.user_agent || "-",
  }
}

const PAGE_SIZE = 10

export default function OperationLogs() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [search, setSearch] = useState("")
  const [filterLevel, setFilterLevel] = useState<string>("all")
  const [filterModule, setFilterModule] = useState<string>("all")
  const [filterOperator, setFilterOperator] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [total, setTotal] = useState(0)

  const fetchLogs = async () => {
    setFetching(true)
    try {
      const params: Record<string, any> = { page, page_size: PAGE_SIZE }
      if (search) params.search = search
      const res: any = await configApi.listOperationLogs(params)
      const items = res?.data?.items || []
      setLogs(items.map(apiToLog))
      setTotal(res?.data?.total || 0)
    } catch (e: any) {
      toast.error("加载日志失败: " + (e?.message || "未知错误"))
    } finally {
      setFetching(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page])

  // 获取所有模块（从当前页数据）
  const modules = useMemo(() => [...new Set(logs.map((l) => l.module))], [logs])
  const operators = useMemo(() => [...new Set(logs.map((l) => l.operator))], [logs])

  // 客户端筛选（在已有数据上补充搜索）
  const filtered = logs.filter((l) => {
    const matchSearch = !search || l.detail.toLowerCase().includes(search.toLowerCase()) || l.operator.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase())
    const matchLevel = filterLevel === "all" || l.status === filterLevel
    const matchModule = filterModule === "all" || l.module === filterModule
    const matchOperator = filterOperator === "all" || l.operator === filterOperator
    return matchSearch && matchLevel && matchModule && matchOperator
  })

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  // 统计（服务端分页下仅基于当前页统计）
  const infoCount = logs.filter((l) => l.status === "success").length
  const warnCount = logs.filter((l) => l.status === "warning").length
  const errorCount = logs.filter((l) => l.status === "error").length

  const handleExport = () => {
    const csv = filtered.map((l) => `${l.id},${l.time},${l.operator},${l.action},${l.module},${l.detail},${l.status}`).join("\n")
    const blob = new Blob([`ID,时间,操作者,操作类型,模块,详情,状态\n${csv}`], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `operation-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success("日志导出成功")
  }

  const getLevelInfo = (status: string) => {
    if (status === "success") return LOG_LEVELS[0]
    if (status === "warning") return LOG_LEVELS[1]
    if (status === "error") return LOG_LEVELS[2]
    return LOG_LEVELS[3]
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-ink">操作日志</h2>
          <p className="text-xs text-muted mt-0.5">全量操作审计 · 用户+AI双轨追踪 · 多维度筛选 · 时间倒序</p>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink">操作日志</h2>
        <p className="text-xs text-muted mt-0.5">全量操作审计 · 用户+AI双轨追踪 · 多维度筛选 · 时间倒序</p>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-ink">{total}</p><p className="text-[11px] text-muted">日志总数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-pass">{infoCount}</p><p className="text-[11px] text-muted">成功</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-warn">{warnCount}</p><p className="text-[11px] text-muted">警告</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-fail">{errorCount}</p><p className="text-[11px] text-muted">错误</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-info">{logs.filter((l) => l.operator_type === "ai").length}</p><p className="text-[11px] text-muted">AI操作</p></div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center mb-3 gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="搜索详情/操作者/操作类型..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <select value={filterLevel} onChange={(e) => { setFilterLevel(e.target.value); setPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
          <option value="all">全部状态</option>
          <option value="success">成功</option>
          <option value="warning">警告</option>
          <option value="error">错误</option>
        </select>
        <select value={filterModule} onChange={(e) => { setFilterModule(e.target.value); setPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
          <option value="all">全部模块</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterOperator} onChange={(e) => { setFilterOperator(e.target.value); setPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
          <option value="all">全部操作者</option>
          {operators.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <button onClick={fetchLogs} disabled={fetching} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${fetching ? "animate-spin" : ""}`} /> 刷新
        </button>
        <button onClick={handleExport} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 导出</button>
      </div>

      {/* 日志表格 */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream/30 border-b border-border">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-16">ID</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-40">时间</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-16">状态</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-28">操作者</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-24">操作类型</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-28">模块</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">详情</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted"><ScrollText className="w-8 h-8 mx-auto mb-2 text-muted-light" /><p className="text-sm">暂无日志</p></td></tr>
              ) : filtered.map((l) => {
                const levelInfo = getLevelInfo(l.status)
                const LevelIcon = levelInfo.icon
                return (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-cream/20 transition-colors">
                    <td className="px-4 py-2.5 text-[11px] text-muted font-mono">#{l.id}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink font-mono">{new Date(l.time).toLocaleString("zh-CN")}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${levelInfo.color}`}>
                        <LevelIcon className="w-3 h-3" /> {l.status === "success" ? "成功" : l.status === "warning" ? "警告" : "错误"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1 text-[11px] text-ink">
                        {l.operator_type === "ai" ? <Bot className="w-3 h-3 text-amber" /> : <User className="w-3 h-3 text-muted" />}
                        <span className="truncate max-w-[100px]">{l.operator}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-ink">{l.action}</td>
                    <td className="px-4 py-2.5 text-[11px] text-muted">{l.module}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink-light max-w-[300px] truncate">{l.detail}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => setSelectedLog(l)} className="p-1 rounded hover:bg-cream transition-colors"><Eye className="w-3.5 h-3.5 text-muted" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted">共 {total} 条记录，第 {page}/{totalPages} 页</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="h-8 px-2 rounded-lg border border-border text-xs text-ink-light hover:bg-cream disabled:opacity-50"><ChevronLeft className="w-3.5 h-3.5" /></button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 rounded-lg text-xs font-medium ${page === p ? "gradient-amber text-white" : "border border-border text-ink-light hover:bg-cream"}`}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="h-8 px-2 rounded-lg border border-border text-xs text-ink-light hover:bg-cream disabled:opacity-50"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[640px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2"><ScrollText className="w-4 h-4 text-amber" /> 日志详情 — #{selectedLog.id}</h3>
              <button onClick={() => setSelectedLog(null)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { label: "日志ID", value: `#${selectedLog.id}` },
                    { label: "时间", value: new Date(selectedLog.time).toLocaleString("zh-CN") },
                    { label: "操作者", value: selectedLog.operator },
                    { label: "操作者类型", value: selectedLog.operator_type === "ai" ? "AI Agent" : "用户" },
                    { label: "操作类型", value: selectedLog.action },
                    { label: "模块", value: selectedLog.module },
                    { label: "状态", value: selectedLog.status === "success" ? "成功" : selectedLog.status === "warning" ? "警告" : "错误" },
                    { label: "详情", value: selectedLog.detail },
                    { label: "IP地址", value: selectedLog.ip },
                    { label: "设备信息", value: selectedLog.device },
                    { label: "输入参数", value: selectedLog.input },
                    { label: "输出结果", value: selectedLog.output },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-2.5 text-xs text-muted w-24">{row.label}</td>
                      <td className="py-2.5 text-xs text-ink font-mono break-all">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
