import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi, projectApi } from "@/lib/api"
import { CheckCircle, XCircle, AlertCircle, X, Download } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { useConfirmStore } from "@/stores/confirmStore"
import {
  type TestCase,
  statusConfig,
  priorityConfig,
  statusOptions,
  priorityOptions,
  testTypeConfig,
  caseFields,
} from "./caseConfig"

export default function CasesPage() {
  const toast = useToast()
  const navigate = useNavigate()
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
  const [tagFilter, setTagFilter] = useState("")
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
      className: "hidden xl:table-cell",
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
      className: "hidden xl:table-cell",
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
      className: "hidden xl:table-cell",
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
      key: "tags",
      title: "标签",
      width: "min-w-[120px]",
      align: "center",
      className: "hidden xl:table-cell",
      render: (v: string[] | null | undefined) => {
        if (!Array.isArray(v) || v.length === 0) {
          return <span className="text-muted">—</span>
        }
        return (
          <div className="flex flex-wrap items-center justify-center gap-1">
            {v.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber/10 text-amber border border-amber/20"
              >
                {t}
              </span>
            ))}
          </div>
        )
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
    className: "hidden 2xl:table-cell",
    render: (v: string) => (
      <span className="text-sm text-ink font-mono">{formatDateTime(v)}</span>
    ),
    },
  ]

  // 从当前数据收集全部标签，作为筛选选项
  const tagOptions = useMemo(() => {
    const tags = new Set<string>()
    data.forEach((row: any) => {
      if (Array.isArray(row.tags)) row.tags.forEach((t: string) => t && tags.add(t))
    })
    return Array.from(tags).map((t) => ({ label: t, value: t }))
  }, [data])

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索用例标题...", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "priority", label: "全部优先级", type: "select", options: priorityOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: versionOptions },
    { key: "tag", label: "全部标签", type: "select", options: tagOptions },
  ]

  // 基于共享 caseFields 构造表单字段，动态补充项目/版本选项
  // （字段 key 与后端 schema 对齐，preconditions 为后端字段名）
  const fields: CrudField[] = caseFields.map((f) => {
    if (f.key === "project_id") return { ...f, options: projectOptions }
    if (f.key === "version_id") return { ...f, options: versionOptions }
    return f
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (projectFilter) params.project_id = projectFilter
      if (versionFilter) params.version_id = versionFilter
      if (tagFilter) params.tag = tagFilter
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
  }, [page, pageSize, searchTerm, statusFilter, priorityFilter, projectFilter, versionFilter, tagFilter])

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
    } else if (key === "tag") {
      setTagFilter(value)
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

  const handleView = useCallback(
    (row: TestCase) => {
      // 独立详情页：左侧导航 + 面包屑 + 工具栏 + 内容区
      navigate(`/test-management/cases/${row.id}`)
    },
    [navigate]
  )

  const handleDelete = useCallback(
    async (row: TestCase) => {
      const confirmed = await useConfirmStore.getState().confirm({
        title: "确认删除",
        message: "确定要删除该测试用例吗？删除后不可恢复。",
        itemName: row.name,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
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
      const confirmed = await useConfirmStore.getState().confirm({
        title: "批量删除",
        message: `确定要删除选中的 ${ids.length} 个测试用例吗？删除后不可恢复。`,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
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

  /** 导出当前筛选条件下的全部用例为 CSV（PingCode 对齐：用例导出） */
  const [exporting, setExporting] = useState(false)
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const params: Record<string, any> = { page: 1, page_size: 10000 }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (projectFilter) params.project_id = projectFilter
      if (versionFilter) params.version_id = versionFilter
      if (tagFilter) params.tag = tagFilter
      const res = await lifecycleApi.listTestCases(params)
      const list = Array.isArray(res?.data?.items)
        ? res.data.items
        : Array.isArray(res?.data)
          ? res.data
          : []
      // 生成 CSV（含 BOM 保证 Excel 中文正常）
      const header = ["ID", "用例标题", "所属模块", "项目", "版本", "优先级", "用例类型", "标签", "状态", "前置条件", "测试步骤", "预期结果", "创建时间"]
      const rows = list.map((c: any) => [
        c.id ?? "",
        c.name ?? "",
        c.module ?? "",
        c.project_name ?? "",
        c.version_name ?? "",
        c.priority ?? "",
        c.test_type ?? "",
        Array.isArray(c.tags) ? c.tags.join("|") : "",
        c.status ?? "",
        (c.preconditions || "").replace(/[\r\n]+/g, " "),
        (Array.isArray(c.steps) ? c.steps.map((s: any) => (typeof s === "string" ? s : JSON.stringify(s))).join(" | ") : c.steps || "").replace(/[\r\n]+/g, " "),
        (c.expected_result || "").replace(/[\r\n]+/g, " "),
        c.created_at ?? "",
      ])
      const escape = (v: any) => {
        const s = String(v ?? "")
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const csv = "\uFEFF" + [header, ...rows]
        .map((r) => r.map(escape).join(","))
        .join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `测试用例导出_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`已导出 ${list.length} 条用例`)
    } catch (e: any) {
      toast.error(e?.message || "导出失败")
    } finally {
      setExporting(false)
    }
  }, [searchTerm, statusFilter, priorityFilter, projectFilter, versionFilter, tagFilter, toast])

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
        onRowClick={handleView}
        onBatchDelete={handleBatchDelete}
        emptyText="暂无测试用例数据"
        toolbarExtra={
          <>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setBatchReviewOpen(true)}
                className="h-9 px-4 rounded-xl bg-amber text-white text-sm font-medium shadow-sm hover:bg-amber/90 transition-all flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                批量评审 ({selectedIds.size})
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {exporting ? "导出中..." : "导出CSV"}
            </button>
          </>
        }
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