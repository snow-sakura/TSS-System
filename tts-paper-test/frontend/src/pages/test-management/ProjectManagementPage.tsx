import { useState, useEffect, useCallback } from "react"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { projectApi, usersApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"

interface Project {
  id: number
  name: string
  code?: string
  description?: string
  status: string
  owner?: string
  start_date?: string
  end_date?: string
}

const statusConfig = {
  active: { label: "进行中", color: "bg-pass/10 text-pass border border-pass/20" },
  archived: { label: "已归档", color: "bg-cream text-muted border border-border" },
  draft: { label: "草稿", color: "bg-amber/10 text-amber border border-amber/20" },
}

const statusOptions = [
  { label: "进行中", value: "active" },
  { label: "已归档", value: "archived" },
  { label: "草稿", value: "draft" },
]

const filters: CrudFilter[] = [
  { key: "search", label: "搜索项目名称或编码...", type: "search" },
  { key: "status", label: "全部状态", type: "select", options: statusOptions },
]

const fields: CrudField[] = [
  { key: "name", label: "项目名称", type: "text", required: true, placeholder: "请输入项目名称" },
  { key: "description", label: "描述", type: "textarea", placeholder: "请输入项目描述" },
  { key: "status", label: "状态", type: "select", options: statusOptions, default: "active" },
  { key: "owner", label: "负责人", type: "select", options: [], placeholder: "请选择负责人" },
  { key: "start_date", label: "开始日期", type: "date" },
  { key: "end_date", label: "结束日期", type: "date" },
]

export default function ProjectManagementPage() {
  const toast = useToast()
  const [data, setData] = useState<Project[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await usersApi.listAllUsers()
        const list = res?.data?.items || res?.data || (Array.isArray(res) ? res : [])
        setUsers(Array.isArray(list) ? list : [])
      } catch {
        setUsers([])
      }
    }
    loadUsers()
  }, [])

  const userOptions = users.map(u => ({
    label: `${u.real_name || u.username}`,
    value: u.id,
  }))

  const fieldsWithUsers = fields.map(f =>
    f.key === "owner" ? { ...f, options: userOptions } : f
  )

  const columns: CrudColumn[] = [
    { key: "name", title: "项目名称", width: "min-w-[140px]", align: "center" },
    { key: "code", title: "项目编码", width: "min-w-[130px]", align: "center" },
    { key: "description", title: "描述", width: "min-w-[180px]", align: "center", render: (v: string) => v || "—" },
    { key: "status", title: "状态", width: "w-28", align: "center" },
    {
      key: "owner", title: "负责人", width: "min-w-[100px]", align: "center",
      render: (v: number) => {
        if (!v) return "—"
        const user = users.find(u => u.id === v)
        return user ? (user.real_name || user.username) : `用户#${v}`
      }
    },
    { key: "start_date", title: "开始日期", width: "min-w-[110px]", align: "center", render: (v: string) => v || "—" },
    { key: "end_date", title: "结束日期", width: "min-w-[110px]", align: "center", render: (v: string) => v || "—" },
  ]

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      const res = await projectApi.listProjects(params)
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
  }, [page, pageSize, searchTerm, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === "status") {
      setStatusFilter(value)
      setPage(1)
    }
  }, [])

  const handleCreate = useCallback(() => {
    setDialogMode("create")
    setEditingProject(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: Project) => {
    setDialogMode("edit")
    setEditingProject(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: Project) => {
    setDialogMode("view")
    setEditingProject(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (row: Project) => {
    if (!window.confirm(`确定要删除项目「${row.name}」吗？`)) return
    try {
      await projectApi.deleteProject(row.id)
      toast.success("删除成功")
      loadData()
    } catch (e: any) {
      toast.error(e?.message || "删除失败")
    }
  }, [toast, loadData])

  const handleBatchDelete = useCallback(async (ids: (string | number)[]) => {
    if (!window.confirm(`确定要删除选中的 ${ids.length} 个项目吗？`)) return
    try {
      await projectApi.batchDeleteProjects(ids as number[])
      toast.success("批量删除成功")
      setSelectedIds(new Set())
      loadData()
    } catch (e: any) {
      toast.error(e?.message || "批量删除失败")
    }
  }, [toast, loadData])

  const handleSubmit = useCallback(async (formData: Record<string, any>) => {
    try {
      // 转换数据类型，确保数字字段正确
      const submitData: Record<string, any> = { ...formData }
      if (submitData.owner) {
        submitData.owner = Number(submitData.owner)
      }
      // 移除空字符串字段
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === "" || submitData[key] === null) {
          delete submitData[key]
        }
      })
      
      if (dialogMode === "create") {
        await projectApi.createProject(submitData)
        toast.success("项目创建成功")
      } else if (dialogMode === "edit" && editingProject) {
        await projectApi.updateProject(editingProject.id, submitData)
        toast.success("项目更新成功")
      }
      setDialogOpen(false)
      loadData()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || "操作失败")
    }
  }, [dialogMode, editingProject, toast, loadData])

  const handleViewEdit = useCallback(() => {
    if (editingProject) {
      setDialogMode("edit")
    }
  }, [editingProject])

  const dialogTitle =
    dialogMode === "create" ? "新建项目" :
    dialogMode === "edit" ? "编辑项目" : "项目详情"

  return (
    <div>
      <CrudTable
        title="项目管理"
        subtitle="管理所有测试项目"
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
        emptyText="暂无项目数据"
        createButtonText="新建项目"
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fieldsWithUsers}
        initialData={editingProject || {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />
    </div>
  )
}