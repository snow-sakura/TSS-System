/**
 * 质量概览 — 从真实 API 获取质量指标
 */
import { useState, useEffect } from "react"
import { BarChart3, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Bug, FileText, Target, Activity, Zap, Loader2 } from "lucide-react"
import { lifecycleApi } from "@/lib/api"

export default function QualityOverview() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    loadMetrics()
  }, [])

  const loadMetrics = async () => {
    setLoading(true)
    setError("")
    try {
      const res: any = await lifecycleApi.getQualityMetrics()
      // API 返回嵌套在 ResponseModel 中
      setMetrics(res?.data || res)
    } catch (e: any) {
      setError(e?.message || "加载失败")
      // 使用兜底数据
      setMetrics({
        pass_rate: 0, total_cases: 0, passed: 0, failed: 0,
        total_defects: 0, open_defects: 0, critical_defects: 0,
        total_executions: 0, total_test_cases: 0, ai_generated_cases: 0,
        defect_fix_rate: 0, defect_density: 0, test_coverage: 0, automation_rate: 0,
        total_requirements: 0, analyzed_requirements: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600"
  const getScoreBg = (score: number) => score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"
  const scoreToPercent = (val: number) => Math.min(100, Math.max(0, val))

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber" />
      </div>
    )
  }

  const m = metrics || {}

  // 计算维度评分
  const dimensions = [
    { name: "执行质量", score: scoreToPercent(m.pass_rate || 0), color: "from-sky-500 to-blue-600" },
    { name: "缺陷管理", score: scoreToPercent(m.defect_fix_rate || 0), color: "from-rose-500 to-red-600" },
    { name: "测试覆盖", score: scoreToPercent(m.test_coverage || 0), color: "from-emerald-500 to-green-600" },
    { name: "自动化成熟度", score: scoreToPercent(m.automation_rate || 0), color: "from-violet-500 to-purple-600" },
  ]

  const overallScore = Math.round(
    (scoreToPercent(m.pass_rate || 0) * 0.35 +
     scoreToPercent(m.defect_fix_rate || 0) * 0.25 +
     scoreToPercent(m.test_coverage || 0) * 0.25 +
     scoreToPercent(m.automation_rate || 0) * 0.15)
  )

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">质量概览</h2>
          <p className="text-xs text-muted mt-0.5">项目质量仪表盘 · 多维度评估</p>
        </div>
        <button onClick={loadMetrics} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-border text-ink-light hover:bg-cream transition-colors flex items-center gap-1">
          <Activity className="w-3.5 h-3.5" /> 刷新
        </button>
      </div>

      {/* 总分 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-6 mb-4">
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f1f1" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={overallScore >= 80 ? "#10b981" : overallScore >= 60 ? "#f59e0b" : "#ef4444"} strokeWidth="8"
                strokeDasharray={`${overallScore * 2.64} 264`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {[
              { label: "通过率", value: `${m.pass_rate ?? 0}%`, icon: CheckCircle, color: "text-emerald-600" },
              { label: "缺陷密度", value: (m.defect_density ?? 0).toFixed(1), icon: Bug, color: "text-red-600" },
              { label: "修复率", value: `${m.defect_fix_rate ?? 0}%`, icon: TrendingUp, color: "text-blue-600" },
              { label: "测试覆盖", value: `${m.test_coverage ?? 0}%`, icon: Target, color: "text-violet-600" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg bg-cream/30">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                  <div>
                    <div className="text-[10px] text-muted">{item.label}</div>
                    <div className="text-xs font-bold text-ink">{item.value}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 维度评分 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {dimensions.map((d) => (
          <div key={d.name} className="bg-white rounded-2xl border border-border shadow-card p-4">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center mb-2`}>
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs text-muted">{d.name}</p>
            <div className="flex items-end gap-1.5 mt-1">
              <span className={`text-lg font-bold ${getScoreColor(d.score)}`}>{d.score}</span>
              <span className="text-[10px] text-muted mb-0.5">/ 100</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-cream overflow-hidden">
              <div className={`h-full rounded-full ${getScoreBg(d.score)} transition-all`} style={{ width: `${d.score}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* 关键指标 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-5">
        <h3 className="text-sm font-semibold text-ink mb-3">关键指标</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "总执行数", value: m.total_executions ?? 0, icon: Activity, color: "text-blue-600", bg: "bg-blue-100" },
            { label: "总用例数", value: m.total_cases ?? 0, icon: FileText, color: "text-emerald-600", bg: "bg-emerald-100" },
            { label: "未解决缺陷", value: m.open_defects ?? 0, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-100" },
            { label: "致命缺陷", value: m.critical_defects ?? 0, icon: Bug, color: "text-red-600", bg: "bg-red-100" },
            { label: "自动化率", value: `${m.automation_rate ?? 0}%`, icon: Zap, color: "text-violet-600", bg: "bg-violet-100" },
            { label: "AI生成用例", value: m.ai_generated_cases ?? 0, icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-100" },
            { label: "需求总数", value: m.total_requirements ?? 0, icon: Target, color: "text-cyan-600", bg: "bg-cyan-100" },
            { label: "已分析需求", value: m.analyzed_requirements ?? 0, icon: CheckCircle, color: "text-teal-600", bg: "bg-teal-100" },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-cream/20">
                <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <div className="text-[10px] text-muted">{item.label}</div>
                  <div className="text-sm font-bold text-ink">{item.value}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
