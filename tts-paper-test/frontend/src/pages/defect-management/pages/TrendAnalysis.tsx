/**
 * 趋势分析 - 缺陷趋势图表
 */
import { useState } from "react"
import { TrendingUp, TrendingDown, Minus, Calendar, Bug, CheckCircle } from "lucide-react"

const weeklyData = [
  { week: "第28周", created: 8, resolved: 5, open: 3 },
  { week: "第29周", created: 12, resolved: 9, open: 6 },
  { week: "第30周", created: 6, resolved: 10, open: 2 },
  { week: "第31周", created: 10, resolved: 7, open: 5 },
  { week: "第32周", created: 4, resolved: 8, open: 1 },
]

const moduleData = [
  { module: "登录模块", defects: 3, resolved: 1, open: 2, trend: "up" },
  { module: "购物车", defects: 2, resolved: 0, open: 2, trend: "up" },
  { module: "支付模块", defects: 2, resolved: 0, open: 2, trend: "up" },
  { module: "搜索模块", defects: 2, resolved: 1, open: 1, trend: "down" },
  { module: "订单模块", defects: 2, resolved: 1, open: 1, trend: "down" },
  { module: "用户管理", defects: 1, resolved: 1, open: 0, trend: "stable" },
  { module: "通知模块", defects: 1, resolved: 1, open: 0, trend: "stable" },
]

const severityTrend = [
  { severity: "致命", current: 2, previous: 1, change: +1 },
  { severity: "严重", current: 3, previous: 2, change: +1 },
  { severity: "一般", current: 3, previous: 4, change: -1 },
  { severity: "轻微", current: 2, previous: 2, change: 0 },
  { severity: "建议", current: 1, previous: 1, change: 0 },
]

export default function TrendAnalysis() {
  const [selectedPeriod, setSelectedPeriod] = useState("weekly")
  const totalCreated = weeklyData.reduce((s, w) => s + w.created, 0)
  const totalResolved = weeklyData.reduce((s, w) => s + w.resolved, 0)
  const maxCreated = Math.max(...weeklyData.map((w) => w.created))

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">趋势分析 <TrendingUp className="w-4 h-4 text-amber" /></h2><p className="text-xs text-muted mt-0.5">缺陷趋势追踪，发现质量问题规律</p></div>
      {/* 总览统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "总缺陷数", value: totalCreated, icon: Bug, color: "from-rose-500 to-red-600" },
          { label: "已解决数", value: totalResolved, icon: CheckCircle, color: "from-emerald-500 to-green-600" },
          { label: "解决率", value: `${Math.round((totalResolved / totalCreated) * 100)}%`, icon: TrendingUp, color: "from-blue-500 to-indigo-600" },
          { label: "平均修复周期", value: "2.3天", icon: Calendar, color: "from-amber to-orange-500" },
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
      {/* 周趋势柱状图（CSS实现） */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-5 mb-4">
        <h3 className="text-sm font-semibold text-ink mb-4">每周缺陷趋势</h3>
        <div className="flex items-end gap-6 h-48 px-4">
          {weeklyData.map((w) => (
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
      </div>
      {/* 模块缺陷分布 + 严重程度趋势 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 模块缺陷分布 */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">模块缺陷分布</h3>
          <div className="space-y-3">
            {moduleData.map((m) => {
              const maxModule = Math.max(...moduleData.map((x) => x.defects))
              return (
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
              )
            })}
          </div>
        </div>
        {/* 严重程度趋势 */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">严重程度趋势</h3>
          <div className="space-y-3">
            {severityTrend.map((s) => (
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
        </div>
      </div>
    </div>
  )
}
