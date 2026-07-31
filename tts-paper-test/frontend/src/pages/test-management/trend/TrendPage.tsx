/**
 * 缺陷趋势分析页面
 */
import { useState, useEffect, useCallback, useMemo } from "react"
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react"
import { lifecycleApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"

interface TrendData {
  week: string
  new: number
  fixed: number
  remaining: number
}

interface Statistics {
  total_new: number
  total_fixed: number
  total_remaining: number
  fix_rate: string
}

const MOCK_TREND_DATA: TrendData[] = [
  { week: "W1", new: 12, fixed: 8, remaining: 4 },
  { week: "W2", new: 15, fixed: 10, remaining: 9 },
  { week: "W3", new: 8, fixed: 14, remaining: 3 },
  { week: "W4", new: 20, fixed: 12, remaining: 11 },
  { week: "W5", new: 10, fixed: 18, remaining: 3 },
  { week: "W6", new: 6, fixed: 9, remaining: 0 },
  { week: "W7", new: 18, fixed: 7, remaining: 11 },
  { week: "W8", new: 14, fixed: 16, remaining: 9 },
]

const STAT_CARDS = [
  { label: "新增缺陷", key: "total_new" as const, fallback: 42, trend: "+12%", icon: TrendingUp, color: "bg-fail/10 text-fail", trendUp: true },
  { label: "已修复", key: "total_fixed" as const, fallback: 35, trend: "+18%", icon: TrendingUp, color: "bg-pass/10 text-pass", trendUp: true },
  { label: "剩余缺陷", key: "total_remaining" as const, fallback: 7, trend: "-15%", icon: TrendingDown, color: "bg-amber/10 text-amber", trendUp: false },
  { label: "修复率", key: "fix_rate" as const, fallback: "83.3%", trend: "+5%", icon: BarChart3, color: "bg-info/10 text-info", trendUp: true },
]

const SEVERITY_DISTRIBUTION = [
  { label: "致命", value: 3, color: "bg-fail", total: 42 },
  { label: "严重", value: 8, color: "bg-fail/80", total: 42 },
  { label: "一般", value: 22, color: "bg-amber", total: 42 },
  { label: "轻微", value: 9, color: "bg-cream", total: 42 },
]

const KEY_METRICS = [
  { label: "平均修复时间", value: "2.4天", desc: "从创建到修复的平均时长" },
  { label: "修复率", value: "83.3%", desc: "已修复 / 总缺陷" },
  { label: "遗留率", value: "16.7%", desc: "未修复 / 总缺陷" },
  { label: "重开率", value: "4.8%", desc: "已关闭后重开的比例" },
  { label: "AI自动修复率", value: "35.2%", desc: "AI建议被采纳的比例" },
]

export default function TrendPage() {
  const toast = useToast()
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await lifecycleApi.getDefectStatistics()
      setStatistics(res?.data?.data || res?.data || null)
    } catch {
      toast?.error?.("加载统计数据失败")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const maxVal = useMemo(
    () => Math.max(...MOCK_TREND_DATA.flatMap(d => [d.new, d.fixed, d.remaining])),
    []
  )

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-ink">缺陷趋势分析</h2>
        <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">缺陷趋势和统计分析</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 text-center text-muted">加载中...</div>
      ) : (
        <>
          {/* 趋势统计卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {STAT_CARDS.map(item => {
              const Icon = item.icon
              const value = statistics ? (statistics[item.key] ?? item.fallback) : item.fallback
              return (
                <div key={item.label} className="bg-white rounded-2xl border border-border p-4 shadow-card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted">{item.label}</p>
                      <p className="text-xl font-bold text-ink">{value}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${item.trendUp ? "text-pass" : "text-fail"}`}>
                    {item.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{item.trend} 较上周</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 趋势图表 */}
          <div className="bg-white rounded-2xl border border-border shadow-card p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink">近8周缺陷趋势</h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-fail" />新增</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pass" />修复</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber" />剩余</span>
              </div>
            </div>
            <div className="h-64 flex items-end gap-2">
              {MOCK_TREND_DATA.map(d => (
                <div key={d.week} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-0.5 h-48">
                    <div className="w-3 bg-fail/80 rounded-t" style={{ height: `${(d.new / maxVal) * 100}%` }} title={`新增: ${d.new}`} />
                    <div className="w-3 bg-pass/80 rounded-t" style={{ height: `${(d.fixed / maxVal) * 100}%` }} title={`修复: ${d.fixed}`} />
                    <div className="w-3 bg-amber/80 rounded-t" style={{ height: `${(d.remaining / maxVal) * 100}%` }} title={`剩余: ${d.remaining}`} />
                  </div>
                  <span className="text-xs text-muted">{d.week}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 严重度分布 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-border shadow-card p-4">
              <h3 className="text-sm font-semibold text-ink mb-4">严重度分布</h3>
              <div className="space-y-3">
                {SEVERITY_DISTRIBUTION.map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-ink-light">{item.label}</span>
                      <span className="text-muted">{item.value} ({((item.value / item.total) * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-cream rounded-full overflow-hidden">
                      <div className={`h-full ${item.color}`} style={{ width: `${(item.value / item.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-card p-4">
              <h3 className="text-sm font-semibold text-ink mb-4">关键指标</h3>
              <div className="space-y-3">
                {KEY_METRICS.map(item => (
                  <div key={item.label} className="flex items-center justify-between p-2 rounded-lg hover:bg-cream/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-ink">{item.label}</p>
                      <p className="text-xs text-muted">{item.desc}</p>
                    </div>
                    <span className="text-lg font-bold text-amber">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
