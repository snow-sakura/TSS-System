/**
 * 环境配置 — 多环境健康仪表盘
 * 功能：环境分类管理 / 服务依赖映射 / 健康检测 / 环境对比 / 流程关联
 */
import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, X, Server, Activity, RefreshCw, Search, CheckCircle, XCircle, Clock, GitCompare, TrendingUp, Globe, Smartphone, Zap, Shield, BarChart3, Database, Wifi, ChevronDown, ChevronRight, Copy, Link2 } from "lucide-react"
import { toast } from "sonner"
import { configApi } from "@/lib/api"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

// 环境类型定义
const ENV_TYPES = [
  { key: "web-automation", label: "Web自动化", icon: Globe, color: "from-sky-500 to-blue-600", desc: "浏览器自动化测试环境" },
  { key: "app-automation", label: "APP自动化", icon: Smartphone, color: "from-violet-500 to-purple-600", desc: "移动端自动化测试环境" },
  { key: "api-automation", label: "接口自动化", icon: Zap, color: "from-amber to-orange-500", desc: "API接口测试环境" },
  { key: "performance", label: "性能测试", icon: BarChart3, color: "from-rose-500 to-red-600", desc: "压力与性能测试环境" },
  { key: "security", label: "安全测试", icon: Shield, color: "from-emerald-500 to-green-600", desc: "安全扫描与渗透测试环境" },
  { key: "dev", label: "开发环境", icon: Server, color: "from-slate-500 to-gray-600", desc: "开发调试环境" },
  { key: "staging", label: "预发布环境", icon: Database, color: "from-teal-500 to-cyan-600", desc: "预发布验证环境" },
]

/** 后端 API 响应 → UI 展示格式 */
function apiToEnv(item: any) {
  return {
    id: item.id,
    name: item.name,
    type: "web-automation", // 后端不存储类型，默认 Web自动化
    status: item.status === "在线" ? "online" : "offline",
    url: item.url,
    description: item.description || "",
    database: item.db_url ? { url: item.db_url, pool_size: 10, timeout: 5000 } : null,
    redis: item.redis_url ? { url: item.redis_url, max_connections: 50, db: 0 } : null,
    services: [] as any[],
    health: { last_check: item.last_check_at || "-", trend: "stable", uptime: "-", history: [] as any[] },
    linked_plans: [] as string[],
    linked_agents: [] as string[],
    last_check_at: item.last_check_at || "-",
  }
}

/** 表单数据 → 后端创建/更新 payload */
function formToPayload(form: any) {
  return {
    name: form.name,
    url: form.url,
    db_url: form.dbUrl || undefined,
    redis_url: form.redisUrl || undefined,
    description: form.description || undefined,
  }
}

