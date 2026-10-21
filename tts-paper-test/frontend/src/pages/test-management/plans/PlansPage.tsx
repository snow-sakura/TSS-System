import { useState, useEffect, useCallback, useMemo } from "react"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi, usersApi } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { useConfirmStore } from "@/stores/confirmStore"
import { useCrudPage } from "@/hooks/useCrudPage"
import { useProjectOptions } from "@/hooks/useProjectOptions"

interface TestPlan {
  id: number
  name: string
  title?: string
  description?: string
  status: string
  priority?: string
  owner?: string
  owner_name?: string
  created_by?: number
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  created_at?: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-cream text-muted border border-border" },
  active: { label: "进行中", color: "bg-info/10 text-info border border-info/20" },
  archived: { label: "已归档", color: "bg-pass/10 text-pass border border-pass/20" },
  completed: { label: "已完成", color: "bg-pass-light text-pass border border-pass/20" },
  cancelled: { label: "已取消", color: "bg-fail-light text-fail border border-fail/20" },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  P0: { label: "P0 - 紧急", color: "text-fail font-semibold" },
  P1: { label: "P1 - 高", color: "text-amber font-semibold" },
  P2: { label: "P2 - 中", color: "text-info font-semibold" },
  P3: { label: "P3 - 低", color: "text-muted" },
}

const statusOptions = [
  { label: "草稿", value: "draft" },
  { label: "进行中", value: "active" },
  { label: "已归档", value: "archived" },
  { label: "已完成", value: "completed" },
  { label: "已取消", value: "cancelled" },
]

const priorityOptions = [
  { label: "P0 - 紧急", value: "P0" },
  { label: "P1 - 高", value: "P1" },
  { label: "P2 - 中", value: "P2" },
  { label: "P3 - 低", value: "P3" },
]

const columns: CrudColumn[] = [
  {
    key: "name",
    title: "方案标题",
    width: "w-[220px]",
    align: "left",
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
  {
    key: "status",
    title: "状态",
    width: "w-[80px]",
    align: "center",
    render: (v: string) => {
      const cfg = statusConfig[v]
      if (cfg) return <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
      return <span className="text-muted">{v || "—"}</span>
    },
  },
  {
    key: "priority",
    title: "优先级",
    width: "w-[90px]",
    align: "center",
    render: (v: string) => {
      const cfg = priorityConfig[v]
      if (cfg) return <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
      return <span className="text-muted">{v || "—"}</span>
    },
  },
  {
    key: "owner_name",
    title: "负责人",
    width: "w-[100px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
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

export default function PlansPage() {
  const toast = useToast()
  const [statusFilter, setStatusFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null)

  // 用户列表（仅用于表单选择）
  const [users, setUsers] = useState<any[]>([])
  useEffect(() => {
    usersApi.listUsers().then((res) => setUsers(res?.data?.items || res?.data || [])).catch(() => {})
  }, [])

  const fetchFn = useCallback(
    (params: Record<string, any>) => lifecycleApi.listTestPlans(params),
    [],
  )

  const {
    data, total, page, setPage, pageSize, setPageSize,
    loading, searchTerm, setSearchTerm, reload,
  } = useCrudPage<TestPlan>({ fetchFn })

  const {
    projectOptions,
    getVersionOptionsForProject,
  } = useProjectOptions()

  const dialogVersionOptions = useMemo(
    () => getVersionOptionsForProject(editingPlan?.project_id),
    [getVersionOptionsForProject, editingPlan?.project_id],
  )

  const filterVersionOptions = useMemo(
    () => getVersionOptionsForProject(projectFilter || undefined),
    [getVersionOptionsForProject, projectFilter],
  )

  const userOptions = users.map((u: any) => ({
    label: u.display_name || u.username || u.name || String(u.id),
    value: String(u.id),
  }))

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索方案标题...", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: filterVersionOptions },
  ]

  const fields: CrudField[] = [
    { key: "project_id", label: "项目", type: "select", options: projectOptions },
    { key: "version_id", label: "版本", type: "select", options: dialogVersionOptions },
    { key: "name", label: "方案标题", type: "text", required: true, placeholder: "请输入方案标题" },
    { key: "description", label: "描述", type: "textarea", placeholder: "请输入方案描述" },
    { key: "status", label: "状态", type: "select", options: statusOptions, default: "draft" },
    { key: "priority", label: "优先级", type: "select", options: priorityOptions, default: "P2" },
    { key: "created_by", label: "负责人", type: "select", options: userOptions, placeholder: "请选择负责人" },
  ]

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setPage(1)
  }, [setSearchTerm, setPage])

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === "status") setStatusFilter(value)
    else if (key === "project") setProjectFilter(value)
    else if (key === "version") setVersionFilter(value)
    setPage(1)
  }, [setPage])

  const handleCreate = useCallback(() => {
    setDialogMode("create")
    setEditingPlan(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: TestPlan) => {
    setDialogMode("edit")
    setEditingPlan(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: TestPlan) => {
    setDialogMode("view")
    setEditingPlan(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (row: TestPlan) => {
      const confirmed = await useConfirmStore.getState().confirm({
        title: "确认删除",
        message: "确定要删除该方案吗？删除后不可恢复。",
        itemName: row.name,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.deleteTestPlan(row.id)
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
        message: `确定要删除选中的 ${ids.length} 个方案吗？删除后不可恢复。`,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.batchDeleteTestPlans(ids as number[])
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
          await lifecycleApi.createTestPlan(formData)
          toast.success("方案创建成功")
        } else if (dialogMode === "edit" && editingPlan) {
          await lifecycleApi.updateTestPlan(editingPlan.id, formData)
          toast.success("方案更新成功")
        }
        setDialogOpen(false)
        reload()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingPlan, toast, reload],
  )

  const handleViewEdit = useCallback(() => {
    if (editingPlan) setDialogMode("edit")
  }, [editingPlan])

  const dialogTitle =
    dialogMode === "create" ? "新建测试方案" : dialogMode === "edit" ? "编辑测试方案" : "测试方案详情"

  return (
    <div>
      <CrudTable
        title="测试方案"
        subtitle="管理所有测试方案"
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
        emptyText="暂无测试方案数据"
        createButtonText="新建方案"
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fields}
        initialData={editingPlan || {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />
    </div>
  )
}
