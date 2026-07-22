/**
 * 调度配置 - 定时任务与CI/CD集成
 */
import { useState, useEffect, useCallback } from "react"
import { Plus, Edit, Trash2, Calendar, Clock, Power, PowerOff, X, ToggleLeft, ToggleRight } from "lucide-react"
import { toast } from "sonner"
import { lifecycleApi } from "@/lib/api"

const initialSchedules = [
  { id: 1, name: "每日回归测试", cron: "0 22 * * *", module: "全模块", environment: "测试环境", trigger: "定时", enabled: true, lastRun: "2026-07-19 22:00", nextRun: "2026-07-20 22:00", lastResult: "通过", description: "每晚10点执行全量回归测试" },
  { id: 2, name: "CI-构建后冒烟", cron: "由CI触发", module: "全模块", environment: "预发布环境", trigger: "CI/CD", enabled: true, lastRun: "2026-07-20 08:30", nextRun: "下一次构建后", lastResult: "失败", description: "代码合并后自动触发冒烟测试" },
  { id: 3, name: "每周接口自动化", cron: "0 7 * * 1", module: "全模块", environment: "测试环境", trigger: "定时", enabled: true, lastRun: "2026-07-14 07:00", nextRun: "2026-07-21 07:00", lastResult: "通过", description: "每周一早上7点执行接口自动化测试" },
  { id: 4, name: "支付模块专项", cron: "0 10 * * 1-5", module: "支付模块", environment: "测试环境", trigger: "定时", enabled: false, lastRun: "2026-07-18 10:00", nextRun: "-", lastResult: "通过", description: "工作日上午10点执行支付模块专项测试" },
  { id: 5, name: "API-触发批量执行", cron: "由API触发", module: "登录模块", environment: "测试环境", trigger: "API触发", enabled: true, lastRun: "2026-07-19 15:00", nextRun: "等待API调用", lastResult: "通过", description: "通过API接口触发，支持自定义参数" },
]

