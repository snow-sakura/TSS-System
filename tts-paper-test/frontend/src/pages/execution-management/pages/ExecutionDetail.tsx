/**
 * 执行详情 - 用例级执行结果展示 + 实时进度
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { CheckCircle, XCircle, Clock, Minus, Play, Eye, Search, Filter, AlertTriangle, SkipForward, Loader2, RefreshCw } from "lucide-react"
import PreviewModal from "../../requirement-testing/components/PreviewModal"
import { lifecycleApi } from "@/lib/api"

const initialDetails = [
  { id: 1, execName: "回归测试-第3轮", caseId: "TC01", caseTitle: "登录成功验证", module: "登录模块", result: "通过", duration: "2.1s", steps: "1. 打开登录页\n2. 输入admin/admin123\n3. 点击登录", screenshot: "", executedAt: "2026-07-20 09:05:12" },
  { id: 2, execName: "回归测试-第3轮", caseId: "TC02", caseTitle: "登录失败提示", module: "登录模块", result: "通过", duration: "1.8s", steps: "1. 打开登录页\n2. 输入admin/wrong\n3. 点击登录", screenshot: "", executedAt: "2026-07-20 09:05:30" },
  { id: 3, execName: "冒烟测试-支付模块", caseId: "TC05", caseTitle: "支付流程验证", module: "支付模块", result: "失败", duration: "15.2s", steps: "1. 添加商品\n2. 结算\n3. 选择支付宝\n4. 等待超时", screenshot: "", executedAt: "2026-07-20 08:35:00", errorMsg: "支付回调超时：timeout after 10000ms" },
  { id: 4, execName: "冒烟测试-支付模块", caseId: "TC12", caseTitle: "支付失败回退", module: "支付模块", result: "失败", duration: "8.5s", steps: "1. 结算\n2. 取消支付", screenshot: "", executedAt: "2026-07-20 08:36:00", errorMsg: "订单状态未正确回退：expected 'pending' got 'processing'" },
  { id: 5, execName: "回归测试-购物车", caseId: "TC04", caseTitle: "购物车添加商品", module: "购物车", result: "通过", duration: "3.2s", steps: "1. 进入商品列表\n2. 点击加入购物车\n3. 检查数量", screenshot: "", executedAt: "2026-07-20 10:05:00" },
  { id: 6, execName: "回归测试-购物车", caseId: "TC08", caseTitle: "购物车删除商品", module: "购物车", result: "通过", duration: "2.5s", steps: "1. 进入购物车\n2. 点击删除\n3. 确认", screenshot: "", executedAt: "2026-07-20 10:06:30" },
  { id: 7, execName: "回归测试-购物车", caseId: "TC03", caseTitle: "搜索空结果提示", module: "搜索模块", result: "跳过", duration: "-", steps: "-", screenshot: "", executedAt: "2026-07-20 10:10:00", errorMsg: "前置条件不满足：搜索服务未连接" },
  { id: 8, execName: "用户模块功能验证", caseId: "TC07", caseTitle: "用户注册验证", module: "用户管理", result: "通过", duration: "4.1s", steps: "1. 进入注册页\n2. 填写信息\n3. 提交", screenshot: "", executedAt: "2026-07-19 14:05:00" },
  { id: 9, execName: "夜间回归测试", caseId: "TC01", caseTitle: "登录成功验证", module: "登录模块", result: "通过", duration: "1.9s", steps: "1. 自动登录验证", screenshot: "", executedAt: "2026-07-19 22:05:00" },
  { id: 10, execName: "夜间回归测试", caseId: "TC06", caseTitle: "搜索空结果提示", module: "搜索模块", result: "失败", duration: "3.0s", steps: "1. 自动搜索验证", screenshot: "", executedAt: "2026-07-19 23:15:00", errorMsg: "搜索结果高亮未生效：assertion failed" },
  { id: 11, execName: "接口自动化测试", caseId: "API-01", caseTitle: "登录接口验证", module: "登录模块", result: "通过", duration: "0.3s", steps: "POST /api/auth/login", screenshot: "", executedAt: "2026-07-20 07:00:10" },
  { id: 12, execName: "接口自动化测试", caseId: "API-08", caseTitle: "搜索接口验证", module: "搜索模块", result: "失败", duration: "1.2s", steps: "GET /api/search?q=test", screenshot: "", executedAt: "2026-07-20 07:05:00", errorMsg: "500 Internal Server Error: DB connection pool exhausted" },
]

const resultColor = (r: string) => {
  if (r === "通过") return "bg-pass/10 text-pass border border-pass/20"
  if (r === "失败") return "bg-fail/10 text-fail border border-fail/20"
  if (r === "跳过") return "bg-cream text-muted border border-border"
  return "bg-cream text-muted border border-border"
}

export default function ExecutionDetail() {
  const [details, setDetails] = useState(initialDetails)
  const [search, setSearch] = useState("")
  const [resultFilter, setResultFilter] = useState("")
  const [previewDetail, setPreviewDetail] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [liveResults, setLiveResults] = useState<any[]>([])
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasRunning = useRef(false)
  const pageSize = 10

  // 从后端加载执行进度
  const fetchProgress = useCallback(async () => {
    try {
      const res: any = await lifecycleApi.listExecutions({ status: "running" })
      if (res?.data?.items && res.data.items.length > 0) {
        hasRunning.current = true
        for (const exec of res.data.items) {
          const progress: any = await lifecycleApi.getExecutionProgress(exec.id)
          if (progress?.data?.results) {
            const mapped = progress.data.results.map((r: any, idx: number) => ({
              id: idx + 1,
              execName: exec.name,
              caseId: `TC${String(r.case_id).padStart(3, "0")}`,
              caseTitle: `用例 ${r.case_id}`,
              module: exec.test_type || "全模块",
              result: r.result === "passed" ? "通过" : "失败",
              duration: `${(r.duration_ms / 1000).toFixed(1)}s`,
              steps: "",
              screenshot: r.screenshot || "",
              executedAt: r.executed_at || "",
              errorMsg: r.error || "",
            }))
            setLiveResults(mapped)
          }
        }
      } else if (hasRunning.current) {
        // 之前有运行中的任务，现在没有了，停止轮询
        hasRunning.current = false
        if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null }
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchProgress()
    pollTimer.current = setInterval(fetchProgress, 5000)
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [fetchProgress])

  const allDetails = [...liveResults, ...details]
  const filtered = allDetails.filter((d) => {
    if (search && !d.caseTitle.toLowerCase().includes(search.toLowerCase()) && !d.caseId.toLowerCase().includes(search.toLowerCase())) return false
    if (resultFilter && d.result !== resultFilter) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const stats = {
    total: allDetails.length,
    passed: allDetails.filter((d) => d.result === "通过").length,
    failed: allDetails.filter((d) => d.result === "失败").length,
    skipped: allDetails.filter((d) => d.result === "跳过").length,
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">执行详情 <span className="text-xs font-normal text-muted">用例级执行结果</span></h2><p className="text-xs text-muted mt-0.5">查看每个用例的执行结果、耗时与错误信息</p></div>
      {/* 统计 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "总计", value: stats.total, color: "text-ink" },
          { label: "通过", value: stats.passed, color: "text-pass" },
          { label: "失败", value: stats.failed, color: "text-fail" },
          { label: "跳过", value: stats.skipped, color: "text-muted" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }} placeholder="搜索用例标题/ID..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <select value={resultFilter} onChange={(e) => { setResultFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部结果</option><option value="通过">通过</option><option value="失败">失败</option><option value="跳过">跳过</option></select>
      </div>
      {/* 列表 */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-cream/50">
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">执行批次</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">用例ID</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">用例标题</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">模块</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">结果</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">耗时</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">执行时间</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-ink">操作</th>
            </tr></thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-muted"><Play className="w-10 h-10 mx-auto mb-2 text-muted-light" /><p className="text-sm font-medium">暂无执行详情</p></td></tr>
              ) : paged.map((d, idx) => (
                <tr key={d.id} className={`border-b border-border/50 last:border-b-0 ${idx % 2 === 1 ? "bg-cream/30" : ""} hover:bg-cream/50 transition-colors`}>
                  <td className="px-3 py-3 text-center text-xs text-muted">{d.execName}</td>
                  <td className="px-3 py-3 text-center"><span className="text-xs font-mono text-ink">{d.caseId}</span></td>
                  <td className="px-3 py-3 text-center"><span className="text-sm font-medium text-ink truncate max-w-[180px] block">{d.caseTitle}</span></td>
                  <td className="px-3 py-3 text-center text-xs text-muted">{d.module}</td>
                  <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${resultColor(d.result)}`}>{d.result === "通过" ? <CheckCircle className="w-3 h-3" /> : d.result === "失败" ? <XCircle className="w-3 h-3" /> : <SkipForward className="w-3 h-3" />}{d.result}</span></td>
                  <td className="px-3 py-3 text-center text-xs text-muted">{d.duration}</td>
                  <td className="px-3 py-3 text-center text-[11px] text-muted">{d.executedAt}</td>
                  <td className="px-3 py-3 text-center"><button onClick={() => setPreviewDetail(d)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors"><Eye className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-cream/20">
          <span className="text-xs text-muted">共 {filtered.length} 条，第 {currentPage}/{totalPages || 1} 页</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
            <span className="h-8 px-3 text-xs rounded-lg gradient-amber text-white flex items-center">{currentPage}</span>
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
          </div>
        </div>
      </div>
      {previewDetail && <PreviewModal title={`${previewDetail.caseId} ${previewDetail.caseTitle}`} content={`# ${previewDetail.caseId}: ${previewDetail.caseTitle}\n\n| 字段 | 值 |\n|------|----|\n| 执行批次 | ${previewDetail.execName} |\n| 模块 | ${previewDetail.module} |\n| 执行结果 | ${previewDetail.result} |\n| 耗时 | ${previewDetail.duration} |\n| 执行时间 | ${previewDetail.executedAt} |\n\n## 执行步骤\n\n${previewDetail.steps || "-"}\n\n${previewDetail.errorMsg ? `## 错误信息\n\n\`\`\`\n${previewDetail.errorMsg}\n\`\`\`` : ""}`} onClose={() => setPreviewDetail(null)} />}
    </div>
  )
}
