/**
 * MCP服务配置 — 外部工具协议注册 + 工具发现 + 连通检测 + 安全配置
 */
import { useState } from "react"
import { Plus, Edit, Trash2, X, Webhook, Activity, RefreshCw, Wifi, WifiOff, AlertTriangle, Server, Search, ChevronDown, ChevronRight, Shield, Wrench, Globe, Lock, Key, Zap, Cpu, Database, Code, Bell } from "lucide-react"
import { toast } from "sonner"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

const MOCK_SERVICES = [
  {
    id: 1, name: "Playwright Server", url: "http://localhost:3000", description: "浏览器自动化控制，用于UI测试和截图采集",
    service_type: "工具", status: "在线", last_check_at: "2025-01-15T10:30:00",
    tools: [
      { name: "browser_navigate", description: "导航到指定URL", inputSchema: '{ "url": "string" }' },
      { name: "browser_click", description: "点击页面元素", inputSchema: '{ "selector": "string" }' },
      { name: "browser_snapshot", description: "获取页面快照", inputSchema: '{ "depth": "number" }' },
      { name: "browser_screenshot", description: "截取页面截图", inputSchema: '{ "fullPage": "boolean" }' },
    ],
    config: { auth: "Bearer Token", token: "pk_live_abc123def456", timeout: 30000 },
    linked_agents: ["ui-test-runner", "visual-regression"],
  },
  {
    id: 2, name: "File Operations", url: "mcp://file-server:9000", description: "文件读写操作，支持测试报告生成和日志收集",
    service_type: "存储", status: "在线", last_check_at: "2025-01-15T09:15:00",
    tools: [
      { name: "file_read", description: "读取文件内容", inputSchema: '{ "path": "string" }' },
      { name: "file_write", description: "写入文件", inputSchema: '{ "path": "string", "content": "string" }' },
      { name: "file_list", description: "列出目录内容", inputSchema: '{ "dir": "string", "pattern": "string" }' },
    ],
    config: { apiKey: "fs_key_xyz789", timeout: 10000 },
    linked_agents: ["report-generator", "log-collector"],
  },
  {
    id: 3, name: "Database Proxy", url: "https://db-proxy.tss.local:5433", description: "数据库查询代理，用于测试数据验证和断言",
    service_type: "代理", status: "在线", last_check_at: "2025-01-15T08:45:00",
    tools: [
      { name: "db_query", description: "执行SQL查询", inputSchema: '{ "sql": "string", "params": "array" }' },
      { name: "db_validate", description: "验证数据完整性", inputSchema: '{ "table": "string", "conditions": "object" }' },
    ],
    config: { auth: "mTLS", token: "db_cert_abc", headers: { "X-DB-Cluster": "primary" } },
    linked_agents: ["data-validator", "integration-tester"],
  },
  {
    id: 4, name: "API Gateway", url: "https://api-gw.tss.local/v1", description: "外部API调用网关，支持Mock和真实API切换",
    service_type: "工具", status: "错误", last_check_at: "2025-01-15T07:00:00",
    tools: [
      { name: "api_call", description: "发起API请求", inputSchema: '{ "method": "string", "url": "string", "body": "object" }' },
      { name: "api_mock", description: "Mock API响应", inputSchema: '{ "endpoint": "string", "response": "object" }' },
    ],
    config: { apiKey: "gw_key_123", timeout: 15000 },
    linked_agents: ["api-tester", "contract-tester"],
  },
  {
    id: 5, name: "Code Analyzer", url: "ws://analyzer.tss.local:8080", description: "代码静态分析服务，检测安全漏洞和代码质量问题",
    service_type: "工具", status: "在线", last_check_at: "2025-01-15T10:00:00",
    tools: [
      { name: "code_scan", description: "扫描代码仓库", inputSchema: '{ "repo": "string", "branch": "string" }' },
      { name: "code_review", description: "代码审查", inputSchema: '{ "file": "string", "rules": "array" }' },
      { name: "vuln_check", description: "漏洞检测", inputSchema: '{ "package": "string", "version": "string" }' },
    ],
    config: { auth: "API Key", apiKey: "scan_key_456" },
    linked_agents: ["security-scanner", "quality-checker"],
  },
  {
    id: 6, name: "Notification Service", url: "https://notify.tss.local/webhook", description: "测试结果通知推送，支持多渠道消息分发",
    service_type: "其他", status: "离线", last_check_at: "2025-01-14T22:00:00",
    tools: [
      { name: "notify_send", description: "发送通知消息", inputSchema: '{ "channel": "string", "message": "object" }' },
      { name: "notify_batch", description: "批量发送通知", inputSchema: '{ "recipients": "array", "message": "object" }' },
    ],
    config: { timeout: 5000 },
    linked_agents: ["alert-manager"],
  },
]

export default function MCPConfig() {
  const [services, setServices] = useState<any[]>(MOCK_SERVICES)
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

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "服务名称不能为空"
    if (!form.url.trim()) errors.url = "服务地址不能为空"
    if (form.config.trim()) { try { JSON.parse(form.config) } catch { errors.config = "JSON 格式无效" } }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const newService = {
      id: dialogMode === "create" ? Date.now() : editingService.id,
      name: form.name, url: form.url, description: form.description,
      service_type: form.service_type, status: "在线", last_check_at: new Date().toISOString(),
      tools: [], config: form.config ? JSON.parse(form.config) : {}, linked_agents: [],
    }
    setServices(dialogMode === "create" ? [...services, newService] : services.map((s) => s.id === newService.id ? { ...s, ...newService } : s))
    toast.success(dialogMode === "create" ? "服务创建成功" : "服务更新成功")
    setShowDialog(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setServices(services.filter((s) => s.id !== deleteTarget.id))
    toast.success("服务已删除"); setDeleteTarget(null)
  }

  const handleTestConnection = (s: any) => {
    setTestingId(s.id)
    setTimeout(() => {
      setServices(services.map((sv) => sv.id === s.id ? { ...sv, status: "在线", last_check_at: new Date().toISOString() } : sv))
      toast.success(`「${s.name}」连通测试成功`); setTestingId(null)
    }, 1000)
  }

  const handleBatchTest = () => {
    setBatchTesting(true)
    setTimeout(() => {
      toast.success(`批量测试完成: ${services.filter((s) => s.status === "在线").length}/${services.length} 在线`)
      setBatchTesting(false)
    }, 1500)
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

      <div className="space-y-3 flex-1 overflow-y-auto">
        {services.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.url.toLowerCase().includes(search.toLowerCase())).map((s) => {
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