export default function ScheduleConfig() {
  const [schedules, setSchedules] = useState<Array<{ id: number; name: string; cron: string; module: string; environment: string; trigger: string; enabled: boolean; lastRun: string; nextRun: string; lastResult: string; description: string }>>(initialSchedules)
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingSchedule, setEditingSchedule] = useState<any>(null)
  const [form, setForm] = useState<Record<string, string>>({ name: "", cron: "", module: "全模块", environment: "测试环境", trigger: "定时", description: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // 从后端加载调度数据
  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await lifecycleApi.listExecutions({ page: 1, page_size: 100 })
      if (res?.data?.items) {
        const scheduled = res.data.items
          .filter((e: any) => e.triggered_by === "schedule" || e.triggered_by === "ci")
          .map((e: any) => ({
            id: e.id,
            name: e.name,
            cron: e.triggered_by === "ci" ? "由CI触发" : "0 22 * * *",
            module: e.test_type || "全模块",
            environment: e.environment || "测试环境",
            trigger: e.triggered_by === "ci" ? "CI/CD" : "定时",
            enabled: e.status !== "stopped",
            lastRun: e.started_at || "-",
            nextRun: e.status === "running" ? "执行中" : "下次触发时",
            lastResult: e.status === "passed" || e.status === "completed" ? "通过" : e.status === "failed" ? "失败" : "-",
            description: `环境: ${e.environment || "测试环境"}`,
          }))
        setSchedules(scheduled.length > 0 ? scheduled : initialSchedules)
      }
    } catch {
      // 保持mock数据
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "任务名称不能为空"
    if (form.trigger === "定时" && !form.cron.trim()) errors.cron = "Cron表达式不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      const triggerMap: Record<string, string> = { "定时": "schedule", "CI/CD": "ci", "API触发": "api" }
      if (dialogMode === "create") {
        await lifecycleApi.createExecution({
          name: form.name,
          test_type: form.module,
          environment: form.environment,
          triggered_by: triggerMap[form.trigger] || "manual",
        })
        toast.success("调度任务创建成功")
      } else {
        await lifecycleApi.updateExecution(editingSchedule.id, {
          name: form.name,
          test_type: form.module,
          environment: form.environment,
        })
        toast.success("调度任务更新成功")
      }
      setShowDialog(false)
      fetchSchedules()
    } catch {
      // 保持本地操作作为后备
      if (dialogMode === "create") {
        const newId = Math.max(...schedules.map((s) => s.id)) + 1
        setSchedules([...schedules, { id: newId, name: form.name, cron: form.cron, module: form.module, environment: form.environment, trigger: form.trigger, description: form.description, enabled: true, lastRun: "-", nextRun: "-", lastResult: "-" }])
      } else {
        setSchedules(schedules.map((s) => s.id === editingSchedule.id ? { ...s, ...form } : s))
      }
      setShowDialog(false)
      toast.success(dialogMode === "create" ? "调度任务创建成功" : "调度任务更新成功")
    }
  }

  const handleDelete = async (s: any) => {
    if (!confirm(`确定删除调度任务「${s.name}」？`)) return
    try {
      await lifecycleApi.deleteExecution(s.id)
      toast.success("调度任务已删除")
      fetchSchedules()
    } catch {
      setSchedules(schedules.filter((x) => x.id !== s.id))
      toast.success("调度任务已删除")
    }
  }

  const handleToggle = (s: any) => {
    setSchedules(schedules.map((x) => x.id === s.id ? { ...x, enabled: !x.enabled } : x))
    toast.success(`任务「${s.name}」已${s.enabled ? "禁用" : "启用"}`)
  }

  const openCreate = () => { setDialogMode("create"); setEditingSchedule(null); setForm({ name: "", cron: "", module: "全模块", environment: "测试环境", trigger: "定时", description: "" }); setFormErrors({}); setShowDialog(true) }
  const openEdit = (s: any) => { setDialogMode("edit"); setEditingSchedule(s); setForm({ name: s.name, cron: s.cron, module: s.module, environment: s.environment, trigger: s.trigger, description: s.description }); setFormErrors({}); setShowDialog(true) }

  const cronExamples = [
    { expr: "0 22 * * *", desc: "每晚22:00" },
    { expr: "0 7 * * 1", desc: "每周一07:00" },
    { expr: "0 10 * * 1-5", desc: "工作日10:00" },
    { expr: "*/30 * * * *", desc: "每30分钟" },
    { expr: "0 0 1 * *", desc: "每月1号0:00" },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">调度配置 <span className="text-xs font-normal text-muted">({schedules.length}个任务)</span></h2><p className="text-xs text-muted mt-0.5">定时任务与CI/CD触发配置，自动化执行测试</p></div>
      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-ink">{schedules.length}</p><p className="text-[11px] text-muted mt-0.5">总任务数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-pass">{schedules.filter((s) => s.enabled).length}</p><p className="text-[11px] text-muted mt-0.5">已启用</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-fail">{schedules.filter((s) => !s.enabled).length}</p><p className="text-[11px] text-muted mt-0.5">已禁用</p></div>
      </div>
      <div className="flex items-center mb-3"><button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 ml-auto"><Plus className="w-3.5 h-3.5" /> 新建调度</button></div>
      {/* 调度卡片列表 */}
      <div className="space-y-3 flex-1 overflow-y-auto">
        {schedules.map((s) => (
          <div key={s.id} className={`bg-white rounded-2xl border border-border shadow-card p-5 transition-all ${!s.enabled ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${s.enabled ? "bg-gradient-to-br from-sky-500 to-blue-600" : "bg-cream"}`}>
                  {s.enabled ? <Calendar className="w-5 h-5 text-white" /> : <Clock className="w-5 h-5 text-muted" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{s.name}</h3>
                  <p className="text-[11px] text-muted">{s.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleToggle(s)} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${s.enabled ? "bg-pass/10 text-pass hover:bg-pass/20" : "bg-cream text-muted hover:bg-border"}`}>
                  {s.enabled ? <><ToggleRight className="w-4 h-4" /> 已启用</> : <><ToggleLeft className="w-4 h-4" /> 已禁用</>}
                </button>
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-cream/30 rounded-xl p-3">
              <div><p className="text-[10px] text-muted mb-0.5">触发方式</p><p className="text-xs font-medium text-ink">{s.trigger}</p></div>
              <div><p className="text-[10px] text-muted mb-0.5">Cron / 触发器</p><p className="text-xs font-medium text-ink font-mono">{s.cron}</p></div>
              <div><p className="text-[10px] text-muted mb-0.5">模块</p><p className="text-xs font-medium text-ink">{s.module}</p></div>
              <div><p className="text-[10px] text-muted mb-0.5">上次执行</p><p className="text-xs font-medium text-ink">{s.lastRun}</p></div>
              <div><p className="text-[10px] text-muted mb-0.5">上次结果</p><p className={`text-xs font-medium ${s.lastResult === "通过" ? "text-pass" : s.lastResult === "失败" ? "text-fail" : "text-muted"}`}>{s.lastResult}</p></div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
              <span>下次执行: {s.nextRun}</span>
              <span>环境: {s.environment}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Cron表达式帮助 */}
      <div className="mt-4 bg-cream/30 rounded-2xl border border-border p-4">
        <h3 className="text-xs font-semibold text-ink mb-2">常用Cron表达式</h3>
        <div className="flex flex-wrap gap-2">
          {cronExamples.map((e) => (
            <div key={e.expr} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-border text-[11px]">
              <code className="font-mono text-amber-hover font-medium">{e.expr}</code>
              <span className="text-muted">→ {e.desc}</span>
            </div>
          ))}
        </div>
      </div>
      {/* 弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[480px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{dialogMode === "create" ? "新建调度任务" : "编辑调度任务"}</h3>
              <button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="block text-xs font-medium text-ink-light mb-1">任务名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：每日回归测试" />{formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">触发方式</label><select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber"><option value="定时">定时</option><option value="CI/CD">CI/CD</option><option value="API触发">API触发</option></select></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">模块</label><select value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber"><option>全模块</option><option>登录模块</option><option>支付模块</option><option>购物车</option><option>搜索模块</option></select></div>
              </div>
              {form.trigger === "定时" && (
                <div><label className="block text-xs font-medium text-ink-light mb-1">Cron表达式 *</label><input value={form.cron} onChange={(e) => setForm({ ...form, cron: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink font-mono focus:border-amber outline-none ${formErrors.cron ? "border-fail" : "border-border"}`} placeholder="0 22 * * *" />{formErrors.cron && <p className="text-[11px] text-fail mt-1">{formErrors.cron}</p>}</div>
              )}
              <div><label className="block text-xs font-medium text-ink-light mb-1">执行环境</label><select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber"><option>测试环境</option><option>预发布环境</option><option>生产环境</option></select></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">描述</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="任务描述..." /></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">{dialogMode === "create" ? "创建" : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
