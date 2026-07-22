/**
 * 用例评审 — 合并原 ReviewsList
 * 审批/驳回 + AI评审评分
 */
import { useState, useCallback } from "react"
import { Search, Plus, Edit, Trash2, Eye, CheckCircle, XCircle, RefreshCw, Loader2, ClipboardList } from "lucide-react"
import { toast } from "sonner"
import { lifecycleApi } from "@/lib/api"
import PreviewModal from "@/pages/requirement-testing/components/PreviewModal"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

interface Review {
  id: number; title: string; type: string; status: string; reviewer: string
  score?: number; comment?: string; createdAt: string
}

const INITIAL_REVIEWS: Review[] = [
  { id: 1, title: "登录模块用例评审", type: "功能评审", status: "已通过", reviewer: "admin", score: 92, comment: "覆盖全面，步骤清晰", createdAt: "2026-07-18" },
  { id: 2, title: "支付流程用例评审", type: "功能评审", status: "待审批", reviewer: "zhangsan", createdAt: "2026-07-19" },
  { id: 3, title: "搜索模块用例评审", type: "边界值评审", status: "已驳回", reviewer: "admin", score: 65, comment: "缺少边界值测试", createdAt: "2026-07-20" },
]

const statusIcon = (s: string) => {
  if (s === "已通过") return <CheckCircle className="w-4 h-4 text-pass" />
  if (s === "已驳回") return <XCircle className="w-4 h-4 text-fail" />
  return <Clock className="w-4 h-4 text-amber" />
}

import { Clock } from "lucide-react"

export default function CaseReview() {
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [previewReview, setPreviewReview] = useState<Review | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null)

  const filtered = reviews.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleApprove = (id: number) => {
    setReviews(reviews.map((r) => r.id === id ? { ...r, status: "已通过", score: 95, comment: "审批通过" } : r))
    toast.success("审批通过")
  }

  const handleReject = (id: number) => {
    setReviews(reviews.map((r) => r.id === id ? { ...r, status: "已驳回", comment: "需要修改" } : r))
    toast.success("已驳回")
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    setReviews(reviews.filter((r) => r.id !== deleteTarget.id))
    toast.success("已删除")
    setDeleteTarget(null)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4">
      {/* 操作栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索评审..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm bg-white focus:border-amber outline-none" />
        </div>
        <div className="flex-1" />
        <button onClick={fetchReviews} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
        </button>
      </div>

      {/* 评审列表 */}
      <div className="flex-1 bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream/50 border-b border-border">
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">ID</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">评审标题</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">类型</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">状态</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">评审人</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">评分</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">创建时间</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-ink">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-muted">
                  <ClipboardList className="w-10 h-10 mx-auto mb-2 text-muted-light" />
                  <p className="text-sm font-medium">暂无评审记录</p>
                </td></tr>
              ) : filtered.map((r, idx) => (
                <tr key={r.id} className={`border-b border-border/50 last:border-b-0 ${idx % 2 === 1 ? "bg-cream/20" : ""} hover:bg-cream/40`}>
                  <td className="px-4 py-3 text-center text-muted">{r.id}</td>
                  <td className="px-4 py-3 text-center font-medium text-ink">{r.title}</td>
                  <td className="px-4 py-3 text-center text-xs text-muted">{r.type}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {statusIcon(r.status)}
                      <span className={`text-xs font-medium ${r.status === "已通过" ? "text-pass" : r.status === "已驳回" ? "text-fail" : "text-amber"}`}>{r.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted">{r.reviewer}</td>
                  <td className="px-4 py-3 text-center text-xs text-muted">{r.score || "-"}</td>
                  <td className="px-4 py-3 text-center text-xs text-muted">{r.createdAt}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {r.status === "待审批" && (
                        <>
                          <button onClick={() => handleApprove(r.id)} className="p-1.5 rounded-lg hover:bg-pass/10 text-ink-light hover:text-pass" title="通过"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => handleReject(r.id)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail" title="驳回"><XCircle className="w-4 h-4" /></button>
                        </>
                      )}
                      <button onClick={() => setPreviewReview(r)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewReview && (
        <PreviewModal title={`评审: ${previewReview.title}`}
          content={`| 字段 | 值 |\n|------|----|\n| 类型 | ${previewReview.type} |\n| 状态 | ${previewReview.status} |\n| 评审人 | ${previewReview.reviewer} |\n| 评分 | ${previewReview.score || "未评分"} |\n| 评审意见 | ${previewReview.comment || "无"} |`}
          onClose={() => setPreviewReview(null)} />
      )}

      <ConfirmDeleteModal open={!!deleteTarget} message="确定删除以下评审记录？" itemName={deleteTarget?.title || ""} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
