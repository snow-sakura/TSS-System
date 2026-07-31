/**
 * DefectListView — 缺陷卡片列表视图
 *
 * 按严重程度分组的缺陷卡片展示，
 * 快速查看缺陷分布与状态。
 */
import { useState, useEffect, useCallback } from "react"
import { Bug, AlertCircle, AlertTriangle, Info, ArrowRight, Eye, CheckCircle2, XCircle, Clock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lifecycleApi } from "@/lib/api"
import AiAnalysisDialog from "./AiAnalysisDialog"

interface Defect {
  id: number
  title: string
  severity: string
  priority: string
  status: string
  module?: string
  description?: string
  created_at?: string
  [key: string]: any
}

const SEVERITY_ORDER = ["critical", "严重", "major", "重要", "minor", "一般", "trivial", "轻微"]
const SEVERITY_CONFIG: Record<string, { icon: typeof AlertCircle; color: string; bg: string; label: string }> = {
  critical: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "致命" },
  "严重": { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "严重" },
  major: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "重要" },
  "重要": { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "重要" },
  minor: { icon: Info, color: "text-amber", bg: "bg-amber-50", label: "一般" },
  "一般": { icon: Info, color: "text-amber", bg: "bg-amber-50", label: "一般" },
  trivial: { icon: Info, color: "text-blue-500", bg: "bg-blue-50", label: "轻微" },
  "轻微": { icon: Info, color: "text-blue-500", bg: "bg-blue-50", label: "轻微" },
}

const STATUS_BADGE: Record<string, { color: string; bg: string; label: string }> = {
  new: { color: "text-blue-600", bg: "bg-blue-100", label: "新建" },
  open: { color: "text-red-600", bg: "bg-red-100", label: "开启" },
  "进行中": { color: "text-amber", bg: "bg-amber-100", label: "进行中" },
  in_progress: { color: "text-amber", bg: "bg-amber-100", label: "进行中" },
  resolved: { color: "text-emerald-600", bg: "bg-emerald-100", label: "已解决" },
  closed: { color: "text-gray-500", bg: "bg-gray-100", label: "已关闭" },
  reopened: { color: "text-orange-500", bg: "bg-orange-100", label: "重新打开" },
}

interface Props {
  onBack: () => void
}

export default function DefectListView({ onBack }: Props) {
  const [items, setItems] = useState<Defect[]>([])
  const [loading, setLoading] = useState(true)
  const [aiDialog, setAiDialog] = useState<{ defect: Defect } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await lifecycleApi.listDefects()
      const list = res?.data?.items || res?.data || res?.items || []
      setItems(list)
    } catch (e) {
      console.warn("获取缺陷列表失败", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const getSeverityCfg = (sev?: string) => {
    if (!sev) return SEVERITY_CONFIG.minor
    return SEVERITY_CONFIG[sev] || { icon: Info, color: "text-gray-500", bg: "bg-gray-50", label: sev }
  }

  const getStatusBadge = (status?: string) => {
    if (!status) return null
    const s = status.toLowerCase()
    const cfg = STATUS_BADGE[s] || STATUS_BADGE[status] || { color: "text-gray-500", bg: "bg-gray-100", label: status }
    return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
  }

  // 按严重程度分组
  const grouped = SEVERITY_ORDER.reduce((acc, sev) => {
    const found = items.filter((d) => {
      const ds = (d.severity || "").toLowerCase()
      return ds === sev.toLowerCase() || d.severity === sev
    })
    if (found.length) acc[sev] = found
    return acc
  }, {} as Record<string, Defect[]>)

  // 未匹配到分组的
  const others = items.filter((d) => {
    const ds = (d.severity || "").toLowerCase()
    return !SEVERITY_ORDER.some((s) => ds === s.toLowerCase() || d.severity === s)
  })

  const buildAnalysisFetch = useCallback((defect: Defect) => {
    return async () => {
      const token = localStorage.getItem("access_token")
      const prompt = `你是一个缺陷分析专家。请分析以下缺陷信息，提供：
1. 根因分析
2. 影响范围评估
3. 修复建议
4. 预防措施

请用中文回答，使用 Markdown 格式。`

      const content = `缺陷信息：
- 标题: ${defect.title}
- 严重程度: ${defect.severity}
- 优先级: ${defect.priority}
- 状态: ${defect.status}
- 模块: ${defect.module || "未指定"}
- 描述: ${defect.description || "无"}`

      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: prompt },
            { role: "user", content },
          ],
          stream: true,
        }),
      })
      return res
    }
  }, [])

  const totalBySeverity = Object.entries(grouped).map(([sev, list]) => ({ sev, count: list.length }))
  const resolved = items.filter((d) => ["resolved", "closed"].includes(d.status?.toLowerCase())).length
  const openCount = items.length - resolved

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-light">加载缺陷数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all">
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </button>
          <h2 className="text-lg font-semibold text-ink">缺陷列表</h2>
          <span className="text-xs text-ink-light bg-cream px-2 py-1 rounded-md">{items.length} 条</span>
        </div>
      </div>

      {/* 统计条 */}
      <div className="flex items-center gap-4 mb-4 text-xs text-ink-light bg-white rounded-2xl border border-border shadow-card px-5 py-3">
        <span className="font-medium text-ink">概览</span>
        <span className="text-fail font-semibold">{openCount} 未解决</span>
        <span className="text-pass font-semibold">{resolved} 已解决</span>
        <div className="flex-1" />
        {totalBySeverity.map(({ sev, count }) => {
          const cfg = getSeverityCfg(sev)
          return (
            <span key={sev} className="flex items-center gap-1">
              <cfg.icon className={`w-3 h-3 ${cfg.color}`} />
              <span className={cfg.color}>{count}</span>
            </span>
          )
        })}
      </div>

      {/* 缺陷分组 */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([sev, defects]) => {
          const cfg = getSeverityCfg(sev)
          const Icon = cfg.icon
          return (
            <div key={sev}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{defects.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {defects.map((d) => {
                  const st = getStatusBadge(d.status)
                  return (
                    <div key={d.id} className="bg-white rounded-xl border border-border/80 p-3.5 shadow-sm hover:shadow-md hover:border-amber/30 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-ink leading-snug line-clamp-2 flex-1">{d.title}</h4>
                        {st}
                      </div>
                      {d.module && <p className="text-[10px] text-ink-light mt-1">{d.module}</p>}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                        <span className="text-[10px] text-ink-light">{d.created_at ? new Date(d.created_at).toLocaleDateString("zh-CN") : ""}</span>
                        <button
                          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-amber/10 text-ink-light hover:text-amber text-[10px] font-medium transition-all"
                          onClick={() => setAiDialog({ defect: d })}
                        >
                          <Sparkles className="w-3 h-3" /> AI分析
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {others.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bug className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-500">其他</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{others.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {others.map((d) => (
                <div key={d.id} className="bg-white rounded-xl border border-border/80 p-3.5 shadow-sm">
                  <h4 className="text-sm font-medium text-ink">{d.title}</h4>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {aiDialog && (
        <AiAnalysisDialog
          title={`缺陷分析：${aiDialog.defect.title}`}
          fetchFn={buildAnalysisFetch(aiDialog.defect)}
          onClose={() => setAiDialog(null)}
        />
      )}
    </div>
  )
}
