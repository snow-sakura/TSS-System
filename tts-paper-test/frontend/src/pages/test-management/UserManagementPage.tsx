import { useState, useEffect, useCallback } from "react"
import { KeyRound } from "lucide-react"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { usersApi, rolesApi } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { useConfirmStore } from "@/stores/confirmStore"

interface UserItem {
  id: number
  username: string
  email: string
  display_name: string
  role: string
  status: string
  last_login_at?: string
  created_at?: string
}

const roleOptions = [
  { label: "管理员", value: "admin" },
  { label: "测试工程师", value: "tester" },
  { label: "开发工程师", value: "developer" },
  { label: "观察者", value: "viewer" },
]

const statusOptions = [
  { label: "活跃", value: "active" },
  { label: "禁用", value: "inactive" },
]

const roleLabels: Record<string, string> = {
  admin: "管理员",
  tester: "测试工程师",
  developer: "开发工程师",
  viewer: "观察者",
  user: "普通用户",
  manager: "项目经理",
}

const roleColors: Record<string, string> = {
  admin: "bg-fail/10 text-fail border border-fail/20",
  tester: "bg-info/10 text-info border border-info/20",
  developer: "bg-pass/10 text-pass border border-pass/20",
  viewer: "bg-cream text-muted border border-border",
  user: "bg-amber/10 text-amber border border-amber/20",
  manager: "bg-violet-100 text-violet-700 border border-violet-200",
}

