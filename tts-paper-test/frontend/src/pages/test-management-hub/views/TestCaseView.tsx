/**
 * TestCaseView — 测试用例状态分组视图
 *
 * 按状态分组显示测试用例（通过/失败/阻塞/未执行），
 * 提供快速的状态概览。
 */
import { useState, useEffect, useCallback } from "react"
import { ClipboardList, CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lifecycleApi } from "@/lib/api"

interface TestCase {
  id: number
  name: string
  title?: string
  status: string
  priority?: string
  module?: string
  test_point_id?: number
  created_at?: string
  [key: string]: any
}

const STATUS_GROUPS: { key: string; label: string; icon: typeof CheckCircle2; color: string; bg: string; match: string[] }[] = [
  { key: "passed", label: "已通过", icon: CheckCircle2, color: "text-pass", bg: "bg-emerald-50", match: ["passed", "approved", "已通过"] },
  { key: "failed", label: "失败", icon: XCircle, color: "text-fail", bg: "bg-red-50", match: ["failed", "未通过"] },
  { key: "blocked", label: "阻塞", icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", match: ["blocked", "阻塞"] },
  { key: "pending", label: "未执行", icon: Clock, color: "text-blue-500", bg: "bg-blue-50", match: ["pending", "draft", "new", "新建", "未执行"] },
]

interface Props {
  onBack: () => void
}

export default function TestCaseView({ onBack }: Props) {
  const [items, setItems] = useState<TestCase[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await lifecycleApi.listTestCases()
      const list = res?.data?.items || res?.data || res?.items || []
      setItems(list)
    } catch (e) {
      console.warn("获取用例列表失败", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const getGroupItems = (group: typeof STATUS_GROUPS[0]) => {
    return items.filter((c) => group.match.some((m) => (c.status || "").toLowerCase() === m.toLowerCase()))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-light">加载用例数据...</p>
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
          <h2 className="text-lg font-semibold text-ink">测试用例</h2>
          <span className="text-xs text-ink-light bg-cream px-2 py-1 rounded-md">{items.length} 条</span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {STATUS_GROUPS.map((g) => {
          const count = getGroupItems(g).length
          const Icon = g.icon
          return (
            <div key={g.key} className={`${g.bg} rounded-xl border border-border/60 p-3`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${g.color}`} />
                <span className={`text-xs font-medium ${g.color}`}>{g.label}</span>
              </div>
              <p className={`text-xl font-bold mt-1 ${g.color}`}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* 按状态分组 */}
      <div className="space-y-3">
        {STATUS_GROUPS.map((g) => {
          const groupItems = getGroupItems(g)
          if (groupItems.length === 0) return null
          const Icon = g.icon
          return (
            <div key={g.key} className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
              <div className={`px-4 py-2.5 ${g.bg} border-b border-border/60 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${g.color}`} />
                  <span className={`text-sm font-semibold ${g.color}`}>{g.label}</span>
                </div>
                <span className={`text-xs font-medium ${g.color} bg-white/60 px-2 py-0.5 rounded-full`}>{groupItems.length}</span>
              </div>
              <div className="divide-y divide-border/40">
                {groupItems.map((tc) => (
                  <div
                    key={tc.id}
                    className="px-4 py-2.5 hover:bg-cream/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCase(selectedCase?.id === tc.id ? null : tc)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <ClipboardList className="w-3.5 h-3.5 text-ink-light shrink-0" />
                        <span className="text-sm text-ink truncate">{tc.name || tc.title || `用例 #${tc.id}`}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {tc.priority && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream text-ink-light">{tc.priority}</span>}
                        {tc.module && <span className="text-[10px] text-ink-light hidden sm:inline">{tc.module}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* 详情弹窗 */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedCase(null)}>
          <div className="bg-white rounded-2xl shadow-elevated max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">用例详情</h3>
              <button onClick={() => setSelectedCase(null)} className="p-1 rounded-lg hover:bg-cream">
                <Eye className="w-4 h-4 text-ink-light" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-60 overflow-y-auto">
              <p className="text-sm font-medium text-ink">{selectedCase.name || selectedCase.title}</p>
              <div className="flex gap-4 text-xs">
                <div><span className="text-ink-light">状态:</span> <span className="font-medium text-ink">{selectedCase.status}</span></div>
                <div><span className="text-ink-light">优先级:</span> <span className="font-medium text-ink">{selectedCase.priority || "-"}</span></div>
                <div><span className="text-ink-light">模块:</span> <span className="font-medium text-ink">{selectedCase.module || "-"}</span></div>
              </div>
              {selectedCase.preconditions && (
                <div>
                  <label className="text-xs text-ink-light">前置条件</label>
                  <p className="text-sm text-ink-light mt-0.5">{selectedCase.preconditions}</p>
                </div>
              )}
              {selectedCase.steps && (
                <div>
                  <label className="text-xs text-ink-light">步骤</label>
                  <p className="text-sm text-ink-light mt-0.5 whitespace-pre-wrap">{typeof selectedCase.steps === "string" ? selectedCase.steps : JSON.stringify(selectedCase.steps)}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-border flex justify-end">
              <Button variant="outline" className="h-8 text-xs border-border" onClick={() => setSelectedCase(null)}>关闭</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