export default function EnvironmentConfig() {
  const [envs, setEnvs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingEnv, setEditingEnv] = useState<any>(null)
  const [form, setForm] = useState({ name: "", type: "web-automation", url: "", dbUrl: "", redisUrl: "", description: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [checkingId, setCheckingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [compareEnv, setCompareEnv] = useState<any>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [batchChecking, setBatchChecking] = useState(false)
  const [expandedEnv, setExpandedEnv] = useState<string | null>(null)

  /** 从后端加载环境列表 */
  const fetchEnvs = async () => {
    setFetching(true)
    try {
      const res: any = await configApi.listEnvironments(1, 100)
      const items = res?.data?.items || []
      setEnvs(items.map(apiToEnv))
    } catch (e: any) {
      toast.error("加载环境列表失败: " + (e?.message || "未知错误"))
    } finally {
      setFetching(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEnvs()
  }, [])

  const onlineCount = envs.filter((e) => e.status === "online").length
  const offlineCount = envs.filter((e) => e.status === "offline" || e.status === "maintenance").length
  const filteredEnvs = envs.filter((e) => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.url.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === "all" || e.type === filterType
    return matchSearch && matchType
  })

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "环境名称不能为空"
    if (!form.url.trim()) errors.url = "服务地址不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      if (dialogMode === "create") {
        await configApi.createEnvironment(formToPayload(form))
        toast.success("环境创建成功")
      } else {
        await configApi.updateEnvironment(editingEnv.id, formToPayload(form))
        toast.success("环境更新成功")
      }
      setShowDialog(false)
      await fetchEnvs()
    } catch (e: any) {
      toast.error(dialogMode === "create" ? "创建环境失败: " + (e?.message || "未知错误") : "更新环境失败: " + (e?.message || "未知错误"))
    }
  }

  const handleDelete = (env: any) => setDeleteTarget(env)
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await configApi.deleteEnvironment(deleteTarget.id)
      toast.success("环境已删除")
      setDeleteTarget(null)
      await fetchEnvs()
    } catch (e: any) {
      toast.error("删除环境失败: " + (e?.message || "未知错误"))
    }
  }

  const handleHealthCheck = async (env: any) => {
    setCheckingId(env.id)
    try {
      await configApi.healthCheckEnvironment(env.id)
      toast.success(`${env.name} 健康检测完成`)
      await fetchEnvs()
    } catch (e: any) {
      toast.error(`${env.name} 健康检测失败: ` + (e?.message || "未知错误"))
    } finally {
      setCheckingId(null)
    }
  }

  const handleBatchCheck = async () => {
    setBatchChecking(true)
    try {
      const res: any = await configApi.batchHealthCheck()
      const data = res?.data
      toast.success(`批量检测完成: ${data?.online || 0}/${data?.total || 0} 在线`)
      await fetchEnvs()
    } catch (e: any) {
      toast.error("批量检测失败: " + (e?.message || "未知错误"))
    } finally {
      setBatchChecking(false)
    }
  }

  const openCreate = () => {
    setDialogMode("create"); setEditingEnv(null)
    setForm({ name: "", type: "web-automation", url: "", dbUrl: "", redisUrl: "", description: "" })
    setFormErrors({}); setShowDialog(true)
  }
  const openEdit = (env: any) => {
    setDialogMode("edit"); setEditingEnv(env)
    setForm({
      name: env.name, type: env.type, url: env.url,
      dbUrl: env.database?.url || "", redisUrl: env.redis?.url || "",
      description: env.description || "",
    })
    setFormErrors({}); setShowDialog(true)
  }

  const getTypeInfo = (typeKey: string) => ENV_TYPES.find((t) => t.key === typeKey) || ENV_TYPES[0]

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-ink">环境配置</h2>
          <p className="text-xs text-muted mt-0.5">多环境分类管理 · 服务依赖映射 · 健康检测 · 流程关联</p>
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
        <h2 className="text-base font-semibold text-ink">环境配置</h2>
        <p className="text-xs text-muted mt-0.5">多环境分类管理 · 服务依赖映射 · 健康检测 · 流程关联</p>
      </div>

      {/* 统计仪表盘 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-ink">{envs.length}</p>
          <p className="text-[11px] text-muted">环境总数</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-pass">{onlineCount}</p>
          <p className="text-[11px] text-muted">在线</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-fail">{offlineCount}</p>
          <p className="text-[11px] text-muted">离线/维护</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-info">{envs.length > 0 ? Math.round(onlineCount / envs.length * 100) : 0}%</p>
          <p className="text-[11px] text-muted">健康率</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
          <p className="text-xl font-bold text-amber">{new Set(envs.map((e) => e.type)).size}</p>
          <p className="text-[11px] text-muted">环境类型</p>
        </div>
      </div>

      {/* 搜索 + 类型筛选 + 操作 */}
      <div className="flex flex-wrap items-center mb-3 gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索环境名称/地址..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-border p-0.5">
          <button onClick={() => setFilterType("all")} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filterType === "all" ? "bg-cream text-ink" : "text-muted hover:text-ink"}`}>全部</button>
          {ENV_TYPES.slice(0, 5).map((t) => (
            <button key={t.key} onClick={() => setFilterType(t.key)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filterType === t.key ? "bg-cream text-ink" : "text-muted hover:text-ink"}`}>{t.label}</button>
          ))}
        </div>
        <button onClick={handleBatchCheck} disabled={batchChecking} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-50">
          {batchChecking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />} 批量检测
        </button>
        <button onClick={fetchEnvs} disabled={fetching} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${fetching ? "animate-spin" : ""}`} /> 刷新
        </button>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 新建环境
        </button>
      </div>

      {/* 环境列表 */}
      <div className="space-y-3 flex-1 overflow-y-auto">
        {filteredEnvs.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <Server className="w-10 h-10 mx-auto mb-2 text-muted-light" />
            <p className="text-sm font-medium">暂无环境</p>
            <p className="text-xs text-muted mt-1">点击"新建环境"添加第一个测试环境</p>
          </div>
        ) : filteredEnvs.map((env) => {
          const typeInfo = getTypeInfo(env.type)
          const TypeIcon = typeInfo.icon
          const isExpanded = expandedEnv === env.id
          return (
            <div key={env.id} className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
              {/* 环境头部 */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${typeInfo.color} flex items-center justify-center shadow-sm`}>
                      <TypeIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink">{env.name}</h3>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${env.status === "online" ? "bg-pass/10 text-pass" : env.status === "maintenance" ? "bg-warn/10 text-warn" : "bg-fail/10 text-fail"}`}>
                          {env.status === "online" ? "在线" : env.status === "maintenance" ? "维护中" : "离线"}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-cream text-[10px] font-medium text-muted">{typeInfo.label}</span>
                      </div>
                      {env.description && <p className="text-[11px] text-muted mt-0.5">{env.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleHealthCheck(env)} disabled={checkingId === env.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cream text-ink-light hover:bg-border transition-colors disabled:opacity-50">
                      {checkingId === env.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />} 检测
                    </button>
                    <button onClick={() => { setCompareEnv(env); setShowCompare(true) }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cream text-ink-light hover:bg-border transition-colors">
                      <GitCompare className="w-3 h-3" />
                    </button>
                    <button onClick={() => openEdit(env)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(env)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* 配置详情网格 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-cream/30 rounded-xl p-3 mb-3">
                  <div><p className="text-[10px] text-muted mb-0.5">服务地址</p><p className="text-xs text-ink font-mono truncate">{env.url}</p></div>
                  <div><p className="text-[10px] text-muted mb-0.5">数据库</p><p className="text-xs text-ink font-mono truncate">{env.database?.url || "-"}</p></div>
                  <div><p className="text-[10px] text-muted mb-0.5">缓存</p><p className="text-xs text-ink font-mono truncate">{env.redis?.url || "-"}</p></div>
                  <div><p className="text-[10px] text-muted mb-0.5">健康率</p><p className="text-xs text-ink font-mono">{env.health?.uptime || "-"}</p></div>
                </div>

                {/* 服务依赖 */}
                {env.services && env.services.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] text-muted mb-1.5 flex items-center gap-1"><Wifi className="w-3 h-3" /> 服务依赖</p>
                    <div className="flex flex-wrap gap-1.5">
                      {env.services.map((s: any, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cream text-[10px]">
                          <span className={`w-1.5 h-1.5 rounded-full ${s.status === "online" ? "bg-pass" : "bg-fail"}`} />
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 健康检测时间线 */}
                {env.health?.history && env.health.history.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] text-muted mb-1.5 flex items-center gap-1"><Clock className="w-3 h-3" /> 最近检测记录</p>
                    <div className="flex items-end gap-1 h-10 px-1">
                      {env.health.history.map((h: any, i: number) => {
                        const latencyNum = parseFloat(String(h.latency || "0").replace("s", ""))
                        const barHeight = Math.min(Math.max(Math.round((latencyNum || 0.1) * 40), 6), 36)
                        return (
                          <div key={i} className="flex flex-col items-center gap-0.5 flex-1 min-w-0 group relative">
                            <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 bg-ink text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap shadow">
                              {h.time} {h.latency} {h.status}
                            </div>
                            <div className={`w-full rounded-t-sm transition-all cursor-pointer ${h.status === "online" ? "bg-gradient-to-t from-pass to-green-300" : h.status === "maintenance" ? "bg-gradient-to-t from-warn to-yellow-300" : "bg-gradient-to-t from-fail to-red-300"}`} style={{ height: `${barHeight}px` }} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 关联流程 */}
                <div className="flex items-center justify-between text-[11px] text-muted border-t border-border/50 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 text-muted-light" />
                    <span>关联测试计划: {env.linked_plans?.length || 0} 个</span>
                    <span className="text-border">|</span>
                    <span>关联Agent: {env.linked_agents?.length || 0} 个</span>
                  </div>
                  <span>上次检测: {env.last_check_at && env.last_check_at !== "-" ? new Date(env.last_check_at).toLocaleString("zh-CN") : "-"}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 环境对比弹窗 */}
      {showCompare && compareEnv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCompare(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[640px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2"><GitCompare className="w-4 h-4 text-amber" /> 配置详情 — {compareEnv.name}</h3>
              <button onClick={() => setShowCompare(false)} className="p-1.5 rounded-lg hover:bg-cream transition-colors"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border"><th className="text-left py-2 text-xs font-bold text-ink w-32">配置项</th><th className="text-left py-2 text-xs font-bold text-ink">当前环境</th></tr></thead>
                <tbody>
                  {[
                    { label: "环境名称", value: compareEnv.name },
                    { label: "环境类型", value: getTypeInfo(compareEnv.type).label },
                    { label: "服务地址", value: compareEnv.url },
                    { label: "状态", value: compareEnv.status === "online" ? "在线" : compareEnv.status === "maintenance" ? "维护中" : "离线" },
                    { label: "数据库", value: compareEnv.database?.url || "未配置" },
                    { label: "缓存", value: compareEnv.redis?.url || "未配置" },
                    { label: "关联测试计划", value: compareEnv.linked_plans?.join(", ") || "无" },
                    { label: "关联Agent", value: compareEnv.linked_agents?.join(", ") || "无" },
                    { label: "健康率", value: compareEnv.health?.uptime || "-" },
                    { label: "上次检测", value: compareEnv.last_check_at && compareEnv.last_check_at !== "-" ? new Date(compareEnv.last_check_at).toLocaleString("zh-CN") : "-" },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-2.5 text-xs text-muted">{row.label}</td>
                      <td className="py-2.5 text-xs text-ink font-mono">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button onClick={() => setShowCompare(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 确认删除 */}
      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下环境配置？此操作不可恢复。" itemName={deleteTarget?.name || ""} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{dialogMode === "create" ? "新建环境" : "编辑环境"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream transition-colors"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">环境名称 *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：Web自动化测试环境" />
                {formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">环境类型 *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none bg-white">
                  {ENV_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label} — {t.desc}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">服务地址 *</label>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink font-mono focus:border-amber outline-none ${formErrors.url ? "border-fail" : "border-border"}`} placeholder="https://test.example.com" />
                {formErrors.url && <p className="text-[11px] text-fail mt-1">{formErrors.url}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">数据库地址</label>
                  <input value={form.dbUrl} onChange={(e) => setForm({ ...form, dbUrl: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink font-mono focus:border-amber outline-none" placeholder="mysql://host:3306/db" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">缓存地址</label>
                  <input value={form.redisUrl} onChange={(e) => setForm({ ...form, redisUrl: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink font-mono focus:border-amber outline-none" placeholder="redis://host:6379" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">描述</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="环境用途描述..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
