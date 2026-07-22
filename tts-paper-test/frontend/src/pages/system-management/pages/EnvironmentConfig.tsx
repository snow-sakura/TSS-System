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

// Mock数据 — Web自动化环境
const mockEnvironments = [
  {
    id: "env-1",
    name: "Web自动化测试环境",
    type: "web-automation",
    status: "online",
    url: "https://test-web.tss.local",
    description: "用于AI驱动的Web界面自动化测试，支持Playwright和Selenium",
    browser: { type: "Chrome", version: "125.0.6422.112", headless: true, viewport: "1920x1080", driverPath: "/usr/local/bin/chromedriver" },
    database: { url: "mysql://test-db:3306/tss_test", pool_size: 10, timeout: 5000 },
    redis: { url: "redis://test-redis:6379/0", max_connections: 50, db: 0 },
    services: [
      { name: "MySQL 8.0", status: "online", url: "test-db:3306" },
      { name: "Redis 7.2", status: "online", url: "test-redis:6379" },
      { name: "RabbitMQ 3.12", status: "online", url: "test-mq:5672" },
      { name: "MinIO", status: "offline", url: "test-minio:9000" },
    ],
    health: { last_check: "2025-07-21T10:30:00Z", trend: "stable", uptime: "99.8%", history: [
      { time: "10:30", status: "online", latency: "0.12s" },
      { time: "09:30", status: "online", latency: "0.15s" },
      { time: "08:30", status: "online", latency: "0.11s" },
      { time: "07:30", status: "offline", latency: "timeout" },
      { time: "06:30", status: "online", latency: "0.13s" },
      { time: "05:30", status: "online", latency: "0.14s" },
    ]},
    linked_plans: ["回归测试-第3轮", "冒烟测试", "Web UI自动化巡检"],
    linked_agents: ["Web自动化Agent", "视觉回归Agent"],
    last_check_at: "2025-07-21T10:30:00Z",
  },
  {
    id: "env-2",
    name: "APP自动化测试环境",
    type: "app-automation",
    status: "online",
    url: "http://appium-server:4723",
    description: "Android/iOS移动端自动化测试，基于Appium 2.x",
    devices: [
      { name: "Pixel 7", os: "Android 14", adb: "emulator-5554", status: "idle", screen: "1080x2400" },
      { name: "iPhone 15", os: "iOS 17.5", udid: "A1B2C3D4E5", status: "running", screen: "1179x2556" },
      { name: "Samsung S24", os: "Android 14", adb: "192.168.1.100:5555", status: "idle", screen: "1080x2340" },
    ],
    appium: { version: "2.5.0", port: 4723, timeout: 30000, basePath: "/wd/hub" },
    database: { url: "mysql://test-db:3306/tss_app_test", pool_size: 5, timeout: 5000 },
    services: [
      { name: "Appium Server", status: "online", url: "appium-server:4723" },
      { name: "STF (设备管理)", status: "online", url: "stf-server:7100" },
      { name: "MySQL 8.0", status: "online", url: "test-db:3306" },
    ],
    health: { last_check: "2025-07-21T10:25:00Z", trend: "up", uptime: "98.5%", history: [
      { time: "10:25", status: "online", latency: "0.08s" },
      { time: "09:25", status: "online", latency: "0.10s" },
      { time: "08:25", status: "offline", latency: "timeout" },
      { time: "07:25", status: "online", latency: "0.09s" },
      { time: "06:25", status: "online", latency: "0.11s" },
      { time: "05:25", status: "online", latency: "0.08s" },
    ]},
    linked_plans: ["APP回归测试", "兼容性测试"],
    linked_agents: ["APP自动化Agent", "UI对比Agent"],
    last_check_at: "2025-07-21T10:25:00Z",
  },
  {
    id: "env-3",
    name: "接口自动化测试环境",
    type: "api-automation",
    status: "online",
    url: "https://api-test.tss.local",
    description: "RESTful API接口自动化测试，支持Postman/requests/JMeter",
    api_config: { base_url: "https://api-test.tss.local", auth_type: "Bearer Token", timeout: 10000, retry: 3 },
    database: { url: "mysql://test-db:3306/tss_api_test", pool_size: 20, timeout: 5000 },
    services: [
      { name: "API Gateway", status: "online", url: "api-gw:8080" },
      { name: "MySQL 8.0", status: "online", url: "test-db:3306" },
      { name: "Redis 7.2", status: "online", url: "test-redis:6379" },
      { name: "Mock Server", status: "online", url: "mock-server:3001" },
    ],
    health: { last_check: "2025-07-21T10:28:00Z", trend: "stable", uptime: "99.9%", history: [
      { time: "10:28", status: "online", latency: "0.05s" },
      { time: "09:28", status: "online", latency: "0.06s" },
      { time: "08:28", status: "online", latency: "0.04s" },
      { time: "07:28", status: "online", latency: "0.05s" },
      { time: "06:28", status: "online", latency: "0.07s" },
      { time: "05:28", status: "online", latency: "0.05s" },
    ]},
    linked_plans: ["API接口回归测试", "性能基准测试"],
    linked_agents: ["接口测试Agent", "数据构造Agent"],
    last_check_at: "2025-07-21T10:28:00Z",
  },
  {
    id: "env-4",
    name: "性能测试环境",
    type: "performance",
    status: "online",
    url: "https://perf-test.tss.local",
    description: "压力测试与性能基准测试环境，基于JMeter/k6",
    perf_config: { tool: "k6", max_vusers: 1000, target_rps: 500, duration: "30m", ramp_up: "2m" },
    database: { url: "mysql://perf-db:3306/tss_perf", pool_size: 50, timeout: 10000 },
    services: [
      { name: "k6 Cloud", status: "online", url: "k6-cloud:6565" },
      { name: "Grafana", status: "online", url: "grafana:3000" },
      { name: "InfluxDB", status: "online", url: "influxdb:8086" },
      { name: "MySQL 8.0", status: "online", url: "perf-db:3306" },
    ],
    health: { last_check: "2025-07-21T10:20:00Z", trend: "stable", uptime: "99.5%", history: [
      { time: "10:20", status: "online", latency: "0.20s" },
      { time: "09:20", status: "online", latency: "0.18s" },
      { time: "08:20", status: "online", latency: "0.22s" },
      { time: "07:20", status: "online", latency: "0.19s" },
      { time: "06:20", status: "online", latency: "0.21s" },
      { time: "05:20", status: "online", latency: "0.20s" },
    ]},
    linked_plans: ["性能压测-并发场景", "稳定性测试-24h"],
    linked_agents: ["性能分析Agent", "瓶颈定位Agent"],
    last_check_at: "2025-07-21T10:20:00Z",
  },
  {
    id: "env-5",
    name: "安全测试环境",
    type: "security",
    status: "maintenance",
    url: "https://sec-test.tss.local",
    description: "安全扫描与渗透测试环境，集成OWASP ZAP/Burp Suite",
    sec_config: { scanner: "OWASP ZAP 2.14", scan_scope: "full", compliance: ["OWASP Top 10", "等保2.0"], alert_threshold: "medium" },
    database: { url: "mysql://sec-db:3306/tss_sec", pool_size: 5, timeout: 5000 },
    services: [
      { name: "OWASP ZAP", status: "online", url: "zap-proxy:8080" },
      { name: "Nuclei", status: "online", url: "nuclei:8888" },
      { name: "MySQL 8.0", status: "online", url: "sec-db:3306" },
    ],
    health: { last_check: "2025-07-21T10:15:00Z", trend: "down", uptime: "95.0%", history: [
      { time: "10:15", status: "maintenance", latency: "-" },
      { time: "09:15", status: "online", latency: "0.30s" },
      { time: "08:15", status: "online", latency: "0.28s" },
      { time: "07:15", status: "online", latency: "0.32s" },
      { time: "06:15", status: "online", latency: "0.29s" },
      { time: "05:15", status: "online", latency: "0.31s" },
    ]},
    linked_plans: ["安全扫描-月度", "渗透测试-Q3"],
    linked_agents: ["安全扫描Agent", "漏洞分析Agent"],
    last_check_at: "2025-07-21T10:15:00Z",
  },
]

