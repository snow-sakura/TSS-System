/**
 * 测试生命周期流水线 - 连接真实API的阶段汇总视图
 */
import { useState, useMemo, useEffect, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { lifecycleStages } from "@/lib/modules"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft, ArrowRight, Sparkles, FileText, ClipboardList, Target,
  FlaskConical, Bug, BarChart3, CheckCircle, Play, ExternalLink,
  Search, Loader2, Plus, Eye, Edit, Trash2, RefreshCw
} from "lucide-react"
import { toast } from "sonner"
import { lifecycleApi } from "@/lib/api"

// 阶段对应的API方法映射
const STAGE_API_MAP: Record<string, (params?: any) => Promise<any>> = {
  "test-review": (p) => lifecycleApi.listTestCases(p),
  "executions": (p) => lifecycleApi.listExecutions(p),
  "defects": (p) => lifecycleApi.listDefects(p),
  "reports": (p) => lifecycleApi.listReports(p),
}

// 阶段列定义
const stageColumnDefs: Record<string, { key: string; label: string }[]> = {
  "test-review": [
    { key: "name", label: "用例名称" },
    { key: "status", label: "评审状态" },
    { key: "priority", label: "优先级" },
    { key: "reviewer", label: "评审人" },
  ],
  "executions": [
    { key: "name", label: "执行名称" },
    { key: "status", label: "状态" },
    { key: "priority", label: "优先级" },
  ],
  "defects": [
    { key: "title", label: "缺陷标题" },
    { key: "status", label: "状态" },
    { key: "priority", label: "优先级" },
    { key: "severity", label: "严重程度" },
  ],
  "reports": [
    { key: "title", label: "报告名称" },
    { key: "status", label: "状态" },
    { key: "type", label: "类型" },
    { key: "coverage", label: "覆盖率" },
  ],
}

// 前5个阶段已整合为「需求测试」全流程
const integratedStages = ["requirements", "test-plans", "test-points", "test-cases", "test-review"]

