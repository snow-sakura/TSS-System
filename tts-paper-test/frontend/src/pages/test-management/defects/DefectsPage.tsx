import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import { useConfirmStore } from "@/stores/confirmStore"
import { LayoutList, LayoutGrid } from "lucide-react"
import KanbanPage from "../kanban/KanbanPage"
import { useCrudPage } from "@/hooks/useCrudPage"
import { useProjectOptions } from "@/hooks/useProjectOptions"

interface Defect {
  id: number
  title: string
  description?: string
  status: "new" | "confirmed" | "fixing" | "fixed" | "closed"
  severity: "critical" | "high" | "medium" | "low"
  assignee?: string
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  created_at?: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "新建", color: "bg-cream text-muted border border-border" },
  confirmed: { label: "已确认", color: "bg-info/10 text-info border border-info/20" },
  fixing: { label: "修复中", color: "bg-amber/10 text-amber border border-amber/20" },
  fixed: { label: "已修复", color: "bg-pass/10 text-pass border border-pass/20" },
  closed: { label: "已关闭", color: "bg-cream text-muted border border-border" },
  open: { label: "打开", color: "bg-cream text-muted border border-border" },
  resolved: { label: "已解决", color: "bg-pass/10 text-pass border border-pass/20" },
  in_progress: { label: "处理中", color: "bg-amber/10 text-amber border border-amber/20" },
}

const severityColors: Record<string, string> = {
  critical: "bg-fail text-white",
  high: "bg-fail/80 text-white",
  medium: "bg-amber text-white",
  low: "bg-cream text-muted",
  fatal: "bg-fail text-white",
  major: "bg-fail/80 text-white",
  minor: "bg-cream text-muted",
}

const severityLabels: Record<string, string> = {
  critical: "致命",
  high: "严重",
  medium: "一般",
  low: "轻微",
  fatal: "致命",
  major: "严重",
  minor: "轻微",
}

const statusOptions = [
  { label: "新建", value: "new" },
  { label: "已确认", value: "confirmed" },
  { label: "修复中", value: "fixing" },
  { label: "已修复", value: "fixed" },
  { label: "已关闭", value: "closed" },
]

const severityOptions = [
  { label: "致命", value: "critical" },
  { label: "严重", value: "high" },
  { label: "一般", value: "medium" },
  { label: "轻微", value: "low" },
]

