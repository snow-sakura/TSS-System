import { useState, useEffect, useCallback } from "react"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { rolesApi } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"

interface Role {
  id: number
  name: string
  description?: string
  user_count?: number
  created_at?: string
  updated_at?: string
}

const statusConfig = {
  active: { label: "活跃", color: "bg-pass/10 text-pass" },
}

const filters: CrudFilter[] = [
  { key: "search", label: "搜索角色名称或描述...", type: "search" },
]

const fields: CrudField[] = [
  { key: "name", label: "角色名称", type: "text", required: true, placeholder: "请输入角色名称" },
  { key: "description", label: "描述", type: "textarea", placeholder: "请输入角色描述" },
]

export default function RoleManagementPage() {
  const toast = useToast()
  const [data, setData] = useState<Role[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingRole, setEditingRole] = useState<Role | null>(null)

  const columns: CrudColumn[] = [
    { key: "name", title: "角色名称", width: "w-[14%]", align: "center" },
    { key: "description", title: "描述", width: "w-[20%]", align: "center", render: (v: string) => v || "—" },
    { key: "user_count", title: "用户数", width: "w-24", align: "center", render: (v: number) => v || 0 },
    {
      key: "created_at",
      title: "创建时间",
      width: "w-[16%]",
      align: "center",
      render: (v: string) => (
        <span className="text-sm text-ink font-mono">{formatDateTime(v)}</span>
      ),
    },
  ]

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (searchTerm) params.search = searchTerm
      const res = await rolesApi.listRoles(params)
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
  }, [page, pageSize, searchTerm])

  useEffect(() => { loadData() }, [loadData])

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string) => {
    setPage(1)
  }, [])

  const handleCreate = useCallback(() => {
    setDialogMode("create")
    setEditingRole(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: Role) => {
    setDialogMode("edit")
    setEditingRole(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: Role) => {
    setDialogMode("view")
    setEditingRole(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (row: Role) => {
    if (!window.confirm(`确定要删除角色「${row.name}」吗？`)) return
    try {
      await rolesApi.deleteRole(row.id)
      toast.success("角色删除成功")
      loadData()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || "删除失败")
    }
  }, [toast, loadData])

  const handleBatchDelete = useCallback(async (ids: (string | number)[]) => {
    if (!window.confirm(`确定要删除选中的 ${ids.length} 个角色吗？`)) return
    try {
      await rolesApi.batchDeleteRoles(ids as number[])
      toast.success("批量删除成功")
      setSelectedIds(new Set())
      loadData()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || "批量删除失败")
    }
  }, [toast, loadData])

  const handleSubmit = useCallback(async (formData: Record<string, any>) => {
    try {
      // 移除空字符串字段
      const submitData: Record<string, any> = { ...formData }
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === "" || submitData[key] === null) {
          delete submitData[key]
        }
      })

      if (dialogMode === "create") {
        await rolesApi.createRole(submitData)
        toast.success("角色创建成功")
      } else if (dialogMode === "edit" && editingRole) {
        await rolesApi.updateRole(editingRole.id, submitData)
        toast.success("角色更新成功")
      }
      setDialogOpen(false)
      loadData()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || "操作失败")
    }
  }, [dialogMode, editingRole, toast, loadData])

  const handleViewEdit = useCallback(() => {
    if (editingRole) {
      setDialogMode("edit")
    }
  }, [editingRole])

  const dialogTitle =
    dialogMode === "create" ? "新建角色" :
    dialogMode === "edit" ? "编辑角色" : "角色详情"

  return (
    <div>
      <CrudTable
        title="角色管理"
        subtitle="管理系统角色及权限分配"
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
        emptyText="暂无角色数据"
        createButtonText="新建角色"
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fields}
        initialData={editingRole || {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />
    </div>
  )
}
