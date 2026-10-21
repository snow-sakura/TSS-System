import { useState, useCallback, useMemo } from "react"
import { toast } from "sonner"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { useConfirmStore } from "@/stores/confirmStore"
import { useCrudPage } from "@/hooks/useCrudPage"
import { useProjectOptions } from "@/hooks/useProjectOptions"

interface TestPoint {
  id: number
  name: string
  module?: string
  description?: string
  status?: string
  priority?: string
  test_type?: string
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  created_at?: string
}

const statusConfig = {
  draft: { label: "草稿", color: "bg-cream text-muted border border-border" },
  pending: { label: "待测试", color: "bg-cream text-muted border border-border" },
  active: { label: "进行中", color: "bg-info/10 text-info border border-info/20" },
  completed: { label: "已完成", color: "bg-pass/10 text-pass border border-pass/20" },
  archived: { label: "已归档", color: "bg-pass/10 text-pass border border-pass/20" },
}

const priorityConfig = {
  P0: { label: "P0 - 紧急", color: "text-fail font-semibold" },
  P1: { label: "P1 - 高", color: "text-amber font-semibold" },
  P2: { label: "P2 - 中", color: "text-info font-semibold" },
  P3: { label: "P3 - 低", color: "text-muted" },
}

const testTypeConfig = {
  functional: { label: "功能测试", color: "text-info" },
  performance: { label: "性能测试", color: "text-amber" },
  security: { label: "安全测试", color: "text-fail" },
  compatibility: { label: "兼容测试", color: "text-pass" },
}

const statusOptions = [
  { label: "待测试", value: "pending" },
  { label: "进行中", value: "active" },
  { label: "已完成", value: "completed" },
]

const priorityOptions = [
  { label: "P0 - 紧急", value: "P0" },
  { label: "P1 - 高", value: "P1" },
  { label: "P2 - 中", value: "P2" },
  { label: "P3 - 低", value: "P3" },
]

const testTypeOptions = [
  { label: "功能测试", value: "functional" },
  { label: "性能测试", value: "performance" },
  { label: "安全测试", value: "security" },
  { label: "兼容测试", value: "compatibility" },
]

const columns: CrudColumn[] = [
  {
    key: "name",
    title: "测试点名称",
    width: "w-[220px]",
    align: "left",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "module",
    title: "模块",
    width: "w-[100px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
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
  { key: "priority", title: "优先级", width: "w-[90px]", align: "center" },
  { key: "status", title: "状态", width: "w-[80px]", align: "center" },
  {
    key: "test_type",
    title: "类型",
    width: "w-[90px]",
    align: "center",
    render: (v: string) => {
      if (!v) return <span className="text-muted">—</span>
      const cfg = testTypeConfig[v as keyof typeof testTypeConfig]
      if (cfg) return <span className={`text-sm ${cfg.color}`}>{cfg.label}</span>
      const isChinese = /[\u4e00-\u9fa5]/.test(v)
      return <span className="text-sm text-ink">{isChinese ? v : "—"}</span>
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

export default function PointsPage() {
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingPoint, setEditingPoint] = useState<TestPoint | null>(null)

  const fetchFn = useCallback(
    (params: Record<string, any>) => lifecycleApi.listTestPoints(params),
    [],
  )

  const {
    data, total, page, setPage, pageSize, setPageSize,
    loading, searchTerm, setSearchTerm, reload,
  } = useCrudPage<TestPoint>({
    fetchFn,
    initialPageSize: 10,
  })

  const {
    projects,
    projectOptions,
    getVersionOptionsForProject,
  } = useProjectOptions()

  // 编辑对话框中，版本选项需根据选中项目联动
  const dialogVersionOptions = useMemo(
    () => getVersionOptionsForProject(editingPoint?.project_id),
    [getVersionOptionsForProject, editingPoint?.project_id],
  )

  // 版本筛选下拉框的全量选项（所有版本）
  const filterVersionOptions = useMemo(
    () => getVersionOptionsForProject(projectFilter || undefined),
    [getVersionOptionsForProject, projectFilter],
  )

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索测试点...", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "priority", label: "全部优先级", type: "select", options: priorityOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: filterVersionOptions },
  ]

  const fields: CrudField[] = [
    { key: "project_id", label: "项目", type: "select", options: projectOptions },
    { key: "version_id", label: "版本", type: "select", options: dialogVersionOptions },
    { key: "name", label: "测试点名称", type: "text", required: true, placeholder: "请输入测试点名称" },
    { key: "module", label: "所属模块", type: "text", placeholder: "请输入所属模块" },
    { key: "description", label: "描述", type: "textarea", placeholder: "请输入描述" },
    { key: "status", label: "状态", type: "select", options: statusOptions, default: "pending" },
    { key: "priority", label: "优先级", type: "select", options: priorityOptions, default: "P2" },
    { key: "test_type", label: "类型", type: "select", options: testTypeOptions, default: "functional" },
  ]

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setPage(1)
  }, [setSearchTerm, setPage])

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === "status") setStatusFilter(value)
    else if (key === "priority") setPriorityFilter(value)
    else if (key === "project") setProjectFilter(value)
    else if (key === "version") setVersionFilter(value)
    setPage(1)
  }, [setPage])

  const handleCreate = useCallback(() => {
    setDialogMode("create")
    setEditingPoint(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: TestPoint) => {
    setDialogMode("edit")
    setEditingPoint(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: TestPoint) => {
    setDialogMode("view")
    setEditingPoint(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (row: TestPoint) => {
      const confirmed = await useConfirmStore.getState().confirm({
        title: "确认删除",
        message: "确定要删除该测试点吗？删除后不可恢复。",
        itemName: row.name,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.deleteTestPoint(row.id)
        toast.success("删除成功")
        reload()
      } catch (e: any) {
        toast.error(e?.message || "删除失败")
      }
    },
    [reload],
  )

  const handleBatchDelete = useCallback(
    async (ids: (string | number)[]) => {
      const confirmed = await useConfirmStore.getState().confirm({
        title: "批量删除",
        message: `确定要删除选中的 ${ids.length} 个测试点吗？删除后不可恢复。`,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.batchDeleteTestPoints(ids as number[])
        toast.success("批量删除成功")
        setSelectedIds(new Set())
        reload()
      } catch (e: any) {
        toast.error(e?.message || "批量删除失败")
      }
    },
    [reload],
  )

  const handleSubmit = useCallback(
    async (formData: Record<string, any>) => {
      try {
        if (dialogMode === "create") {
          await lifecycleApi.createTestPoint(formData)
          toast.success("测试点创建成功")
        } else if (dialogMode === "edit" && editingPoint) {
          await lifecycleApi.updateTestPoint(editingPoint.id, formData)
          toast.success("测试点更新成功")
        }
        setDialogOpen(false)
        reload()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingPoint, reload],
  )

  const handleViewEdit = useCallback(() => {
    if (editingPoint) setDialogMode("edit")
  }, [editingPoint])

  const dialogTitle =
    dialogMode === "create" ? "新建测试点" : dialogMode === "edit" ? "编辑测试点" : "测试点详情"

  return (
    <div>
      <CrudTable
        title="测试点"
        subtitle="管理所有测试点"
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
        emptyText="暂无测试点数据"
        createButtonText="新建测试点"
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fields}
        initialData={editingPoint || {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />
    </div>
  )
}
