/**
 * 需求看板视图 - Kanban 风格 + AI 辅助
 *
 * 将需求列表展示为状态列（新建→分析中→已完成），
 * 每个需求以卡片形式呈现，支持 AI 智能分析和测试用例生成。
 */
import { useState, useEffect, useCallback } from "react"
import { FileText, Plus, AlertCircle, Clock, CheckCircle2, ArrowRight, Eye, Trash2, Pencil, Sparkles, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lifecycleApi, apiFetch } from "@/lib/api"
import AiAnalysisDialog from "./AiAnalysisDialog"

// ── 类型 ──────────────────────────────────────────────
interface Requirement {
  id: number
  title: string
  description?: string
  status: string
  priority: string
  module?: string
  created_at?: string
  [key: string]: any
}

interface ColumnDef {
  id: string
  label: string
  icon: typeof FileText
  color: string
  bgColor: string
  statusFilter: string[]
}

const COLUMNS: ColumnDef[] = [
  {
    id: "new",
    label: "新建",
    icon: AlertCircle,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    statusFilter: ["new", "draft", "新建"],
  },
  {
    id: "analyzing",
    label: "分析中",
    icon: Clock,
    color: "text-amber",
    bgColor: "bg-amber-50",
    statusFilter: ["analyzing", "in_progress", "分析中"],
  },
  {
    id: "completed",
    label: "已完成",
    icon: CheckCircle2,
    color: "text-pass",
    bgColor: "bg-emerald-50",
    statusFilter: ["completed", "analyzed", "已分析", "已完成"],
  },
]

const PRIORITY_COLORS: Record<string, string> = {
  "紧急": "bg-red-100 text-red-600",
  "critical": "bg-red-100 text-red-600",
  "高": "bg-orange-100 text-orange-600",
  "high": "bg-orange-100 text-orange-600",
  "中": "bg-amber-100 text-amber-600",
  "medium": "bg-amber-100 text-amber-600",
  "低": "bg-blue-100 text-blue-600",
  "low": "bg-blue-100 text-blue-600",
}

interface Props {
  onBack: () => void
  onEdit?: (item: any) => void
}

