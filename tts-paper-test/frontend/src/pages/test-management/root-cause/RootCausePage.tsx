/**
 * AI根因分析页面 — 缺陷列表与 AI 分析均接后端真实接口
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { Search, Sparkles, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import { lifecycleApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"

interface DefectItem {
  id: number
  title: string
  severity: string
  status: string
}

/** 严重度/状态 英文值 → 中文映射 */
const severityLabels: Record<string, string> = {
  critical: "致命", high: "严重", major: "严重", medium: "一般", minor: "轻微", low: "轻微",
}
const statusLabels: Record<string, string> = {
  new: "新建", open: "打开", confirmed: "已确认", in_progress: "处理中", fixing: "修复中", fixed: "已修复", closed: "已关闭",
}

const severityColor = (severity: string): string => {
  if (severity === "critical") return "bg-fail text-white"
  if (["high", "major"].includes(severity)) return "bg-fail/80 text-white"
  if (severity === "medium") return "bg-amber text-white"
  return "bg-cream text-muted"
}

/** 后端分析结果 dict → Markdown 呈现 */
function analysisToMarkdown(a: Record<string, any>): string {
  if (!a) return "（无分析结果）"
  const lines: string[] = []
  if (a.root_cause) lines.push(`## 根因分析\n${a.root_cause}`)
  if (a.category) lines.push(`- **问题类别**：${a.category}`)
  if (a.impact) lines.push(`- **影响范围**：${a.impact}`)
  if (a.fix_suggestion) lines.push(`## 修复建议\n${a.fix_suggestion}`)
  if (a.prevention) lines.push(`## 预防措施\n${a.prevention}`)
  if (Array.isArray(a.related_modules) && a.related_modules.length) {
    lines.push(`## 关联模块\n${a.related_modules.join("、")}`)
  }
  return lines.join("\n\n") || "（无分析结果）"
}

export default function RootCausePage() {
  const toast = useToast()
  const [defects, setDefects] = useState<DefectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDefect, setSelectedDefect] = useState<DefectItem | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string>("")
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false })

  useEffect(() => {
    return () => { abortRef.current.aborted = true }
  }, [])

  const loadDefects = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await lifecycleApi.listDefects()
      setDefects(Array.isArray(data) ? data : (data?.items ?? []))
    } catch (e) {
      toast?.error?.("加载缺陷列表失败")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadDefects() }, [loadDefects])

  const handleAnalyze = useCallback(async (defect: DefectItem) => {
    abortRef.current.aborted = false
    setSelectedDefect(defect)
    setAnalyzing(true)
    setAnalysisResult("")

    try {
      const { data } = await lifecycleApi.aiAnalyzeDefect(defect.id)
      if (abortRef.current.aborted) return
      setAnalysisResult(analysisToMarkdown(data || {}))
      toast?.success?.("根因分析完成")
    } catch (e) {
      if (abortRef.current.aborted) return
      toast?.error?.("AI 根因分析失败")
    } finally {
      if (!abortRef.current.aborted) setAnalyzing(false)
    }
  }, [toast])

  return (
    <div className="p-4 md:p-6">
      {/* 页头：标题 + 说明 + 主操作（统一布局） */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink">AI根因分析</h2>
          <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">共 {defects.length} 条缺陷</span>
        </div>
        <button
          onClick={() => { setSelectedDefect(null); setAnalysisResult(""); loadDefects() }}
          className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream transition-colors flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4" /> 刷新列表
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：真实缺陷列表 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-ink mb-3">选择缺陷</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  placeholder="搜索缺陷..."
                  className="w-full h-9 pl-9 pr-3 text-sm bg-cream border border-border rounded-xl input-focus"
                />
              </div>
            </div>
            <div className="p-3 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-xs text-muted">加载中...</div>
              ) : defects.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted">暂无缺陷数据</div>
              ) : defects.map(defect => (
                <button
                  key={defect.id}
                  onClick={() => handleAnalyze(defect)}
                  className={`w-full text-left p-3 rounded-xl transition-colors ${
                    selectedDefect?.id === defect.id ? "bg-amber-50 border border-amber/20" : "hover:bg-cream border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${severityColor(defect.severity)}`}>
                      {severityLabels[defect.severity] || defect.severity}
                    </span>
                    <span className="text-xs text-muted">{statusLabels[defect.status] || defect.status}</span>
                  </div>
                  <p className="text-sm font-medium text-ink line-clamp-2">{defect.title}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：AI 分析结果 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-border shadow-card min-h-[420px]">
            {!selectedDefect && !analyzing ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-amber" />
                </div>
                <p className="text-sm font-medium text-ink mb-1">选择一个缺陷开始分析</p>
                <p className="text-xs text-muted">AI将智能分析缺陷根因并给出修复建议</p>
              </div>
            ) : analyzing ? (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="w-5 h-5 text-amber animate-spin" />
                  <div>
                    <h3 className="text-sm font-semibold text-ink">AI 分析中...</h3>
                    <p className="text-xs text-muted">{selectedDefect?.title}</p>
                  </div>
                </div>
                <div className="bg-cream rounded-xl p-4">
                  <pre className="text-sm text-ink-light whitespace-pre-wrap font-mono">
                    💭 正在调用 AI 引擎分析缺陷根因...
                    <span className="animate-pulse">▊</span>
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pass/10 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-pass" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">分析完成</h3>
                      <p className="text-xs text-muted">{selectedDefect?.title}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { if (selectedDefect) handleAnalyze(selectedDefect) }}
                    className="h-8 px-3 rounded-lg border border-border text-xs hover:bg-cream transition-colors"
                  >
                    重新分析
                  </button>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-amber" />
                    <span className="text-sm font-semibold text-amber">AI 分析结果</span>
                  </div>
                  <MarkdownPreview content={analysisResult} maxHeight={440} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}