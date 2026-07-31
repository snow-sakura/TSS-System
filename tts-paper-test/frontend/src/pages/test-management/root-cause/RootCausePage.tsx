/**
 * AI根因分析页面
 */
import { useState, useCallback, useRef, useEffect } from "react"
import { Search, Sparkles, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/useToast"

interface DefectItem {
  id: number
  title: string
  severity: "critical" | "high" | "medium" | "low"
  status: "new" | "confirmed" | "fixing" | "fixed" | "closed"
}

const MOCK_DEFECTS: DefectItem[] = [
  { id: 1, title: "登录接口返回500错误", severity: "critical", status: "fixing" },
  { id: 2, title: "支付金额计算错误", severity: "high", status: "confirmed" },
  { id: 3, title: "页面加载慢超过5秒", severity: "medium", status: "new" },
  { id: 4, title: "手机端按钮点击无响应", severity: "high", status: "fixing" },
]

/** 严重度英文值 → 中文映射 */
const severityLabels: Record<string, string> = {
  critical: "致命",
  high: "严重",
  medium: "一般",
  low: "轻微",
}

/** 状态英文值 → 中文映射 */
const statusLabels: Record<string, string> = {
  new: "新建",
  confirmed: "已确认",
  fixing: "修复中",
  fixed: "已修复",
  closed: "已关闭",
}

const ANALYSIS_STEPS = [
  "正在分析缺陷描述...",
  "关联相关代码模块...",
  "检查历史类似缺陷...",
  "分析调用链路和依赖...",
  "综合根因分析...",
  "生成修复建议...",
]

const ANALYSIS_RESULT_TEMPLATE = `【根因分析】
该缺陷的根本原因可能是：
1. 数据库连接池配置不合理，高并发下连接耗尽
2. 异常处理未覆盖特定边界情况
3. 缓存策略缺失导致重复计算

【修复建议】
• 增加数据库连接池大小并设置超时
• 补充针对高并发场景的异常捕获
• 引入Redis缓存热点数据
• 添加降级和限流机制

【影响范围】
该问题影响所有使用该接口的用户，建议优先修复。`

export default function RootCausePage() {
  const toast = useToast()
  const [selectedDefect, setSelectedDefect] = useState<DefectItem | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string>("")
  const [analysisOutput, setAnalysisOutput] = useState<string>("")
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false })

  useEffect(() => {
    return () => { abortRef.current.aborted = true }
  }, [])

  const handleAnalyze = useCallback(async (defect: DefectItem) => {
    abortRef.current.aborted = false
    setSelectedDefect(defect)
    setAnalyzing(true)
    setAnalysisOutput("")
    setAnalysisResult("")

    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      if (abortRef.current.aborted) return
      await new Promise(r => setTimeout(r, 600))
      if (abortRef.current.aborted) return
      setAnalysisOutput(prev => prev + `\n💭 ${ANALYSIS_STEPS[i]}`)
    }

    if (abortRef.current.aborted) return
    setAnalysisResult(ANALYSIS_RESULT_TEMPLATE)
    setAnalyzing(false)
    toast?.success?.("根因分析完成")
  }, [toast])

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-ink">AI根因分析</h2>
        <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">智能分析缺陷根因</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：缺陷选择列表 */}
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
            <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
              {MOCK_DEFECTS.map((defect: DefectItem) => (
                <button
                  key={defect.id}
                  onClick={() => handleAnalyze(defect)}
                  className={`w-full text-left p-3 rounded-xl transition-colors ${
                    selectedDefect?.id === defect.id ? "bg-amber-50 border border-amber/20" : "hover:bg-cream border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      defect.severity === "critical" ? "bg-fail text-white" :
                      defect.severity === "high" ? "bg-fail/80 text-white" :
                      defect.severity === "medium" ? "bg-amber text-white" : "bg-cream text-muted"
                    }`}>
                      {severityLabels[defect.severity] || "一般"}
                    </span>
                    <span className="text-xs text-muted">{statusLabels[defect.status] || defect.status}</span>
                  </div>
                  <p className="text-sm font-medium text-ink line-clamp-2">{defect.title}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：分析结果 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-border shadow-card">
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
                <div className="bg-cream rounded-xl p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-ink-light whitespace-pre-wrap font-mono">
                    {analysisOutput}
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
                  <pre className="text-sm text-ink whitespace-pre-wrap">
                    {analysisResult}
                  </pre>
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                  <button className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream transition-colors">
                    忽略
                  </button>
                  <button className="h-9 px-4 rounded-xl bg-pass text-white text-sm font-medium shadow-sm hover:shadow-md transition-all">
                    采纳建议
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
