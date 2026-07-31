/**
 * 执行测试仪表盘 - 专注执行进度追踪 + AI 辅助分析
 *
 * 展示执行列表的运行状态、通过率、进度条，
 * 提供 AI 智能分析每轮执行结果的能力。
 */
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Play, CheckCircle2, Clock, AlertTriangle, XCircle, ArrowRight, RefreshCw, BarChart3, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lifecycleApi, apiFetch } from "@/lib/api"
import AiAnalysisDialog from "./AiAnalysisDialog"

// ── 类型 ──────────────────────────────────────────────
interface Execution {
  id: number
  name: string
  status: string
  test_type?: string
  environment?: string
  total_cases?: number
  passed?: number
  failed?: number
  blocked?: number
  pass_rate?: number
  duration_ms?: number
  started_at?: string
  completed_at?: string
  created_by?: string
  [key: string]: any
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Play; color: string; bg: string }> = {
  passed: { label: "通过", icon: CheckCircle2, color: "text-pass", bg: "bg-emerald-50" },
  completed: { label: "完成", icon: CheckCircle2, color: "text-pass", bg: "bg-emerald-50" },
  running: { label: "运行中", icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
  pending: { label: "等待中", icon: Clock, color: "text-amber", bg: "bg-amber-50" },
  failed: { label: "失败", icon: XCircle, color: "text-fail", bg: "bg-red-50" },
  blocked: { label: "阻塞", icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50" },
}

interface Props {
  onBack: () => void
}

export default function ExecutionView({ onBack }: Props) {
  const navigate = useNavigate()
  const [items, setItems] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)

  // AI 分析对话框
  const [aiDialog, setAiDialog] = useState<{ exec: Execution } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await lifecycleApi.listExecutions()
      const list = res?.data?.items || res?.data || res?.items || []
      setItems(list)
    } catch (e) {
      console.warn("获取执行列表失败", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getStatusCfg = (status?: string) => {
    if (!status) return STATUS_CONFIG.pending
    const s = status.toLowerCase()
    return STATUS_CONFIG[s] || { label: status, icon: Clock, color: "text-ink-light", bg: "bg-gray-50" }
  }

  // 统计摘要
  const stats = {
    total: items.length,
    running: items.filter((i) => i.status?.toLowerCase() === "running").length,
    passed: items.filter((i) => ["passed", "completed"].includes(i.status?.toLowerCase())).length,
    failed: items.filter((i) => i.status?.toLowerCase() === "failed").length,
    avgPassRate: items.length > 0
      ? Math.round(items.reduce((s, i) => s + (i.pass_rate ?? 0), 0) / items.length)
      : 0,
  }

  /** 构建执行分析的 SSE fetch 函数 - 使用 AI 聊天接口分析执行结果 */
  const buildExecutionAnalysis = useCallback((exec: Execution) => {
    return async () => {
      const token = localStorage.getItem("access_token")
      const systemPrompt = `你是一个测试执行分析专家。请根据以下测试执行数据，提供分析报告：
1. 执行概况
2. 通过/失败分析
3. 风险点识别
4. 改进建议

请用中文回答，使用 Markdown 格式。`

      const userPrompt = `测试执行信息：
- 名称: ${exec.name}
- 状态: ${exec.status}
- 类型: ${exec.test_type || "未指定"}
- 环境: ${exec.environment || "未指定"}
- 总用例数: ${exec.total_cases || 0}
- 通过: ${exec.passed || 0}
- 失败: ${exec.failed || 0}
- 阻塞: ${exec.blocked || 0}
- 通过率: ${exec.pass_rate || 0}%
- 耗时: ${exec.duration_ms ? Math.round(exec.duration_ms / 1000) + "s" : "未知"}
- 开始时间: ${exec.started_at || "未知"}
- 完成时间: ${exec.completed_at || "未知"}`

      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: true,
        }),
      })
      return res
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-light">加载执行数据...</p>
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
          <h2 className="text-lg font-semibold text-ink">执行测试仪表盘</h2>
          <span className="text-xs text-ink-light bg-cream px-2 py-1 rounded-md">{items.length} 项</span>
        </div>
        <Button className="h-9 gradient-amber text-white text-sm shadow-sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" /> 刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
          <p className="text-xs text-ink-light mb-1">总计执行</p>
          <p className="text-2xl font-bold text-ink">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <p className="text-xs text-ink-light">运行中</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.running}</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-pass" />
            <p className="text-xs text-ink-light">已通过</p>
          </div>
          <p className="text-2xl font-bold text-pass">{stats.passed}</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-3.5 h-3.5 text-fail" />
            <p className="text-xs text-ink-light">失败</p>
          </div>
          <p className="text-2xl font-bold text-fail">{stats.failed}</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-amber" />
            <p className="text-xs text-ink-light">平均通过率</p>
          </div>
          <p className="text-2xl font-bold text-amber">{stats.avgPassRate}%</p>
        </div>
      </div>

      {/* 空状态 */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col items-center justify-center py-20">
          <Play className="w-12 h-12 text-ink-light opacity-30 mb-3" />
          <p className="text-sm font-medium text-ink">暂无执行记录</p>
          <p className="text-xs mt-1 text-ink-light">创建一个新的测试执行来开始</p>
        </div>
      ) : (
        /* 执行列表 */
        <div className="space-y-3">
          {items.map((exec) => {
            const sc = getStatusCfg(exec.status)
            const Icon = sc.icon
            const passRate = exec.pass_rate ?? 0
            const total = exec.total_cases ?? 0
            const passed = exec.passed ?? 0
            const failed = exec.failed ?? 0

            return (
              <div
                key={exec.id}
                className="bg-white rounded-2xl border border-border shadow-card p-4 hover:shadow-md hover:border-amber/20 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* 左侧信息 */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${sc.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${sc.color}`} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-ink truncate">{exec.name}</h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.color} font-medium`}>
                          {sc.label}
                        </span>
                        {exec.test_type && (
                          <span className="text-[10px] text-ink-light bg-cream px-1.5 py-0.5 rounded-full">
                            {exec.test_type}
                          </span>
                        )}
                        {exec.environment && (
                          <span className="text-[10px] text-ink-light bg-cream px-1.5 py-0.5 rounded-full">
                            {exec.environment}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 右侧进度 */}
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    {/* AI 分析按钮 */}
                    <button
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber/10 text-amber hover:bg-amber/20 text-xs font-medium transition-colors"
                      title="AI 分析执行结果"
                      onClick={() => setAiDialog({ exec })}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> 分析
                    </button>

                    {total > 0 && (
                      <div className="text-right min-w-[60px]">
                        <p className="text-xs text-ink-light">{passed}/{total}</p>
                        <div className="w-full h-1.5 bg-cream rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(passRate, 100)}%`,
                              backgroundColor: passRate >= 80 ? "#10B981" : passRate >= 50 ? "#F59E0B" : "#EF4444",
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="text-right min-w-[48px]">
                      <p className={`text-sm font-bold ${passRate >= 80 ? "text-pass" : passRate >= 50 ? "text-amber" : "text-fail"}`}>
                        {passRate}%
                      </p>
                      <p className="text-[10px] text-ink-light">通过率</p>
                    </div>
                  </div>
                </div>

                {/* 底部执行详情 */}
                <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-border/40 text-[10px] text-ink-light">
                  {exec.started_at && (
                    <span>开始: {new Date(exec.started_at).toLocaleString("zh-CN")}</span>
                  )}
                  {exec.duration_ms && (
                    <span>耗时: {Math.round(exec.duration_ms / 1000)}s</span>
                  )}
                  {exec.created_by && (
                    <span>执行人: {exec.created_by}</span>
                  )}
                  {failed > 0 && (
                    <span className="text-fail font-medium">失败 {failed} 条</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* AI 分析对话框 */}
      {aiDialog && (
        <AiAnalysisDialog
          title={`执行分析：${aiDialog.exec.name}`}
          fetchFn={buildExecutionAnalysis(aiDialog.exec)}
          onClose={() => setAiDialog(null)}
        />
      )}
    </div>
  )
}
