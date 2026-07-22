/**
 * 设备管理 - 连接真实API
 */
import { useState, useEffect, useCallback } from "react"
import { Search, ShieldCheck, ShieldOff, Trash2, Smartphone, Monitor, Laptop, RefreshCw, Loader2, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { usersApi } from "@/lib/api"

interface DeviceItem {
  id: number
  user_id: number
  username: string
  device_name: string
  os: string
  browser: string
  ip_address: string
  fingerprint: string
  status: string
  last_active_at: string
  created_at: string
}

export default function DeviceMgmt() {
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 })

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await usersApi.listDevices({
        page: pagination.page,
        page_size: pagination.page_size,
        search: search || undefined,
        status: statusFilter || undefined,
      })
      if (res?.data) {
        setDevices(res.data.items || [])
        setPagination((p) => ({ ...p, total: res.data.total, total_pages: res.data.total_pages }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.page_size, search, statusFilter])

  useEffect(() => { fetchDevices() }, [fetchDevices])

  const handleTrust = async (id: number) => {
    try {
      await usersApi.updateDeviceStatus(id, "可信")
      toast.success("设备已标记为可信")
      fetchDevices()
    } catch { toast.error("操作失败") }
  }

  const handleBan = async (id: number) => {
    if (!confirm("确定封禁该设备？")) return
    try {
      await usersApi.updateDeviceStatus(id, "已封禁")
      toast.success("设备已封禁")
      fetchDevices()
    } catch { toast.error("操作失败") }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除该设备记录？")) return
    try {
      await usersApi.deleteDevice(id)
      toast.success("设备已删除")
      fetchDevices()
    } catch { toast.error("操作失败") }
  }

  const getDeviceIcon = (os: string) => {
    if (!os) return <Smartphone className="w-4 h-4" />
    if (os.toLowerCase().includes("iphone") || os.toLowerCase().includes("ios") || os.toLowerCase().includes("android")) return <Smartphone className="w-4 h-4" />
    if (os.toLowerCase().includes("windows")) return <Monitor className="w-4 h-4" />
    return <Laptop className="w-4 h-4" />
  }

  const statusColor = (s: string) => {
    if (s === "可信") return "bg-pass/10 text-pass border border-pass/20"
    if (s === "已封禁") return "bg-fail/10 text-fail border border-fail/20"
    return "bg-amber-light text-warn border border-amber/20"
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">设备管理 <span className="text-xs font-normal text-muted">({pagination.total}台)</span></h2><p className="text-xs text-muted mt-0.5">用户登录设备管理，支持可信标记与封禁</p></div>
      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchDevices()} placeholder="搜索用户名/设备..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部状态</option><option value="可信">可信</option><option value="未验证">未验证</option><option value="已封禁">已封禁</option></select>
        <button onClick={fetchDevices} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
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
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">设备名称</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">操作系统</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">浏览器</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">最后活跃</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">状态</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">操作</th>
              </tr></thead>
              <tbody>
                {devices.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-muted"><Smartphone className="w-10 h-10 mx-auto mb-2 text-muted-light" /><p className="text-sm font-medium">暂无设备数据</p></td></tr>
                ) : devices.map((d, idx) => (
                  <tr key={d.id} className={`border-b border-border/50 last:border-b-0 ${idx % 2 === 1 ? "bg-cream/30" : ""} hover:bg-cream/50`}>
                    <td className="px-4 py-3 text-center text-muted">{d.id}</td>
                    <td className="px-4 py-3 text-center font-medium text-ink">{d.username}</td>
                    <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-2">{getDeviceIcon(d.os)}<span className="text-sm text-ink truncate max-w-[180px]">{d.device_name}</span></div></td>
                    <td className="px-4 py-3 text-center text-xs text-muted">{d.os || "-"}</td>
                    <td className="px-4 py-3 text-center text-xs text-muted">{d.browser || "-"}</td>
                    <td className="px-4 py-3 text-center text-xs text-muted">{d.last_active_at ? new Date(d.last_active_at).toLocaleString("zh-CN") : "-"}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(d.status)}`}>{d.status === "可信" ? <ShieldCheck className="w-3 h-3" /> : d.status === "已封禁" ? <ShieldOff className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}{d.status}</span></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {d.status !== "可信" && <button onClick={() => handleTrust(d.id)} className="p-1.5 rounded-lg hover:bg-pass/10 text-ink-light hover:text-pass transition-colors" title="标记可信"><ShieldCheck className="w-4 h-4" /></button>}
                        {d.status !== "已封禁" && <button onClick={() => handleBan(d.id)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="封禁"><ShieldOff className="w-4 h-4" /></button>}
                        <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-cream/20">
              <span className="text-xs text-muted">共 {pagination.total} 台</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} disabled={pagination.page <= 1} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
                <span className="h-8 px-3 text-xs rounded-lg gradient-amber text-white flex items-center">{pagination.page}</span>
                <button onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} disabled={pagination.page >= pagination.total_pages} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
