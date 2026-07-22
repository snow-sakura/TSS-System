/**
 * Hermes配置 — 多平台消息网关 + 连通检测 + 消息发送测试 + 模板管理
 */
import { useState } from "react"
import { Plus, Edit, Trash2, X, Key, Wifi, WifiOff, Activity, RefreshCw, Search, Send, MessageSquare, Globe, Clock, CheckCircle, XCircle, ChevronDown, ChevronRight, Shield, Bell, FileText, Zap } from "lucide-react"
import { toast } from "sonner"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

const MOCK_CHANNELS = [
  {
    id: 1, name: "测试团队钉钉群", channel_type: "dingtalk", description: "测试团队日常沟通和测试结果通知",
    status: "在线", last_check_at: "2025-01-15T10:30:00",
    config: { webhook_url: "https://oapi.dingtalk.com/robot/send?access_token=abc123", api_token: "ding_token_xyz789" },
    templates: [
      { name: "测试完成通知", content: "【{{project}}】测试完成，通过率: {{pass_rate}}%", trigger: "测试执行完成" },
      { name: "缺陷告警", content: "发现高优先级缺陷: {{title}}，影响模块: {{module}}", trigger: "新增P0/P1缺陷" },
    ],
    trigger_conditions: ["测试执行完成", "新增P0/P1缺陷", "每日报告"],
  },
  {
    id: 2, name: "研发通知企微群", channel_type: "wechat", description: "研发团队缺陷修复通知和版本发布提醒",
    status: "在线", last_check_at: "2025-01-15T09:15:00",
    config: { webhook_url: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=def456", api_token: "wecom_token_abc" },
    templates: [
      { name: "缺陷修复通知", content: "缺陷#{{id}}已修复，请验证: {{title}}", trigger: "缺陷状态变更" },
      { name: "版本发布提醒", content: "版本{{version}}已部署到测试环境，请开始回归测试", trigger: "版本部署" },
    ],
    trigger_conditions: ["缺陷状态变更", "版本部署", "代码合并"],
  },
  {
    id: 3, name: "飞书测试报告", channel_type: "feishu", description: "自动生成的测试报告推送到飞书文档",
    status: "在线", last_check_at: "2025-01-15T08:00:00",
    config: { webhook_url: "https://open.feishu.cn/open-apis/bot/v2/hook/ghi789", api_token: "feishu_token_456" },
    templates: [
      { name: "日报推送", content: "测试日报 - {{date}}\n通过: {{pass}} 失败: {{fail}} 跳过: {{skip}}", trigger: "每日定时" },
    ],
    trigger_conditions: ["每日定时", "测试执行完成"],
  },
  {
    id: 4, name: "Slack CI/CD", channel_type: "slack", description: "CI/CD流水线状态和测试结果推送",
    status: "离线", last_check_at: "2025-01-14T22:00:00",
    config: { webhook_url: "https://hooks.slack.com/services/T00/B00/xxx", api_token: "xoxb-slack-token" },
    templates: [
      { name: "构建状态", content: "Build {{build_id}}: {{status}} ({{duration}})", trigger: "CI构建完成" },
    ],
    trigger_conditions: ["CI构建完成", "测试执行完成"],
  },
  {
    id: 5, name: "邮件通知服务", channel_type: "email", description: "重要测试结果和报告的邮件通知",
    status: "在线", last_check_at: "2025-01-15T10:00:00",
    config: { webhook_url: "smtp://mail.tss.local:587", api_token: "smtp_user_pass" },
    templates: [
      { name: "测试报告邮件", content: "测试报告已生成，请查看附件: {{report_url}}", trigger: "报告生成" },
    ],
    trigger_conditions: ["报告生成", "测试执行失败"],
  },
  {
    id: 6, name: "Webhook总线", channel_type: "webhook", description: "通用Webhook接口，对接第三方系统",
    status: "在线", last_check_at: "2025-01-15T10:30:00",
    config: { webhook_url: "https://api.tss.local/webhook/dispatch", api_token: "wh_key_123" },
    templates: [
      { name: "事件分发", content: '{"event": "{{event}}", "data": {{data}}}', trigger: "任意事件" },
    ],
    trigger_conditions: ["任意事件"],
  },
]

const channelTypeOptions = [
  { value: "dingtalk", label: "钉钉", icon: "🔔" },
  { value: "wechat", label: "企业微信", icon: "💚" },
  { value: "feishu", label: "飞书", icon: "🪶" },
  { value: "slack", label: "Slack", icon: "💼" },
  { value: "email", label: "邮件", icon: "📧" },
  { value: "webhook", label: "Webhook", icon: "🔗" },
]

export default function HermesConfig() {
  const [channels, setChannels] = useState<any[]>(MOCK_CHANNELS)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingChannel, setEditingChannel] = useState<any>(null)
  const [form, setForm] = useState({ name: "", channel_type: "dingtalk", webhook_url: "", api_token: "", description: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [testingId, setTestingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [sendingId, setSendingId] = useState<number | null>(null)
  const [sendMessage, setSendMessage] = useState("")
  const [sendResult, setSendResult] = useState<Record<number, { success: boolean; messageId: string; latency: string } | null>>({})
  const [expandedConfig, setExpandedConfig] = useState<Record<number, boolean>>({})
  const [expandedTemplates, setExpandedTemplates] = useState<Record<number, boolean>>({})
  const [batchTesting, setBatchTesting] = useState(false)

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "渠道名称不能为空"
    if (form.webhook_url.trim()) { try { new URL(form.webhook_url) } catch { errors.webhook_url = "URL 格式无效" } }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const newChannel = {
      id: dialogMode === "create" ? Date.now() : editingChannel.id,
      name: form.name, channel_type: form.channel_type, description: form.description,
      status: "在线", last_check_at: new Date().toISOString(),
      config: { webhook_url: form.webhook_url, api_token: form.api_token },
      templates: [], trigger_conditions: [],
    }
    setChannels(dialogMode === "create" ? [...channels, newChannel] : channels.map((c) => c.id === newChannel.id ? { ...c, ...newChannel } : c))
    toast.success(dialogMode === "create" ? "渠道创建成功" : "渠道更新成功")
    setShowDialog(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setChannels(channels.filter((c) => c.id !== deleteTarget.id))
    toast.success("渠道已删除"); setDeleteTarget(null)
  }

  const handleTest = (c: any) => {
    setTestingId(c.id)
    setTimeout(() => {
      setChannels(channels.map((ch) => ch.id === c.id ? { ...ch, status: "在线", last_check_at: new Date().toISOString() } : ch))
      toast.success(`「${c.name}」连通测试成功`); setTestingId(null)
    }, 1000)
  }

  const handleBatchTest = () => {
    setBatchTesting(true)
    setTimeout(() => {
      toast.success(`批量测试完成: ${channels.filter((c) => c.status === "在线").length}/${channels.length} 在线`)
      setBatchTesting(false)
    }, 1500)
  }

  const handleSendMessage = (c: any) => {
    if (!sendMessage.trim()) { toast.warning("请输入要发送的消息内容"); return }
    setSendingId(c.id)
    setTimeout(() => {
      const result = { success: true, messageId: `msg_${Date.now()}`, latency: `${(Math.random() * 200 + 50).toFixed(0)}ms` }
      setSendResult((prev) => ({ ...prev, [c.id]: result }))
      toast.success(`消息已发送到「${c.name}」(${result.latency})`); setSendingId(null)
    }, 800)
  }

  const openCreate = () => { setDialogMode("create"); setEditingChannel(null); setForm({ name: "", channel_type: "dingtalk", webhook_url: "", api_token: "", description: "" }); setFormErrors({}); setShowDialog(true) }
  const openEdit = (c: any) => { setDialogMode("edit"); setEditingChannel(c); setForm({ name: c.name, channel_type: c.channel_type || "dingtalk", webhook_url: c.config?.webhook_url || "", api_token: c.config?.api_token || "", description: c.description || "" }); setFormErrors({}); setShowDialog(true) }

  const maskToken = (token: string) => { if (!token) return ""; if (token.length <= 8) return "••••••••"; return token.slice(0, 4) + "••••" + token.slice(-4) }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink">Hermes配置</h2><p className="text-xs text-muted mt-0.5">多平台消息网关 · 消息模板 · 触发条件 · 连通检测</p></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-ink">{channels.length}</p><p className="text-[11px] text-muted">渠道总数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-pass">{channels.filter((c) => c.status === "在线").length}</p><p className="text-[11px] text-muted">在线</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-info">{new Set(channels.map((c) => c.channel_type)).size}</p><p className="text-[11px] text-muted">平台数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-amber">{channels.reduce((a, c) => a + (c.templates?.length || 0), 0)}</p><p className="text-[11px] text-muted">消息模板</p></div>
      </div>

      <div className="flex items-center mb-3 gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索渠道名称/类型..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <button onClick={handleBatchTest} disabled={batchTesting} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-50">
          {batchTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />} 批量检测
        </button>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 添加渠道</button>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {channels.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.channel_type?.toLowerCase().includes(search.toLowerCase())).map((c) => {
          const isConfigExpanded = expandedConfig[c.id]
          const isTemplatesExpanded = expandedTemplates[c.id]
          return (
          <div key={c.id} className={`bg-white rounded-2xl border border-border shadow-card p-5 transition-all ${c.status === "离线" ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm text-xl ${c.status === "在线" ? "bg-gradient-to-br from-emerald-500 to-green-600" : "bg-cream"}`}>
                  <span>{channelTypeOptions.find((o) => o.value === c.channel_type)?.icon || "📡"}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{c.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream text-muted">{channelTypeOptions.find((o) => o.value === c.channel_type)?.label || c.channel_type}</span>
                  </div>
                  {c.description && <p className="text-[11px] text-muted mt-0.5">{c.description}</p>}
                  {c.trigger_conditions?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {c.trigger_conditions.map((t: string) => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-light text-amber-hover">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleTest(c)} disabled={testingId === c.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cream text-ink-light hover:bg-border transition-colors disabled:opacity-50">
                  {testingId === c.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />} 检测
                </button>
                <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="border-t border-border/50 pt-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                  <input value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} placeholder="输入测试消息内容，点击发送..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" />
                </div>
                <button onClick={() => handleSendMessage(c)} disabled={sendingId === c.id} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-1.5 shrink-0">
                  {sendingId === c.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} 发送
                </button>
              </div>
              {sendResult[c.id] && (
                <div className={`mt-2 flex items-center gap-2 text-[11px] ${sendResult[c.id]?.success ? "text-pass" : "text-fail"}`}>
                  {sendResult[c.id]?.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>{sendResult[c.id]?.success ? "发送成功" : "发送失败"}</span>
                  {sendResult[c.id]?.messageId && <span className="text-muted font-mono">ID: {sendResult[c.id]?.messageId}</span>}
                  {sendResult[c.id]?.latency && <span className="text-muted">延迟: {sendResult[c.id]?.latency}</span>}
                </div>
              )}
            </div>

            {c.templates?.length > 0 && (
              <div className="border-t border-border/50 pt-2.5 mt-2">
                <button onClick={() => setExpandedTemplates({ ...expandedTemplates, [c.id]: !isTemplatesExpanded })} className="flex items-center gap-1 text-[11px] font-medium text-ink-light hover:text-ink transition-colors">
                  {isTemplatesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <FileText className="w-3.5 h-3.5 text-amber" /> 消息模板 ({c.templates.length})
                </button>
                {isTemplatesExpanded && (
                  <div className="pl-5 mt-2 space-y-2">
                    {c.templates.map((tpl: any, idx: number) => (
                      <div key={idx} className="bg-cream/30 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-ink">{tpl.name}</span>
                          <span className="text-[9px] text-muted bg-cream rounded px-1.5 py-0.5">{tpl.trigger}</span>
                        </div>
                        <p className="text-[10px] text-muted font-mono">{tpl.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-border/50 pt-2.5 mt-2">
              <button onClick={() => setExpandedConfig({ ...expandedConfig, [c.id]: !isConfigExpanded })} className="flex items-center gap-1 text-[11px] font-medium text-ink-light hover:text-ink transition-colors">
                {isConfigExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Shield className="w-3.5 h-3.5 text-amber" /> 配置详情
              </button>
              {isConfigExpanded && (
                <div className="pl-5 mt-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-muted"><Globe className="w-3 h-3 text-info" /> Webhook: <span className="font-mono text-ink">{c.config?.webhook_url || "—"}</span></div>
                  <div className="flex items-center gap-2 text-[11px] text-muted"><Key className="w-3 h-3 text-amber" /> Token: <span className="font-mono text-ink">{c.config?.api_token ? maskToken(c.config.api_token) : "—"}</span></div>
                  {c.last_check_at && <div className="flex items-center gap-2 text-[11px] text-muted"><Clock className="w-3 h-3 text-muted" /> 上次检测: {new Date(c.last_check_at).toLocaleString("zh-CN")}</div>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted border-t border-border/50 pt-3 mt-2">
              <div className="flex items-center gap-1.5">
                {c.status === "在线" ? <Wifi className="w-3.5 h-3.5 text-pass" /> : <WifiOff className="w-3.5 h-3.5 text-muted" />}
                <span className={c.status === "在线" ? "text-pass" : ""}>{c.status}</span>
              </div>
            </div>
          </div>
        )})}
      </div>

      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下消息渠道？" itemName={deleteTarget?.name || ""} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{dialogMode === "create" ? "添加消息渠道" : "编辑消息渠道"}</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">渠道名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：测试通知群" />{formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}</div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">渠道类型</label>
                  <select value={form.channel_type} onChange={(e) => setForm({ ...form, channel_type: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">
                    {channelTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">Webhook URL</label><input value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink font-mono focus:border-amber outline-none ${formErrors.webhook_url ? "border-fail" : "border-border"}`} placeholder="https://hooks.example.com/..." />{formErrors.webhook_url && <p className="text-[11px] text-fail mt-1">{formErrors.webhook_url}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">API Token</label><input type="password" value={form.api_token} onChange={(e) => setForm({ ...form, api_token: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink font-mono focus:border-amber outline-none" placeholder="..." /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">描述</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="渠道用途描述" /></div>
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
