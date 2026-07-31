/**
 * 看板视图页面 - 缺陷看板
 */
import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus, MoreHorizontal, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { lifecycleApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import { withMockFallback, mockDefects } from "@/lib/mockData"

interface KanbanDefect {
  id: number
  title: string
  status: "new" | "confirmed" | "fixing" | "fixed" | "closed"
  severity: "critical" | "high" | "medium" | "low"
  assignee?: string
}

const columns = [
  { key: "new", label: "新建", color: "bg-cream border-t-muted" },
  { key: "confirmed", label: "已确认", color: "bg-info/5 border-t-info" },
  { key: "fixing", label: "修复中", color: "bg-amber/5 border-t-amber" },
  { key: "fixed", label: "已修复", color: "bg-pass/5 border-t-pass" },
  { key: "closed", label: "已关闭", color: "bg-cream border-t-border" },
]

const severityColors: Record<string, string> = {
  critical: "bg-fail text-white",
  high: "bg-fail/80 text-white",
  medium: "bg-amber text-white",
  low: "bg-cream text-muted",
}

const severityLabels: Record<string, string> = {
  critical: "致命",
  high: "严重",
  medium: "一般",
  low: "轻微",
}

export default function KanbanPage() {
  const toast = useToast()
  const [defects, setDefects] = useState<KanbanDefect[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await withMockFallback<KanbanDefect[]>(
        () => lifecycleApi.listDefects(),
        mockDefects as unknown as KanbanDefect[],
        false
      )
      setDefects(Array.isArray(data) ? data : [])
    } catch (e) {
      toast?.error?.("加载看板数据失败")
      setDefects([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const getDefectsByStatus = useCallback((status: string) =>
    defects.filter(d => d.status === status), [defects])

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink">缺陷看板</h2>
          <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">共 {defects.length} 条</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber to-orange-500 text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> AI根因分析
          </button>
          <button className="h-9 px-4 rounded-xl bg-pass text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-2">
            <Plus className="w-4 h-4" /> 新建缺陷
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 text-center text-muted">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {columns.map(col => {
            const colDefects = getDefectsByStatus(col.key)
            return (
              <div key={col.key} className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
                <div className={`p-4 border-t-4 ${col.color}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink">{col.label}</h3>
                    <span className="text-xs font-medium bg-cream px-2 py-0.5 rounded-full">{colDefects.length}</span>
                  </div>
                </div>
                <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
                  {colDefects.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted">暂无缺陷</div>
                  ) : (
                    colDefects.map(defect => (
                      <div
                        key={defect.id}
                        className="p-3 rounded-xl bg-cream hover:bg-cream-dark/50 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-medium text-ink line-clamp-2">{defect.title}</h4>
                          <button className="p-1 rounded hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <MoreHorizontal className="w-4 h-4 text-muted" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${severityColors[defect.severity] || severityColors.low}`}>
                            {severityLabels[defect.severity] || "一般"}
                          </span>
                          {defect.assignee && (
                            <span className="text-xs text-muted">{defect.assignee}</span>
                          )}
                        </div>
                      </div>
                    ))
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