const columns: CrudColumn[] = [
  { key: "title", title: "缺陷标题", width: "w-[220px]", align: "left" },
  {
    key: "severity",
    title: "严重度",
    width: "w-[80px]",
    align: "center",
    render: (v: string) => (
      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${severityColors[v] || severityColors.low}`}>
        {severityLabels[v] || (v ? (/[\u4e00-\u9fa5]/.test(v) ? v : "—") : "—")}
      </span>
    ),
  },
  { key: "status", title: "状态", width: "w-[80px]", align: "center" },
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
    key: "assignee",
    title: "责任人",
    width: "w-[90px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "created_at",
    title: "创建时间",
    width: "w-[140px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
]

export default function DefectsPage() {
  const toast = useToast()
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list")
  const [viewSearchParams] = useSearchParams()
  useEffect(() => {
    if (viewSearchParams.get("view") === "kanban") setViewMode("kanban")
  }, [viewSearchParams])

  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  const [statusFilter, setStatusFilter] = useState("")
  const [severityFilter, setSeverityFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingDefect, setEditingDefect] = useState<Defect | null>(null)
  const [prefill, setPrefill] = useState<Record<string, any> | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get("new") !== "1") return
    const next: Record<string, any> = {}
    const execId = searchParams.get("execution_id")
    const execName = searchParams.get("execution_name")
    if (execId) {
      next.execution_id = Number(execId)
      next.title = `[执行] ${execName || `执行#${execId}`}`
      next.description = `关联执行 #${execId}（${execName || ""}）失败的缺陷`
    }
    const caseId = searchParams.get("case_id")
    const caseTitle = searchParams.get("case_title")
    if (caseTitle) next.title = `[用例] ${caseTitle}`
    if (caseId) {
      next.test_case_id = Number(caseId)
      next.description = `关联用例 #${caseId}（${caseTitle || ""}）发现的缺陷`
    }
    const pid = searchParams.get("project_id")
    if (pid) next.project_id = Number(pid)
    const vid = searchParams.get("version_id")
    if (vid) next.version_id = Number(vid)
    setPrefill(next)
    setDialogMode("create")
    setEditingDefect(null)
    setDialogOpen(true)
    setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchFn = useCallback(
    (params: Record<string, any>) => lifecycleApi.listDefects(params),
    [],
  )

  // 额外筛选条件对象（传入 hook 自动合并到请求参数）
  const extraFilters: Record<string, string | undefined> = {}
  if (statusFilter) extraFilters.status = statusFilter
  if (severityFilter) extraFilters.severity = severityFilter
  if (projectFilter) extraFilters.project_id = projectFilter
  if (versionFilter) extraFilters.version_id = versionFilter

  const {
    data, total, page, setPage, pageSize, setPageSize,
    loading, searchTerm, setSearchTerm, reload,
  } = useCrudPage<Defect>({ fetchFn, extraFilters })

  const {
    projectOptions,
    getVersionOptionsForProject,
  } = useProjectOptions()

  const dialogVersionOptions = useMemo(
    () => getVersionOptionsForProject(editingDefect?.project_id || prefill?.project_id),
    [getVersionOptionsForProject, editingDefect?.project_id, prefill?.project_id],
  )

  const filterVersionOptions = useMemo(
    () => getVersionOptionsForProject(projectFilter || undefined),
    [getVersionOptionsForProject, projectFilter],
  )

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索缺陷标题...", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "severity", label: "全部严重度", type: "select", options: severityOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: filterVersionOptions },
  ]

  const fields: CrudField[] = [
    { key: "project_id", label: "项目", type: "select", options: projectOptions },
    { key: "version_id", label: "版本", type: "select", options: dialogVersionOptions },
    { key: "title", label: "缺陷标题", type: "text", required: true, placeholder: "请输入缺陷标题" },
    { key: "description", label: "描述", type: "textarea", placeholder: "请输入缺陷描述" },
    { key: "status", label: "状态", type: "select", options: statusOptions, default: "new" },
    { key: "severity", label: "严重度", type: "select", options: severityOptions, default: "medium" },
    { key: "assignee", label: "责任人", type: "text", placeholder: "请输入责任人姓名" },
    ...(prefill?.execution_id
      ? ([{
          key: "execution_id",
          label: "关联执行ID",
          type: "text" as const,
          disabled: true,
          helpText: "该缺陷由失败执行一键提交，自动关联",
        }] as CrudField[])
      : []),
    ...(prefill?.test_case_id
      ? ([{
          key: "test_case_id",
          label: "关联用例ID",
          type: "text" as const,
          disabled: true,
          helpText: "该缺陷由用例一键提交，自动关联",
        }] as CrudField[])
      : []),
  ]

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setPage(1)
  }, [setSearchTerm, setPage])

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === "status") setStatusFilter(value)
    else if (key === "severity") setSeverityFilter(value)
    else if (key === "project") setProjectFilter(value)
    else if (key === "version") setVersionFilter(value)
    setPage(1)
  }, [setPage])

  const handleCreate = useCallback(() => {
    setDialogMode("create")
    setEditingDefect(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: Defect) => {
    setDialogMode("edit")
    setEditingDefect(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: Defect) => {
    setDialogMode("view")
    setEditingDefect(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (row: Defect) => {
      const confirmed = await useConfirmStore.getState().confirm({
        title: "确认删除",
        message: "确定要删除该缺陷吗？删除后不可恢复。",
        itemName: row.title,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.deleteDefect(row.id)
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
        message: `确定要删除选中的 ${ids.length} 个缺陷吗？删除后不可恢复。`,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.batchDeleteDefects(ids as number[])
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
          await lifecycleApi.createDefect(formData)
          toast.success("缺陷创建成功")
        } else if (dialogMode === "edit" && editingDefect) {
          await lifecycleApi.updateDefect(editingDefect.id, formData)
          toast.success("缺陷更新成功")
        }
        setDialogOpen(false)
        reload()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingDefect, toast, reload],
  )

  const handleViewEdit = useCallback(() => {
    if (editingDefect) setDialogMode("edit")
  }, [editingDefect])

  const dialogTitle =
    dialogMode === "create" ? "新建缺陷" : dialogMode === "edit" ? "编辑缺陷" : "缺陷详情"

  return (
    <div>
      <div className="flex items-center gap-1 mb-4">
        {([
          { key: "list" as const, label: "列表视图", icon: LayoutList },
          { key: "kanban" as const, label: "看板视图", icon: LayoutGrid },
        ]).map((view) => {
          const Icon = view.icon
          const isActive = viewMode === view.key
          return (
            <button
              key={view.key}
              onClick={() => setViewMode(view.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                isActive
                  ? "bg-amber text-white border-amber shadow-sm"
                  : "bg-white text-muted border-border hover:text-ink hover:border-amber/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              {view.label}
            </button>
          )
        })}
      </div>

      <div className={viewMode === "list" ? "" : "hidden"}>
        <CrudTable
          title="缺陷管理"
          subtitle="管理所有缺陷"
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
          onPageSizeChange={setPageSize}
          onSelectionChange={setSelectedIds}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onView={handleView}
          onDelete={handleDelete}
          onBatchDelete={handleBatchDelete}
          emptyText="暂无缺陷数据"
          createButtonText="新建缺陷"
        />

        <CrudDialog
          open={dialogOpen}
          mode={dialogMode}
          title={dialogTitle}
          fields={fields}
          initialData={editingDefect || prefill || {}}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleSubmit}
          onViewEdit={handleViewEdit}
        />
      </div>

      {viewMode === "kanban" && <KanbanPage />}
    </div>
  )
}
