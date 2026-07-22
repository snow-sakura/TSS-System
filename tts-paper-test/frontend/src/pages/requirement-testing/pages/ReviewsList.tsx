/**
 * 评审管理 - 测试用例/方案评审 + AI评审 + 批量审核
 */
import { useState } from "react"
import { Search, Plus, Edit, Trash2, Eye, CheckCircle, X, Download, Sparkles, User, Loader2, XCircle } from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import PreviewModal from "../components/PreviewModal"
import DataTable, { type ColumnDef } from "../components/DataTable"

const typeOptions = ["用例评审", "方案评审", "报告评审", "AI自动评审"]
const statusOptions = ["草稿", "待审", "已通过", "已驳回", "已取消"]
const reviewerOptions = ["admin", "zhangsan", "wangwu", "lisi", "zhaoliu"]

const initialReviews: Record<string, any>[] = [
  { id: 1, title: "登录模块用例评审-第3批", type: "用例评审", status: "已通过", reviewer: "admin", reviewer2: "zhangsan", source: "手动", caseCount: 8, passed: 8, rejected: 0, summary: "登录模块8条用例全部通过评审，覆盖正常/异常/边界场景", comments: "用例设计合理，边界条件覆盖充分", createdAt: "2026-07-18 14:00", completedAt: "2026-07-18 16:30" },
  { id: 2, title: "搜索模块用例评审", type: "用例评审", status: "已通过", reviewer: "zhangsan", reviewer2: "", source: "AI自动评审", caseCount: 6, passed: 5, rejected: 1, summary: "搜索模块6条用例，1条因预期结果不明确被驳回修改", comments: "搜索结果排序验证用例需补充排序规则说明", createdAt: "2026-07-19 09:00", completedAt: "2026-07-19 11:00" },
  { id: 3, title: "购物车模块用例评审", type: "用例评审", status: "待审", reviewer: "wangwu", reviewer2: "", source: "手动", caseCount: 10, passed: 0, rejected: 0, summary: "", comments: "", createdAt: "2026-07-20 08:00", completedAt: "" },
  { id: 4, title: "v2.1.0测试方案评审", type: "方案评审", status: "已通过", reviewer: "admin", reviewer2: "zhangsan", source: "手动", caseCount: 1, passed: 1, rejected: 0, summary: "测试方案覆盖全面，策略合理，准予执行", comments: "建议增加性能测试和安全测试部分", createdAt: "2026-07-17 10:00", completedAt: "2026-07-17 15:00" },
  { id: 5, title: "回归测试报告评审", type: "报告评审", status: "已驳回", reviewer: "admin", reviewer2: "", source: "手动", caseCount: 1, passed: 0, rejected: 1, summary: "报告缺少性能指标数据和用户体验评估", comments: "报告需补充响应时间统计、错误率分析、用户满意度数据", createdAt: "2026-07-19 14:00", completedAt: "2026-07-19 16:00" },
  { id: 6, title: "AI自动生成用例评审-登录模块", type: "AI自动评审", status: "已通过", reviewer: "AI", reviewer2: "admin", source: "AI自动评审", caseCount: 5, passed: 4, rejected: 1, summary: "AI评审完成：4条用例质量达标，1条步骤描述需优化", comments: "TC-AI-002密码强度验证的步骤缺少具体测试数据", createdAt: "2026-07-20 10:00", completedAt: "2026-07-20 10:05" },
  { id: 7, title: "支付模块用例评审", type: "用例评审", status: "待审", reviewer: "lisi", reviewer2: "", source: "手动", caseCount: 6, passed: 0, rejected: 0, summary: "", comments: "", createdAt: "2026-07-20 09:30", completedAt: "" },
  { id: 8, title: "AI自动生成用例评审-购物车", type: "AI自动评审", status: "已通过", reviewer: "AI", reviewer2: "zhangsan", source: "AI自动评审", caseCount: 4, passed: 4, rejected: 0, summary: "AI评审完成：所有用例质量达标，步骤清晰", comments: "", createdAt: "2026-07-20 11:00", completedAt: "2026-07-20 11:02" },
]

