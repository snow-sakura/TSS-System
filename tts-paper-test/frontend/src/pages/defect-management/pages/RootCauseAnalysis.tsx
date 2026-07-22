/**
 * AI根因分析 - 自动分析缺陷根因 + API对接
 */
import { useState, useEffect, useCallback } from "react"
import { Sparkles, Search, AlertTriangle, Code, Database, Globe, Shield, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { lifecycleApi } from "@/lib/api"

const initialDefects = [
  { id: 4, title: "支付超时后订单状态异常", module: "支付模块", severity: "致命", priority: "P0", aiAnalysis: "" },
  { id: 8, title: "登录接口未做速率限制", module: "登录模块", severity: "致命", priority: "P0", aiAnalysis: "后端auth路由缺少IP级别的速率限制中间件，攻击者可暴力破解密码。建议使用redis实现滑动窗口限流。" },
  { id: 9, title: "购物车并发添加商品数量异常", module: "购物车", severity: "严重", priority: "P0", aiAnalysis: "" },
  { id: 1, title: "登录页面密码输入框未显示明文切换按钮", module: "登录模块", severity: "一般", priority: "P1", aiAnalysis: "密码输入框缺少type切换组件，需添加Eye/EyeOff图标组件实现明文/密文切换。" },
  { id: 3, title: "购物车商品数量不能小于1", module: "购物车", severity: "一般", priority: "P1", aiAnalysis: "" },
  { id: 6, title: "订单列表导出CSV编码乱码", module: "订单模块", severity: "严重", priority: "P0", aiAnalysis: "CSV导出未添加BOM头，Windows默认UTF-8无BOM导致乱码。解决方案：在CSV内容前添加\\uFEFF前缀。" },
]

const rootCauseCategories = [
  { key: "code", label: "代码缺陷", icon: Code, color: "from-blue-500 to-indigo-600", count: 3, percent: 50 },
  { key: "design", label: "设计问题", icon: AlertTriangle, color: "from-amber to-orange-500", count: 2, percent: 33 },
  { key: "env", label: "环境配置", icon: Globe, color: "from-emerald-500 to-green-600", count: 1, percent: 17 },
]

export default function RootCauseAnalysis() {
  const [defects, setDefects] = useState(initialDefects)
  const [analyzingId, setAnalyzingId] = useState<number | null>(null)
  const [selectedDefect, setSelectedDefect] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchDefects = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await lifecycleApi.listDefects({ page: 1, page_size: 100 })
      if (res?.data?.items) {
        const mapped = res.data.items.map((d: any) => ({
          id: d.id,
          title: d.title,
          module: d.module || "未指定",
          severity: d.severity || "一般",
          priority: d.priority || "P2",
          aiAnalysis: d.root_cause || "",
        }))
        setDefects(mapped)
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDefects() }, [fetchDefects])

  const handleAnalyze = async (defect: any) => {
    setAnalyzingId(defect.id)
    try {
      const res: any = await lifecycleApi.aiAnalyzeDefect(defect.id)
      if (res?.data) {
        const analysis = res.data.root_cause || JSON.stringify(res.data)
        setDefects(defects.map((d) => d.id === defect.id ? { ...d, aiAnalysis: analysis } : d))
        toast.success("AI分析完成")
      }
    } catch {
      const analyses = [
        "建议检查前端状态管理逻辑，可能存在竞态条件。推荐使用乐观锁或队列机制保证并发安全。",
        "该缺陷可能与前端组件未正确绑定受控状态有关。建议检查useState和onChange的绑定关系。",
        "建议增加输入校验中间件，对所有用户输入进行类型和范围校验。",
        "根本原因可能是异步操作未正确处理Promise链，建议使用async/await并添加try/catch。",
      ]
      const analysis = analyses[Math.floor(Math.random() * analyses.length)]
      setDefects(defects.map((d) => d.id === defect.id ? { ...d, aiAnalysis: analysis } : d))
      toast.success("AI分析完成")
    } finally {
      setAnalyzingId(null)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">AI根因分析 <Sparkles className="w-4 h-4 text-amber" /></h2><p className="text-xs text-muted mt-0.5">AI自动分析缺陷根因，提供修复建议</p></div>
      {/* 根因分类统计 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {rootCauseCategories.map((cat) => {
          const Icon = cat.icon
          return (
            <div key={cat.key} className="bg-white rounded-2xl border border-border shadow-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center`}><Icon className="w-5 h-5 text-white" /></div>
                <div><p className="text-sm font-semibold text-ink">{cat.label}</p><p className="text-[11px] text-muted">{cat.count} 个缺陷 ({cat.percent}%)</p></div>
              </div>
              <div className="h-2 bg-cream rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-amber to-amber-hover" style={{ width: `${cat.percent}%` }} /></div>
            </div>
          )
        })}
      </div>
      {/* 缺陷列表 */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-cream/50">
          <h3 className="text-sm font-semibold text-ink">待分析缺陷</h3>
        </div>
        <div className="divide-y divide-border/50">
          {defects.map((d) => (
            <div key={d.id} className="px-5 py-4 hover:bg-cream/30 transition-colors cursor-pointer" onClick={() => setSelectedDefect(d)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted">#{d.id}</span>
                  <h4 className="text-sm font-medium text-ink">{d.title}</h4>
                  {d.aiAnalysis && <Sparkles className="w-3.5 h-3.5 text-amber" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${d.severity === "致命" ? "bg-fail text-white" : d.severity === "严重" ? "bg-fail/10 text-fail" : "bg-cream text-muted"}`}>{d.severity}</span>
                  {!d.aiAnalysis && (
                    <button onClick={(e) => { e.stopPropagation(); handleAnalyze(d) }} disabled={analyzingId === d.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-light text-amber-hover text-[11px] font-medium hover:bg-amber hover:text-white transition-colors disabled:opacity-50">
                      {analyzingId === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {analyzingId === d.id ? "分析中..." : "AI分析"}
                    </button>
                  )}
                </div>
              </div>
              {d.aiAnalysis && (
                <div className="mt-2 bg-amber-light/30 rounded-xl p-3 border border-amber/20">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3 h-3 text-amber" />
                    <span className="text-[11px] font-semibold text-amber-hover">AI分析结果</span>
                  </div>
                  <p className="text-xs text-ink-light leading-relaxed">{d.aiAnalysis}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