export default function TestLifecyclePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const stages = lifecycleStages
  const [currentStageIdx, setCurrentStageIdx] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [stageData, setStageData] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const stageParam = searchParams.get("stage")
    if (stageParam) {
      const idx = stages.findIndex((s) => s.key === stageParam)
      if (idx >= 0) setCurrentStageIdx(idx)
    }
  }, [searchParams, stages])

  const currentStage = stages[currentStageIdx]
  const stageKey = currentStage?.key ?? "requirements"
  const isIntegrated = integratedStages.includes(stageKey)
  const columns = stageColumnDefs[stageKey] || []

  // 加载阶段数据
  const fetchStageData = useCallback(async (key: string) => {
    const apiMethod = STAGE_API_MAP[key]
    if (!apiMethod) return

    setLoading((prev) => ({ ...prev, [key]: true }))
    try {
      const res: any = await apiMethod({ page: 1, page_size: 100 })
      const items = res?.data?.items || res?.data || []
      setStageData((prev) => ({ ...prev, [key]: Array.isArray(items) ? items : [] }))
    } catch (e) {
      console.warn(`Failed to fetch ${key}:`, e)
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }))
    }
  }, [])

  // 当切换阶段时加载数据
  useEffect(() => {
    if (!isIntegrated && STAGE_API_MAP[stageKey] && !stageData[stageKey]) {
      fetchStageData(stageKey)
    }
  }, [stageKey, isIntegrated, fetchStageData, stageData])

  const data = stageData[stageKey] || []

  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    return data.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [data, searchTerm])

  const stats = useMemo(() => {
    const total = data.length
    const draft = data.filter((r) => ["草稿", "新建", "待执行", "待评审", "pending", "draft"].includes(r.status?.toLowerCase?.() || r.status)).length
    const completed = data.filter((r) =>
      ["已完成", "已通过", "已发布", "已解决", "已关闭", "completed", "passed"].includes(r.status?.toLowerCase?.() || r.status)
    ).length
    const inProgress = data.filter((r) =>
      ["执行中", "处理中", "running", "in_progress"].includes(r.status?.toLowerCase?.() || r.status)
    ).length
    return { total, draft, completed, inProgress, progress: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [data])

  const hasPrev = currentStageIdx > 0
  const hasNext = currentStageIdx < stages.length - 1

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase?.() || status
    if (["已完成", "已通过", "已发布", "已解决", "已关闭", "completed", "passed"].includes(s)) return "bg-pass/10 text-pass border border-pass/20"
    if (["执行中", "处理中", "running", "in_progress"].includes(s)) return "bg-amber-light text-warn border border-amber/20"
    if (["新建", "待执行", "待评审", "pending", "draft", "new"].includes(s)) return "bg-cream text-muted border border-border"
    return "bg-cream text-muted border border-border"
  }

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    if (["P0", "紧急", "urgent"].includes(priority)) return "text-fail"
    if (["P1", "高", "high"].includes(priority)) return "text-amber-hover"
    if (["P2", "中", "medium"].includes(priority)) return "text-info"
    return "text-muted"
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group">
            <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
            <span className="text-xs font-medium text-ink-light group-hover:text-ink transition-colors hidden sm:block">返回</span>
          </button>
          <div className="h-8 w-px bg-border/60" />
          <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md">
            <Play className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>测试生命周期流水线</h1>
            <p className="text-[11px] text-muted truncate">{stages.map((s) => s.label).join(" → ")}</p>
          </div>
        </div>
      </div>

      {/* 阶段进度条 */}
      <div className="bg-white border-b border-border px-4 md:px-8 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          {stages.map((stage, idx) => {
            const isActive = idx === currentStageIdx
            const isPast = idx < currentStageIdx
            return (
              <button
                key={stage.key}
                onClick={() => setCurrentStageIdx(idx)}
                className={`flex flex-col items-center gap-1.5 group relative transition-all duration-300 ${isActive ? "scale-105" : "opacity-70 hover:opacity-100"}`}
              >
                {idx > 0 && <div className={`absolute -left-[calc(50%+20px)] top-3.5 w-[calc(100%+10px)] h-[2px] ${isPast ? "bg-amber" : "bg-border"}`} />}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isActive ? "gradient-amber text-white shadow-lg shadow-amber/30 scale-110" : isPast ? "bg-amber text-white" : "bg-cream text-ink-light border border-border"}`}>
                  <span className="text-xs font-bold">{idx + 1}</span>
                </div>
                <span className={`text-[11px] font-medium whitespace-nowrap ${isActive ? "text-ink font-semibold" : "text-ink-light"}`}>{stage.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
          {/* 阶段头部 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${currentStage.gradient} flex items-center justify-center shadow-md`}>
                {stageKey === "requirements" && <FileText className="w-6 h-6 text-white" />}
                {stageKey === "test-plans" && <ClipboardList className="w-6 h-6 text-white" />}
                {stageKey === "test-points" && <Target className="w-6 h-6 text-white" />}
                {stageKey === "test-cases" && <FlaskConical className="w-6 h-6 text-white" />}
                {stageKey === "executions" && <Play className="w-6 h-6 text-white" />}
                {stageKey === "defects" && <Bug className="w-6 h-6 text-white" />}
                {stageKey === "reports" && <BarChart3 className="w-6 h-6 text-white" />}
                {stageKey === "test-review" && <CheckCircle className="w-6 h-6 text-white" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink">{currentStage.label}</h2>
                <p className="text-sm text-ink-light">{currentStage.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isIntegrated ? (
                <Button onClick={() => navigate("/requirement-testing")} className="h-9 px-4 text-white text-sm shadow-sm gradient-amber hover:shadow-md">
                  <ExternalLink className="w-4 h-4 mr-1.5" /> 打开全流程详情
                </Button>
              ) : (
                <Button variant="outline" className="h-9 border-border text-ink-light text-sm hover:bg-cream" onClick={() => fetchStageData(stageKey)}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading[stageKey] ? "animate-spin" : ""}`} /> 刷新
                </Button>
              )}
            </div>
          </div>

          {/* 如果是前5个阶段，显示引导卡片 */}
          {isIntegrated && (
            <div className="mb-6 px-5 py-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-amber-900">全流程自动化已整合</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    「需求分析 → 规划方案 → 提取测试点 → 用例生成 → 用例评审」五个阶段已整合为统一的流水线页面，
                    支持一键全流程执行、实时流式输出、流程图状态追踪。
                  </p>
                  <Button onClick={() => navigate("/requirement-testing")} className="mt-3 h-8 px-4 text-sm text-white gradient-amber hover:shadow-md">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> 进入全流程
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 阶段6-8: 统计卡片 */}
          {!isIntegrated && data.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-500" /></div>
                  <div><p className="text-xs text-ink-light">总计</p><p className="text-xl font-bold text-ink">{stats.total}</p></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Loader2 className="w-5 h-5 text-amber" /></div>
                  <div><p className="text-xs text-ink-light">进行中</p><p className="text-xl font-bold text-ink">{stats.inProgress}</p></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-pass" /></div>
                  <div><p className="text-xs text-ink-light">已完成</p><p className="text-xl font-bold text-ink">{stats.completed}</p></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-purple-500" /></div>
                  <div><p className="text-xs text-ink-light">完成率</p><p className="text-xl font-bold text-ink">{stats.progress}%</p></div>
                </div>
              </div>
            </div>
          )}

          {/* 阶段5-8: 搜索+表格 */}
          {!isIntegrated && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    placeholder={`搜索${currentStage.label}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"
                  />
                </div>
              </div>

              {loading[stageKey] ? (
                <div className="bg-white rounded-2xl border border-border shadow-card flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-amber mr-2" /> 加载中...
                </div>
              ) : filteredData.length === 0 ? (
                <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col items-center justify-center py-20">
                  <p className="text-sm font-medium text-ink">{searchTerm ? "没有匹配的数据" : "暂无数据"}</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-cream/50">
                        <th className="text-center px-4 py-3 text-xs font-semibold text-ink-light w-16">ID</th>
                        {columns.map((col) => (
                          <th key={col.key} className="text-center px-4 py-3 text-xs font-semibold text-ink-light">{col.label}</th>
                        ))}
                        <th className="text-center px-4 py-3 text-xs font-semibold text-ink-light w-28">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row: any) => (
                        <tr key={row.id} className="border-b border-border/50 last:border-0 transition-colors hover:bg-cream/50">
                          <td className="px-4 py-3.5 text-sm text-ink-light text-center">{row.id}</td>
                          {columns.map((col) => {
                            const val = row[col.key] || row[`${col.key}_name`] || "-"
                            if (col.key === "status") {
                              return <td key={col.key} className="px-4 py-3.5 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(val)}`}>{val}</span></td>
                            }
                            if (col.key === "priority") {
                              return <td key={col.key} className="px-4 py-3.5 text-center"><span className={`text-xs font-semibold ${getPriorityColor(val)}`}>{val}</span></td>
                            }
                            if (col.key === "severity") {
                              const s = val?.toLowerCase?.() || val
                              const cls = s === "严重" || s === "critical" ? "text-fail bg-fail/10" : s === "一般" || s === "medium" ? "text-warn bg-amber-light" : "text-info bg-info/10"
                              return <td key={col.key} className="px-4 py-3.5 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{val}</span></td>
                            }
                            return <td key={col.key} className="px-4 py-3.5 text-sm text-ink-light text-center truncate max-w-[200px]" title={String(val)}>{val}</td>
                          })}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => { toast(`查看: ${row.name || row.title || row.id}`) }} className="p-1.5 rounded-md hover:bg-cream transition-colors"><Eye className="w-4 h-4 text-ink-light" /></button>
                              <button onClick={() => { toast(`编辑: ${row.name || row.title || row.id}`) }} className="p-1.5 rounded-md hover:bg-cream transition-colors"><Edit className="w-4 h-4 text-ink-light" /></button>
                              <button onClick={() => { if (confirm(`确定删除 ${row.name || row.title || row.id}？`)) toast("已删除") }} className="p-1.5 rounded-md hover:bg-fail-light transition-colors"><Trash2 className="w-4 h-4 text-fail" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* 阶段导航 */}
          <div className="flex items-center justify-between mt-6">
            <Button variant="outline" disabled={!hasPrev} onClick={() => setCurrentStageIdx((i) => i - 1)} className="border-border text-ink-light hover:bg-cream disabled:opacity-40">
              <ArrowLeft className="w-4 h-4 mr-1" /> 上一阶段
            </Button>
            <span className="text-xs text-ink-light">{currentStageIdx + 1} / {stages.length} · {currentStage.label}</span>
            <Button variant="outline" disabled={!hasNext} onClick={() => setCurrentStageIdx((i) => i + 1)} className="border-border text-ink-light hover:bg-cream disabled:opacity-40">
              下一阶段 <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
