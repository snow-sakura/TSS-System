/**
 * 用户状态管理 - 连接真实API的在线/离线状态 + 强制下线
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Wifi, WifiOff, ShieldOff, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { usersApi } from "@/lib/api"

interface StatusItem {
  id: number
  username: string
  status: string
  last_login_at: string
  ip: string
  browser: string
}

export default function UserStatus() {
  const [data, setData] = useState<StatusItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await usersApi.listUsers({ page: 1, page_size: 50, search: search || undefined, status: statusFilter || undefined })
      if (res?.data?.items) {
        setData(res.data.items.map((u: any) => ({
          id: u.id,
          username: u.username,
          status: u.status === "active" ? "在线" : "离线",
          last_login_at: u.last_login_at || "-",
          ip: u.ip || "-",
          browser: u.browser || "-",
        })))
      }
    } catch {
      // 保持空数据
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleForceOffline = async (user: StatusItem) => {
    if (!confirm(`确定强制用户「${user.username}」下线？`)) return
    try {
      await usersApi.updateUser(user.id, { status: "inactive" })
      toast.success(`${user.username} 已被强制下线`)
      fetchStatus()
    } catch {
      toast.error("操作失败")
    }
  }

  const onlineCount = data.filter((d) => d.status === "在线").length
  const offlineCount = data.filter((d) => d.status === "离线").length

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink">用户状态</h2>
        <p className="text-xs text-muted mt-0.5">实时监控用户在线状态与活跃信息</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pass/10 flex items-center justify-center"><Wifi className="w-5 h-5 text-pass" /></div>
          <div><p className="text-2xl font-bold text-ink">{onlineCount}</p><p className="text-[11px] text-muted">在线用户</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center"><WifiOff className="w-5 h-5 text-muted" /></div>
          <div><p className="text-2xl font-bold text-ink">{offlineCount}</p><p className="text-[11px] text-muted">离线用户</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center"><ShieldOff className="w-5 h-5 text-info" /></div>
          <div><p className="text-2xl font-bold text-ink">{data.length}</p><p className="text-[11px] text-muted">总用户数</p></div>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索用户名..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
          <option value="">全部状态</option>
          <option value="active">在线</option>
          <option value="inactive">离线</option>
        </select>
        <button onClick={fetchStatus} disabled={loading} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
        </button>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream/30 border-b border-border">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">用户名</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">状态</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">最后活跃</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">IP地址</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">浏览器</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted mx-auto" /></td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted">暂无数据</td></tr>
            ) : data.map((u) => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-cream/20 transition-colors">
                <td className="px-4 py-2.5 text-sm font-medium text-ink">{u.username}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${u.status === "在线" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>
                    {u.status === "在线" ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[11px] text-muted">{u.last_login_at}</td>
                <td className="px-4 py-2.5 text-[11px] text-ink font-mono">{u.ip}</td>
                <td className="px-4 py-2.5 text-[11px] text-muted">{u.browser}</td>
                <td className="px-4 py-2.5">
                  {u.status === "在线" && (
                    <button onClick={() => handleForceOffline(u)} className="px-2 py-1 rounded-lg text-[10px] font-medium bg-fail/10 text-fail hover:bg-fail/20 transition-colors">
                      强制下线
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
