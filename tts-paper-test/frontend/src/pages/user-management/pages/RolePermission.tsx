/**
 * 角色权限管理 - 连接真实API
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, Shield, X, Check, ChevronDown, ChevronRight, ShieldCheck, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { usersApi } from "@/lib/api"

interface RoleItem {
  key: string
  name: string
  description: string
  permissions: string[]
}

// 权限树定义
const permissionTree = [
  { key: "test-mgmt", label: "测试管理", children: [
    { key: "requirements", label: "需求管理", children: [{ key: "req-view", label: "查看需求" }, { key: "req-create", label: "创建需求" }, { key: "req-edit", label: "编辑需求" }, { key: "req-delete", label: "删除需求" }] },
    { key: "plans", label: "方案管理", children: [{ key: "plan-view", label: "查看方案" }, { key: "plan-create", label: "创建方案" }, { key: "plan-edit", label: "编辑方案" }] },
    { key: "cases", label: "用例管理", children: [{ key: "case-view", label: "查看用例" }, { key: "case-create", label: "创建用例" }, { key: "case-review", label: "用例评审" }] },
    { key: "reviews", label: "评审管理", children: [{ key: "rev-view", label: "查看评审" }, { key: "rev-approve", label: "审批用例" }] },
  ]},
  { key: "ai-auto", label: "AI自动化", children: [
    { key: "pipeline", label: "全流程执行", children: [{ key: "pipe-run", label: "执行流水线" }, { key: "pipe-view", label: "查看结果" }] },
    { key: "records", label: "流程记录", children: [{ key: "rec-view", label: "查看记录" }, { key: "rec-delete", label: "删除记录" }] },
  ]},
  { key: "config", label: "基础配置", children: [
    { key: "env", label: "环境配置", children: [{ key: "env-view", label: "查看环境" }, { key: "env-edit", label: "编辑环境" }] },
    { key: "llm", label: "大模型配置", children: [{ key: "llm-view", label: "查看模型" }, { key: "llm-edit", label: "配置模型" }] },
    { key: "mcp", label: "MCP服务", children: [{ key: "mcp-view", label: "查看服务" }, { key: "mcp-edit", label: "管理服务" }] },
  ]},
  { key: "personal", label: "个人中心", children: [
    { key: "users", label: "用户管理", children: [{ key: "usr-view", label: "查看用户" }, { key: "usr-create", label: "创建用户" }, { key: "usr-edit", label: "编辑用户" }, { key: "usr-delete", label: "删除用户" }, { key: "usr-resetpwd", label: "重置密码" }] },
    { key: "roles", label: "角色管理", children: [{ key: "role-view", label: "查看角色" }, { key: "role-edit", label: "编辑角色" }, { key: "role-perm", label: "权限配置" }] },
    { key: "profile", label: "个人设置", children: [{ key: "pf-info", label: "编辑个人信息" }, { key: "pf-pwd", label: "修改密码" }] },
  ]},
]

const roleColors = [
  "from-amber to-orange-500",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-green-600",
  "from-purple-500 to-pink-600",
  "from-slate-500 to-gray-600",
  "from-cyan-500 to-teal-600",
]

export default function RolePermission() {
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [roleStats, setRoleStats] = useState<Record<string, number>>({})

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, statsRes] = await Promise.all([
        usersApi.listRoles(),
        usersApi.getRoleStats(),
      ])
      if (listRes?.data) setRoles(listRes.data)
      if (statsRes?.data) setRoleStats(statsRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  // 新建/编辑弹窗
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [form, setForm] = useState({ name: "", code: "", desc: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // 权限配置弹窗
  const [showPermDialog, setShowPermDialog] = useState(false)
  const [permRole, setPermRole] = useState<RoleItem | null>(null)
  const [permSelections, setPermSelections] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const filtered = roles.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.key.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // 角色CRUD
  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "角色名称不能为空"
    if (!form.code.trim()) errors.code = "角色编码不能为空"
    else if (!/^[a-z_]+$/.test(form.code)) errors.code = "编码只能包含小写字母和下划线"
    if (dialogMode === "create" && roles.some((r) => r.key === form.code)) errors.code = "编码已存在"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      if (dialogMode === "create") {
        await usersApi.createRole({ name: form.name, code: form.code, description: form.desc })
        toast.success("角色创建成功")
      } else if (editingRole) {
        await usersApi.updateRole(editingRole.key, { name: form.name, description: form.desc })
        toast.success("角色更新成功")
      }
      setShowDialog(false)
      fetchRoles()
    } catch (e: any) {
      toast.error(e?.message || "操作失败")
    }
  }

  const handleDelete = async (role: RoleItem) => {
    if (role.key === "admin") { toast.error("管理员角色不可删除"); return }
    if (!confirm(`确定删除角色「${role.name}」？`)) return
    try {
      await usersApi.deleteRole(role.key)
      toast.success("角色已删除")
      fetchRoles()
    } catch { toast.error("删除失败") }
  }

  const openCreate = () => { setDialogMode("create"); setEditingRole(null); setForm({ name: "", code: "", desc: "" }); setFormErrors({}); setShowDialog(true) }
  const openEdit = (role: RoleItem) => { setDialogMode("edit"); setEditingRole(role); setForm({ name: role.name, code: role.key, desc: role.description || "" }); setFormErrors({}); setShowDialog(true) }

  // 权限配置
  const openPermDialog = async (role: RoleItem) => {
    setPermRole(role)
    setPermSelections(new Set(role.permissions || []))
    setExpandedGroups(new Set())
    setShowPermDialog(true)
  }

  const toggleGroupExpand = (key: string) => {
    const next = new Set(expandedGroups)
    if (next.has(key)) next.delete(key); else next.add(key)
    setExpandedGroups(next)
  }

  const togglePerm = (key: string) => {
    const next = new Set(permSelections)
    if (next.has(key)) next.delete(key); else next.add(key)
    setPermSelections(next)
  }

  const toggleModulePerms = (modulePerms: string[]) => {
    const next = new Set(permSelections)
    const allSelected = modulePerms.every((p) => next.has(p))
    modulePerms.forEach((p) => { allSelected ? next.delete(p) : next.add(p) })
    setPermSelections(next)
  }

  const toggleGroupPerms = (group: any) => {
    const allPerms = group.children.flatMap((m: any) => m.children.map((p: any) => p.key))
    const next = new Set(permSelections)
    const allSelected = allPerms.every((p: string) => next.has(p))
    allPerms.forEach((p: string) => { allSelected ? next.delete(p) : next.add(p) })
    setPermSelections(next)
  }

  const handleSavePerms = async () => {
    if (!permRole) return
    try {
      await usersApi.updateRole(permRole.key, { permissions: Array.from(permSelections) })
      toast.success(`角色「${permRole.name}」权限已更新`)
      setShowPermDialog(false)
      fetchRoles()
    } catch { toast.error("保存失败") }
  }

  const totalPerms = permissionTree.flatMap((g) => g.children.flatMap((m) => m.children.map((p) => p.key))).length

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">角色权限 <span className="text-xs font-normal text-muted">({roles.length}个角色)</span></h2><p className="text-xs text-muted mt-0.5">角色管理与权限树配置，控制不同用户的功能访问范围</p></div>
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索角色名称/编码..." className="w-52 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <button onClick={fetchRoles} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 ml-auto"><Plus className="w-3.5 h-3.5" /> 新建角色</button>
      </div>
      {/* 角色卡片网格 */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-amber" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 flex-1">
          {filtered.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted"><Shield className="w-12 h-12 mb-3 text-muted-light" /><p className="text-sm font-medium">暂无角色数据</p></div>
          ) : filtered.map((role, idx) => {
            const memberCount = roleStats[role.key] || 0
            const permPercent = Math.round(((role.permissions?.length || 0) / totalPerms) * 100)
            const color = roleColors[idx % roleColors.length]
            return (
              <div key={role.key} className="bg-white rounded-2xl border border-border shadow-card p-5 hover:shadow-card-hover transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-ink">{role.name}</h3>
                      <p className="text-[11px] text-muted font-mono">{role.key}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openPermDialog(role)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors" title="配置权限"><ShieldCheck className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(role)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors" title="编辑"><Edit className="w-4 h-4" /></button>
                    {role.key !== "admin" && <button onClick={() => handleDelete(role)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
                <p className="text-xs text-muted mb-3">{role.description}</p>
                {/* 权限进度条 */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted">权限覆盖</span>
                    <span className="text-[11px] font-medium text-ink">{role.permissions?.length || 0}/{totalPerms} ({permPercent}%)</span>
                  </div>
                  <div className="h-1.5 bg-cream rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber to-amber-hover rounded-full transition-all" style={{ width: `${permPercent}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>{memberCount} 个成员</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新建/编辑角色弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[420px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{dialogMode === "create" ? "新建角色" : "编辑角色"}</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="block text-xs font-medium text-ink-light mb-1">角色名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：测试经理" />{formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">角色编码 *</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={dialogMode === "edit"} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink font-mono focus:border-amber outline-none disabled:bg-cream disabled:text-muted ${formErrors.code ? "border-fail" : "border-border"}`} placeholder="如：test_manager" />{formErrors.code && <p className="text-[11px] text-fail mt-1">{formErrors.code}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">描述</label><textarea value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="角色描述..." /></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 权限配置弹窗 */}
      {showPermDialog && permRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPermDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-white" /></div>
                <div>
                  <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>权限配置</h3>
                  <p className="text-[11px] text-muted">{permRole.name} · 已选择 {permSelections.size} 项权限</p>
                </div>
              </div>
              <button onClick={() => setShowPermDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {permissionTree.map((group) => {
                const groupPerms = group.children.flatMap((m) => m.children.map((p) => p.key))
                const groupSelected = groupPerms.filter((p) => permSelections.has(p)).length
                const isExpanded = expandedGroups.has(group.key)
                return (
                  <div key={group.key} className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-cream/50 cursor-pointer hover:bg-cream transition-colors" onClick={() => toggleGroupExpand(group.key)}>
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
                        <span className="text-sm font-semibold text-ink">{group.label}</span>
                        <span className="text-[11px] text-muted">({groupSelected}/{groupPerms.length})</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleGroupPerms(group) }} className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${groupSelected === groupPerms.length ? "bg-pass/10 text-pass" : "bg-cream text-muted hover:bg-border"}`}>
                        {groupSelected === groupPerms.length ? "全部选中" : "全选"}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="px-4 py-2 space-y-2">
                        {group.children.map((mod) => {
                          const modSelected = mod.children.filter((p) => permSelections.has(p.key)).length
                          return (
                            <div key={mod.key} className="bg-cream/20 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-ink-light">{mod.label}</span>
                                  <span className="text-[10px] text-muted">({modSelected}/{mod.children.length})</span>
                                </div>
                                <button onClick={() => toggleModulePerms(mod.children.map((p: any) => p.key))} className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${modSelected === mod.children.length ? "bg-pass/10 text-pass" : "bg-cream text-muted hover:bg-border"}`}>
                                  {modSelected === mod.children.length ? "已全选" : "全选"}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {mod.children.map((perm: any) => (
                                  <button key={perm.key} onClick={() => togglePerm(perm.key)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${permSelections.has(perm.key) ? "bg-pass/10 text-pass border-pass/30" : "bg-white text-muted border-border hover:border-amber/50"}`}>
                                    {permSelections.has(perm.key) && <Check className="w-3 h-3 inline mr-0.5" />}
                                    {perm.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-between items-center flex-shrink-0">
              <button onClick={() => { const all = permissionTree.flatMap((g) => g.children.flatMap((m) => m.children.map((p) => p.key))); setPermSelections(new Set(all)) }} className="text-xs text-amber-hover hover:text-amber font-medium">全选所有权限</button>
              <div className="flex gap-2">
                <button onClick={() => setShowPermDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
                <button onClick={handleSavePerms} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">保存权限</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
