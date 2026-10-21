/**
 * SequenceCenter — 序列任务中心（SPEC-001）
 *
 * 核心规则：
 *   🆓 免费模型 → 单任务序列：任务按序号逐个执行（Lane 1 串行）
 *   💎 付费模型 → 并行序列：最多 N 个任务同时执行（Lane 1..N），序列内部仍按阶段顺序
 *
 * 区块：
 *   ① 执行模式卡片（档位/并发/模型/健康探测）
 *   ② 批量任务提交（支持模拟执行演示）
 *   ③ 泳道视图（按序列序号排列，实时状态）
 *   ④ 历史调度组
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Play, Plus, Trash2, Loader2, RefreshCw, History, Wifi,
  CircleDot, CheckCircle2, XCircle, Clock, Ban, Zap, Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { sequenceApi } from "@/lib/api"
import type { ExecutionMode, SequenceGroupState, SequenceTaskState } from "@/lib/api"
import { useSSEStream } from "@/hooks/useSSEStream"

/* ─────────── 常量 ─────────── */

const STAGE_KEYS = [
  { key: "requirements", label: "需" },
  { key: "test-plans", label: "规" },
  { key: "test-points", label: "点" },
  { key: "test-cases", label: "例" },
  { key: "test-review", label: "审" },
]

const TASK_STATUS_META: Record<
  string,
  { label: string; cls: string; icon: "pulse" | "done" | "fail" | "wait" | "ban" }
> = {
  queued: { label: "排队中", cls: "bg-cream text-muted border-border", icon: "wait" },
  waiting_slot: { label: "等待槽位", cls: "bg-info-light text-info border-info/30", icon: "wait" },
  running: { label: "执行中", cls: "bg-amber-light text-ink border-amber/40", icon: "pulse" },
  completed: { label: "成功", cls: "bg-pass-light text-pass border-pass/30", icon: "done" },
  failed: { label: "失败", cls: "bg-fail-light text-fail border-fail/30", icon: "fail" },
  cancelled: { label: "已取消", cls: "bg-cream text-muted-light border-border", icon: "ban" },
}

interface DraftTask {
  name: string
  content: string
}

/* ─────────── 子组件 ─────────── */

