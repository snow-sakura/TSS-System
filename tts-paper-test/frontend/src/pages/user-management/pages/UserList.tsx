/**
 * 用户列表 - 连接真实API的CRUD
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, X, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { usersApi } from "@/lib/api"
import { Skeleton } from "@/components/ui/Skeleton"

interface UserItem {
  id: number
  username: string
  email: string
  display_name: string
  role: string
  status: string
  created_at: string
  last_login_at: string
}

const roleOptions = ["admin", "tester", "developer", "viewer"]
const roleLabels: Record<string, string> = { admin: "管理员", tester: "测试工程师", developer: "开发工程师", viewer: "观察者" }
const statusOptions = ["active", "inactive"]
const statusLabels: Record<string, string> = { active: "启用", inactive: "禁用" }

export default function UserList() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 })

  const [showDialog, setShowDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [form, setForm] = useState({ username: "", email: "", password: "", display_name: "", role: "viewer", status: "active" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await usersApi.listUsers({
        page: currentPage,
        page_size: 20,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      })
      if (res?.data) {
        setUsers(res.data.items || [])
        setPagination((p) => ({ ...p, total: res.data.total, total_pages: res.data.total_pages }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [currentPage, search, roleFilter, statusFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.username.trim()) errors.username = "用户名不能为空"
    if (!form.email.trim()) errors.email = "邮箱不能为空"
    if (!editingUser && !form.password.trim()) errors.password = "密码不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      if (editingUser) {
        const res: any = await usersApi.updateUser(editingUser.id, {
          email: form.email,
          display_name: form.display_name,
          role: form.role,
          status: form.status,
        })
        if (res?.success !== false) {
          toast.success("用户更新成功")
          setShowDialog(false)
          fetchUsers()
        } else {
          toast.error(res.message || "更新失败")
        }
      } else {
        const res: any = await usersApi.createUser({
          username: form.username,
          email: form.email,
          password: form.password,
          display_name: form.display_name,
          role: form.role,
          status: form.status,
        })
        if (res?.success !== false) {
          toast.success("用户创建成功")
          setShowDialog(false)
          fetchUsers()
        } else {
          toast.error(res.message || "创建失败")
        }
      }
    } catch (e) {
      toast.error("操作失败")
    }
  }

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`确定删除用户「${u.username}」？`)) return
    try {
      await usersApi.deleteUser(u.id)
      toast.success("用户已删除")
      fetchUsers()
    } catch (e) {
      toast.error("删除失败")
    }
  }

  const openCreate = () => {
    setEditingUser(null)
    setForm({ username: "", email: "", password: "", display_name: "", role: "viewer", status: "active" })
    setFormErrors({})
    setShowDialog(true)
  }

  const openEdit = (u: UserItem) => {
    setEditingUser(u)
    setForm({ username: u.username, email: u.email, password: "", display_name: u.display_name || "", role: u.role, status: u.status })
    setFormErrors({})
    setShowDialog(true)
  }

  const roleColor = (r: string) => {
    if (r === "admin") return "bg-fail/10 text-fail border border-fail/20"
    if (r === "tester") return "bg-info/10 text-info border border-info/20"
    if (r === "developer") return "bg-pass/10 text-pass border border-pass/20"
    return "bg-cream text-muted border border-border"
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">用户列表 <span className="text-xs font-normal text-muted">({pagination.total}条)</span></h2><p className="text-xs text-muted mt-0.5">系统用户管理，支持角色分配和状态控制</p></div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchUsers()} placeholder="搜索用户名/邮箱..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部角色</option>{roleOptions.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部状态</option>{statusOptions.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</select>
        <button onClick={fetchUsers} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 ml-auto"><Plus className="w-3.5 h-3.5" /> 新建用户</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Skeleton className="h-4 w-48" count={3} /></div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-cream/50">
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light">ID</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light">用户名</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light">邮箱</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light">角色</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light">状态</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light">创建时间</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-ink-light">操作</th>
            </tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted">暂无用户数据</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-cream/30 transition-colors">
                  <td className="px-4 py-3 text-center text-xs text-muted">{u.id}</td>
                  <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-2"><div className="w-7 h-7 rounded-full bg-amber/10 flex items-center justify-center"><span className="text-xs font-medium text-amber">{u.username[0]?.toUpperCase()}</span></div><span className="text-sm font-medium text-ink">{u.username}</span></div></td>
                  <td className="px-4 py-3 text-center text-xs text-ink-light">{u.email}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${roleColor(u.role)}`}>{roleLabels[u.role] || u.role}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${u.status === "active" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{statusLabels[u.status] || u.status}</span></td>
                  <td className="px-4 py-3 text-center text-xs text-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString("zh-CN") : "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-700 transition-colors" title="编辑"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(u)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-muted">共 {pagination.total} 条</span>
        <div className="flex items-center gap-1">
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
          <span className="h-8 px-3 text-xs rounded-lg gradient-amber text-white flex items-center">{currentPage}</span>
          <button disabled={currentPage >= pagination.total_pages} onClick={() => setCurrentPage((p) => p + 1)} className="h-8 px-3 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
        </div>
      </div>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[480px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{editingUser ? "编辑用户" : "新建用户"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">
              {!editingUser && <div><label className="block text-xs font-medium text-ink-light mb-1">用户名 *</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.username ? "border-fail" : "border-border"}`} placeholder="如：zhangsan" />{formErrors.username && <p className="text-[11px] text-fail mt-1">{formErrors.username}</p>}</div>}
              <div><label className="block text-xs font-medium text-ink-light mb-1">邮箱 *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.email ? "border-fail" : "border-border"}`} placeholder="user@example.com" />{formErrors.email && <p className="text-[11px] text-fail mt-1">{formErrors.email}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">显示名称</label><input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="如：张三" /></div>
              {!editingUser && <div><label className="block text-xs font-medium text-ink-light mb-1">密码 *</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.password ? "border-fail" : "border-border"}`} placeholder="至少6位" />{formErrors.password && <p className="text-[11px] text-fail mt-1">{formErrors.password}</p>}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">角色</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none">{roleOptions.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">状态</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none">{statusOptions.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
