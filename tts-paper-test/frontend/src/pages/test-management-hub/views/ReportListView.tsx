/**
 * ReportListView — 报告卡片墙视图
 *
 * 展示测试报告卡片墙，按类型分组，
 * 快速查看报告状态和生成时间。
 */
import { useState, useEffect, useCallback } from "react"
import { BarChart3, FileText, Download, ArrowRight, Eye, Clock, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lifecycleApi } from "@/lib/api"

interface Report {
  id: number
  name: string
  report_type?: string
  status: string
  description?: string
  created_at?: string
  generated_at?: string
  [key: string]: any
}

const TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  coverage: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  execution: { icon: BarChart3, color: "text-pass", bg: "bg-emerald-50" },
  quality: { icon: BarChart3, color: "text-amber", bg: "bg-amber-50" },
  defect: { icon: AlertCircle, color: "text-fail", bg: "bg-red-50" },
}

const STATUS_BADGE: Record<string, { color: string; bg: string; label: string }> = {
  draft: { color: "text-gray-500", bg: "bg-gray-100", label: "草稿" },
  generating: { color: "text-blue-600", bg: "bg-blue-100", label: "生成中" },
  completed: { color: "text-pass", bg: "bg-emerald-100", label: "完成" },
  failed: { color: "text-fail", bg: "bg-red-100", label: "失败" },
}

interface Props {
  onBack: () => void
}

export default function ReportListView({ onBack }: Props) {
  const [items, setItems] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await lifecycleApi.listReports()
      const list = res?.data?.items || res?.data || res?.items || []
      setItems(list)
    } catch (e) {
      console.warn("获取报告列表失败", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const getTypeCfg = (type?: string) => {
    const t = (type || "").toLowerCase()
    return TYPE_CONFIG[t] || { icon: FileText, color: "text-ink-light", bg: "bg-cream" }
  }

  const getStatusBadge = (status?: string) => {
    const s = (status || "draft").toLowerCase()
    const cfg = STATUS_BADGE[s] || STATUS_BADGE.draft
    return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
  }

  // 按类型分组
  const grouped = items.reduce((acc, r) => {
    const type = r.report_type || "other"
    if (!acc[type]) acc[type] = []
    acc[type].push(r)
    return acc
  }, {} as Record<string, Report[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-light">加载报告数据...</p>
        </div>
      </div>
    )
  }

  const completed = items.filter((r) => r.status?.toLowerCase() === "completed").length

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all">
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </button>
          <h2 className="text-lg font-semibold text-ink">测试报告</h2>
          <span className="text-xs text-ink-light bg-cream px-2 py-1 rounded-md">{items.length} 份</span>
        </div>
      </div>

      {/* 概览 */}
      <div className="flex items-center gap-4 mb-4 text-xs text-ink-light bg-white rounded-2xl border border-border shadow-card px-5 py-3">
        <span className="font-medium text-ink">概览</span>
        <span>共 {items.length} 份</span>
        <span className="text-pass">{completed} 已完成</span>
        <span className="text-ink-light">{items.length - completed} 待完成</span>
      </div>

      {/* 报告卡片墙 */}
      {Object.entries(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col items-center justify-center py-20">
          <BarChart3 className="w-12 h-12 text-ink-light opacity-30 mb-3" />
          <p className="text-sm font-medium text-ink">暂无测试报告</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((report) => {
            const tc = getTypeCfg(report.report_type)
            const Icon = tc.icon
            return (
              <div key={report.id} className="bg-white rounded-2xl border border-border shadow-card p-4 hover:shadow-md hover:border-amber/30 transition-all group">
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl ${tc.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${tc.color}`} />
                  </div>
                  {getStatusBadge(report.status)}
                </div>
                <h4 className="text-sm font-semibold text-ink mt-2 line-clamp-1">{report.name}</h4>
                {report.description && <p className="text-xs text-ink-light mt-1 line-clamp-2">{report.description}</p>}
                <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-border/40 text-[10px] text-ink-light">
                  <span>{report.report_type || "通用报告"}</span>
                  {report.generated_at && (
                    <span>{new Date(report.generated_at).toLocaleDateString("zh-CN")}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
