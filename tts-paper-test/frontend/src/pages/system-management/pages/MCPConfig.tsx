/**
 * MCP服务配置 — 外部工具协议注册 + 工具发现 + 连通检测 + 安全配置
 * 已对接 configApi 真实 API
 */
import { useState, useEffect, useCallback } from "react"
import { Plus, Edit, Trash2, X, Webhook, Activity, RefreshCw, Wifi, WifiOff, AlertTriangle, Server, Search, ChevronDown, ChevronRight, Shield, Wrench, Globe, Lock, Key, Zap, Cpu, Database, Code, Bell } from "lucide-react"
import { toast } from "sonner"
import { configApi } from "@/lib/api"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

/** 后端 API 服务 → UI 展示格式 */
function apiToService(item: any) {
  return {
    id: item.id,
    name: item.name || "",
    url: item.url || "",
    description: item.description || "",
    service_type: item.service_type || "工具",
    status: item.status || "在线",
    last_check_at: item.last_check_at || null,
    tools: item.tools || [],
    config: item.config || {},
    linked_agents: item.linked_agents || [],
  }
}

/** UI 格式 → 后端 API payload */
function formToPayload(form: any) {
  const payload: Record<string, any> = {
    name: form.name || "",
    url: form.url || "",
    description: form.description || "",
    service_type: form.service_type || "工具",
  }
  if (form.config.trim()) {
    try { payload.config = JSON.parse(form.config) } catch {}
  }
  return payload
}

