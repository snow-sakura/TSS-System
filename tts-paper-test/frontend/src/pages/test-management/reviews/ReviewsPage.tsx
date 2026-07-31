import { useState, useEffect, useCallback } from "react"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi, projectApi } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"

interface Review {
  id: number
  title?: string
  target_type?: string
  target_id?: number
  target_name?: string
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  reviewer?: string
  status?: string
  review_type?: string
  comments?: string
  created_at?: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-cream text-muted border border-border" },
  pending: { label: "待评审", color: "bg-cream text-muted border border-border" },
  in_progress: { label: "评审中", color: "bg-info/10 text-info border border-info/20" },
  completed: { label: "已完成", color: "bg-pass/10 text-pass border border-pass/20" },
  failed: { label: "已失败", color: "bg-fail/10 text-fail border border-fail/20" },
}

const reviewTypeConfig: Record<string, { label: string; color: string }> = {
  formal: { label: "正式评审", color: "bg-info/10 text-info border border-info/20" },
  peer: { label: "同行评审", color: "bg-amber/10 text-amber border border-amber/20" },
  self: { label: "自检", color: "bg-pass/10 text-pass border border-pass/20" },
  case_review: { label: "用例评审", color: "bg-info/10 text-info border border-info/20" },
  plan_review: { label: "方案评审", color: "bg-amber/10 text-amber border border-amber/20" },
  report_review: { label: "报告评审", color: "bg-pass/10 text-pass border border-pass/20" },
  ai: { label: "AI自动评审", color: "bg-violet-100 text-violet-700 border border-violet-200" },
  manual: { label: "人工评审", color: "bg-cream text-muted border border-border" },
}

const statusOptions = [
  { label: "待评审", value: "pending" },
  { label: "评审中", value: "in_progress" },
  { label: "已完成", value: "completed" },
]

const reviewTypeOptions = [
  { label: "正式评审", value: "formal" },
  { label: "同行评审", value: "peer" },
  { label: "自检", value: "self" },
]

const targetTypeOptions = [
  { label: "用例", value: "test_case" },
  { label: "测试点", value: "test_point" },
  { label: "测试方案", value: "test_plan" },
]

const columns: CrudColumn[] = [
  {
    key: "title",
    title: "评审标题",
    width: "min-w-[160px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "target_type",
    title: "关联对象",
    width: "min-w-[110px]",
    align: "center",
    render: (v: string, row: Review) => {
      const label = targetTypeOptions.find((o) => o.value === v)?.label || v
      const name = row.target_name
        ? `${label} #${row.target_id}`
        : label || <span className="text-muted">—</span>
      return <span className="text-sm">{name}</span>
    },
  },
  {
    key: "project_name",
    title: "项目",
    width: "min-w-[120px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "version_name",
    title: "版本",
    width: "min-w-[120px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "reviewer",
    title: "评审人",
    width: "min-w-[100px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  { key: "status", title: "状态", width: "w-28", align: "center" },
  {
    key: "review_type",
    title: "评审类型",
    width: "w-28",
    align: "center",
    render: (v: string) => {
      if (!v) return <span className="text-muted">—</span>
      const cfg = reviewTypeConfig[v]
      if (cfg) {
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        )
      }
      // 已是中文则直接显示，否则显示"—"
      const isChinese = /[\u4e00-\u9fa5]/.test(v)
      return <span className="text-sm text-ink">{isChinese ? v : "—"}</span>
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

export default function ReviewsPage() {
  const toast = useToast()
  const [data, setData] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [projects, setProjects] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [versionOptions, setVersionOptions] = useState<{ label: string; value: string }[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingReview, setEditingReview] = useState<Review | null>(null)

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
    if (!editingReview?.project_id) {
      setVersionOptions(versions.map((v: any) => ({ label: v.name, value: String(v.id) })))
    } else {
      setVersionOptions(
        versions
          .filter((v: any) => v.project_id === editingReview.project_id)
          .map((v: any) => ({ label: v.name, value: String(v.id) }))
      )
    }
  }, [versions, editingReview])

  const projectOptions = projects.map((p: any) => ({ label: p.name, value: String(p.id) }))

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索评审标题...", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: versionOptions },
  ]

  const fields: CrudField[] = [
    { key: "project_id", label: "项目", type: "select", options: projectOptions },
    { key: "version_id", label: "版本", type: "select", options: versionOptions },
    { key: "title", label: "评审标题", type: "text", required: true, placeholder: "请输入评审标题" },
    {
      key: "target_type",
      label: "关联对象类型",
      type: "select",
      options: targetTypeOptions,
      default: "test_case",
    },
    { key: "target_id", label: "关联对象ID", type: "number", placeholder: "请输入关联对象ID" },
    { key: "reviewer", label: "评审人", type: "text", placeholder: "请输入评审人姓名" },
    {
      key: "status",
      label: "状态",
      type: "select",
      options: statusOptions,
      default: "pending",
    },
    {
      key: "review_type",
      label: "评审类型",
      type: "select",
      options: reviewTypeOptions,
      default: "formal",
    },
    { key: "comments", label: "评审意见", type: "textarea", placeholder: "请输入评审意见" },
  ]

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      if (projectFilter) params.project_id = projectFilter
      if (versionFilter) params.version_id = versionFilter
      const res = await lifecycleApi.listReviews(params)
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
  }, [page, pageSize, searchTerm, statusFilter, projectFilter, versionFilter])

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
    } else if (key === "project") {
      setProjectFilter(value)
      setPage(1)
    } else if (key === "version") {
      setVersionFilter(value)
      setPage(1)
    }
  }, [])

  const handleCreate = useCallback(() => {
    setDialogMode("create")
    setEditingReview(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: Review) => {
    setDialogMode("edit")
    setEditingReview(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: Review) => {
    setDialogMode("view")
    setEditingReview(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (row: Review) => {
      if (!window.confirm(`确定要删除评审「${row.title}」吗？`)) return
      try {
        await lifecycleApi.deleteReview(row.id)
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
      if (!window.confirm(`确定要删除选中的 ${ids.length} 条评审记录吗？`)) return
      try {
        await lifecycleApi.batchDeleteReviews(ids as number[])
        toast.success("批量删除成功")
        setSelectedIds(new Set())
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "批量删除失败")
      }
    },
    [toast, loadData]
  )

  const handleSubmit = useCallback(
    async (formData: Record<string, any>) => {
      try {
        if (dialogMode === "create") {
          await lifecycleApi.createReview(formData)
          toast.success("评审创建成功")
        } else if (dialogMode === "edit" && editingReview) {
          await lifecycleApi.updateReview(editingReview.id, formData)
          toast.success("评审更新成功")
        }
        setDialogOpen(false)
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingReview, toast, loadData]
  )

  const handleViewEdit = useCallback(() => {
    if (editingReview) {
      setDialogMode("edit")
    }
  }, [editingReview])

  const dialogTitle =
    dialogMode === "create" ? "新建评审" : dialogMode === "edit" ? "编辑评审" : "评审详情"

  return (
    <div>
      <CrudTable
        title="用例评审"
        subtitle="管理所有测试评审记录"
        columns={columns}
        filters={filters}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        selectedIds={selectedIds}
        statusConfig={statusConfig}
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
        emptyText="暂无评审数据"
        createButtonText="新建评审"
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fields}
        initialData={editingReview || {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />
    </div>
  )
}
