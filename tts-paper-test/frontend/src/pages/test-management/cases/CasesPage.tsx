import { useState, useEffect, useCallback } from "react"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi, projectApi } from "@/lib/api"
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"

interface TestCase {
  id: number
  name: string
  module?: string
  description?: string
  preconditions?: string
  steps?: string
  expected_result?: string
  status: "draft" | "active" | "deprecated" | "approved" | "rejected" | "needs_modification"
  priority: "P0" | "P1" | "P2" | "P3"
  test_type?: string
  reviewed_by?: number
  reviewed_at?: string
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  created_at?: string
}

const statusConfig = {
  draft: { label: "待评审", color: "bg-amber/10 text-amber border border-amber/20" },
  active: { label: "活跃", color: "bg-info/10 text-info border border-info/20" },
  deprecated: { label: "已废弃", color: "bg-fail/10 text-fail border border-fail/20" },
  approved: { label: "已通过", color: "bg-pass/10 text-pass border border-pass/20" },
  rejected: { label: "已驳回", color: "bg-fail/10 text-fail border border-fail/20" },
  needs_modification: { label: "需修改", color: "bg-amber/10 text-amber border border-amber/20" },
}

const priorityConfig = {
  P0: { label: "P0 - 紧急", color: "text-fail font-semibold" },
  P1: { label: "P1 - 高", color: "text-amber font-semibold" },
  P2: { label: "P2 - 中", color: "text-info font-semibold" },
  P3: { label: "P3 - 低", color: "text-muted" },
}

const statusOptions = [
  { label: "待评审", value: "draft" },
  { label: "已通过", value: "approved" },
  { label: "已驳回", value: "rejected" },
  { label: "需修改", value: "needs_modification" },
  { label: "活跃", value: "active" },
  { label: "已废弃", value: "deprecated" },
]

const priorityOptions = [
  { label: "P0 - 紧急", value: "P0" },
  { label: "P1 - 高", value: "P1" },
  { label: "P2 - 中", value: "P2" },
  { label: "P3 - 低", value: "P3" },
]

/** 用例类型英文值 → 中文映射 */
const testTypeConfig: Record<string, string> = {
  functional: "功能",
  performance: "性能",
  security: "安全",
  compatibility: "兼容",
  api: "接口",
  interface: "接口",
}

const testTypeOptions = [
  { label: "功能", value: "功能" },
  { label: "性能", value: "性能" },
  { label: "安全", value: "安全" },
  { label: "兼容", value: "兼容" },
  { label: "接口", value: "接口" },
]