export default function MCPConfig() {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingService, setEditingService] = useState<any>(null)
  const [form, setForm] = useState({ name: "", url: "", description: "", service_type: "工具", config: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [testingId, setTestingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>({})
  const [expandedSecurity, setExpandedSecurity] = useState<Record<number, boolean>>({})
  const [batchTesting, setBatchTesting] = useState(false)

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await configApi.listMCPServices(1, 100)
      const items = res?.data?.items || res?.data || []
      setServices(items.map(apiToService))
    } catch (e: any) {
      toast.error("加载MCP服务列表失败: " + (e?.message || "未知错误"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchServices() }, [fetchServices])

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "服务名称不能为空"
    if (!form.url.trim()) errors.url = "服务地址不能为空"
    if (form.config.trim()) { try { JSON.parse(form.config) } catch { errors.config = "JSON 格式无效" } }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      const payload = formToPayload(form)
      if (dialogMode === "create") {
        await configApi.createMCPService(payload)
        toast.success("服务创建成功")
      } else if (editingService) {
        await configApi.updateMCPService(editingService.id, payload)
        toast.success("服务更新成功")
      }
      setShowDialog(false)
      fetchServices()
    } catch (e: any) {
      toast.error("保存失败: " + (e?.message || "未知错误"))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await configApi.deleteMCPService(deleteTarget.id)
      toast.success("服务已删除")
      setDeleteTarget(null)
      fetchServices()
    } catch (e: any) {
      toast.error("删除失败: " + (e?.message || "未知错误"))
    }
  }

  const handleTestConnection = async (s: any) => {
    setTestingId(s.id)
    try {
      await configApi.testMCPConnection(s.id)
      toast.success(`「${s.name}」连通测试成功`)
      fetchServices()
    } catch (e: any) {
      toast.error(`「${s.name}」测试失败: ` + (e?.message || "未知错误"))
    } finally {
      setTestingId(null)
    }
  }

  const handleBatchTest = async () => {
    setBatchTesting(true)
    try {
      await configApi.batchTestMCP()
      toast.success("批量检测完成")
      fetchServices()
    } catch (e: any) {
      toast.error("批量检测失败: " + (e?.message || "未知错误"))
    } finally {
      setBatchTesting(false)
    }
  }

  const openCreate = () => { setDialogMode("create"); setEditingService(null); setForm({ name: "", url: "", description: "", service_type: "工具", config: "" }); setFormErrors({}); setShowDialog(true) }
  const openEdit = (s: any) => { setDialogMode("edit"); setEditingService(s); setForm({ name: s.name, url: s.url, description: s.description || "", service_type: s.service_type || "工具", config: typeof s.config === "object" ? JSON.stringify(s.config, null, 2) : s.config || "" }); setFormErrors({}); setShowDialog(true) }

  const statusIcon = (status: string) => {
    if (status === "在线") return <Wifi className="w-3.5 h-3.5 text-pass" />
    if (status === "错误") return <AlertTriangle className="w-3.5 h-3.5 text-fail" />
    return <WifiOff className="w-3.5 h-3.5 text-muted" />
  }

  const totalTools = services.reduce((sum, s) => sum + (s.tools?.length || 0), 0)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink">MCP服务</h2><p className="text-xs text-muted mt-0.5">外部工具协议注册 · 连通检测 · 工具发现 · 安全配置</p></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-ink">{services.length}</p><p className="text-[11px] text-muted">服务总数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-pass">{services.filter((s) => s.status === "在线").length}</p><p className="text-[11px] text-muted">在线</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-cyan-600">{totalTools}</p><p className="text-[11px] text-muted">可用工具</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-warn">{services.filter((s) => s.status === "错误" || s.status === "离线").length}</p><p className="text-[11px] text-muted">异常</p></div>
      </div>

      <div className="flex items-center mb-3 gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索服务名称/地址..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <button onClick={handleBatchTest} disabled={batchTesting} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-50">
          {batchTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />} 批量检测
        </button>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 添加服务</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 text-amber animate-spin" /></div>
      ) : (
      <div className="space-y-3 flex-1 overflow-y-auto">
        {services.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.url.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
          <div className="text-center py-16 text-muted"><Server className="w-8 h-8 mx-auto mb-2 text-muted-light" /><p className="text-sm">暂无MCP服务</p></div>
        ) : services.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.url.toLowerCase().includes(search.toLowerCase())).map((s) => {
          const isExpanded = expandedTools[s.id]
          const isSecurityExpanded = expandedSecurity[s.id]
          const configObj = typeof s.config === "object" ? s.config : null
          const hasSecurity = configObj && (configObj.auth || configObj.token || configObj.apiKey)
          return (
          <div key={s.id} className={`bg-white rounded-2xl border border-border shadow-card p-5 transition-all ${s.status === "离线" || s.status === "错误" ? "opacity-75" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${s.status === "在线" ? "bg-gradient-to-br from-sky-500 to-cyan-600" : s.status === "错误" ? "bg-fail/10" : "bg-cream"}`}>
                  <Server className={`w-5 h-5 ${s.status === "在线" ? "text-white" : s.status === "错误" ? "text-fail" : "text-muted"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{s.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream text-muted">{s.service_type}</span>
                  </div>
                  <p className="text-[11px] text-muted font-mono">{s.url}</p>
                  {s.description && <p className="text-[11px] text-muted mt-0.5">{s.description}</p>}
                  {s.linked_agents?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {s.linked_agents.map((agent: string) => (
                        <span key={agent} className="text-[9px] px-1.5 py-0.5 rounded bg-info/10 text-info font-mono">{agent}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleTestConnection(s)} disabled={testingId === s.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cream text-ink-light hover:bg-border transition-colors disabled:opacity-50">
                  {testingId === s.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />} 检测
                </button>
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="border-t border-border/50 pt-3">
              <button onClick={() => setExpandedTools({ ...expandedTools, [s.id]: !isExpanded })} className="flex items-center gap-1 text-[11px] font-medium text-ink-light hover:text-ink transition-colors mb-2">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Wrench className="w-3.5 h-3.5 text-cyan-600" /> 可用工具 ({s.tools?.length || 0})
              </button>
              {isExpanded && (
                <div className="space-y-1.5 pl-5">
                  {(s.tools || []).map((tool: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded-lg hover:bg-cream/50">
                      <Wrench className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[11px] font-mono font-medium text-ink">{tool.name}</span>
                        <p className="text-[10px] text-muted">{tool.description}</p>
                        <code className="text-[9px] text-muted font-mono bg-cream/50 rounded px-1">{tool.inputSchema}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {hasSecurity && (
              <div className="border-t border-border/50 pt-2.5 mt-1">
                <button onClick={() => setExpandedSecurity({ ...expandedSecurity, [s.id]: !isSecurityExpanded })} className="flex items-center gap-1 text-[11px] font-medium text-ink-light hover:text-ink transition-colors mb-1">
                  {isSecurityExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <Shield className="w-3.5 h-3.5 text-amber" /> 安全配置
                </button>
                {isSecurityExpanded && configObj && (
                  <div className="pl-5 space-y-1">
                    {configObj.auth && <div className="flex items-center gap-1.5 text-[11px] text-muted"><Lock className="w-3 h-3 text-amber" /> Auth: <span className="font-mono">{configObj.auth}</span></div>}
                    {configObj.token && <div className="flex items-center gap-1.5 text-[11px] text-muted"><Key className="w-3 h-3 text-amber" /> Token: <span className="font-mono">••••{configObj.token.slice(-4)}</span></div>}
                    {configObj.apiKey && <div className="flex items-center gap-1.5 text-[11px] text-muted"><Key className="w-3 h-3 text-amber" /> API Key: <span className="font-mono">••••{configObj.apiKey.slice(-4)}</span></div>}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted border-t border-border/50 pt-3 mt-2">
              <div className="flex items-center gap-1.5">
                {statusIcon(s.status)}
                <span className={s.status === "在线" ? "text-pass" : s.status === "错误" ? "text-fail" : ""}>{s.status}</span>
              </div>
              {s.last_check_at && <span>上次检测: {new Date(s.last_check_at).toLocaleString("zh-CN")}</span>}
            </div>
          </div>
        )})}
      </div>
      )}

      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下MCP服务？" itemName={deleteTarget?.name || ""} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[580px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{dialogMode === "create" ? "添加MCP服务" : "编辑MCP服务"}</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">服务名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：Playwright Server" />{formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}</div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">类型</label>
                  <select value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">
                    {["工具", "存储", "代理", "其他"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">服务地址 *</label><input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink font-mono focus:border-amber outline-none ${formErrors.url ? "border-fail" : "border-border"}`} placeholder="http://localhost:3000" />{formErrors.url && <p className="text-[11px] text-fail mt-1">{formErrors.url}</p>}<p className="text-[10px] text-muted mt-0.5">支持 http://、https://、ws://、mcp:// 协议</p></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">描述</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="服务描述" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">配置 (JSON)</label><textarea value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} rows={4} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink font-mono focus:border-amber outline-none resize-none ${formErrors.config ? "border-fail" : "border-border"}`} placeholder='{"timeout": 30000, "headers": {"Authorization": "Bearer xxx"}}' />{formErrors.config && <p className="text-[11px] text-fail mt-1">{formErrors.config}</p>}</div>
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
