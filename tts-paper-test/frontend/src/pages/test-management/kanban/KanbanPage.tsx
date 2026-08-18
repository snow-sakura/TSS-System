/**
 * 缺陷看板页面 — 真实数据 + 拖拽流转状态 + 列自适应
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, MoreHorizontal, Sparkles, RefreshCw } from "lucide-react"
import { lifecycleApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"

interface KanbanDefect {
  id: number
  title: string
  status: string
  severity: string
  assignee?: string
}

/** 看板列（标准流向），兼容遗留状态：open→已确认、in_progress→修复中、resolved→已修复 */
const columns = [
  { key: "new", label: "新建", statuses: ["new"], color: "bg-cream border-t-muted" },
  { key: "confirmed", label: "已确认", statuses: ["confirmed", "open"], color: "bg-info/5 border-t-info" },
  { key: "fixing", label: "修复中", statuses: ["fixing", "in_progress"], color: "bg-amber/5 border-t-amber" },
  { key: "fixed", label: "已修复", statuses: ["fixed", "resolved"], color: "bg-pass/5 border-t-pass" },
  { key: "closed", label: "已关闭", statuses: ["closed"], color: "bg-cream border-t-border" },
]

const severityColors: Record<string, string> = {
  critical: "bg-fail text-white",
  high: "bg-fail/80 text-white",
  major: "bg-fail/70 text-white",
  medium: "bg-amber text-white",
  minor: "bg-cream text-muted",
  low: "bg-cream text-muted",
}

const severityLabels: Record<string, string> = {
  critical: "致命", high: "严重", major: "严重", medium: "一般", minor: "轻微", low: "轻微",
}

export default function KanbanPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [defects, setDefects] = useState<KanbanDefect[]>([])
  const [loading, setLoading] = useState(true)
  const dragIdRef = useRef<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await lifecycleApi.listDefects()
      setDefects(Array.isArray(data) ? data : (data?.items ?? []))
    } catch (e) {
      toast?.error?.("加载看板数据失败")
      setDefects([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const getDefectsByStatus = useCallback((statuses: string[]) =>
    defects.filter(d => statuses.includes(d.status)), [defects])

  const handleDrop = useCallback(async (targetStatus: string) => {
    const id = dragIdRef.current
    dragIdRef.current = null
    setDragOverCol(null)
    if (id == null) return
    const defect = defects.find(d => d.id === id)
    if (!defect || defect.status === targetStatus) return
    // 乐观更新
    setDefects(prev => prev.map(d => d.id === id ? { ...d, status: targetStatus } : d))
    try {
      await lifecycleApi.updateDefect(id, { status: targetStatus })
      toast?.success?.(`已流转至「${columns.find(c => c.key === targetStatus)?.label}」`)
    } catch (e) {
      toast?.error?.("状态流转失败")
      loadData()
    }
  }, [defects, loadData, toast])

  const stats = useMemo(() => {
    const total = defects.length
    const open = defects.filter(d => ["new", "confirmed", "open", "fixing", "in_progress"].includes(d.status)).length
    const critical = defects.filter(d => ["critical", "high", "major"].includes(d.severity)).length
    return { total, open, critical }
  }, [defects])

  return (
    <div className="p-4 md:p-6">
      {/* 页头：标题 + 徽章行 + 主操作（统一布局） */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink">缺陷看板</h2>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 px-2.5 items-center rounded-full text-xs font-medium bg-cream text-muted">共 {stats.total} 条</span>
            <span className="inline-flex h-7 px-2.5 items-center rounded-full text-xs font-medium bg-amber/10 text-amber">未关闭 {stats.open}</span>
            <span className="inline-flex h-7 px-2.5 items-center rounded-full text-xs font-medium bg-fail/10 text-fail">严重 {stats.critical}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/test-management/root-cause")}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber to-orange-500 text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> AI根因分析
          </button>
          <button
            onClick={() => navigate("/test-management/defects")}
            className="h-9 px-4 rounded-xl bg-pass text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> 新建缺陷
          </button>
          <button
            onClick={loadData}
            className="h-9 w-9 rounded-xl border border-border text-ink-light hover:bg-cream transition-colors flex items-center justify-center"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 text-center text-muted">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {columns.map(col => {
            const colDefects = getDefectsByStatus(col.statuses)
            return (
              <div
                key={col.key}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.key) }}
                onDragLeave={() => setDragOverCol(prev => prev === col.key ? null : prev)}
                onDrop={e => { e.preventDefault(); handleDrop(col.key) }}
                className={`bg-white rounded-2xl border shadow-card overflow-hidden transition-all ${
                  dragOverCol === col.key ? "border-amber ring-2 ring-amber/20" : "border-border"
                }`}
              >
                <div className={`p-4 border-t-4 ${col.color}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink">{col.label}</h3>
                    <span className="text-xs font-medium bg-cream px-2 py-0.5 rounded-full">{colDefects.length}</span>
                  </div>
                </div>
                <div className={`p-3 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto ${dragOverCol === col.key ? "bg-amber-50/50" : ""}`}>
                  {colDefects.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted border border-dashed border-border rounded-xl">拖拽缺陷到此列</div>
                  ) : (
                    colDefects.map(defect => (
                      <div
                        key={defect.id}
                        draggable
                        onDragStart={() => { dragIdRef.current = defect.id }}
                        onDragEnd={() => { dragIdRef.current = null; setDragOverCol(null) }}
                        className="p-3 rounded-xl bg-cream hover:bg-cream-dark/50 cursor-grab active:cursor-grabbing transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-medium text-ink line-clamp-2">{defect.title}</h4>
                          <button className="p-1 rounded hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <MoreHorizontal className="w-4 h-4 text-muted" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${severityColors[defect.severity] || severityColors.medium}`}>
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