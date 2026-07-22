/**
 * 测试执行 - 连接真实API + WebSocket实时进度
 */
import { useState, useEffect, useRef, useCallback } from "react"
import { Play, Square, Loader2, CheckCircle, XCircle, Clock, Eye, RefreshCw, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { webApi } from "@/lib/api"

interface ExecutionRecord {
  id: number; project_id: number; status: string; started_at: string; completed_at?: string;
  duration_ms?: number; screenshots?: string[]; error_message?: string
}

interface ExecutionEvent {
  type: string; case_id?: number; case_title?: string; status?: string;
  duration_ms?: number; error?: string; screenshot?: string; index?: number; total?: number;
}

export default function ExecutionView() {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, status: "" })
  const [logs, setLogs] = useState<Array<{ time: string; message: string; type: string }>>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [previewExec, setPreviewExec] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const logsRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const addLog = useCallback((message: string, type: string = "info") => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message, type }])
  }, [])

  useEffect(() => {
    logsRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  // 加载项目列表
  const fetchProjects = useCallback(async () => {
    try {
      const res: any = await webApi.listProjects(1)
      if (res?.data?.items) {
        setProjects(res.data.items)
        if (res.data.items.length > 0 && !selectedProjectId) {
          setSelectedProjectId(res.data.items[0].id)
        }
      }
    } catch {}
  }, [selectedProjectId])

  // 加载执行记录
  const fetchExecutions = useCallback(async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const res: any = await webApi.listExecutions(selectedProjectId)
      if (res?.data) {
        const items = Array.isArray(res.data) ? res.data : (res.data.items || [])
        setExecutions(items)
      }
    } catch {
      setExecutions([])
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchExecutions() }, [fetchExecutions])

  // 启动执行
  const startExecution = useCallback(async () => {
    if (!selectedProjectId) { toast.error("请先选择项目"); return }

    setRunning(true)
    setLogs([])
    setProgress({ current: 0, total: 0, status: "starting" })
    addLog("启动测试执行引擎...", "info")

    try {
      // 连接WebSocket接收实时进度
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/web-automation/ws/automation/${selectedProjectId}`
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleExecutionEvent(data)
        } catch {}
      }

      wsRef.current.onerror = () => {
        addLog("WebSocket连接错误", "error")
      }

      // 调用执行API
      const res: any = await webApi.execute(selectedProjectId)
      if (res?.data) {
        addLog(`执行已启动，共 ${res.data.cases_count || 0} 条用例`, "success")
        setProgress({ current: 0, total: res.data.cases_count || 0, status: "running" })
      } else if (res?.message) {
        addLog(res.message, "warning")
        setRunning(false)
      }
    } catch (e: any) {
      addLog(`执行启动失败: ${e.message}`, "error")
      setRunning(false)
    }
  }, [selectedProjectId, addLog])

  // 处理执行事件
  const handleExecutionEvent = useCallback((event: ExecutionEvent) => {
    switch (event.type) {
      case "case_start":
        addLog(`[${event.index}/${event.total}] 开始执行: ${event.case_title}`, "info")
        setProgress({ current: event.index || 0, total: event.total || 0, status: "running" })
        break
      case "case_complete":
        const statusIcon = event.status === "passed" ? "✓" : "✗"
        const statusType = event.status === "passed" ? "success" : "error"
        addLog(`${statusIcon} ${event.case_title} - ${event.status} (${event.duration_ms || 0}ms)`, statusType)
        if (event.error) addLog(`  错误: ${event.error}`, "error")
        break
      case "execution_complete":
        addLog(`执行完成: 通过 ${event.passed || 0}, 失败 ${event.failed || 0}`, "success")
        setRunning(false)
        setProgress((p) => ({ ...p, status: "completed" }))
        fetchExecutions()
        // 关闭WebSocket
        wsRef.current?.close()
        break
      case "execution_error":
        addLog(`执行失败: ${event.error}`, "error")
        setRunning(false)
        setProgress((p) => ({ ...p, status: "failed" }))
        wsRef.current?.close()
        break
    }
  }, [addLog, fetchExecutions])

  // 停止执行
  const stopExecution = useCallback(() => {
    wsRef.current?.close()
    setRunning(false)
    addLog("执行已停止", "warning")
  }, [addLog])

  // 清理WebSocket
  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": case "passed": return <CheckCircle className="w-4 h-4 text-pass" />
      case "failed": return <XCircle className="w-4 h-4 text-fail" />
      case "running": return <Loader2 className="w-4 h-4 text-amber animate-spin" />
      default: return <Clock className="w-4 h-4 text-muted" />
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4">
      <div className="mb-1"><h2 className="text-base font-semibold text-ink flex items-center gap-2">测试执行 <Play className="w-4 h-4 text-amber" /></h2><p className="text-xs text-muted mt-0.5">使用AI视觉驱动执行测试用例，实时查看执行进度</p></div>

      {/* 控制区 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-light">项目:</label>
            <select value={selectedProjectId || ""} onChange={(e) => { setSelectedProjectId(Number(e.target.value)); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
              <option value="">请选择项目</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={fetchExecutions} disabled={!selectedProjectId} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-40"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
          {running ? (
            <button onClick={stopExecution} className="h-9 px-4 rounded-xl bg-fail text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Square className="w-3.5 h-3.5" /> 停止执行</button>
          ) : (
            <button onClick={startExecution} disabled={!selectedProjectId} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 disabled:opacity-50"><Play className="w-3.5 h-3.5" /> 启动执行</button>
          )}
        </div>

        {/* 进度条 */}
        {progress.total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-light">进度: {progress.current}/{progress.total}</span>
              <span className="text-xs text-muted">{progress.status === "completed" ? "完成" : progress.status === "failed" ? "失败" : "执行中..."}</span>
            </div>
            <div className="w-full h-2 bg-cream rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${progress.status === "failed" ? "bg-fail" : "gradient-amber"}`} style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* 左侧：执行日志 */}
        <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">执行日志</h3>
            <span className="text-[11px] text-muted">{logs.length} 条</span>
          </div>
          <div ref={logsRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted"><Clock className="w-8 h-8 mx-auto mb-2 text-muted-light" /><p className="text-xs">选择项目后点击"启动执行"</p></div>
            ) : logs.map((log, idx) => (
              <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${log.type === "error" ? "bg-fail/10" : log.type === "success" ? "bg-pass/10" : log.type === "warning" ? "bg-amber-light" : "bg-cream/50"}`}>
                <span className="text-[10px] text-muted font-mono w-14 flex-shrink-0">{log.time}</span>
                <span className={`flex-shrink-0 ${log.type === "error" ? "text-fail" : log.type === "success" ? "text-pass" : log.type === "warning" ? "text-amber" : "text-ink-light"}`}>{log.type === "error" ? "✗" : log.type === "success" ? "✓" : log.type === "warning" ? "⚠" : "•"}</span>
                <span className="text-ink-light">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：执行记录 */}
        <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">执行记录</h3>
            <span className="text-[11px] text-muted">{executions.length} 条</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {executions.length === 0 ? (
              <div className="text-center py-8 text-muted"><Play className="w-8 h-8 mx-auto mb-2 text-muted-light" /><p className="text-xs">暂无执行记录</p></div>
            ) : executions.map((exec) => (
              <div key={exec.id} className="border border-border rounded-xl p-3 hover:bg-cream/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(exec.status)}
                    <span className="text-sm font-medium text-ink">执行 #{exec.id}</span>
                    <span className="text-[11px] text-muted">{exec.status}</span>
                  </div>
                  <button onClick={() => setPreviewExec(exec)} className="p-1.5 rounded-lg hover:bg-cream text-ink-light hover:text-info transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                </div>
                <div className="mt-2 text-[11px] text-muted space-y-0.5">
                  <p>开始: {exec.started_at ? new Date(exec.started_at).toLocaleString("zh-CN") : "-"}</p>
                  {exec.completed_at && <p>完成: {new Date(exec.completed_at).toLocaleString("zh-CN")}</p>}
                  {exec.duration_ms && <p>耗时: {(exec.duration_ms / 1000).toFixed(1)}s</p>}
                  {exec.error_message && <p className="text-fail">错误: {exec.error_message}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 预览弹窗 */}
      {previewExec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPreviewExec(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[480px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">执行详情 #{previewExec.id}</h3>
              <button onClick={() => setPreviewExec(null)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-2">
                {statusIcon(previewExec.status)}
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${previewExec.status === "completed" || previewExec.status === "passed" ? "bg-pass/10 text-pass" : previewExec.status === "failed" ? "bg-fail/10 text-fail" : "bg-cream text-muted"}`}>{previewExec.status}</span>
              </div>
              <div className="text-xs text-ink-light space-y-1">
                <p>开始时间: {previewExec.started_at ? new Date(previewExec.started_at).toLocaleString("zh-CN") : "-"}</p>
                <p>完成时间: {previewExec.completed_at ? new Date(previewExec.completed_at).toLocaleString("zh-CN") : "-"}</p>
                <p>耗时: {previewExec.duration_ms ? `${(previewExec.duration_ms / 1000).toFixed(1)}s` : "-"}</p>
              </div>
              {previewExec.error_message && <div><p className="text-xs font-medium text-ink mb-1">错误信息</p><p className="text-xs text-fail bg-fail/10 rounded-lg p-2">{previewExec.error_message}</p></div>}
              {previewExec.screenshots && previewExec.screenshots.length > 0 && (
                <div><p className="text-xs font-medium text-ink mb-1">截图 ({previewExec.screenshots.length})</p>
                  <div className="grid grid-cols-2 gap-2">{previewExec.screenshots.map((s: string, i: number) => (
                    <div key={i} className="border border-border rounded-lg overflow-hidden"><img src={s} alt={`截图 ${i + 1}`} className="w-full h-auto" /></div>
                  ))}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