export default function CasesPage() {
  const toast = useToast()
  const [data, setData] = useState<TestCase[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewingCase, setReviewingCase] = useState<TestCase | null>(null)
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected" | "needs_modification">("approved")
  const [reviewComment, setReviewComment] = useState("")
  const [batchReviewOpen, setBatchReviewOpen] = useState(false)
  const [batchReviewAction, setBatchReviewAction] = useState<"approved" | "rejected">("approved")
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  const [projects, setProjects] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [versionOptions, setVersionOptions] = useState<{ label: string; value: string }[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingCase, setEditingCase] = useState<TestCase | null>(null)

  useEffect(() => {
    projectApi
      .listProjects()
      .then((res) => setProjects(res?.data?.items || []))
      .catch(() => {})
    projectApi
      .listVersions()
      .then((res) => setVersions(res?.data?.items || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!editingCase?.project_id) {
      setVersionOptions(versions.map((v: any) => ({ label: v.name, value: String(v.id) })))
    } else {
      setVersionOptions(
        versions
          .filter((v: any) => v.project_id === editingCase.project_id)
          .map((v: any) => ({ label: v.name, value: String(v.id) }))
      )
    }
  }, [versions, editingCase])

  const projectOptions = projects.map((p: any) => ({ label: p.name, value: String(p.id) }))

  const columns: CrudColumn[] = [
    { key: "name", title: "用例标题", width: "min-w-[160px]", align: "center" },
    {
      key: "module",
      title: "所属模块",
      width: "min-w-[110px]",
      align: "center",
      render: (v: string) => v || <span className="text-muted">—</span>,
    },
    {
      key: "project_name",
      title: "项目",
      width: "min-w-[110px]",
      align: "center",
      render: (v: string) => v || <span className="text-muted">—</span>,
    },
    {
      key: "version_name",
      title: "版本",
      width: "min-w-[110px]",
      align: "center",
      render: (v: string) => v || <span className="text-muted">—</span>,
    },
    {
      key: "priority",
      title: "优先级",
      width: "w-28",
      align: "center",
      render: (v: string) => {
        const config = priorityConfig[v as keyof typeof priorityConfig]
        return config ? (
          <span className={`text-sm ${config.color}`}>{config.label}</span>
        ) : (
          <span className="text-sm text-muted">{v || "—"}</span>
        )
      },
    },
    {
      key: "test_type",
      title: "用例类型",
      width: "min-w-[100px]",
      align: "center",
      render: (v: string) => {
        if (!v) return <span className="text-muted">—</span>
        // 英文值映射为中文
        const label = testTypeConfig[v]
        if (label) return <span className="text-sm text-ink">{label}</span>
        // 已是中文则直接显示，否则显示"—"
        const isChinese = /[\u4e00-\u9fa5]/.test(v)
        return <span className="text-sm text-ink">{isChinese ? v : "—"}</span>
      },
    },
    {
      key: "status",
      title: "评审状态",
      width: "w-36",
      align: "center",
      render: (v: string, row: TestCase) => {
        const config = statusConfig[v as keyof typeof statusConfig] || statusConfig.draft
        const isPending = v === "draft" || !v
        return (
          <div className="flex items-center justify-center gap-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            {isPending && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setReviewingCase(row)
                  setReviewAction("approved")
                  setReviewComment("")
                  setReviewDialogOpen(true)
                }}
                className="text-xs text-amber hover:text-amber/80 underline transition-colors"
              >
                评审
              </button>
            )}
          </div>
        )
      },
    },
    {
      key: "created_at",
    title: "创建时间",
    width: "min-w-[160px]",
    align: "center",
    render: (v: string) => (
      <span className="text-sm text-ink font-mono">{formatDateTime(v)}</span>
    ),
    },
  ]

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索用例标题...", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "priority", label: "全部优先级", type: "select", options: priorityOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: versionOptions },
  ]

  const fields: CrudField[] = [
    { key: "project_id", label: "项目", type: "select", options: projectOptions },
    { key: "version_id", label: "版本", type: "select", options: versionOptions },
    { key: "name", label: "用例标题", type: "text", required: true, placeholder: "请输入用例标题" },
    { key: "module", label: "所属模块", type: "text", placeholder: "请输入所属模块" },
    { key: "description", label: "描述", type: "textarea", placeholder: "请输入用例描述" },
    { key: "precondition", label: "前置条件", type: "textarea", placeholder: "请输入前置条件" },
    { key: "steps", label: "测试步骤", type: "textarea", placeholder: "请输入测试步骤" },
    { key: "expected_result", label: "预期结果", type: "textarea", placeholder: "请输入预期结果" },
    { key: "status", label: "状态", type: "select", options: statusOptions, default: "draft" },
    { key: "priority", label: "优先级", type: "select", options: priorityOptions, default: "P2" },
    { key: "test_type", label: "用例类型", type: "select", options: testTypeOptions },
  ]

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (projectFilter) params.project_id = projectFilter
      if (versionFilter) params.version_id = versionFilter
      const res = await lifecycleApi.listTestCases(params)
      const payload = res?.data
      const list = Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload) ? payload : [])
      const totalCount = typeof payload?.total === 'number' ? payload.total : list.length
      setData(list)
      setTotal(totalCount)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchTerm, statusFilter, priorityFilter, projectFilter, versionFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === "status") {
      setStatusFilter(value)
      setPage(1)
    } else if (key === "priority") {
      setPriorityFilter(value)
      setPage(1)
    } else if (key === "project") {
      setProjectFilter(value)
      setPage(1)
      setVersionFilter("")
    } else if (key === "version") {
      setVersionFilter(value)
      setPage(1)
    }
  }, [])

  const handleCreate = useCallback(() => {
    setDialogMode("create")
    setEditingCase(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: TestCase) => {
    setDialogMode("edit")
    setEditingCase(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: TestCase) => {
    setDialogMode("view")
    setEditingCase(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (row: TestCase) => {
      if (!window.confirm(`确定要删除用例「${row.name}」吗？`)) return
      try {
        await lifecycleApi.deleteTestCase(row.id)
        toast.success("删除成功")
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "删除失败")
      }
    },
    [toast, loadData]
  )

  const handleBatchDelete = useCallback(
    async (ids: (string | number)[]) => {
      if (!window.confirm(`确定要删除选中的 ${ids.length} 个用例吗？`)) return
      try {
        await lifecycleApi.batchDeleteTestCases(ids as number[])
        toast.success("批量删除成功")
        setSelectedIds(new Set())
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "批量删除失败")
      }
    },
    [toast, loadData]
  )

  /** 单条评审提交 */
  const handleReviewSubmit = useCallback(async () => {
    if (!reviewingCase) return
    setReviewSubmitting(true)
    try {
      await lifecycleApi.reviewTestCase(reviewingCase.id, { action: reviewAction, review_comment: reviewComment })
      const actionLabels: Record<string, string> = { approved: "通过", rejected: "驳回", needs_modification: "需修改" }
      toast.success(`用例「${reviewingCase.name}」评审完成：${actionLabels[reviewAction]}`)
      setReviewDialogOpen(false)
      setReviewComment("")
      setReviewingCase(null)
      loadData()
    } catch (e: any) {
      toast.error(e?.message || "评审失败")
    } finally {
      setReviewSubmitting(false)
    }
  }, [reviewingCase, reviewAction, reviewComment, toast, loadData])

  /** 批量评审提交 */
  const handleBatchReviewSubmit = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setReviewSubmitting(true)
    try {
      let successCount = 0
      let failCount = 0
      for (const id of ids) {
        try {
          await lifecycleApi.reviewTestCase(Number(id), { action: batchReviewAction, review_comment: "" })
          successCount++
        } catch {
          failCount++
        }
      }
      if (failCount === 0) {
        toast.success(`批量评审完成，共 ${successCount} 条用例${batchReviewAction === "approved" ? "通过" : "驳回"}`)
      } else {
        toast.error(`部分失败：成功 ${successCount} 条，失败 ${failCount} 条`)
      }
      setBatchReviewOpen(false)
      setSelectedIds(new Set())
      loadData()
    } catch (e: any) {
      toast.error(e?.message || "批量评审失败")
    } finally {
      setReviewSubmitting(false)
    }
  }, [selectedIds, batchReviewAction, toast, loadData])

  const handleSubmit = useCallback(
    async (formData: Record<string, any>) => {
      try {
        if (dialogMode === "create") {
          await lifecycleApi.createTestCase(formData)
          toast.success("用例创建成功")
        } else if (dialogMode === "edit" && editingCase) {
          await lifecycleApi.updateTestCase(editingCase.id, formData)
          toast.success("用例更新成功")
        }
        setDialogOpen(false)
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingCase, toast, loadData]
  )

  const handleViewEdit = useCallback(() => {
    if (editingCase) {
      setDialogMode("edit")
    }
  }, [editingCase])

  const dialogTitle =
    dialogMode === "create" ? "新建测试用例" : dialogMode === "edit" ? "编辑测试用例" : "测试用例详情"

  return (
    <div>
      <CrudTable
        title="测试用例"
        subtitle="管理所有测试用例"
        columns={columns}
        filters={filters}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        selectedIds={selectedIds}
        statusConfig={statusConfig}
        priorityConfig={priorityConfig}
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        onSelectionChange={setSelectedIds}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        onBatchDelete={handleBatchDelete}
        emptyText="暂无测试用例数据"
        toolbarExtra={selectedIds.size > 0 ? (
          <button
            onClick={() => setBatchReviewOpen(true)}
            className="h-9 px-4 rounded-xl bg-amber text-white text-sm font-medium shadow-sm hover:bg-amber/90 transition-all flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            批量评审 ({selectedIds.size})
          </button>
        ) : null}
        createButtonText="新建用例"
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fields}
        initialData={editingCase || {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />

      {/* 单条评审弹窗 */}
      {reviewDialogOpen && reviewingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReviewDialogOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink">用例评审</h3>
              <button onClick={() => setReviewDialogOpen(false)} className="text-muted hover:text-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 p-3 bg-cream/50 rounded-lg border border-border">
              <p className="text-sm font-medium text-ink truncate">{reviewingCase.name}</p>
              <p className="text-xs text-muted mt-1">优先级：{reviewingCase.priority} | 类型：{reviewingCase.test_type || "未指定"}</p>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-ink mb-2 block">评审操作</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setReviewAction("approved")}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${reviewAction === "approved" ? "border-pass bg-pass/5 text-pass" : "border-border text-muted hover:border-pass/40"}`}
                >
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">通过</span>
                </button>
                <button
                  onClick={() => setReviewAction("rejected")}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${reviewAction === "rejected" ? "border-fail bg-fail/5 text-fail" : "border-border text-muted hover:border-fail/40"}`}
                >
                  <XCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">驳回</span>
                </button>
                <button
                  onClick={() => setReviewAction("needs_modification")}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${reviewAction === "needs_modification" ? "border-amber bg-amber/5 text-amber" : "border-border text-muted hover:border-amber/40"}`}
                >
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">需修改</span>
                </button>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-ink mb-2 block">评审意见（可选）</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="请输入评审意见..."
                rows={3}
                className="w-full px-3 py-2 text-sm bg-cream/30 border border-border rounded-xl input-focus resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReviewDialogOpen(false)}
                className="h-9 px-4 rounded-xl border border-border text-sm text-muted hover:bg-cream transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReviewSubmit}
                disabled={reviewSubmitting}
                className="h-9 px-4 rounded-xl bg-amber text-white text-sm font-medium shadow-sm hover:bg-amber/90 transition-all disabled:opacity-50"
              >
                {reviewSubmitting ? "提交中..." : "确认评审"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量评审弹窗 */}
      {batchReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setBatchReviewOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink">批量评审</h3>
              <button onClick={() => setBatchReviewOpen(false)} className="text-muted hover:text-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 p-3 bg-cream/50 rounded-lg border border-border">
              <p className="text-sm font-medium text-ink">已选中 {selectedIds.size} 条测试用例</p>
              <p className="text-xs text-muted mt-1">将对所有选中用例执行相同的评审操作</p>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-ink mb-2 block">评审操作</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBatchReviewAction("approved")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${batchReviewAction === "approved" ? "border-pass bg-pass/5 text-pass" : "border-border text-muted hover:border-pass/40"}`}
                >
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">全部通过</span>
                </button>
                <button
                  onClick={() => setBatchReviewAction("rejected")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${batchReviewAction === "rejected" ? "border-fail bg-fail/5 text-fail" : "border-border text-muted hover:border-fail/40"}`}
                >
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">全部驳回</span>
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBatchReviewOpen(false)}
                className="h-9 px-4 rounded-xl border border-border text-sm text-muted hover:bg-cream transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBatchReviewSubmit}
                disabled={reviewSubmitting}
                className="h-9 px-4 rounded-xl bg-amber text-white text-sm font-medium shadow-sm hover:bg-amber/90 transition-all disabled:opacity-50"
              >
                {reviewSubmitting ? "提交中..." : `确认批量评审 (${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}