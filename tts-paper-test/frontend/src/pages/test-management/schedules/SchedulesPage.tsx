/**
 * 调度配置页面 — 接后端 /test-lifecycle/schedules 真实 CRUD
 */
import { useState, useEffect, useMemo, useCallback } from "react"
import { Plus, Edit2, Trash2, Play, Pause, X } from "lucide-react"
import { lifecycleApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"

interface Schedule {
  id: number
  name: string
  cron_expr: string
  status: "running" | "paused"
  description?: string
  schedule_type?: string
  execution_count?: number
  last_run_at?: string
  next_run_at?: string
}

const STATUS_LABELS: Record<string, string> = { running: "运行中", paused: "已暂停" }

export default function SchedulesPage() {
  const toast = useToast()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialog, setDialog] = useState<{ open: boolean; editing: Schedule | null }>({ open: false, editing: null })
  const [form, setForm] = useState({ name: "", cron_expr: "", description: "", status: "running" })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await lifecycleApi.listSchedules()
      setSchedules(Array.isArray(data) ? data : [])
    } catch (e) {
      toast?.error?.("加载调度列表失败")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return schedules
    return schedules.filter(s => (s.name || "").toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q))
  }, [schedules, searchTerm])

  const statusCounts = useMemo(() => ({
    running: schedules.filter(s => s.status === "running").length,
    paused: schedules.filter(s => s.status === "paused").length,
  }), [schedules])

  const openCreate = () => {
    setForm({ name: "", cron_expr: "", description: "", status: "running" })
    setDialog({ open: true, editing: null })
  }

  const openEdit = (s: Schedule) => {
    setForm({ name: s.name, cron_expr: s.cron_expr, description: s.description || "", status: s.status })
    setDialog({ open: true, editing: s })
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.cron_expr.trim()) {
      toast?.error?.("请填写调度名称和 Cron 表达式")
      return
    }
    setSaving(true)
    try {
      if (dialog.editing) {
        await lifecycleApi.updateSchedule(dialog.editing.id, form)
        toast?.success?.("调度已更新")
      } else {
        await lifecycleApi.createSchedule(form)
        toast?.success?.("调度创建成功")
      }
      setDialog({ open: false, editing: null })
      loadData()
    } catch (e) {
      toast?.error?.("保存失败")
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (s: Schedule) => {
    const next = s.status === "running" ? "paused" : "running"
    try {
      await lifecycleApi.toggleSchedule(s.id, next)
      toast?.success?.(next === "running" ? "调度已启用" : "调度已暂停")
      loadData()
    } catch (e) {
      toast?.error?.("操作失败")
    }
  }

  const handleDelete = async (s: Schedule) => {
    if (!window.confirm(`确认删除调度「${s.name}」？`)) return
    try {
      await lifecycleApi.deleteSchedule(s.id)
      toast?.success?.("调度已删除")
      loadData()
    } catch (e) {
      toast?.error?.("删除失败")
    }
  }

  return (
    <div className="p-4 md:p-6">
      {/* 页头：标题 + 说明 + 主操作（统一布局） */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink">执行调度</h2>
          <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">共 {schedules.length} 条</span>
        </div>
        <button
          onClick={openCreate}
          className="h-9 px-4 rounded-xl bg-pass text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> 新建调度
        </button>
      </div>

      {/* 统计徽章行（统一紧凑样式） */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white border border-border text-[11px] text-muted">
          活跃调度 <strong className="text-pass">{statusCounts.running}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white border border-border text-[11px] text-muted">
          已暂停 <strong className="text-ink">{statusCounts.paused}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white border border-border text-[11px] text-muted">
          今日执行 <strong className="text-info">0</strong>
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <input
            placeholder="搜索调度..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full max-w-sm h-9 px-3 text-sm bg-cream border border-border rounded-xl input-focus"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted text-sm">加载中...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-cream/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-light">调度名称</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-light">Cron表达式</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-light">状态</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-light">描述</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-ink-light w-36">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted">暂无调度，点击右上角「新建调度」创建</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-cream/50">
                  <td className="px-5 py-3.5 text-sm font-medium text-ink">{s.name}</td>
                  <td className="px-5 py-3.5">
                    <code className="px-2 py-1 rounded bg-cream text-xs text-info">{s.cron_expr}</code>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${
                      s.status === "running" ? "bg-pass/10 text-pass" : "bg-cream text-muted"
                    }`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted max-w-[280px] truncate">{s.description || "-"}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggle(s)}
                        className={`p-1.5 rounded-lg hover:bg-cream ${s.status === "running" ? "text-amber" : "text-pass"}`}
                        title={s.status === "running" ? "暂停" : "启用"}
                      >
                        {s.status === "running" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-cream text-info" title="编辑">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg hover:bg-fail/10 text-fail" title="删除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      {dialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setDialog({ open: false, editing: null })}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink">{dialog.editing ? "编辑调度" : "新建调度"}</h3>
              <button onClick={() => setDialog({ open: false, editing: null })} className="p-1.5 rounded-lg hover:bg-cream">
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">调度名称 *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="如：每日回归测试"
                  className="w-full h-9 px-3 text-sm bg-cream border border-border rounded-xl input-focus"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Cron 表达式 *</label>
                <input
                  value={form.cron_expr}
                  onChange={e => setForm(f => ({ ...f, cron_expr: e.target.value }))}
                  placeholder="如：0 2 * * *"
                  className="w-full h-9 px-3 text-sm bg-cream border border-border rounded-xl input-focus"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">描述</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="调度用途说明"
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-cream border border-border rounded-xl input-focus resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">初始状态</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full h-9 px-3 text-sm bg-cream border border-border rounded-xl input-focus"
                >
                  <option value="running">运行中</option>
                  <option value="paused">已暂停</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setDialog({ open: false, editing: null })}
                className="h-9 px-4 rounded-xl border border-border text-sm text-muted hover:bg-cream"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-4 rounded-xl bg-pass text-white text-sm font-medium hover:shadow-md disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
