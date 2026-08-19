import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi, projectApi } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"

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
    width: "min-w-[160px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "module",
    title: "所属模块",
    width: "min-w-[120px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
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
  { key: "priority", title: "优先级", width: "w-28", align: "center" },
  { key: "status", title: "状态", width: "w-28", align: "center" },
  {
    key: "test_type",
    title: "类型",
    width: "min-w-[110px]",
    align: "center",
    render: (v: string) => {
      if (!v) return <span className="text-muted">—</span>
      const cfg = testTypeConfig[v as keyof typeof testTypeConfig]
      if (cfg) return <span className={`text-sm ${cfg.color}`}>{cfg.label}</span>
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

export default function PointsPage() {
  const [data, setData] = useState<TestPoint[]>([])
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

  const [projects, setProjects] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [versionOptions, setVersionOptions] = useState<{ label: string; value: string }[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingPoint, setEditingPoint] = useState<TestPoint | null>(null)

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
    const projectId = editingPoint?.project_id
    setVersionOptions(
      versions
        .filter((v: any) => !projectId || v.project_id === projectId)
        .map((v: any) => ({ label: v.name, value: String(v.id) }))
    )
  }, [versions, editingPoint])

  const projectOptions = projects.map((p: any) => ({ label: p.name, value: String(p.id) }))

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索测试点...", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "priority", label: "全部优先级", type: "select", options: priorityOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: versionOptions },
  ]

  const fields: CrudField[] = [
    { key: "project_id", label: "项目", type: "select", options: projectOptions },
    { key: "version_id", label: "版本", type: "select", options: versionOptions },
    { key: "name", label: "测试点名称", type: "text", required: true, placeholder: "请输入测试点名称" },
    { key: "module", label: "所属模块", type: "text", placeholder: "请输入所属模块" },
    { key: "description", label: "描述", type: "textarea", placeholder: "请输入描述" },
    { key: "status", label: "状态", type: "select", options: statusOptions, default: "pending" },
    { key: "priority", label: "优先级", type: "select", options: priorityOptions, default: "P2" },
    { key: "test_type", label: "类型", type: "select", options: testTypeOptions, default: "functional" },
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
      const res = await lifecycleApi.listTestPoints(params)
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
    } else if (key === "version") {
      setVersionFilter(value)
      setPage(1)
    }
  }, [])

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
      if (!window.confirm(`确定要删除测试点「${row.name}」吗？`)) return
      try {
        await lifecycleApi.deleteTestPoint(row.id)
        toast.success("删除成功")
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "删除失败")
      }
    },
    [loadData]
  )

  const handleBatchDelete = useCallback(
    async (ids: (string | number)[]) => {
      if (!window.confirm(`确定要删除选中的 ${ids.length} 个测试点吗？`)) return
      try {
        await lifecycleApi.batchDeleteTestPoints(ids as number[])
        toast.success("批量删除成功")
        setSelectedIds(new Set())
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "批量删除失败")
      }
    },
    [loadData]
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
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingPoint, loadData]
  )

  const handleViewEdit = useCallback(() => {
    if (editingPoint) {
      setDialogMode("edit")
    }
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
