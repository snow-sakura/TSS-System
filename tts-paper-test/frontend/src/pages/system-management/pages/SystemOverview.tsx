/**
 * 系统概览 - 全局系统状态仪表盘
 * 展示服务状态 + 配置模块统计 + 系统指标 + 最近日志
 */
import { useState, useEffect } from "react"
import {
  Server, Database, Brain, Activity, Clock, Zap,
  CheckCircle, Wifi,
  Globe, MessageSquare, Wand2, Webhook, Puzzle, Key,
  TrendingUp, DollarSign, Gauge,
} from "lucide-react"
import { configApi } from "@/lib/api"

// 配置模块统计卡片定义
const CONFIG_CARDS = [
  { label: "环境配置", key: "environments", icon: Globe, color: "text-cyan-600", bgColor: "bg-cyan-50" },
  { label: "大模型配置", key: "llm-providers", icon: Brain, color: "text-violet-600", bgColor: "bg-violet-50" },
  { label: "提示词模板", key: "prompts", icon: MessageSquare, color: "text-blue-600", bgColor: "bg-blue-50" },
  { label: "去AI味策略", key: "deai-styles", icon: Wand2, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  { label: "MCP服务", key: "mcp-services", icon: Webhook, color: "text-orange-600", bgColor: "bg-orange-50" },
  { label: "Skills技能", key: "skills", icon: Puzzle, color: "text-rose-600", bgColor: "bg-rose-50" },
  { label: "消息渠道", key: "hermes-channels", icon: Key, color: "text-indigo-600", bgColor: "bg-indigo-50" },
]

const STATIC_SERVICES = [
  { name: "Web服务", icon: Server, color: "text-pass", bgColor: "bg-pass/10", key: "web" },
  { name: "数据库", icon: Database, color: "text-pass", bgColor: "bg-pass/10", key: "db" },
  { name: "AI模型路由", icon: Brain, color: "text-info", bgColor: "bg-info/10", key: "ai" },
  { name: "MCP协议网关", icon: Webhook, color: "text-orange-600", bgColor: "bg-orange-50", key: "mcp" },
  { name: "消息队列", icon: Activity, color: "text-pass", bgColor: "bg-pass/10", key: "queue" },
  { name: "Hermes渠道", icon: Key, color: "text-indigo-600", bgColor: "bg-indigo-50", key: "hermes" },
]

const levelColor = (l: string) => {
  if (l === "ERROR") return "bg-fail/10 text-fail"
  if (l === "WARN" || l === "WARNING") return "bg-amber-light text-warn"
  return "bg-pass/10 text-pass"
}

export default function SystemOverview() {
  const [configCounts, setConfigCounts] = useState<Record<string, number>>({})
  const [healthStats, setHealthStats] = useState<any>(null)
  const [usageStats, setUsageStats] = useState<any>(null)
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfigStats(); loadHealthStats(); loadUsageStats(); loadRecentLogs()
  }, [])

  const loadConfigStats = async () => {
    setLoading(true)
    const counts: Record<string, number> = {}
    for (const card of CONFIG_CARDS) {
      try {
        let res: any
        switch (card.key) {
          case "environments": res = await configApi.listEnvironments(1, 1); break
          case "llm-providers": res = await configApi.listLLMProviders(1, 1); break
          case "prompts": res = await configApi.listPrompts(1, 1); break
          case "deai-styles": res = await configApi.listDeAIStyles(1, 1); break
          case "mcp-services": res = await configApi.listMCPServices(1, 1); break
          case "skills": res = await configApi.listSkills(1, 1); break
          case "hermes-channels": res = await configApi.listHermesChannels(1, 1); break
        }
        counts[card.key] = res?.data?.total ?? 0
      } catch {
        counts[card.key] = 0
      }
    }
    setConfigCounts(counts)
    setLoading(false)
  }

  const loadHealthStats = async () => {
    try {
      const res: any = await configApi.getSystemHealthStats()
      setHealthStats(res.data)
    } catch { /* unavailable */ }
  }

  const loadUsageStats = async () => {
    try {
      const res: any = await configApi.getLLMUsageStats()
      setUsageStats(res.data)
    } catch { /* unavailable */ }
  }

  const loadRecentLogs = async () => {
    try {
      const res: any = await configApi.listOperationLogs({ page: 1, page_size: 8 })
      setRecentLogs(res.data?.items || [])
    } catch { /* unavailable */ }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink">系统概览</h2>
        <p className="text-xs text-muted mt-0.5">系统运行状态、配置概览、资源使用与日志监控</p>
      </div>

      {/* 配置概览 - 7个配置模块实时统计 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink">配置概览</h3>
          {loading && <span className="text-[11px] text-muted animate-pulse">加载中...</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {CONFIG_CARDS.map((card) => {
            const Icon = card.icon
            const count = configCounts[card.key] ?? 0
            return (
              <div key={card.key} className="text-center p-3 rounded-xl border border-border/50 hover:shadow-card transition-all">
                <div className={`w-10 h-10 rounded-xl ${card.bgColor} flex items-center justify-center mx-auto mb-2`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-lg font-bold text-ink">{count}</p>
                <p className="text-[10px] text-muted mt-0.5">{card.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 服务状态 + 模块健康 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-5 mb-4">
        <h3 className="text-sm font-semibold text-ink mb-4">服务状态</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {STATIC_SERVICES.map((s) => {
            const Icon = s.icon
            let online: boolean | null = null
            if (healthStats) {
              if (s.key === "mcp") online = healthStats.mcp_services.online > 0
              else if (s.key === "hermes") online = healthStats.hermes_channels.online > 0
              else if (s.key === "ai") online = healthStats.llm_providers.enabled > 0
              else online = true // web/db/queue — always assumed running
            }
            return (
              <div key={s.name} className="text-center p-3 rounded-xl border border-border/50 hover:shadow-card transition-all">
                <div className={`w-10 h-10 rounded-xl ${s.bgColor} flex items-center justify-center mx-auto mb-2`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <p className="text-xs font-medium text-ink">{s.name}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${online !== false ? "bg-pass animate-pulse" : "bg-fail"}`} />
                  <span className="text-[10px] text-muted">{online !== false ? "运行中" : "异常"}</span>
                </div>
              </div>
            )
          })}
        </div>
        {/* 模块健康状态（按配置模块） */}
        {healthStats && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] font-medium text-ink-light mb-3">模块健康</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-cream/30">
                <Globe className="w-5 h-5 text-cyan-600" />
                <div>
                  <p className="text-xs text-muted">环境配置</p>
                  <p className="text-sm font-bold text-ink">
                    <span className="text-pass">{healthStats.environments.online}</span>
                    <span className="text-muted">/</span>
                    <span className="text-ink">{healthStats.environments.total}</span>
                    <span className="text-xs text-muted ml-1">在线</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-cream/30">
                <Webhook className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-xs text-muted">MCP服务</p>
                  <p className="text-sm font-bold text-ink">
                    <span className="text-pass">{healthStats.mcp_services.online}</span>
                    <span className="text-muted">/</span>
                    <span className="text-ink">{healthStats.mcp_services.total}</span>
                    <span className="text-xs text-muted ml-1">在线</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-cream/30">
                <Key className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="text-xs text-muted">消息渠道</p>
                  <p className="text-sm font-bold text-ink">
                    <span className="text-pass">{healthStats.hermes_channels.online}</span>
                    <span className="text-muted">/</span>
                    <span className="text-ink">{healthStats.hermes_channels.total}</span>
                    <span className="text-xs text-muted ml-1">在线</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-cream/30">
                <Brain className="w-5 h-5 text-violet-600" />
                <div>
                  <p className="text-xs text-muted">大模型</p>
                  <p className="text-sm font-bold text-ink">
                    <span className="text-pass">{healthStats.llm_providers.enabled}</span>
                    <span className="text-muted">/</span>
                    <span className="text-ink">{healthStats.llm_providers.total}</span>
                    <span className="text-xs text-muted ml-1">已启用</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LLM 今日用量 */}
      {usageStats && (
        <div className="bg-white rounded-2xl border border-border shadow-card p-5 mb-4">
          <h3 className="text-sm font-semibold text-ink mb-4">LLM 今日用量</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-cream/30 text-center">
              <TrendingUp className="w-5 h-5 text-info mx-auto mb-1.5" />
              <p className="text-lg font-bold text-ink">{usageStats.today_calls?.toLocaleString() || 0}</p>
              <p className="text-[11px] text-muted">总调用</p>
            </div>
            <div className="p-3 rounded-xl bg-cream/30 text-center">
              <CheckCircle className="w-5 h-5 text-pass mx-auto mb-1.5" />
              <p className="text-lg font-bold text-pass">{usageStats.today_success?.toLocaleString() || 0}</p>
              <p className="text-[11px] text-muted">成功</p>
            </div>
            <div className="p-3 rounded-xl bg-cream/30 text-center">
              <Activity className="w-5 h-5 text-violet-600 mx-auto mb-1.5" />
              <p className="text-lg font-bold text-ink">{usageStats.today_tokens?.toLocaleString() || 0}</p>
              <p className="text-[11px] text-muted">Tokens</p>
            </div>
            <div className="p-3 rounded-xl bg-cream/30 text-center">
              <DollarSign className="w-5 h-5 text-warn mx-auto mb-1.5" />
              <p className="text-lg font-bold text-warn">{usageStats.today_cost || "¥0"}</p>
              <p className="text-[11px] text-muted">费用</p>
            </div>
            <div className="p-3 rounded-xl bg-cream/30 text-center">
              <Gauge className="w-5 h-5 text-muted mx-auto mb-1.5" />
              <p className="text-lg font-bold text-ink">{usageStats.avg_latency || "-"}</p>
              <p className="text-[11px] text-muted">平均延迟</p>
            </div>
          </div>
          {/* 各模型调用分布 */}
          {usageStats.per_provider && usageStats.per_provider.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[11px] font-medium text-ink-light mb-2">各模型调用分布</p>
              <div className="space-y-1.5">
                {usageStats.per_provider.map((p: any, i: number) => {
                  const pct = usageStats.today_calls > 0 ? (p.calls / usageStats.today_calls) * 100 : 0
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[11px] text-ink w-24 truncate">{p.name}</span>
                      <div className="flex-1 h-3 bg-cream rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-info to-blue-400" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <span className="text-[11px] text-muted w-16 text-right">{p.calls}次</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 最近操作日志 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink">最近操作日志</h3>
          <span className="text-[11px] text-muted">最近 {recentLogs.length} 条</span>
        </div>
        <div className="space-y-2">
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">暂无日志</p>
          ) : recentLogs.map((log, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-cream/50 transition-colors">
              <span className="text-[11px] text-muted font-mono w-16 flex-shrink-0">{log.created_at ? new Date(log.created_at).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${levelColor(log.action)}`}>{log.action}</span>
              <span className="text-[11px] text-ink bg-cream px-1.5 py-0.5 rounded flex-shrink-0">{log.module || log.target_type}</span>
              <span className="text-xs text-muted truncate flex-1">{log.detail || log.username || "-"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