export default function RequirementsView({ onBack, onEdit }: Props) {
  const [items, setItems] = useState<Requirement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<Requirement | null>(null)

  // AI 分析对话框状态
  const [aiDialog, setAiDialog] = useState<{ reqId: number; title: string } | null>(null)

  // 生成测试用例状态
  const [generating, setGenerating] = useState(false)
  const [generatedResult, setGeneratedResult] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await lifecycleApi.listRequirements()
      const list = res?.data?.items || res?.data || res?.items || []
      setItems(list)
    } catch (e) {
      console.warn("获取需求列表失败", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getColumnItems = (col: ColumnDef): Requirement[] => {
    return items.filter((item) =>
      col.statusFilter.some((s) => item.status?.toLowerCase() === s.toLowerCase()),
    )
  }

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null
    const cls = PRIORITY_COLORS[priority] || "bg-gray-100 text-gray-600"
    return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{priority}</span>
  }

  /** 为 AiAnalysisDialog 生成 SSE fetch 函数 */
  const buildAnalysisFetch = useCallback((reqId: number) => {
    return async () => {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`/api/v1/test-lifecycle/requirements/${reqId}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      return res
    }
  }, [])

  /** AI 生成测试用例 */
  const handleGenerateCases = useCallback(async (req: Requirement) => {
    setGenerating(true)
    setGeneratedResult(null)
    try {
      const res: any = await lifecycleApi.aiGenerateCases({
        requirement_content: req.description || req.raw_content || "",
        requirement_name: req.title || req.name,
        module: req.module,
        priority: req.priority,
        count: 5,
      })
      const count = res?.data?.count || res?.data?.length || 0
      setGeneratedResult(`✅ 成功生成 ${count} 条测试用例`)
    } catch (e: any) {
      setGeneratedResult(`❌ 生成失败：${e?.detail || e?.message || "请稍后重试"}`)
    } finally {
      setGenerating(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-light">加载需求看板...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all"
            title="返回工作台总览"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </button>
          <h2 className="text-lg font-semibold text-ink">需求看板</h2>
          <span className="text-xs text-ink-light bg-cream px-2 py-1 rounded-md">{items.length} 条</span>
        </div>
        <Button className="h-9 gradient-amber text-white text-sm shadow-sm">
          <Plus className="w-4 h-4 mr-1" /> 新建需求
        </Button>
      </div>

      {/* 看板列 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const colItems = getColumnItems(col)
          const Icon = col.icon
          return (
            <div key={col.id} className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
              {/* 列头 */}
              <div className={`px-4 py-3 ${col.bgColor} border-b border-border/60`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${col.color}`} />
                    <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                  </div>
                  <span className={`text-xs font-medium ${col.color} bg-white/60 px-2 py-0.5 rounded-full`}>
                    {colItems.length}
                  </span>
                </div>
              </div>

              {/* 卡片列表 */}
              <div className="p-3 space-y-2 min-h-[200px]">
                {colItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-ink-light">
                    <FileText className="w-8 h-8 opacity-30 mb-2" />
                    <p className="text-xs">暂无数据</p>
                  </div>
                ) : (
                  colItems.map((item) => (
                    <div
                      key={item.id}
                      className="group bg-white border border-border/80 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-amber/30 transition-all cursor-pointer"
                      onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-ink leading-snug line-clamp-2 flex-1">
                          {item.title || item.name || `需求 #${item.id}`}
                        </h4>
                        {getPriorityBadge(item.priority)}
                      </div>
                      {item.description && (
                        <p className="text-xs text-ink-light mt-1.5 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/40">
                        <span className="text-[10px] text-ink-light">
                          {item.module && `${item.module}`}
                          {item.created_at && ` · ${new Date(item.created_at).toLocaleDateString("zh-CN")}`}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* AI 分析按钮 */}
                          <button
                            className="p-1 rounded-md hover:bg-amber/10 text-ink-light hover:text-amber transition-colors"
                            title="AI 分析需求"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAiDialog({ reqId: item.id, title: item.title || item.name || `需求 #${item.id}` })
                            }}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="p-1 rounded-md hover:bg-cream text-ink-light hover:text-ink transition-colors"
                            title="编辑"
                            onClick={(e) => { e.stopPropagation(); onEdit?.(item) }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="p-1 rounded-md hover:bg-red-50 text-ink-light hover:text-fail transition-colors"
                            title="删除"
                            onClick={(e) => { e.stopPropagation() }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 详情弹窗（含 AI 功能） */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-2xl shadow-elevated max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">需求详情</h3>
              <button onClick={() => setSelectedItem(null)} className="p-1 rounded-lg hover:bg-cream text-ink-light hover:text-ink">
                <Eye className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-xs text-ink-light block mb-1">标题</label>
                <p className="text-sm font-medium text-ink">{selectedItem.title || selectedItem.name}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="text-xs text-ink-light block mb-1">状态</label>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                    {selectedItem.status}
                  </span>
                </div>
                <div>
                  <label className="text-xs text-ink-light block mb-1">优先级</label>
                  {getPriorityBadge(selectedItem.priority)}
                </div>
                <div>
                  <label className="text-xs text-ink-light block mb-1">模块</label>
                  <span className="text-xs text-ink">{selectedItem.module || "-"}</span>
                </div>
              </div>
              {selectedItem.description && (
                <div>
                  <label className="text-xs text-ink-light block mb-1">描述</label>
                  <p className="text-sm text-ink-light">{selectedItem.description}</p>
                </div>
              )}

              {/* AI 生成区域 */}
              <div className="pt-2 border-t border-border/40">
                <label className="text-xs text-ink-light block mb-2">AI 辅助操作</label>
                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber/10 text-amber hover:bg-amber/20 text-xs font-medium transition-colors"
                    onClick={() => setAiDialog({
                      reqId: selectedItem.id,
                      title: selectedItem.title || selectedItem.name || `需求 #${selectedItem.id}`,
                    })}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> AI 智能分析
                  </button>
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium transition-colors disabled:opacity-50"
                    onClick={() => handleGenerateCases(selectedItem)}
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {generating ? "生成中..." : "生成测试用例"}
                  </button>
                </div>
                {generatedResult && (
                  <p className="text-xs mt-2 text-ink-light">{generatedResult}</p>
                )}
              </div>
            </div>
            <div className="px-6 py-3 border-t border-border flex justify-end gap-2">
              <Button variant="outline" className="h-8 text-xs border-border" onClick={() => setSelectedItem(null)}>
                关闭
              </Button>
              <Button className="h-8 text-xs gradient-amber text-white">
                <Pencil className="w-3 h-3 mr-1" /> 编辑
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI 分析流式对话框 */}
      {aiDialog && (
        <AiAnalysisDialog
          title={`需求分析：${aiDialog.title}`}
          fetchFn={buildAnalysisFetch(aiDialog.reqId)}
          onClose={() => {
            setAiDialog(null)
            fetchData() // 刷新看板以反映状态变化
          }}
        />
      )}
    </div>
  )
}
