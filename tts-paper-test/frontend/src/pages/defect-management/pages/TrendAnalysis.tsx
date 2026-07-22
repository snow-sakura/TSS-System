/**
 * 趋势分析 - 缺陷趋势图表
 * 已对接 lifecycleApi 真实数据
 */
import { useState, useEffect, useCallback } from "react"
import { TrendingUp, TrendingDown, Minus, Calendar, Bug, CheckCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { lifecycleApi } from "@/lib/api"

export default function TrendAnalysis() {
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [moduleData, setModuleData] = useState<any[]>([])
  const [severityTrend, setSeverityTrend] = useState<any[]>([])
  const [stats, setStats] = useState({ totalCreated: 0, totalResolved: 0, resolveRate: "0%", avgFixDays: "-" })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [metricsRes, trendsRes, defectStatsRes] = await Promise.allSettled([
        lifecycleApi.getQualityMetrics(),
        lifecycleApi.getQualityTrends(),
        lifecycleApi.getDefectStatistics(),
      ])

      // 处理 quality metrics
      if (metricsRes.status === "fulfilled") {
        const m = metricsRes.value?.data || {}
        setStats({
          totalCreated: m.total_defects || m.total || 0,
          totalResolved: m.resolved_defects || m.resolved || 0,
          resolveRate: m.pass_rate ? `${m.pass_rate}%` : `${Math.round(((m.resolved_defects || 0) / Math.max(m.total_defects || 1, 1)) * 100)}%`,
          avgFixDays: m.avg_fix_days ? `${m.avg_fix_days}天` : "-",
        })
        // 严重程度分布
        const severity = [
          { severity: "致命", current: m.critical_defects || 0, previous: (m.critical_defects_prev || 0), change: (m.critical_defects || 0) - (m.critical_defects_prev || 0) },
          { severity: "严重", current: m.major_defects || 0, previous: (m.major_defects_prev || 0), change: (m.major_defects || 0) - (m.major_defects_prev || 0) },
          { severity: "一般", current: m.minor_defects || 0, previous: (m.minor_defects_prev || 0), change: (m.minor_defects || 0) - (m.minor_defects_prev || 0) },
          { severity: "轻微", current: m.trivial_defects || 0, previous: (m.trivial_defects_prev || 0), change: (m.trivial_defects || 0) - (m.trivial_defects_prev || 0) },
          { severity: "建议", current: m.suggestion_count || 0, previous: 0, change: 0 },
        ]
        setSeverityTrend(severity)
      }

      // 处理 quality trends — 周趋势
      if (trendsRes.status === "fulfilled") {
        const trendData = trendsRes.value?.data || {}
        const weekly = trendData.weekly || []
        setWeeklyData(weekly.map((w: any, i: number) => ({
          week: w.week || `第${29 + i}周`,
          created: w.defects || w.created || 0,
          resolved: w.resolved || 0,
          open: (w.defects || w.created || 0) - (w.resolved || 0),
        })))
        // 从 defect trends 提取模块数据
        if (trendData.modules) {
          setModuleData(trendData.modules.map((m: any) => ({
            module: m.name || m.module || "未知模块",
            defects: m.total || m.defects || 0,
            resolved: m.resolved || 0,
            open: (m.total || m.defects || 0) - (m.resolved || 0),
            trend: m.trend || "stable",
          })))
        }
      }

      // 处理 defect statistics
      if (defectStatsRes.status === "fulfilled") {
        const ds = defectStatsRes.value?.data || {}
        // 如果 trends 没返回模块数据，从统计中提取
        if (ds.by_module) {
          setModuleData(ds.by_module.map((m: any) => ({
            module: m.name || m.module || "未知模块",
            defects: m.total || m.count || 0,
            resolved: m.resolved || 0,
            open: (m.total || m.count || 0) - (m.resolved || 0),
            trend: m.trend || "stable",
          })))
        }
        // 如果 metrics 未返回 severity，从统计中提取
        if (ds.by_severity && severityTrend.every((s) => s.current === 0)) {
          setSeverityTrend(ds.by_severity.map((s: any) => ({
            severity: s.name || s.severity || "未知",
            current: s.count || 0,
            previous: s.previous || 0,
            change: (s.count || 0) - (s.previous || 0),
          })))
        }
      }
    } catch (err) {
      console.error("获取趋势数据失败:", err)
      toast.error("获取趋势数据失败，已显示空数据")
      // 静默处理 — 页面显示空数据而非崩溃
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // 如果 APIs 都没数据，使用空状态
  const displayWeekly = weeklyData.length > 0 ? weeklyData : []
  const displayModule = moduleData.length > 0 ? moduleData : []
  const displaySeverity = severityTrend.length > 0 ? severityTrend : []

  const maxCreated = displayWeekly.length > 0 ? Math.max(...displayWeekly.map((w) => w.created || 1)) : 1
  const maxModule = displayModule.length > 0 ? Math.max(...displayModule.map((x) => x.defects || 1)) : 1

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">趋势分析 <TrendingUp className="w-4 h-4 text-amber" /></h2><p className="text-xs text-muted mt-0.5">缺陷趋势追踪，发现质量问题规律</p></div>
      {/* 总览统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "总缺陷数", value: stats.totalCreated, icon: Bug, color: "from-rose-500 to-red-600" },
          { label: "已解决数", value: stats.totalResolved, icon: CheckCircle, color: "from-emerald-500 to-green-600" },
          { label: "解决率", value: stats.resolveRate, icon: TrendingUp, color: "from-blue-500 to-indigo-600" },
          { label: "平均修复周期", value: stats.avgFixDays, icon: Calendar, color: "from-amber to-orange-500" },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-border shadow-card p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}><Icon className="w-5 h-5 text-white" /></div>
                <div><p className="text-2xl font-bold text-ink">{s.value}</p><p className="text-[11px] text-muted">{s.label}</p></div>
              </div>
            </div>
          )
        })}
      </div>
      {/* 周趋势柱状图 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-5 mb-4">
        <h3 className="text-sm font-semibold text-ink mb-4">每周缺陷趋势</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-amber animate-spin" /></div>
        ) : displayWeekly.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">暂无趋势数据</p>
        ) : (
        <>
          <div className="flex items-end gap-6 h-48 px-4">
            {displayWeekly.map((w) => (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-1.5 h-36">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-ink-light font-medium">{w.created}</span>
                    <div className="w-5 rounded-t-md bg-gradient-to-t from-rose-500 to-red-400 transition-all" style={{ height: `${(w.created / maxCreated) * 100}%` }} />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-ink-light font-medium">{w.resolved}</span>
                    <div className="w-5 rounded-t-md bg-gradient-to-t from-emerald-500 to-green-400 transition-all" style={{ height: `${(w.resolved / maxCreated) * 100}%` }} />
                  </div>
                </div>
                <span className="text-[11px] text-muted mt-1">{w.week}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-rose-500" /><span className="text-[11px] text-muted">新增</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500" /><span className="text-[11px] text-muted">已解决</span></div>
          </div>
        </>
        )}
      </div>
      {/* 模块缺陷分布 + 严重程度趋势 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 模块缺陷分布 */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">模块缺陷分布</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-amber animate-spin" /></div>
          ) : displayModule.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">暂无模块数据</p>
          ) : (
          <div className="space-y-3">
            {displayModule.map((m) => (
              <div key={m.module} className="flex items-center gap-3">
                <span className="text-xs text-muted w-16 text-right flex-shrink-0">{m.module}</span>
                <div className="flex-1 h-6 bg-cream rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 flex">
                    <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-l-full" style={{ width: `${(m.open / maxModule) * 100}%` }} />
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500" style={{ width: `${(m.resolved / maxModule) * 100}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 w-20">
                  <span className="text-[10px] text-fail">{m.open}开</span>
                  <span className="text-[10px] text-pass">{m.resolved}关</span>
                  <span className="text-[10px] text-muted">{m.defects}总</span>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
        {/* 严重程度趋势 */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">严重程度趋势</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-amber animate-spin" /></div>
          ) : displaySeverity.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">暂无严重程度数据</p>
          ) : (
          <div className="space-y-3">
            {displaySeverity.map((s) => (
              <div key={s.severity} className="flex items-center justify-between p-3 bg-cream/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${s.severity === "致命" ? "bg-fail text-white" : s.severity === "严重" ? "bg-fail/10 text-fail" : s.severity === "一般" ? "bg-warn/10 text-warn" : s.severity === "轻微" ? "bg-info/10 text-info" : "bg-cream text-muted"}`}>{s.severity}</span>
                  <span className="text-sm font-medium text-ink">{s.current} 个</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted">上期 {s.previous}</span>
                  {s.change > 0 ? <TrendingUp className="w-4 h-4 text-fail" /> : s.change < 0 ? <TrendingDown className="w-4 h-4 text-pass" /> : <Minus className="w-4 h-4 text-muted" />}
                  <span className={`text-[11px] font-medium ${s.change > 0 ? "text-fail" : s.change < 0 ? "text-pass" : "text-muted"}`}>{s.change > 0 ? `+${s.change}` : s.change}</span>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
