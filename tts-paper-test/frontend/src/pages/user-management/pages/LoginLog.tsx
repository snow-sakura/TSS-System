/**
 * 登录日志 - 连接真实API
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Eye, CheckCircle, XCircle, Shield, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { usersApi } from "@/lib/api"
import PreviewModal from "../../requirement-testing/components/PreviewModal"

interface LoginLogItem {
  id: number
  user_id: number
  username: string
  ip_address: string
  user_agent: string
  status: string
  created_at: string
}

export default function LoginLog() {
  const [logs, setLogs] = useState<LoginLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 })
  const [previewLog, setPreviewLog] = useState<any>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await usersApi.listLoginLogs({
        page: pagination.page,
        page_size: pagination.page_size,
        search: search || undefined,
      })
      if (res?.data) {
        setLogs(res.data.items || [])
        setPagination((p) => ({ ...p, total: res.data.total, total_pages: res.data.total_pages }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.page_size, search])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const successCount = logs.filter((l) => l.status === "success").length
  const failCount = logs.filter((l) => l.status !== "success").length

  const parseDevice = (ua: string) => {
    if (!ua) return { device: "-", browser: "-" }
    const hasWin = ua.includes("Windows") ? "Windows" : null
    const hasMac = ua.includes("Mac") || ua.includes("macOS") ? "macOS" : null
    const hasLinux = ua.includes("Linux") && !ua.includes("Android") ? "Linux" : null
    const device = hasWin || hasMac || hasLinux || "Unknown"
    const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|curl|Python)[\/\s][\d.]+/)
    const browser = browserMatch ? browserMatch[0] : ua.slice(0, 40)
    return { device, browser }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">登录日志 <span className="text-xs font-normal text-muted">({pagination.total}条)</span></h2><p className="text-xs text-muted mt-0.5">用户登录记录审计，支持搜索与结果筛选</p></div>
      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center"><Shield className="w-5 h-5 text-info" /></div><div><p className="text-2xl font-bold text-ink">{pagination.total}</p><p className="text-[11px] text-muted">总登录次数</p></div></div>
        <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-pass/10 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-pass" /></div><div><p className="text-2xl font-bold text-ink">{successCount}</p><p className="text-[11px] text-muted">成功登录</p></div></div>
        <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-fail/10 flex items-center justify-center"><XCircle className="w-5 h-5 text-fail" /></div><div><p className="text-2xl font-bold text-ink">{failCount}</p><p className="text-[11px] text-muted">失败尝试</p></div></div>
      </div>
      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchLogs()} placeholder="搜索用户..." className="w-44 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部结果</option><option value="success">成功</option><option value="fail">失败</option></select>
        <button onClick={fetchLogs} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
      </div>
      {/* 表格 */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-amber" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-cream/50">
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">ID</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">用户名</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">登录时间</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">IP地址</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">设备/浏览器</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">结果</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">操作</th>
              </tr></thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-muted"><Shield className="w-10 h-10 mx-auto mb-2 text-muted-light" /><p className="text-sm font-medium">暂无登录记录</p></td></tr>
                ) : logs.map((log, idx) => {
                  const { device, browser } = parseDevice(log.user_agent)
                  return (
                    <tr key={log.id} className={`border-b border-border/50 last:border-b-0 ${idx % 2 === 1 ? "bg-cream/30" : ""} hover:bg-cream/50`}>
                      <td className="px-4 py-3 text-center text-muted">{log.id}</td>
                      <td className="px-4 py-3 text-center font-medium text-ink">{log.username}</td>
                      <td className="px-4 py-3 text-center text-xs text-muted">{log.created_at ? new Date(log.created_at).toLocaleString("zh-CN") : "-"}</td>
                      <td className="px-4 py-3 text-center text-xs text-muted font-mono">{log.ip_address || "-"}</td>
                      <td className="px-4 py-3 text-center text-xs text-muted">{device} / {browser}</td>
                      <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${log.status === "success" ? "bg-pass/10 text-pass border border-pass/20" : "bg-fail/10 text-fail border border-fail/20"}`}>{log.status === "success" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}{log.status === "success" ? "成功" : "失败"}</span></td>
                      <td className="px-4 py-3 text-center"><button onClick={() => setPreviewLog(log)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors"><Eye className="w-4 h-4" /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-cream/20">
            <span className="text-xs text-muted">共 {pagination.total} 条，第 {pagination.page}/{pagination.total_pages || 1} 页</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} disabled={pagination.page <= 1} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
              <span className="h-8 px-3 text-xs rounded-lg gradient-amber text-white flex items-center">{pagination.page}</span>
              <button onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} disabled={pagination.page >= pagination.total_pages} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
            </div>
          </div>
        </div>
      )}

      {previewLog && <PreviewModal title={`登录记录 #${previewLog.id}`} content={`# 登录记录详情\n\n| 字段 | 值 |\n|------|----|\n| 用户名 | ${previewLog.username} |\n| 登录时间 | ${previewLog.created_at || "-"} |\n| IP地址 | ${previewLog.ip_address || "-"} |\n| User-Agent | ${previewLog.user_agent || "-"} |\n| 登录结果 | ${previewLog.status} |`} onClose={() => setPreviewLog(null)} />}
    </div>
  )
}