export default function UserManagementPage() {
  const toast = useToast()
  const confirm = useConfirmStore((s) => s.confirm)

  const [users, setUsers] = useState<UserItem[]>([])
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)

  // 加载角色列表
  const loadRoles = useCallback(async () => {
    try {
      const res = await rolesApi.listAllRoles()
      const list = res?.data || (Array.isArray(res) ? res : [])
      setRoles(Array.isArray(list) ? list : [])
    } catch {
      setRoles([])
    }
  }, [])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  // 动态生成角色选项
  const dynamicRoleOptions = roles.map(r => ({
    label: r.name,
    value: r.name,
  }))

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await usersApi.listUsers({
        page,
        page_size: pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
      })
      const payload = res?.data
      const list = Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload) ? payload : [])
      const totalCount = typeof payload?.total === 'number' ? payload.total : list.length
      setUsers(list)
      setTotal(totalCount)
    } catch (e) {
      toast.error("加载用户列表失败")
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter, roleFilter, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === "status") setStatusFilter(value)
    else if (key === "role") setRoleFilter(value)
    setPage(1)
  }, [])

  const handleSelectionChange = useCallback((ids: Set<string | number>) => {
    setSelectedIds(ids)
  }, [])

  const handleCreate = () => {
    setDialogMode("create")
    setEditingUser(null)
    setDialogOpen(true)
  }

  const handleEdit = (row: UserItem) => {
    setDialogMode("edit")
    setEditingUser(row)
    setDialogOpen(true)
  }

  const handleView = (row: UserItem) => {
    setDialogMode("view")
    setEditingUser(row)
    setDialogOpen(true)
  }

  const handleDelete = async (row: UserItem) => {
    const ok = await confirm({
      title: "确认删除",
      message: `确定删除用户「${row.username}」？`,
      danger: true,
      confirmText: "删除",
    })
    if (!ok) return
    try {
      await usersApi.deleteUser(row.id)
      toast.success("用户已删除")
      loadData()
    } catch (e) {
      toast.error("删除失败")
    }
  }

  const handleBatchDelete = async (ids: (string | number)[]) => {
    const ok = await confirm({
      title: "批量删除",
      message: `确定删除选中的 ${ids.length} 个用户？`,
      danger: true,
      confirmText: "删除",
    })
    if (!ok) return
    try {
      await Promise.all(ids.map((id) => usersApi.deleteUser(id as number)))
      toast.success(`已删除 ${ids.length} 个用户`)
      setSelectedIds(new Set())
      loadData()
    } catch (e) {
      toast.error("批量删除失败")
    }
  }

  const handleResetPassword = async (row: UserItem) => {
    const ok = await confirm({
      title: "重置密码",
      message: `确定要重置用户「${row.username}」的密码？新密码将发送到其邮箱。`,
      confirmText: "重置",
    })
    if (!ok) return
    try {
      await usersApi.updateUser(row.id, { reset_password: true })
      toast.success("密码已重置")
    } catch (e) {
      toast.error("密码重置失败")
    }
  }

  const handleSubmit = async (data: Record<string, any>) => {
    try {
      if (dialogMode === "create") {
        const res: any = await usersApi.createUser({
          username: data.username,
          email: data.email,
          password: data.password,
          display_name: data.display_name,
          role: data.role,
          status: data.status,
        })
        if (res?.success !== false) {
          toast.success("用户创建成功")
          setDialogOpen(false)
          loadData()
        } else {
          toast.error(res?.message || "创建失败")
        }
      } else if (editingUser) {
        const res: any = await usersApi.updateUser(editingUser.id, {
          email: data.email,
          display_name: data.display_name,
          role: data.role,
          status: data.status,
        })
        if (res?.success !== false) {
          toast.success("用户更新成功")
          setDialogOpen(false)
          loadData()
        } else {
          toast.error(res?.message || "更新失败")
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "操作失败")
    }
  }

  const columns: CrudColumn[] = [
    {
      key: "username",
      title: "用户名",
      render: (_: any, row: UserItem) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-amber">
              {row.username?.[0]?.toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-ink">{row.username}</span>
        </div>
      ),
    },
    { key: "email", title: "邮箱" },
    { key: "display_name", title: "显示名" },
    {
      key: "role",
      title: "角色",
      render: (value: string) => {
        if (!value) return <span className="text-muted">—</span>
        const label = roleLabels[value]
        if (label) {
          return (
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                roleColors[value] || roleColors.viewer
              }`}
            >
              {label}
            </span>
          )
        }
        // 已是中文则直接显示，否则显示"—"
        const isChinese = /[\u4e00-\u9fa5]/.test(value)
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-cream text-ink border border-border">
            {isChinese ? value : "—"}
          </span>
        )
      },
    },
    { key: "status", title: "状态" },
    { key: "last_login_at", title: "最后登录时间", width: "min-w-[160px]", align: "center",
      render: (value: string) => (
        <span className="text-xs text-ink font-mono">
          {formatDateTime(value)}
        </span>
      ),
    },
    {
      key: "reset",
      title: "重置密码",
      width: "80px",
      align: "center",
      render: (_: any, row: UserItem) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleResetPassword(row)
          }}
          className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"
          title="重置密码"
        >
          <KeyRound className="w-4 h-4" />
        </button>
      ),
    },
  ]

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索用户名/邮箱", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "role", label: "全部角色", type: "select", options: dynamicRoleOptions },
  ]

  const statusConfig = {
    active: { label: "活跃", color: "bg-pass/10 text-pass" },
    inactive: { label: "禁用", color: "bg-cream text-muted" },
  }

  const createFields: CrudField[] = [
    {
      key: "username",
      label: "用户名",
      type: "text",
      required: true,
      placeholder: "如：zhangsan",
      validation: (v) => (!v || !v.trim() ? "用户名不能为空" : null),
    },
    {
      key: "email",
      label: "邮箱",
      type: "email",
      required: true,
      placeholder: "user@example.com",
      validation: (v) => {
        if (!v || !v.trim()) return "邮箱不能为空"
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "邮箱格式不正确"
        return null
      },
    },
    {
      key: "display_name",
      label: "显示名",
      type: "text",
      placeholder: "如：张三",
    },
    {
      key: "password",
      label: "密码",
      type: "password",
      required: true,
      placeholder: "至少6位",
      validation: (v) => (!v || !v.trim() ? "密码不能为空" : null),
    },
    {
      key: "role",
      label: "角色",
      type: "select",
      options: dynamicRoleOptions,
      default: roles.length > 0 ? roles[0].name : "",
    },
    {
      key: "status",
      label: "状态",
      type: "select",
      options: statusOptions,
      default: "active",
    },
  ]

  const editFields: CrudField[] = [
    {
      key: "username",
      label: "用户名",
      type: "text",
      disabled: true,
      helpText: "用户名创建后不可修改",
    },
    {
      key: "email",
      label: "邮箱",
      type: "email",
      required: true,
      placeholder: "user@example.com",
      validation: (v) => {
        if (!v || !v.trim()) return "邮箱不能为空"
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "邮箱格式不正确"
        return null
      },
    },
    {
      key: "display_name",
      label: "显示名",
      type: "text",
      placeholder: "如：张三",
    },
    {
      key: "role",
      label: "角色",
      type: "select",
      options: dynamicRoleOptions,
    },
    {
      key: "status",
      label: "状态",
      type: "select",
      options: statusOptions,
    },
  ]

  const viewFields: CrudField[] = editFields.map((f) => ({ ...f, disabled: true }))

  const fields =
    dialogMode === "create"
      ? createFields
      : dialogMode === "edit"
        ? editFields
        : viewFields

  const dialogTitle =
    dialogMode === "create"
      ? "新建用户"
      : dialogMode === "edit"
        ? "编辑用户"
        : "用户详情"

  return (
    <div>
      <CrudTable
        title="用户管理"
        subtitle="系统用户管理，支持角色分配和状态控制"
        columns={columns}
        filters={filters}
        data={users}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        selectedIds={selectedIds}
        showCreateButton
        createButtonText="新建用户"
        statusConfig={statusConfig}
        emptyText="暂无用户数据"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        onBatchDelete={handleBatchDelete}
        onSelectionChange={handleSelectionChange}
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fields}
        initialData={{
          username: editingUser?.username || "",
          email: editingUser?.email || "",
          display_name: editingUser?.display_name || "",
          role: editingUser?.role || "viewer",
          status: editingUser?.status || "active",
          password: "",
        }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