function ModeBadge({ mode }: { mode: ExecutionMode | null }) {
  if (!mode) {
    return <span className="text-[11px] text-muted-light">模式加载中…</span>
  }
  const paid = mode.tier === "paid"
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
        paid
          ? "bg-violet-50 text-violet-700 border-violet-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200"
      }`}
      title={`当前模型: ${mode.provider_name} / ${mode.model}`}
    >
      {paid ? <Zap className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
      {paid ? `付费模型 · 并行×${mode.concurrency}` : "免费模型 · 单任务串行"}
    </span>
  )
}

function StageDots({ task }: { task: SequenceTaskState }) {
  return (
    <div className="flex items-center gap-1">
      {STAGE_KEYS.map((s, idx) => {
        const st = task.stages[idx]
        const status = st?.status || "waiting"
        const cls =
          status === "completed"
            ? "bg-pass text-white"
            : status === "running"
              ? "bg-amber text-white animate-pulse"
              : status === "failed"
                ? "bg-fail text-white"
                : "bg-cream-dark/[0.15] text-muted-light border border-border"
        return (
          <span
            key={s.key}
            className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold ${cls}`}
            title={`${s.label}·测试阶段${idx + 1}: ${status}`}
          >
            {idx + 1}
          </span>
        )
      })}
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const meta = TASK_STATUS_META[status] || TASK_STATUS_META.queued
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.cls}`}>
      {meta.icon === "pulse" && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {meta.icon === "done" && <CheckCircle2 className="w-2.5 h-2.5" />}
      {meta.icon === "fail" && <XCircle className="w-2.5 h-2.5" />}
      {meta.icon === "ban" && <Ban className="w-2.5 h-2.5" />}
      {meta.icon === "wait" && <Clock className="w-2.5 h-2.5" />}
      {meta.label}
    </span>
  )
}

function TaskCard({ task, total }: { task: SequenceTaskState; total: number }) {
  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-sm transition-all ${
        task.status === "running" ? "border-amber shadow-md ring-1 ring-amber/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full gradient-amber text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {task.order}
            </span>
            <span className="text-xs font-semibold text-ink truncate">{task.name}</span>
          </div>
          <p className="text-[10px] text-muted-light mt-1 line-clamp-2">{task.content_preview || "（无内容预览）"}</p>
        </div>
        <StatusChip status={task.status} />
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <StageDots task={task} />
        <div className="flex items-center gap-2 text-[10px] text-muted">
          {task.lane != null && (
            <span className="px-1.5 py-0.5 rounded bg-cream border border-border font-mono">L{task.lane}</span>
          )}
          {task.duration > 0 && <span>{task.duration.toFixed(1)}s</span>}
          {task.pipeline_record_id && (
            <span className="text-muted-light">#{task.pipeline_record_id}</span>
          )}
        </div>
      </div>
      {task.error && (
        <p className="mt-2 text-[10px] text-fail bg-fail-light/60 border border-fail/20 rounded-lg px-2 py-1 break-all">
          {task.error}
        </p>
      )}
      <span className="sr-only">{`序列 ${task.order}/${total}`}</span>
    </div>
  )
}

/* ─────────── 主组件 ─────────── */

export default function SequenceCenter() {
  /* 模式与探活 */
  const [mode, setMode] = useState<ExecutionMode | null>(null)
  const [probing, setProbing] = useState(false)

  /* 表单 */
  const [groupName, setGroupName] = useState("")
  const [simulated, setSimulated] = useState(true)
  const [drafts, setDrafts] = useState<DraftTask[]>([
    { name: "登录模块测试", content: "用户通过用户名+密码登录，连续5次失败锁定账户30分钟，支持记住登录状态。" },
    { name: "支付模块测试", content: "订单支持MCard与现金两种支付方式，支付成功后扣减库存，取消订单恢复库存。" },
    { name: "报表导出测试", content: "测试报告支持Excel/PDF导出，导出内容包含用例统计、缺陷分布与趋势图。" },
  ])

  /* 运行态 */
  const [group, setGroup] = useState<SequenceGroupState | null>(null)
  const [history, setHistory] = useState<SequenceGroupState[]>([])
  const [starting, setStarting] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  /* SSE */
  const [sseResponse, setSseResponse] = useState<Response | null>(null)
  const cursorRef = useRef(0)
  const runningGroupRef = useRef<number | null>(null)

  const pushLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false })
    setLogs((prev) => [...prev.slice(-199), `[${time}] ${msg}`])
  }, [])

  const loadMode = useCallback(async (probe = false) => {
    try {
      const res = await sequenceApi.getMode(probe)
      const m = (res as any)?.data || null
      setMode(m)
      if (probe && m?.health && !m.health.available) {
        toast.warning(`模型不可用：${m.health.reason}`, { duration: 8000 })
      }
    } catch {
      /* 静默：模式徽标保持原值 */
    }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const res: any = await sequenceApi.listRuns({ page: 1, page_size: 10 })
      setHistory(res?.data?.items || [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadMode()
    loadHistory()
  }, [loadMode, loadHistory])

  /* ─── SSE 事件 → 本地状态 ─── */
  const applyEvent = useCallback(
    (eventType: string, data: any) => {
      cursorRef.current += 1
      setGroup((prev) => {
        if (!prev) return prev
        const tasks = prev.tasks.map((t) => ({ ...t, stages: t.stages.map((s) => ({ ...s })) }))
        const find = (order: number) => tasks.find((t) => t.order === order)
        let next = { ...prev, tasks }
        switch (eventType) {
          case "group_start":
            if (Array.isArray(data.tasks)) next = { ...next, tasks: data.tasks }
            next = { ...next, status: "running" }
            pushLog(`🚀 调度组启动 · ${data.mode === "parallel" ? `并行×${data.concurrency}` : "单任务串行"} · 任务数 ${data.total_tasks}`)
            break
          case "task_queued":
            pushLog(`⏸ 任务#${data.order}「${data.name}」排队等待`)
            break
          case "task_start": {
            const t = find(data.order)
            if (t) {
              t.status = "running"
              t.lane = data.lane
            }
            pushLog(`▶ 任务#${data.order}「${data.name}」进入 Lane-${data.lane} 执行`)
            break
          }
          case "task_stage": {
            const t = find(data.order)
            const s = t?.stages.find((st) => st.key === data.stage)
            if (s) {
              s.status = data.status
              if (data.duration) s.duration = data.duration
            }
            if (data.status === "failed") {
              pushLog(`❌ 任务#${data.order} 阶段「${data.label}」失败: ${data.error || ""}`)
            }
            break
          }
          case "task_complete": {
            const t = find(data.order)
            if (t) {
              t.status = "completed"
              t.duration = data.duration || t.duration
              t.pipeline_record_id = data.pipeline_record_id || t.pipeline_record_id
            }
            pushLog(`✅ 任务#${data.order}「${data.name}」完成（${(data.duration || 0).toFixed(1)}s）`)
            break
          }
          case "task_failed": {
            const t = find(data.order)
            if (t) {
              t.status = "failed"
              t.error = data.error || t.error
              t.duration = data.duration || t.duration
            }
            pushLog(`❌ 任务#${data.order} 失败: ${data.error || "未知错误"}`)
            break
          }
          case "group_complete":
            next = {
              ...next,
              status: data.status,
              done_tasks: data.done_tasks,
              failed_tasks: data.failed_tasks,
              total_duration: data.total_duration,
              tasks: Array.isArray(data.tasks) ? data.tasks : tasks,
            }
            pushLog(
              `🏁 调度组结束: ${data.status === "completed" ? "全部成功" : data.status === "partial" ? "部分成功" : data.status === "failed" ? "失败" : "已取消"}（${(data.total_duration || 0).toFixed(1)}s）`
            )
            break
          default:
            break
        }
        return next
      })
    },
    [pushLog]
  )

  const attachStream = useCallback(async (groupId: number) => {
    try {
      const res = await sequenceApi.streamRun(groupId, cursorRef.current)
      if (res.ok) setSseResponse(res)
    } catch {
      /* 网络异常由重连逻辑兜底 */
    }
  }, [])

  useSSEStream({
    response: sseResponse,
    onEvent: applyEvent,
    onComplete: useCallback(() => {
      setSseResponse(null)
      const gid = runningGroupRef.current
      if (!gid) return
      // 未结束则重连（since 游标续传）
      setGroup((prev) => {
        if (prev && prev.id === gid && !["completed", "failed", "partial", "cancelled"].includes(prev.status)) {
          setTimeout(() => attachStream(gid), 1200)
        }
        return prev
      })
      loadHistory()
    }, [attachStream, loadHistory]),
  })

  /* ─── 启动调度 ─── */
  const startRun = useCallback(async () => {
    const valid = drafts.filter((d) => d.content.trim())
    if (valid.length === 0) {
      toast.error("请至少填写一个任务的需求内容")
      return
    }
    setStarting(true)
    try {
      const res: any = await sequenceApi.createRun({
        name: groupName || `序列调度-${new Date().toLocaleString("zh-CN", { hour12: false }).replace(/[\/\s:]/g, "")}`,
        simulated,
        tasks: valid.map((d) => ({
          requirement_name: d.name || "未命名任务",
          requirement_content: d.content,
        })),
      })
      const g = res?.data
      if (!g) throw new Error("启动失败")
      cursorRef.current = 0
      runningGroupRef.current = g.id
      setGroup(g)
      setLogs([])
      pushLog(`💎 调度组 #${g.id} 已创建 · ${g.mode === "parallel" ? `并行×${g.concurrency}` : "单任务串行"} · 模型 ${g.model}`)
      attachStream(g.id)
      loadHistory()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "启动失败"
      toast.error(String(detail), { duration: 8000 })
      pushLog(`❌ 启动失败: ${detail}`)
    } finally {
      setStarting(false)
    }
  }, [drafts, groupName, simulated, attachStream, loadHistory, pushLog])

  const cancelRun = useCallback(async () => {
    if (!group) return
    try {
      await sequenceApi.cancelRun(group.id)
      pushLog(`⏹ 已请求取消调度组 #${group.id}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "取消失败")
    }
  }, [group, pushLog])

  const restoreRun = useCallback(
    async (id: number) => {
      try {
        const res: any = await sequenceApi.getRun(id)
        const g = res?.data
        if (!g) return
        runningGroupRef.current = g.id
        setGroup(g)
        if (g.status === "running") {
          cursorRef.current = 0
          attachStream(id)
        } else {
          runningGroupRef.current = null
        }
      } catch {
        toast.error("加载调度组失败")
      }
    },
    [attachStream]
  )

  /* ─── 泳道分组 ─── */
  const laneCount = useMemo(() => {
    if (!group) return 1
    return group.mode === "parallel" ? Math.max(1, group.concurrency) : 1
  }, [group])

  const lanes = useMemo(() => {
    const result: SequenceTaskState[][] = Array.from({ length: laneCount }, () => [])
    if (!group) return result
    const sorted = [...group.tasks].sort((a, b) => a.order - b.order)
    sorted.forEach((t) => {
      const lane = Math.max(1, Math.min(laneCount, t.lane ?? 1))
      result[lane - 1].push(t)
    })
    // 未分配 Lane 的排队任务：按序号填入最短道
    return result
  }, [group, laneCount])

  const isRunning = group?.status === "running"
  const runningCount = group?.tasks.filter((t) => t.status === "running").length || 0

  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-6 space-y-5">
      {/* ① 执行模式 */}
      <section className="bg-white rounded-2xl border border-border shadow-sm p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md">
              <Layers className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                序列任务中心
              </h2>
              <p className="text-[11px] text-muted">
                免费模型：单任务序列（避免限流）｜付费模型：多任务并行（吞吐优先）
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeBadge mode={mode} />
            <button
              onClick={() => {
                setProbing(true)
                loadMode(true).finally(() => setProbing(false))
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-cream hover:bg-amber-light text-[11px] text-ink transition-colors"
              title="探测当前模型是否可用"
            >
              {probing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
              模型体检
            </button>
            {mode?.health && (
              <span
                className={`text-[11px] px-2 py-1 rounded-lg border ${
                  mode.health.available
                    ? "bg-pass-light text-pass border-pass/30"
                    : "bg-fail-light text-fail border-fail/30"
                }`}
              >
                {mode.health.available ? "模型可用" : "模型异常"}
              </span>
            )}
          </div>
        </div>
        {mode?.health && !mode.health.available && (
          <p className="mt-3 text-[11px] text-fail bg-fail-light/60 border border-fail/25 rounded-lg px-3 py-2">
            ⚠️ {mode.health.reason}。可先使用「模拟执行」验证调度流程，或前往「系统管理 → 模型配置」更新密钥/模型。
          </p>
        )}
      </section>

      {/* ② 任务提交 */}
      <section className="bg-white rounded-2xl border border-border shadow-sm p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="调度组名称（可选）"
            className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-lg border border-border bg-cream focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber/30"
          />
          <label className="flex items-center gap-2 text-xs text-ink cursor-pointer select-none">
            <input
              type="checkbox"
              checked={simulated}
              onChange={(e) => setSimulated(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#D4A574]"
            />
            模拟执行（demo，不调用真实模型）
          </label>
          <Button
            onClick={startRun}
            disabled={starting || isRunning}
            className="gap-1.5 bg-[#D4A574] hover:bg-[#c49564] text-white text-xs"
          >
            {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            启动序列调度（{drafts.filter((d) => d.content.trim()).length} 个任务）
          </Button>
        </div>

        <div className="space-y-2">
          {drafts.map((d, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="mt-2 w-5 h-5 rounded-full gradient-amber text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </span>
              <input
                value={d.name}
                onChange={(e) =>
                  setDrafts((prev) => prev.map((t, i) => (i === idx ? { ...t, name: e.target.value } : t)))
                }
                placeholder="任务名称"
                className="w-40 md:w-48 px-2.5 py-1.5 text-xs rounded-lg border border-border bg-cream focus:bg-white focus:outline-none"
              />
              <textarea
                value={d.content}
                onChange={(e) =>
                  setDrafts((prev) => prev.map((t, i) => (i === idx ? { ...t, content: e.target.value } : t)))
                }
                placeholder="需求内容（将驱动 需求分析→规划→测试点→用例→评审 五阶段序列）"
                rows={2}
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-border bg-cream focus:bg-white focus:outline-none resize-y"
              />
              <button
                onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== idx))}
                className="mt-1.5 p-1.5 rounded-lg text-muted-light hover:text-fail hover:bg-fail-light transition-colors"
                title="删除该任务"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setDrafts((prev) => [...prev, { name: "", content: "" }])}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber hover:text-[#b8860b] font-semibold"
        >
          <Plus className="w-3.5 h-3.5" /> 添加任务
        </button>
      </section>

      {/* ③ 泳道视图 */}
      {group && (
        <section className="bg-white rounded-2xl border border-border shadow-sm p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CircleDot className="w-4 h-4 text-amber" />
              <h3 className="text-sm font-bold text-ink">
                调度组 #{group.id} · {group.name}
              </h3>
              <StatusChip status={group.status} />
              <span className="text-[11px] text-muted">
                {group.mode === "parallel" ? `并行×${group.concurrency}` : "单任务串行"}
                {group.simulated && " · 模拟"}
              </span>
              {isRunning && (
                <span className="text-[11px] text-amber font-semibold">
                  同时执行中 {runningCount}/{group.concurrency}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {group.total_duration != null && group.status !== "running" && (
                <span className="text-[11px] text-muted">总耗时 {Number(group.total_duration).toFixed(1)}s</span>
              )}
              {isRunning && (
                <button
                  onClick={cancelRun}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-fail/40 text-fail bg-fail-light/50 hover:bg-fail-light text-[11px]"
                >
                  <Ban className="w-3 h-3" /> 取消
                </button>
              )}
            </div>
          </div>

          <div
            className={`grid gap-3 ${laneCount > 3 ? "grid-cols-1 md:grid-cols-3" : ""}`}
            style={{ gridTemplateColumns: `repeat(${laneCount}, minmax(0, 1fr))` }}
          >
            {lanes.map((tasks, laneIdx) => (
              <div key={laneIdx} className="rounded-xl bg-cream/50 border border-border/60 p-2.5 space-y-2 min-w-0">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-ink-light">
                    {laneCount === 1 ? "Lane 1 · 单序列通道" : `Lane ${laneIdx + 1}`}
                  </span>
                  <span className="text-[10px] text-muted-light">{tasks.length} 个任务</span>
                </div>
                {tasks.length === 0 && (
                  <p className="text-[11px] text-muted-light text-center py-6">（空闲通道）</p>
                )}
                {tasks.map((t) => (
                  <TaskCard key={t.order} task={t} total={group.total_tasks} />
                ))}
              </div>
            ))}
          </div>

          {/* 事件日志 */}
          <details className="mt-4 group">
            <summary className="text-[11px] font-semibold text-muted cursor-pointer select-none hover:text-ink">
              调度事件日志（{logs.length}）
            </summary>
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl bg-[#2C1810] p-3 space-y-1">
              {logs.length === 0 && <p className="text-[11px] text-white/40">（暂无事件）</p>}
              {logs.map((l, i) => (
                <p key={i} className="text-[11px] font-mono text-[#E8DDD0] leading-relaxed whitespace-pre-wrap">
                  {l}
                </p>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* ④ 历史调度组 */}
      <section className="bg-white rounded-2xl border border-border shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted" />
            <h3 className="text-sm font-bold text-ink">历史调度组</h3>
          </div>
          <button
            onClick={loadHistory}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[11px] text-muted hover:bg-cream"
          >
            <RefreshCw className="w-3 h-3" /> 刷新
          </button>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-muted-light py-6 text-center">暂无调度记录，先提交一批任务试试</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-light border-b border-border">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">名称</th>
                  <th className="py-2 pr-3 font-medium">模式</th>
                  <th className="py-2 pr-3 font-medium">状态</th>
                  <th className="py-2 pr-3 font-medium">任务</th>
                  <th className="py-2 pr-3 font-medium">耗时</th>
                  <th className="py-2 pr-3 font-medium">时间</th>
                  <th className="py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {history.map((g) => (
                  <tr key={g.id} className="border-b border-border/50 hover:bg-cream/40">
                    <td className="py-2 pr-3 font-mono text-muted">{g.id}</td>
                    <td className="py-2 pr-3 max-w-[220px] truncate text-ink">{g.name}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                          g.mode === "parallel"
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {g.mode === "parallel" ? `并行×${g.concurrency}` : "串行"}
                        {g.simulated ? " ·模拟" : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3"><StatusChip status={g.status} /></td>
                    <td className="py-2 pr-3 text-muted">
                      {g.done_tasks}成功/{g.failed_tasks}失败/{g.total_tasks}总
                    </td>
                    <td className="py-2 pr-3 text-muted">{g.total_duration != null ? `${Number(g.total_duration).toFixed(1)}s` : "-"}</td>
                    <td className="py-2 pr-3 text-muted-light whitespace-nowrap">
                      {g.created_at ? g.created_at.slice(5, 16).replace("T", " ") : "-"}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => restoreRun(g.id)}
                        className="text-[11px] text-amber hover:text-[#b8860b] font-semibold"
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
