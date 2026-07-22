/**
 * AI生成报告 — 调用真实 API 生成 AI 智能报告
 */
import { useState } from "react"
import { Sparkles, Play, Loader2, FileText, Check, ChevronRight, Download, Eye, X, Bot, Zap, BarChart3, Brain } from "lucide-react"
import { toast } from "sonner"
import { lifecycleApi } from "@/lib/api"

const REPORT_TYPES = [
  { key: "version", label: "版本报告", desc: "自动生成当前版本的完整测试报告", icon: FileText, color: "from-sky-500 to-blue-600" },
  { key: "regression", label: "回归报告", desc: "汇总回归测试结果与趋势", icon: BarChart3, color: "from-emerald-500 to-green-600" },
  { key: "smoke", label: "冒烟报告", desc: "今日冒烟测试执行概况", icon: Zap, color: "from-amber to-orange-500" },
  { key: "quality", label: "质量评估", desc: "AI评估当前系统质量水平", icon: Sparkles, color: "from-violet-500 to-purple-600" },
]

const AI_STEPS = [
  { key: "collect", label: "收集数据", desc: "从测试用例、缺陷、执行记录中收集数据", icon: "📊" },
  { key: "analyze", label: "AI分析", desc: "大模型分析数据趋势和质量指标", icon: "🧠" },
  { key: "generate", label: "生成报告", desc: "根据分析结果自动撰写报告内容", icon: "📝" },
  { key: "review", label: "质量审核", desc: "AI自检报告内容的准确性和完整性", icon: "✅" },
]