export default function EnvironmentConfig() {
  const [envs, setEnvs] = useState<any[]>(mockEnvironments)
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingEnv, setEditingEnv] = useState<any>(null)
  const [form, setForm] = useState({ name: "", type: "web-automation", url: "", dbUrl: "", redisUrl: "", description: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [compareEnv, setCompareEnv] = useState<any>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [batchChecking, setBatchChecking] = useState(false)
  const [expandedEnv, setExpandedEnv] = useState<string | null>(null)

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

  const handleSave = () => {
    if (!validate()) return
    if (dialogMode === "create") {
      const newEnv = {
        id: `env-${Date.now()}`,
        name: form.name,
        type: form.type,
        status: "online",
        url: form.url,
        description: form.description,
        database: form.dbUrl ? { url: form.dbUrl, pool_size: 10, timeout: 5000 } : null,
        redis: form.redisUrl ? { url: form.redisUrl, max_connections: 50, db: 0 } : null,
        services: [],
        health: { last_check: "-", trend: "stable", uptime: "-", history: [] },
        linked_plans: [],
        linked_agents: [],
        last_check_at: "-",
      }
      setEnvs([newEnv, ...envs])
      toast.success("环境创建成功")
    } else {
      setEnvs(envs.map((e) => e.id === editingEnv.id ? { ...e, name: form.name, type: form.type, url: form.url, description: form.description } : e))
      toast.success("环境更新成功")
    }
    setShowDialog(false)
  }

  const handleDelete = (env: any) => setDeleteTarget(env)
  const confirmDelete = () => {
    if (!deleteTarget) return
    setEnvs(envs.filter((e) => e.id !== deleteTarget.id))
    toast.success("环境已删除")
    setDeleteTarget(null)
  }

  const handleHealthCheck = async (env: any) => {
    setCheckingId(env.id)
    await new Promise((r) => setTimeout(r, 1500))
    toast.success(`${env.name} 健康检测完成: 在线`)
    setCheckingId(null)
  }

  const handleBatchCheck = async () => {
    setBatchChecking(true)
    await new Promise((r) => setTimeout(r, 2000))
    toast.success(`批量检测完成: ${onlineCount}/${envs.length} 在线`)
    setBatchChecking(false)
  }

  const openCreate = () => {
    setDialogMode("create"); setEditingEnv(null)
    setForm({ name: "", type: "web-automation", url: "", dbUrl: "", redisUrl: "", description: "" })
    setFormErrors({}); setShowDialog(true)
  }
  const openEdit = (env: any) => {
    setDialogMode("edit"); setEditingEnv(env)
    setForm({ name: env.name, type: env.type, url: env.url, dbUrl: env.database?.url || "", redisUrl: env.redis?.url || "", description: env.description || "" })
    setFormErrors({}); setShowDialog(true)
  }

  const getTypeInfo = (typeKey: string) => ENV_TYPES.find((t) => t.key === typeKey) || ENV_TYPES[0]

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
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 新建环境
        </button>
      </div>

      {/* 环境列表 */}
      {loading ? (
        <div className="text-center py-12 text-muted text-sm">加载中...</div>
      ) : (
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

                  {/* 类型特定配置 */}
                  {env.type === "web-automation" && env.browser && (
                    <div className="flex items-center gap-4 text-[11px] text-muted mb-3 px-1">
                      <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {env.browser.type} {env.browser.version}</span>
                      <span>视口: {env.browser.viewport}</span>
                      <span>{env.browser.headless ? "无头模式" : "有头模式"}</span>
                    </div>
                  )}
                  {env.type === "app-automation" && env.devices && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {env.devices.map((d: any, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cream text-[11px] text-ink">
                          <Smartphone className="w-3 h-3 text-muted" />
                          {d.name} ({d.os})
                          <span className={`w-1.5 h-1.5 rounded-full ${d.status === "idle" ? "bg-pass" : "bg-amber animate-pulse"}`} />
                        </span>
                      ))}
                    </div>
                  )}
                  {env.type === "api-automation" && env.api_config && (
                    <div className="flex items-center gap-4 text-[11px] text-muted mb-3 px-1">
                      <span>Base URL: {env.api_config.base_url}</span>
                      <span>认证: {env.api_config.auth_type}</span>
                      <span>超时: {env.api_config.timeout}ms</span>
                    </div>
                  )}
                  {env.type === "performance" && env.perf_config && (
                    <div className="flex items-center gap-4 text-[11px] text-muted mb-3 px-1">
                      <span>工具: {env.perf_config.tool}</span>
                      <span>最大并发: {env.perf_config.max_vusers}</span>
                      <span>目标RPS: {env.perf_config.target_rps}</span>
                      <span>持续: {env.perf_config.duration}</span>
                    </div>
                  )}
                  {env.type === "security" && env.sec_config && (
                    <div className="flex items-center gap-4 text-[11px] text-muted mb-3 px-1">
                      <span>扫描器: {env.sec_config.scanner}</span>
                      <span>范围: {env.sec_config.scan_scope}</span>
                      <span>合规: {env.sec_config.compliance.join(", ")}</span>
                    </div>
                  )}

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
      )}

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