export default function ReviewsList() {
  const [reviews, setReviews] = useState(initialReviews)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [previewReview, setPreviewReview] = useState<any>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingReview, setEditingReview] = useState<any>(null)
  const [form, setForm] = useState<Record<string, string>>({ title: "", type: "用例评审", status: "草稿", reviewer: "", summary: "", comments: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const pageSize = 10

  // AI评审弹窗
  const [showAiReview, setShowAiReview] = useState(false)
  const [aiReviewing, setAiReviewing] = useState(false)
  const [aiReviewResult, setAiReviewResult] = useState<any>(null)

  const columns: ColumnDef[] = [
    { key: "id", label: "ID", width: "60px" },
    { key: "title", label: "评审标题", width: "25%", render: (v) => (
      <div className="flex items-center justify-center gap-1.5 min-w-0">
        <CheckCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
        <span className="text-sm font-medium text-ink truncate max-w-[200px]">{v}</span>
      </div>
    )},
    { key: "type", label: "类型", width: "12%", render: (v) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${typeColor(v)}`}>{v}</span>
    )},
    { key: "status", label: "状态", width: "10%", render: (v) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(v)}`}>{v}</span>
    )},
    { key: "reviewer", label: "评审人", width: "10%", render: (v) => (
      <div className="flex items-center justify-center gap-1"><User className="w-3 h-3 text-muted" /><span className="text-xs text-muted">{v}</span></div>
    )},
    { key: "caseCount", label: "用例数", width: "8%" },
    { key: "passed", label: "通过/驳回", width: "10%", render: (v, r) => (
      <div className="flex items-center justify-center gap-1.5"><span className="text-xs text-pass">{r.passed}✓</span><span className="text-xs text-fail">{r.rejected}✗</span></div>
    )},
  ]

  const filtered = reviews.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter && r.type !== typeFilter) return false
    if (statusFilter && r.status !== statusFilter) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.title.trim()) errors.title = "评审标题不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    if (dialogMode === "create") {
      const newId = Math.max(...reviews.map((r) => r.id)) + 1
      setReviews([{ id: newId, ...form, reviewer: form.reviewer || "admin", reviewer2: "", source: "手动", caseCount: 0, passed: 0, rejected: 0, createdAt: new Date().toLocaleString("zh-CN"), completedAt: "" }, ...reviews])
      toast.success("评审创建成功")
    } else {
      setReviews(reviews.map((r) => r.id === editingReview.id ? { ...r, ...form } : r))
      toast.success("评审更新成功")
    }
    setShowDialog(false)
  }

  const handleDelete = (r: any) => { if (!confirm(`确定删除评审「${r.title}」？`)) return; setReviews(reviews.filter((x) => x.id !== r.id)); toast.success("评审已删除") }
  const handleBatchDelete = (ids: Set<string>) => { if (!confirm(`确定删除选中的 ${ids.size} 条评审？`)) return; setReviews(reviews.filter((r) => !ids.has(String(r.id)))); toast.success("批量删除成功") }

  const handleExport = () => {
    const data = filtered.map((r) => ({
      ID: r.id, 标题: r.title, 类型: r.type, 状态: r.status, 评审人: r.reviewer, 用例数: r.caseCount, 通过: r.passed, 驳回: r.rejected, 来源: r.source, 创建时间: r.createdAt,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "评审记录")
    XLSX.writeFile(wb, `评审记录_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success("导出成功")
  }

  // 审批操作
  const handleApprove = (r: any) => {
    setReviews(reviews.map((x) => x.id === r.id ? { ...x, status: "已通过", completedAt: new Date().toLocaleString("zh-CN") } : x))
    toast.success(`评审「${r.title}」已通过`)
  }

  const handleReject = (r: any) => {
    const comment = prompt("请输入驳回原因：")
    if (comment === null) return
    setReviews(reviews.map((x) => x.id === r.id ? { ...x, status: "已驳回", comments: comment || x.comments, completedAt: new Date().toLocaleString("zh-CN") } : x))
    toast.success(`评审「${r.title}」已驳回`)
  }

  // AI评审
  const startAiReview = async () => {
    setAiReviewing(true); setAiReviewResult(null)
    await new Promise((r) => setTimeout(r, 2000))
    setAiReviewResult({
      title: "AI自动评审报告",
      totalCases: 8,
      qualityScore: 87,
      issues: [
        { severity: "建议", description: "TC-03搜索功能验证缺少具体搜索关键词示例", suggestion: "建议添加3个不同类型的关键词示例" },
        { severity: "建议", description: "TC-06搜索空结果提示未说明空结果的UI表现", suggestion: "建议明确说明空结果页面的具体展示内容" },
      ],
      summary: "8条用例中6条质量优秀，2条需要小幅优化。整体测试设计合理，覆盖了核心业务流程和异常场景。",
    })
    setAiReviewing(false)
    toast.success("AI评审完成")
  }

  const openCreate = () => { setDialogMode("create"); setEditingReview(null); setForm({ title: "", type: "用例评审", status: "草稿", reviewer: "", summary: "", comments: "" }); setFormErrors({}); setShowDialog(true) }
  const openEdit = (r: any) => { setDialogMode("edit"); setEditingReview(r); setForm({ title: r.title, type: r.type, status: r.status, reviewer: r.reviewer || "", summary: r.summary || "", comments: r.comments || "" }); setFormErrors({}); setShowDialog(true) }

  const statusColor = (s: string) => {
    if (s === "已通过") return "bg-pass/10 text-pass border border-pass/20"
    if (s === "已驳回") return "bg-fail/10 text-fail border border-fail/20"
    if (s === "待审") return "bg-amber-light text-warn border border-amber/20"
    if (s === "已取消") return "bg-cream text-muted border border-border"
    return "bg-cream text-muted border border-border"
  }

  const typeColor = (t: string) => {
    if (t === "AI自动评审") return "bg-amber-light text-amber-hover"
    if (t === "方案评审") return "bg-info/10 text-info"
    if (t === "报告评审") return "bg-pass/10 text-pass"
    return "bg-purple-100 text-purple-600"
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">评审管理 <span className="text-xs font-normal text-muted">({filtered.length}条)</span></h2><p className="text-xs text-muted mt-0.5">测试用例/方案/报告评审，支持AI自动评审与批量审核</p></div>
      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { label: "总计", value: reviews.length, color: "text-ink" },
          { label: "待审", value: reviews.filter((r) => r.status === "待审").length, color: "text-warn" },
          { label: "已通过", value: reviews.filter((r) => r.status === "已通过").length, color: "text-pass" },
          { label: "已驳回", value: reviews.filter((r) => r.status === "已驳回").length, color: "text-fail" },
          { label: "通过率", value: `${reviews.length ? Math.round((reviews.filter((r) => r.status === "已通过").length / reviews.filter((r) => r.status === "已通过" || r.status === "已驳回").length) * 100) || 0 : 0}%`, color: "text-info" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <DataTable
        title=""
        columns={columns}
        data={paged}
        pagination={{
          page: currentPage,
          page_size: pageSize,
          total: filtered.length,
          total_pages: totalPages,
        }}
        search={search}
        sourceFilter={""}
        loading={false}
        onSearch={setSearch}
        onSourceFilter={() => {}}
        onPageChange={setCurrentPage}
        onPageSizeChange={() => {}}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        onBatchDelete={handleBatchDelete}
        onRowClick={setPreviewReview}
        renderActions={(r) => (
          <>
            {r.status === "待审" && (
              <>
                <button onClick={() => handleApprove(r)} className="p-1.5 rounded-lg hover:bg-pass/10 text-ink-light hover:text-pass transition-colors" title="通过"><CheckCircle className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleReject(r)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="驳回"><XCircle className="w-3.5 h-3.5" /></button>
              </>
            )}
          </>
        )}
        extraActions={
          <div className="flex items-center gap-2">
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部类型</option>{typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部状态</option>{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <button onClick={() => setShowAiReview(true)} className="h-9 px-3 rounded-xl bg-amber-light text-amber-hover text-sm font-medium hover:bg-amber hover:text-white flex items-center gap-1.5 transition-colors"><Sparkles className="w-3.5 h-3.5" /> AI评审</button>
            <button onClick={handleExport} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 导出</button>
          </div>
        }
      />

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[520px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{dialogMode === "create" ? "新建评审" : "编辑评审"}</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div><label className="block text-xs font-medium text-ink-light mb-1">评审标题 *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.title ? "border-fail" : "border-border"}`} placeholder="如：登录模块用例评审" />{formErrors.title && <p className="text-[11px] text-fail mt-1">{formErrors.title}</p>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">评审类型</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">评审人</label><select value={form.reviewer} onChange={(e) => setForm({ ...form, reviewer: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber"><option value="">请选择</option>{reviewerOptions.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">评审摘要</label><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="评审总结..." /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">评审意见</label><textarea value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="具体评审意见或修改建议..." /></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {/* AI评审弹窗 */}
      {showAiReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAiReview(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
                <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>AI用例评审</h3>
              </div>
              <button onClick={() => setShowAiReview(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {!aiReviewResult && !aiReviewing ? (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-amber" />
                  <p className="text-sm text-muted mb-4">AI将自动评审当前待审的测试用例，检查用例质量</p>
                  <button onClick={startAiReview} className="h-10 px-6 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-2 mx-auto"><Sparkles className="w-4 h-4" /> 开始AI评审</button>
                </div>
              ) : aiReviewing ? (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 mx-auto mb-3 text-amber animate-spin" />
                  <p className="text-sm font-medium text-ink">AI正在评审中...</p>
                  <p className="text-xs text-muted mt-1">分析用例步骤完整性、预期结果合理性、覆盖度</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-pass/10 rounded-xl">
                    <div><p className="text-sm font-semibold text-ink">评审完成</p><p className="text-xs text-muted">评审 {aiReviewResult.totalCases} 条用例，质量评分 {aiReviewResult.qualityScore}/100</p></div>
                    <span className="text-2xl font-bold text-pass">{aiReviewResult.qualityScore}</span>
                  </div>
                  <p className="text-sm text-ink-light leading-relaxed">{aiReviewResult.summary}</p>
                  {aiReviewResult.issues.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-ink mb-2">发现的问题</h4>
                      <div className="space-y-2">
                        {aiReviewResult.issues.map((issue: any, idx: number) => (
                          <div key={idx} className="p-3 bg-amber-light/30 rounded-xl border border-amber/20">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-warn/10 text-warn">{issue.severity}</span>
                              <span className="text-xs text-ink font-medium">{issue.description}</span>
                            </div>
                            <p className="text-[11px] text-muted ml-12">建议：{issue.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => { setShowAiReview(false); setAiReviewResult(null) }} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">关闭</button>
              {aiReviewResult && <button onClick={() => { toast.success("评审报告已保存"); setShowAiReview(false); setAiReviewResult(null) }} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">保存报告</button>}
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewReview && <PreviewModal title={previewReview.title} content={`# ${previewReview.title}\n\n| 字段 | 值 |\n|------|----|\n| 类型 | ${previewReview.type} |\n| 状态 | ${previewReview.status} |\n| 评审人 | ${previewReview.reviewer} |\n| 用例数 | ${previewReview.caseCount} |\n| 通过 | ${previewReview.passed} |\n| 驳回 | ${previewReview.rejected} |\n| 来源 | ${previewReview.source} |\n| 创建时间 | ${previewReview.createdAt} |\n| 完成时间 | ${previewReview.completedAt || "未完成"} |\n\n## 评审摘要\n\n${previewReview.summary || "暂无摘要"}\n\n## 评审意见\n\n${previewReview.comments || "暂无意见"}`} onClose={() => setPreviewReview(null)} />}
    </div>
  )
}
