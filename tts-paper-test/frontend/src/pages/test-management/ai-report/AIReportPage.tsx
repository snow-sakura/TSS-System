/**
 * AI生成报告页面
 */
import { useState, useCallback, useRef, useEffect } from "react"
import { Sparkles, FileText, Download, Eye, Loader2, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/useToast"

type ReportType = "full" | "summary" | "defect" | "quality"

const GENERATION_STEPS = [
  "正在收集测试数据...",
  "分析执行结果和通过率...",
  "汇总缺陷统计数据...",
  "计算质量指标...",
  "生成报告结构...",
  "填充报告内容...",
  "添加图表和建议...",
  "报告生成完成！",
]

const REPORT_TYPES: { key: ReportType; label: string; desc: string }[] = [
  { key: "full", label: "完整测试报告", desc: "包含所有测试数据的完整报告" },
  { key: "summary", label: "测试摘要报告", desc: "精简版测试结果摘要" },
  { key: "defect", label: "缺陷分析报告", desc: "专注于缺陷统计和分析" },
  { key: "quality", label: "质量度量报告", desc: "质量指标和改进建议" },
]

const generateReportTemplate = (name: string, type: ReportType): string => {
  const typeSections: Record<ReportType, string> = {
    full: `## 一、测试概述
- 测试类型: 功能测试 + 接口测试
- 执行周期: 2026-07-01 ~ 2026-07-28
- 测试范围: 用户管理模块、权限管理模块、数据管理模块

## 二、执行统计
- 总用例数: 156
- 通过: 132 (84.6%)
- 失败: 18 (11.5%)
- 阻塞: 6 (3.9%)

## 三、缺陷统计
- 总缺陷数: 42
- 致命: 3 (建议立即修复)
- 严重: 8 (建议本次迭代修复)
- 一般: 22 (可排期修复)
- 轻微: 9 (记录跟踪)

## 四、质量指标
- 代码覆盖率: 78.5%
- 接口通过率: 92.1%
- 性能达标率: 88.3%
- 安全扫描通过率: 95.2%

## 五、风险评估
当前版本存在 3 个致命缺陷，建议在发布前必须修复。整体通过率 84.6%，建议补充边界条件测试。

## 六、建议
1. 优先修复3个致命缺陷后进行回归测试
2. 补充性能测试用例，特别是大数据量场景
3. 加强接口异常处理的测试覆盖
4. 建议引入自动化测试框架`,

    summary: `## 测试摘要
- 总用例数: 156
- 通过率: 84.6%
- 缺陷数: 42
- 修复率: 92.3%
- 质量评分: 87.5/100

## 关键发现
1. 核心功能稳定，通过率 84.6%
2. 存在 3 个致命缺陷需紧急处理
3. 自动化覆盖率有待提升

## 行动建议
- 修复致命缺陷 → 回归测试 → 发布`,

    defect: `## 缺陷分析报告

### 缺陷概览
- 总缺陷数: 42
- 致命: 3 (7.1%)
- 严重: 8 (19.0%)
- 一般: 22 (52.4%)
- 轻微: 9 (21.5%)

### 趋势分析
- 新增缺陷: 12个/周
- 修复速度: 10个/周
- 平均修复时长: 2.4天

### 高风险缺陷
1. 登录接口500错误 - 数据库连接池耗尽
2. 支付金额计算错误 - 浮点数精度问题
3. 权限校验绕过 - 接口未做二次校验`,

    quality: `## 质量度量报告

### 核心指标
| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| 测试覆盖率 | 78.5% | 80% | ⚠️ 接近 |
| 用例通过率 | 84.6% | 90% | ⚠️ 待提升 |
| 缺陷修复率 | 92.3% | 95% | ✅ 达标 |
| 自动化率 | 65.2% | 70% | ⚠️ 接近 |
| 安全评分 | 95.2 | 95 | ✅ 达标 |
| 性能评分 | 88.3 | 90 | ⚠️ 待提升 |

### 改进建议
1. 补充边界条件测试用例
2. 增加UI自动化测试覆盖
3. 优化接口性能，减少响应时间`,
  }
  return `# 测试报告 - ${name || "自动生成"}\n\n${typeSections[type]}`
}

export default function AIReportPage() {
  const toast = useToast()
  const [generating, setGenerating] = useState(false)
  const [reportType, setReportType] = useState<ReportType>("full")
  const [reportName, setReportName] = useState("")
  const [generatedReport, setGeneratedReport] = useState<string>("")
  const [generationProgress, setGenerationProgress] = useState<string>("")
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false })

  useEffect(() => {
    return () => { abortRef.current.aborted = true }
  }, [])

  const handleGenerate = useCallback(async () => {
    abortRef.current.aborted = false
    setGenerating(true)
    setGeneratedReport("")
    setGenerationProgress("")

    for (let i = 0; i < GENERATION_STEPS.length; i++) {
      if (abortRef.current.aborted) return
      await new Promise(r => setTimeout(r, 500))
      if (abortRef.current.aborted) return
      setGenerationProgress(prev => prev + `\n${i + 1}. ${GENERATION_STEPS[i]}`)
    }

    if (abortRef.current.aborted) return
    const report = generateReportTemplate(reportName, reportType)
    setGeneratedReport(report)
    setGenerating(false)
    toast?.success?.("报告生成完成")
  }, [reportName, reportType, toast])

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-ink">AI生成报告</h2>
        <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">
          一键生成专业测试报告
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：配置区 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-border shadow-card p-4">
            <h3 className="text-sm font-semibold text-ink mb-4">报告配置</h3>

            {/* 报告类型 */}
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

            {/* 报告名称 */}
            <div className="mb-4">
              <label className="text-xs font-medium text-muted mb-2 block">报告名称（可选）</label>
              <input
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                placeholder="留空则自动生成"
                className="w-full h-10 px-3 text-sm bg-cream border border-border rounded-xl input-focus"
              />
            </div>

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-amber to-orange-500 text-white text-sm font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI 生成报告
                </>
              )}
            </button>

            <p className="text-xs text-muted mt-3 text-center">
              生成的报告将自动汇总所有测试数据
            </p>
          </div>
        </div>

        {/* 右侧：预览区 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-border shadow-card min-h-[500px]">
            {generating ? (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="w-5 h-5 text-amber animate-spin" />
                  <div>
                    <h3 className="text-sm font-semibold text-ink">AI 生成中...</h3>
                    <p className="text-xs text-muted">正在生成测试报告</p>
                  </div>
                </div>
                <div className="bg-cream rounded-xl p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-ink-light whitespace-pre-wrap font-mono">
                    {generationProgress}
                    <span className="animate-pulse">▊</span>
                  </pre>
                </div>
              </div>
            ) : generatedReport ? (
              <div>
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-pass" />
                    <span className="text-sm font-semibold text-ink">报告预览</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="h-8 px-3 rounded-lg border border-border text-xs hover:bg-cream transition-colors flex items-center gap-1">
                      <Eye className="w-3 h-3" /> 预览
                    </button>
                    <button className="h-8 px-3 rounded-lg bg-pass text-white text-xs font-medium hover:shadow-sm transition-all flex items-center gap-1">
                      <Download className="w-3 h-3" /> 下载
                    </button>
                  </div>
                </div>
                <div className="p-6 max-h-[500px] overflow-y-auto">
                  <pre className="text-sm text-ink whitespace-pre-wrap font-sans leading-relaxed">
                    {generatedReport}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-amber" />
                </div>
                <p className="text-sm font-medium text-ink mb-1">选择报告类型并点击生成</p>
                <p className="text-xs text-muted">AI将自动汇总测试数据生成报告</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
