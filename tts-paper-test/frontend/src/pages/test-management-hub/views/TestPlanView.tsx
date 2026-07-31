/**
 * TestPlanView — 测试方案卡片视图
 *
 * 展示方案列表，每个方案显示关联的测试点/用例数量，
 * 按状态和创建时间组织。
 */
import { useState, useEffect, useCallback } from "react"
import { Target, ArrowRight, CheckCircle2, Clock, FileText, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lifecycleApi } from "@/lib/api"

interface TestPlan {
  id: number
  name: string
  description?: string
  status: string
  module?: string
  version?: string
  test_point_count?: number
  case_count?: number
  created_at?: string
  [key: string]: any
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  draft: { color: "text-gray-500", bg: "bg-gray-100", label: "草稿" },
  active: { color: "text-blue-600", bg: "bg-blue-100", label: "进行中" },
  completed: { color: "text-pass", bg: "bg-emerald-100", label: "已完成" },
  archived: { color: "text-ink-light", bg: "bg-cream", label: "已归档" },
}

interface Props {
  onBack: () => void
}

export default function TestPlanView({ onBack }: Props) {
  const [items, setItems] = useState<TestPlan[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await lifecycleApi.listTestPlans()
      const list = res?.data?.items || res?.data || res?.items || []
      setItems(list)
    } catch (e) {
      console.warn("获取方案列表失败", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const getStatus = (status?: string) => {
    const s = (status || "draft").toLowerCase()
    return STATUS_CONFIG[s] || STATUS_CONFIG.draft
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-light">加载方案数据...</p>
        </div>
      </div>
    )
  }

  const totalPoints = items.reduce((s, p) => s + (p.test_point_count || 0), 0)
  const totalCases = items.reduce((s, p) => s + (p.case_count || 0), 0)
  const active = items.filter((p) => p.status?.toLowerCase() === "active").length

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all">
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </button>
          <h2 className="text-lg font-semibold text-ink">测试方案</h2>
          <span className="text-xs text-ink-light bg-cream px-2 py-1 rounded-md">{items.length} 项</span>
        </div>
      </div>

      {/* 概览条 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border p-3 shadow-card">
          <p className="text-[10px] text-ink-light mb-0.5">总方案</p>
          <p className="text-xl font-bold text-ink">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-3 shadow-card">
          <p className="text-[10px] text-ink-light mb-0.5">进行中</p>
          <p className="text-xl font-bold text-blue-600">{active}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-3 shadow-card">
          <p className="text-[10px] text-ink-light mb-0.5">测试点</p>
          <p className="text-xl font-bold text-amber">{totalPoints}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-3 shadow-card">
          <p className="text-[10px] text-ink-light mb-0.5">测试用例</p>
          <p className="text-xl font-bold text-pass">{totalCases}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col items-center justify-center py-20">
          <Target className="w-12 h-12 text-ink-light opacity-30 mb-3" />
          <p className="text-sm font-medium text-ink">暂无测试方案</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((plan) => {
            const st = getStatus(plan.status)
            return (
              <div key={plan.id} className="bg-white rounded-2xl border border-border shadow-card p-4 hover:shadow-md hover:border-amber/30 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5 text-indigo-500" />
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.color}`}>{st.label}</span>
                </div>
                <h4 className="text-sm font-semibold text-ink mt-2 line-clamp-1">{plan.name}</h4>
                {plan.description && <p className="text-xs text-ink-light mt-1 line-clamp-2">{plan.description}</p>}
                {plan.module && <p className="text-[10px] text-ink-light mt-1">模块: {plan.module}</p>}
                <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-border/40 text-[11px] text-ink-light">
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {plan.test_point_count || 0} 测试点</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {plan.case_count || 0} 用例</span>
                </div>
                {plan.created_at && (
                  <p className="text-[10px] text-ink-light mt-1.5">{new Date(plan.created_at).toLocaleDateString("zh-CN")}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
