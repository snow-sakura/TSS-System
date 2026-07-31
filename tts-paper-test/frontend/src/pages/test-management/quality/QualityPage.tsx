/**
 * 质量概览页面
 */
import { useState, useEffect, useCallback, useMemo } from "react"
import { Shield, TrendingUp, Target, Activity, CheckCircle } from "lucide-react"
import { lifecycleApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"

interface QualityMetrics {
  testCoverage: number
  passRate: number
  fixRate: number
  automationRate: number
  securityScore: number
  performanceScore: number
}

const DEFAULT_METRICS: QualityMetrics = {
  testCoverage: 78.5,
  passRate: 84.6,
  fixRate: 92.3,
  automationRate: 65.2,
  securityScore: 95.2,
  performanceScore: 88.3,
}

const METRIC_CARDS = [
  { label: "测试覆盖率", key: "testCoverage" as const, target: 80, icon: Target, color: "bg-info/10 text-info" },
  { label: "用例通过率", key: "passRate" as const, target: 90, icon: CheckCircle, color: "bg-pass/10 text-pass" },
  { label: "缺陷修复率", key: "fixRate" as const, target: 95, icon: Shield, color: "bg-amber/10 text-amber" },
  { label: "自动化率", key: "automationRate" as const, target: 70, icon: Activity, color: "bg-fail/10 text-fail" },
  { label: "安全评分", key: "securityScore" as const, target: 95, icon: Shield, color: "bg-pass/10 text-pass" },
  { label: "性能评分", key: "performanceScore" as const, target: 90, icon: TrendingUp, color: "bg-info/10 text-info" },
]

const QUALITY_TREND = [
  { month: "6月", score: 78 },
  { month: "7月", score: 82 },
  { month: "8月", score: 85 },
  { month: "9月", score: 83 },
  { month: "10月", score: 88 },
  { month: "11月", score: 91 },
  { month: "12月", score: 89 },
]

const IMPROVEMENT_ITEMS = [
  { label: "自动化测试覆盖率", current: 65.2, target: 70, desc: "建议增加UI自动化测试", isRate: true },
  { label: "接口安全扫描通过率", current: 92.1, target: 98, desc: "需要修复3个中危漏洞", isRate: true },
  { label: "性能达标率", current: 88.3, target: 95, desc: "部分接口响应超时", isRate: true },
  { label: "需求变更响应时间", current: 2.5, target: 1, desc: "流程需优化", isRate: false },
]

export default function QualityPage() {
  const toast = useToast()
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const metricsRes: any = await lifecycleApi.getQualityMetrics()
      setMetrics(metricsRes?.data?.data || metricsRes?.data || null)
    } catch {
      toast?.error?.("加载质量数据失败")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const displayMetrics = useMemo(() => metrics ?? DEFAULT_METRICS, [metrics])

  const metricCardsData = useMemo(() => METRIC_CARDS.map(card => ({
    ...card,
    value: displayMetrics[card.key]
  })), [displayMetrics])

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-ink">质量概览</h2>
        <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">
          综合质量仪表盘
        </span>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 text-center text-muted">加载中...</div>
      ) : (
        <>
          {/* 综合评分 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-1 bg-gradient-to-br from-amber to-orange-500 rounded-2xl p-6 text-white shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium opacity-90">综合质量评分</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold">87.5</span>
                <span className="text-sm opacity-80 mb-2">/ 100</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm opacity-90">
                <TrendingUp className="w-4 h-4" />
                <span>较上月提升 3.2 分</span>
              </div>
              <div className="mt-4 p-3 bg-white/20 rounded-xl">
                <p className="text-xs opacity-80 mb-1">等级评价</p>
                <p className="text-lg font-semibold">良好，有改进空间</p>
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {metricCardsData.map(card => {
                const Icon = card.icon
                const progressColor = card.value >= card.target
                  ? "bg-pass"
                  : card.value >= card.target * 0.9
                    ? "bg-amber"
                    : "bg-fail"
                return (
                  <div key={card.label} className="bg-white rounded-2xl border border-border p-4 shadow-card">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-muted">{card.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-bold text-ink">{card.value}</span>
                      <span className="text-xs text-muted">%</span>
                    </div>
                    <div className="h-1.5 bg-cream rounded-full overflow-hidden">
                      <div className={`h-full ${progressColor}`} style={{ width: `${card.value}%` }} />
                    </div>
                    <p className="text-[10px] text-muted mt-1">
                      目标 {card.target}%
                      {card.value >= card.target ? (
                        <span className="text-pass ml-1">✓</span>
                      ) : (
                        <span className="text-amber ml-1">待提升</span>
                      )}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 质量趋势图 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-border shadow-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-ink">质量评分趋势</h3>
                <span className="text-xs text-muted">近7个月</span>
              </div>
              <div className="h-48 flex items-end gap-2">
                {QUALITY_TREND.map(item => (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-ink mb-1">{item.score}</span>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-amber to-amber/60"
                      style={{ height: `${item.score}%` }}
                    />
                    <span className="text-xs text-muted">{item.month}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-ink">待改进项</h3>
                <span className="text-xs text-muted">需要关注的指标</span>
              </div>
              <div className="space-y-3">
                {IMPROVEMENT_ITEMS.map(item => {
                  const progressColor = item.current >= item.target ? "bg-pass" : "bg-amber"
                  return (
                    <div key={item.label} className="p-3 rounded-xl hover:bg-cream/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className="text-sm font-medium text-ink">{item.label}</p>
                          <p className="text-xs text-muted">{item.desc}</p>
                        </div>
                        <span className="text-sm font-bold text-ink">
                          {item.current}{item.isRate ? "%" : "天"}
                        </span>
                      </div>
                      <div className="h-1.5 bg-cream rounded-full overflow-hidden mt-2">
                        <div className={`h-full ${progressColor}`} style={{ width: `${item.isRate ? item.current : (100 - item.current * 10)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
