import { useState, useEffect, useCallback, useMemo } from "react"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi, projectApi } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { useConfirmStore } from "@/stores/confirmStore"
import { useCrudPage } from "@/hooks/useCrudPage"

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

/** 评审检查清单模板（竞品对齐：覆盖完整性、可验证性、边界与规范） */
const CHECKLIST_TEMPLATE: { id: string; label: string; required?: boolean }[] = [
  { id: "req_coverage", label: "需求覆盖完整性：所有需求点均有对应用例", required: true },
  { id: "step_clarity", label: "步骤明确性：操作步骤清晰、无歧义", required: true },
  { id: "expected_verifiable", label: "预期结果可验证：可量化、可判定", required: true },
  { id: "precondition", label: "前置条件与数据：依赖环境/数据说明完整", required: false },
  { id: "boundary_exception", label: "边界与异常场景：覆盖边界值、异常与错误路径", required: false },
  { id: "naming_standard", label: "命名与格式规范：标题/优先级/标签规范", required: false },
]

const columns: CrudColumn[] = [
  {
    key: "title",
    title: "评审标题",
    width: "w-[220px]",
    align: "left",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "target_type",
    title: "关联对象",
    width: "w-[110px]",
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
    width: "w-[100px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "version_name",
    title: "版本",
    width: "w-[110px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "reviewer",
    title: "评审人",
    width: "w-[90px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  { key: "status", title: "状态", width: "w-[80px]", align: "center" },
  {
    key: "review_type",
    title: "评审类型",
    width: "w-[90px]",
    align: "center",
    render: (v: string) => {
      if (!v) return <span className="text-muted">—</span>
      const cfg = reviewTypeConfig[v]
      if (cfg) {
        return (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        )
      }
      const isChinese = /[\u4e00-\u9fa5]/.test(v)
      return <span className="text-sm text-ink">{isChinese ? v : "—"}</span>
    },
  },
  {
    key: "checklist",
    title: "清单",
    width: "w-[100px]",
    align: "center",
    render: (v: any) => {
      const items: { passed: boolean | null }[] = Array.isArray(v) ? v : []
      if (items.length === 0) return <span className="text-muted">—</span>
      const passed = items.filter((it) => it.passed === true).length
      const done = items.filter((it) => it.passed !== null).length
      const allPassed = passed === items.length
      const color = allPassed ? "text-pass" : done === 0 ? "text-muted" : "text-amber"
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className={`text-xs font-medium ${color}`}>
            {passed}/{items.length}
          </span>
          <div className="w-12 h-1 rounded-full bg-cream border border-border overflow-hidden">
            <div
              className={`h-full rounded-full ${allPassed ? "bg-pass" : done === 0 ? "bg-border" : "bg-amber"}`}
              style={{ width: `${items.length ? Math.round((done / items.length) * 100) : 0}%` }}
            />
          </div>
        </div>
      )
    },
  },
  {
    key: "created_at",
    title: "创建时间",
    width: "w-[140px]",
    align: "center",
    render: (v: string) => (
      <span className="text-sm text-ink font-mono">{formatDateTime(v)}</span>
    ),
  },
]

export default function ReviewsPage() {
  const toast = useToast()

  // --- 下拉选项 ---
  const [projects, setProjects] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")

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

  const projectOptions = projects.map((p: any) => ({ label: p.name, value: String(p.id) }))

  const versionOptions = useMemo(() => {
    return versions.map((v: any) => ({ label: v.name, value: String(v.id) }))
  }, [versions])

  const extraFilters = useMemo<Record<string, string | number | undefined>>(
    () => ({
      status: statusFilter || undefined,
      project_id: projectFilter || undefined,
      version_id: versionFilter || undefined,
    }),
    [statusFilter, projectFilter, versionFilter],
  )

  // --- 列表 Hook ---
  const {
    data, total, page, setPage, pageSize, setPageSize,
    loading, searchTerm, setSearchTerm, reload,
  } = useCrudPage<Review>({
    fetchFn: (params) => lifecycleApi.listReviews(params),
    extraFilters,
  })

  // --- 对话框 ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [versionOptionsForDialog, setVersionOptionsForDialog] = useState<{ label: string; value: string }[]>([])

  useEffect(() => {
    if (!editingReview?.project_id) {
      setVersionOptionsForDialog(versions.map((v: any) => ({ label: v.name, value: String(v.id) })))
    } else {
      setVersionOptionsForDialog(
        versions
          .filter((v: any) => v.project_id === editingReview.project_id)
          .map((v: any) => ({ label: v.name, value: String(v.id) })),
      )
    }
  }, [versions, editingReview])

  // --- 筛选栏 ---
  const filters: CrudFilter[] = [
    { key: "search", label: "搜索评审标题...", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: versionOptions },
  ]

  const fields: CrudField[] = [
    { key: "project_id", label: "项目", type: "select", options: projectOptions },
    { key: "version_id", label: "版本", type: "select", options: versionOptionsForDialog },
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
    {
      key: "checklist",
      label: "评审检查清单",
      type: "checklist",
      checklistTemplate: CHECKLIST_TEMPLATE,
      helpText: "逐项勾选评审结果，必查项不通过时建议在备注中说明原因",
    },
  ]

  // --- 筛选变更 ---
  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      if (key === "status") setStatusFilter(value)
      else if (key === "project") setProjectFilter(value)
      else if (key === "version") setVersionFilter(value)
    },
    [],
  )

  // --- CRUD 回调 ---
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
      const confirmed = await useConfirmStore.getState().confirm({
        title: "确认删除",
        message: "确定要删除该评审吗？删除后不可恢复。",
        itemName: row.title,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.deleteReview(row.id)
        toast.success("删除成功")
        reload()
      } catch (e: any) {
        toast.error(e?.message || "删除失败")
      }
    },
    [toast, reload],
  )

  const handleBatchDelete = useCallback(
    async (ids: (string | number)[]) => {
      const confirmed = await useConfirmStore.getState().confirm({
        title: "批量删除",
        message: `确定要删除选中的 ${ids.length} 条评审记录吗？删除后不可恢复。`,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.batchDeleteReviews(ids as number[])
        toast.success("批量删除成功")
        setSelectedIds(new Set())
        reload()
      } catch (e: any) {
        toast.error(e?.message || "批量删除失败")
      }
    },
    [toast, reload],
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
        reload()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingReview, toast, reload],
  )

  const handleViewEdit = useCallback(() => {
    if (editingReview) setDialogMode("edit")
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
        onSearch={setSearchTerm}
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