export default function AiReport() {
  const [selectedType, setSelectedType] = useState("version")
  const [generating, setGenerating] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [generatedReport, setGeneratedReport] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    setGeneratedReport(null)

    // 模拟步骤动画
    for (let i = 0; i < AI_STEPS.length; i++) {
      setCurrentStep(i)
      // 真实步骤：收集 data -> AI analyze -> generate -> review
      if (i === 0) {
        // 第 1 步：快速演示用
        await new Promise((r) => setTimeout(r, 800))
      } else if (i === 1) {
        await new Promise((r) => setTimeout(r, 600))
      } else if (i === 2) {
        // 第 3 步才调用真实 API（让用户看到前两步的反馈）
        try {
          const res: any = await lifecycleApi.generateAiReport({
            report_type: selectedType,
          })
          setGeneratedReport(res?.data || res)
        } catch (e: any) {
          toast.error("AI 报告生成失败: " + (e?.message || ""))
          setGenerating(false)
          setCurrentStep(-1)
          return
        }
        await new Promise((r) => setTimeout(r, 300))
      } else {
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    setCurrentStep(-1)
    setGenerating(false)
    toast.success("AI 报告生成完成！")
  }

  // 格式化报告内容
  const reportContent = generatedReport ? buildReportContent(generatedReport) : null

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink flex items-center gap-2">AI生成报告 <Sparkles className="w-4 h-4 text-amber" /></h2>
        <p className="text-xs text-muted mt-0.5">AI自动收集数据 · 分析趋势 · 生成报告 · 质量审核</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* 左侧：配置 */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-border shadow-card p-5">
            <h3 className="text-sm font-semibold text-ink mb-3">选择报告类型</h3>
            <div className="grid grid-cols-2 gap-3">
              {REPORT_TYPES.map((t) => {
                const Icon = t.icon
                return (
                  <button key={t.key} onClick={() => setSelectedType(t.key)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      selectedType === t.key ? "border-amber bg-amber-50/50" : "border-border hover:border-amber/40"
                    }`}>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center shadow-sm mb-2`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm font-medium text-ink">{t.label}</p>
                    <p className="text-[11px] text-muted mt-0.5">{t.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border shadow-card p-5">
            <h3 className="text-sm font-semibold text-ink mb-3">AI生成流程</h3>
            <div className="space-y-3">
              {AI_STEPS.map((step, idx) => {
                const isActive = currentStep === idx
                const isDone = currentStep > idx || (generatedReport && currentStep === -1)
                return (
                  <div key={step.key}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isActive ? "bg-amber-50 border border-amber/20" :
                      isDone ? "bg-pass/5 border border-pass/10" : "bg-cream/30 border border-transparent"
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                      isActive ? "bg-amber text-white animate-pulse" : isDone ? "bg-pass text-white" : "bg-cream text-muted"
                    }`}>
                      {isDone ? <Check className="w-4 h-4" /> : <span>{step.icon}</span>}
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs font-medium ${isActive ? "text-amber" : isDone ? "text-pass" : "text-ink"}`}>{step.label}</p>
                      <p className="text-[10px] text-muted">{step.desc}</p>
                    </div>
                    {isActive && <Loader2 className="w-4 h-4 text-amber animate-spin" />}
                  </div>
                )
              })}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={generating}
            className="w-full h-11 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</> : <><Sparkles className="w-4 h-4" /> 开始生成</>}
          </button>
        </div>

        {/* 右侧：预览 */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink">报告预览</h3>
            {generatedReport && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPreview(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cream text-ink-light hover:bg-border transition-colors">
                  <Eye className="w-3 h-3" /> 全屏
                </button>
              </div>
            )}
          </div>

          {reportContent ? (
            <div className="flex-1 overflow-y-auto bg-cream/20 rounded-xl p-4">
              {/* AI 分析部分 */}
              {generatedReport.ai_analysis && (
                <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-amber-50 to-white border border-amber-200/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="w-4 h-4 text-amber" />
                    <span className="text-xs font-semibold text-amber">AI 分析</span>
                  </div>
                  {generatedReport.ai_analysis.execution_analysis && (
                    <div className="text-[11px] text-ink/70 mb-2">
                      <span className="font-medium text-ink">执行分析：</span>{generatedReport.ai_analysis.execution_analysis}
                    </div>
                  )}
                  {generatedReport.ai_analysis.defect_analysis && (
                    <div className="text-[11px] text-ink/70 mb-2">
                      <span className="font-medium text-ink">缺陷分析：</span>{generatedReport.ai_analysis.defect_analysis}
                    </div>
                  )}
                </div>
              )}

              {/* 指标卡片 */}
              {generatedReport.metrics && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {Object.entries(generatedReport.metrics).filter(([k]) => !k.includes("duration") && !k.includes("execution")).map(([key, val]) => (
                    <div key={key} className="p-2 rounded-lg bg-white border border-border/50 text-center">
                      <div className="text-[10px] text-muted uppercase">{key.replace(/_/g, " ")}</div>
                      <div className="text-sm font-bold text-ink">{typeof val === "number" ? (key.includes("rate") ? `${val}%` : val) : String(val)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 结论 */}
              {generatedReport.conclusion && (
                <div className="text-xs text-ink/70 leading-relaxed whitespace-pre-wrap">
                  <span className="font-semibold text-ink">结论：</span>
                  {generatedReport.conclusion}
                </div>
              )}

              {/* AI 质量评分 */}
              {generatedReport.ai_analysis?.quality_score && (
                <div className="mt-3 pt-3 border-t border-border">
                  <span className="text-[10px] font-medium text-muted">质量评分</span>
                  <div className="flex gap-2 mt-1">
                    {Object.entries(generatedReport.ai_analysis.quality_score).map(([k, v]) => (
                      <div key={k} className="flex-1 p-1.5 rounded-lg bg-white border border-border/30 text-center">
                        <div className="text-[9px] text-muted truncate">{k}</div>
                        <div className="text-xs font-bold" style={{ color: (v as number) >= 80 ? "#10b981" : (v as number) >= 60 ? "#f59e0b" : "#ef4444" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-muted-light" />
                <p className="text-sm font-medium">选择报告类型并点击生成</p>
                <p className="text-xs text-muted mt-1">AI将自动收集数据并生成报告</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 全屏预览 */}
      {showPreview && reportContent && (
        <div className="fixed inset-0 z-50 bg-white" onClick={() => setShowPreview(false)}>
          <div className="h-14 border-b border-border flex items-center justify-between px-6">
            <h3 className="text-sm font-bold text-ink">{generatedReport?.name || "AI 报告"}</h3>
            <button className="p-2 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
          </div>
          <div className="h-[calc(100vh-56px)] overflow-y-auto p-8 max-w-3xl mx-auto">
            <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{reportContent}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 从 API 响应构建报告 Markdown 内容 */
function buildReportContent(report: any): string {
  const lines: string[] = []
  lines.push(`# ${report.name || "测试报告"}`)
  lines.push("")

  // 摘要
  if (report.summary) {
    lines.push("## 测试概况")
    lines.push("")
    lines.push("| 指标 | 数值 |")
    lines.push("|------|------|")
    const s = report.summary
    lines.push(`| 执行次数 | ${s.execution_count || "-"} |`)
    lines.push(`| 总用例数 | ${s.total_cases || "-"} |`)
    lines.push(`| 通过 | ${s.passed || "-"} |`)
    lines.push(`| 失败 | ${s.failed || "-"} |`)
    lines.push(`| 阻塞 | ${s.blocked || "-"} |`)
    lines.push(`| 通过率 | ${s.pass_rate ?? "-"}% |`)
    lines.push(`| 缺陷总数 | ${s.total_defects || "-"} |`)
    lines.push(`| 未解决缺陷 | ${s.open_defects || "-"} |`)
    lines.push(`| 严重缺陷 | ${s.critical_defects || "-"} |`)
    lines.push("")
  }

  // 指标
  if (report.metrics) {
    lines.push("## 质量指标")
    lines.push("")
    const m = report.metrics
    lines.push(`- **通过率**: ${m.pass_rate ?? "-"}%`)
    lines.push(`- **缺陷修复率**: ${m.defect_fix_rate ?? "-"}%`)
    lines.push(`- **自动化率**: ${m.automation_rate ?? "-"}%`)
    lines.push("")
  }

  // AI 分析
  if (report.ai_analysis) {
    lines.push("## AI 分析")
    lines.push("")
    const a = report.ai_analysis
    if (a.execution_analysis) lines.push(`### 执行分析\n\n${a.execution_analysis}\n`)
    if (a.defect_analysis) lines.push(`### 缺陷分析\n\n${a.defect_analysis}\n`)
    if (a.quality_summary) lines.push(`### 质量总结\n\n${a.quality_summary}\n`)

    if (a.risk_warnings?.length) {
      lines.push("### 风险警告")
      a.risk_warnings.forEach((r: string) => lines.push(`- ⚠️ ${r}`))
      lines.push("")
    }
    if (a.strengths?.length) {
      lines.push("### 优势")
      a.strengths.forEach((s: string) => lines.push(`- ✅ ${s}`))
      lines.push("")
    }
  }

  // 结论
  if (report.conclusion) {
    lines.push("## 结论\n")
    lines.push(report.conclusion)
    lines.push("")
  }

  // 建议
  if (report.recommendations) {
    lines.push("## 建议")
    lines.push("")
    const r = report.recommendations
    if (r.immediate_actions?.length) {
      lines.push("### 立即可执行")
      r.immediate_actions.forEach((a: string) => lines.push(`- ${a}`))
      lines.push("")
    }
    if (r.improvement_suggestions?.length) {
      lines.push("### 改进建议")
      r.improvement_suggestions.forEach((s: string) => lines.push(`- ${s}`))
      lines.push("")
    }
    if (r.focus_areas?.length) {
      lines.push("### 重点关注")
      r.focus_areas.forEach((f: string) => lines.push(`- ${f}`))
      lines.push("")
    }
  }

  return lines.join("\n")
}
