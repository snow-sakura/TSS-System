/**
 * AI生成报告页面 — 调用后端 /reports/generate 真实聚合数据 + AI 生成
 */
import { useState, useCallback, useRef, useEffect } from "react"
import { Sparkles, FileText, Loader2, CheckCircle, RefreshCw } from "lucide-react"
import { lifecycleApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"

type ReportType = "version" | "regression" | "quality" | "daily"

const REPORT_TYPES: { key: ReportType; label: string; desc: string }[] = [
  { key: "version", label: "版本测试报告", desc: "聚合执行/缺陷/用例数据的完整报告" },
  { key: "regression", label: "回归测试报告", desc: "聚焦回归执行结果与风险" },
  { key: "quality", label: "质量评估报告", desc: "质量指标分析与改进建议" },
  { key: "daily", label: "测试日报", desc: "当日执行与缺陷动态摘要" },
]

/** 将后端报告结构转换为 Markdown 展示 */
function reportToMarkdown(r: Record<string, any>): string {
  const s: Record<string, any> = r.summary || {}
  const m: Record<string, any> = r.metrics || {}
  const ai: Record<string, any> = r.ai_analysis || {}
  const lines: string[] = []

  lines.push(`# ${r.name || "测试报告"}（${r.report_type || ""}）`)

  lines.push("## 数据概览")
  lines.push("| 指标 | 数值 |")
  lines.push("|------|------|")
  const summaryRows: [string, any][] = [
    ["执行记录数", s.execution_count], ["用例总数", s.total_cases],
    ["通过", s.passed], ["失败", s.failed], ["阻塞", s.blocked],
    ["通过率", s.pass_rate != null ? `${s.pass_rate}%` : null],
    ["缺陷总数", s.total_defects], ["未关闭缺陷", s.open_defects],
    ["已解决缺陷", s.resolved_defects], ["致命缺陷", s.critical_defects],
    ["严重缺陷", s.major_defects], ["测试用例总量", s.total_test_cases],
    ["AI生成用例", s.ai_generated_cases],
  ]
  summaryRows.forEach(([k, v]) => { if (v != null) lines.push(`| ${k} | ${v} |`) })

  lines.push("## 质量指标")
  lines.push("| 指标 | 数值 |")
  lines.push("|------|------|")
  const metricRows: [string, any][] = [
    ["通过率", m.pass_rate != null ? `${m.pass_rate}%` : null],
    ["缺陷修复率", m.defect_fix_rate != null ? `${m.defect_fix_rate}%` : null],
    ["自动化率", m.automation_rate != null ? `${m.automation_rate}%` : null],
    ["执行次数", m.total_executions], ["平均耗时(ms)", m.avg_duration_ms],
  ]
  metricRows.forEach(([k, v]) => { if (v != null) lines.push(`| ${k} | ${v} |`) })

  if (Object.keys(ai).length > 0) {
    lines.push("## AI 分析")
    lines.push("| 维度 | 内容 |")
    lines.push("|------|------|")
    Object.entries(ai).forEach(([k, v]) => {
      const val = typeof v === "object" ? JSON.stringify(v) : String(v)
      lines.push(`| ${k} | ${val.replace(/\n/g, " ")} |`)
    })
  }

  if (r.conclusion) lines.push(`## 结论\n${r.conclusion}`)

  const rec: Record<string, any> = r.recommendations || {}
  if (Object.keys(rec).length > 0) {
    lines.push("## 建议")
    Object.entries(rec).forEach(([k, v]) => {
      const val = Array.isArray(v)
        ? v.map((x: any) => `- ${x}`).join("\n")
        : typeof v === "object" ? JSON.stringify(v) : String(v)
      lines.push(`### ${k}\n${val}`)
    })
  }

  return lines.join("\n\n")
}

export default function AIReportPage() {
  const toast = useToast()
  const [generating, setGenerating] = useState(false)
  const [reportType, setReportType] = useState<ReportType>("version")
  const [reportName, setReportName] = useState("")
  const [generatedReport, setGeneratedReport] = useState<string>("")
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false })

  useEffect(() => {
    return () => { abortRef.current.aborted = true }
  }, [])

  const handleGenerate = useCallback(async () => {
    abortRef.current.aborted = false
    setGenerating(true)
    setGeneratedReport("")
    try {
      const { data } = await lifecycleApi.generateAiReport({
        report_type: reportType,
        name: reportName || undefined,
      })
      if (abortRef.current.aborted) return
      setGeneratedReport(reportToMarkdown(data || {}))
      toast?.success?.("报告生成完成")
    } catch (e) {
      if (abortRef.current.aborted) return
      toast?.error?.("报告生成失败，请稍后重试")
    } finally {
      if (!abortRef.current.aborted) setGenerating(false)
    }
  }, [reportType, reportName, toast])

  return (
    <div className="p-4 md:p-6">
      {/* 页头：标题 + 说明 + 主操作（统一布局） */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink">AI生成报告</h2>
          <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">真实数据聚合 + AI 分析</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：配置区 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-border shadow-card p-4">
            <h3 className="text-sm font-semibold text-ink mb-4">报告配置</h3>

            <div className="mb-4">
              <label className="text-xs font-medium text-muted mb-2 block">报告类型</label>
              <div className="space-y-2">
                {REPORT_TYPES.map(type => (
                  <button
                    key={type.key}
                    onClick={() => setReportType(type.key)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      reportType === type.key
                        ? "border-amber bg-amber-50"
                        : "border-border hover:bg-cream"
                    }`}
                  >
                    <p className="text-sm font-medium text-ink">{type.label}</p>
                    <p className="text-xs text-muted">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-muted mb-2 block">报告名称（可选）</label>
              <input
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                placeholder="留空则自动生成"
                className="w-full h-10 px-3 text-sm bg-cream border border-border rounded-xl input-focus"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`w-full h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                generating
                  ? "bg-cream text-muted cursor-not-allowed"
                  : "bg-amber text-white shadow-sm hover:shadow-md"
              }`}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "生成中..." : "生成报告"}
            </button>
          </div>
        </div>

        {/* 右侧：报告预览 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-border shadow-card min-h-[420px]">
            {!generatedReport && !generating ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-amber" />
                </div>
                <p className="text-sm font-medium text-ink mb-1">配置报告并点击生成</p>
                <p className="text-xs text-muted">AI 将聚合执行、缺陷、用例数据生成报告</p>
              </div>
            ) : generating ? (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="w-5 h-5 text-amber animate-spin" />
                  <div>
                    <h3 className="text-sm font-semibold text-ink">AI 报告生成中...</h3>
                    <p className="text-xs text-muted">正在聚合测试数据并调用 AI 引擎</p>
                  </div>
                </div>
                <div className="bg-cream rounded-xl p-4">
                  <pre className="text-sm text-ink-light whitespace-pre-wrap font-mono">
                    💭 收集执行与缺陷数据 → 计算质量指标 → 生成报告...
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
                      <h3 className="text-sm font-semibold text-ink">报告已生成</h3>
                      <p className="text-xs text-muted">已写入报告列表（状态：草稿）</p>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerate}
                    className="h-8 px-3 rounded-lg border border-border text-xs hover:bg-cream transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> 重新生成
                  </button>
                </div>
                <div className="bg-cream rounded-xl p-4 border border-border">
                  <MarkdownPreview content={generatedReport} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}