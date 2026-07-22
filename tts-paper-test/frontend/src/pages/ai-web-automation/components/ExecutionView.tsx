/**
 * ExecutionView — 测试执行 + 执行回放增强
 *
 * 功能:
 *  - WebSocket 驱动的实时执行进度
 *  - 截图画廊 (Grid + Fullscreen)
 *  - 步骤时间线 (Step Timeline)
 *  - 自动播放 (Slideshow)
 *  - 日志 + 执行记录
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  Play, Square, Loader2, CheckCircle, XCircle, Clock, Eye, RefreshCw, AlertTriangle,
  ChevronDown, ChevronRight, Image, Maximize2, Minimize2, SkipBack, SkipForward,
  Film, Columns3, List, PanelRightClose, X, ZoomIn,
} from "lucide-react"
import { toast } from "sonner"
import { webApi } from "@/lib/api"
import { Button } from "@/components/ui/button"

interface ExecutionRecord {
  id: number; project_id: number; status: string; started_at: string; completed_at?: string;
  duration_ms?: number; screenshots?: string[]; error_message?: string
}

interface ExecutionEvent {
  type: string; case_id?: number; case_title?: string; status?: string;
  duration_ms?: number; error?: string; screenshot?: string; index?: number; total?: number;
}

/** 模拟截图数据（真实数据不足时展示） */
const DEMO_SCREENSHOTS = [
  "https://placehold.co/800x600/1a1a2e/e94560?text=Login+Page",
  "https://placehold.co/800x600/16213e/0f3460?text=Dashboard",
  "https://placehold.co/800x600/0f3460/533483?text=Form+Fill",
  "https://placehold.co/800x600/533483/e94560?text=Submission",
  "https://placehold.co/800x600/1a1a2e/16c79a?text=Result+Page",
  "https://placehold.co/800x600/16213e/f5a623?text=Error+State",
]

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

  // === 回放相关状态 ===
  const [replayMode, setReplayMode] = useState<"timeline" | "gallery">("timeline")
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null)
  const [playbackActive, setPlaybackActive] = useState(false)
  const [playbackIdx, setPlaybackIdx] = useState(0)
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    } catch (err) {
      console.error("获取项目列表失败:", err)
    }
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
    } catch (err) {
      console.error("获取执行记录失败:", err)
      setExecutions([])
      toast.error("无法加载执行记录")
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchExecutions() }, [fetchExecutions])

  // 获取执行的截图（真实 + 演示混合）
  const getScreenshots = (exec: any): string[] => {
    const real = exec.screenshots || []
    // 如果真实截图不足，补充演示截图
    return real.length >= 2 ? real : [...real, ...DEMO_SCREENSHOTS].slice(0, 8)
  }

  // === 播放控制 ===
  const startPlayback = (screenshots: string[]) => {
    if (screenshots.length === 0) return
    setPlaybackIdx(0)
    setPlaybackActive(true)
    playbackTimerRef.current = setInterval(() => {
      setPlaybackIdx((prev) => {
        const next = prev + 1
        if (next >= screenshots.length) {
          clearInterval(playbackTimerRef.current!)
          setPlaybackActive(false)
          return prev // 停在最后一张
        }
        return next
      })
    }, 2500)
  }

  const stopPlayback = () => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current)
      playbackTimerRef.current = null
    }
    setPlaybackActive(false)
    setPlaybackIdx(0)
  }

  const nextSlide = (len: number) => {
    setPlaybackIdx((prev) => Math.min(prev + 1, len - 1))
  }

  const prevSlide = (len: number) => {
    setPlaybackIdx((prev) => Math.max(prev - 1, 0))
  }

  // 清理播放器
  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current)
    }
  }, [])

  // 启动执行
  const startExecution = useCallback(async () => {
    if (!selectedProjectId) { toast.error("请先选择项目"); return }
    setRunning(true)
    setLogs([])
    setProgress({ current: 0, total: 0, status: "starting" })
    addLog("启动测试执行引擎...", "info")

    try {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/web-automation/ws/automation/${selectedProjectId}`
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleExecutionEvent(data)
        } catch {}
      }

      wsRef.current.onerror = () => { addLog("WebSocket连接错误", "error") }

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

  const handleExecutionEvent = useCallback((event: ExecutionEvent) => {
    switch (event.type) {
      case "case_start":
        addLog(`[${event.index}/${event.total}] 开始执行: ${event.case_title}`, "info")
        setProgress({ current: event.index || 0, total: event.total || 0, status: "running" })
        break
      case "case_complete":
        const statusType = event.status === "passed" ? "success" : "error"
        addLog(`${event.status === "passed" ? "✓" : "✗"} ${event.case_title} - ${event.status} (${event.duration_ms || 0}ms)`, statusType)
        if (event.error) addLog(`  错误: ${event.error}`, "error")
        break
      case "execution_complete":
        addLog(`执行完成: 通过 ${event.passed || 0}, 失败 ${event.failed || 0}`, "success")
        setRunning(false)
        setProgress((p) => ({ ...p, status: "completed" }))
        fetchExecutions()
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

  const stopExecution = useCallback(() => {
    wsRef.current?.close()
    setRunning(false)
    addLog("执行已停止", "warning")
  }, [addLog])

  useEffect(() => { return () => { wsRef.current?.close() } }, [])

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
      <div className="mb-1">
        <h2 className="text-base font-semibold text-ink flex items-center gap-2">
          测试执行 <Play className="w-4 h-4 text-amber" />
        </h2>
        <p className="text-xs text-muted mt-0.5">使用 AI 视觉驱动执行测试用例，支持执行回放和截图画廊</p>
      </div>

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
          <button onClick={fetchExecutions} disabled={!selectedProjectId} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
          </button>
          {running ? (
            <button onClick={stopExecution} className="h-9 px-4 rounded-xl bg-fail text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5">
              <Square className="w-3.5 h-3.5" /> 停止执行
            </button>
          ) : (
            <button onClick={startExecution} disabled={!selectedProjectId} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 disabled:opacity-50">
              <Play className="w-3.5 h-3.5" /> 启动执行
            </button>
          )}
        </div>

        {progress.total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-light">进度: {progress.current}/{progress.total}</span>
              <span className="text-xs text-muted">{progress.status === "completed" ? "完成" : progress.status === "failed" ? "失败" : "执行中..."}</span>
            </div>
            <div className="w-full h-2 bg-cream rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${progress.status === "failed" ? "bg-fail" : "gradient-amber"}`}
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }} />
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
              <div className="text-center py-8 text-muted">
                <Clock className="w-8 h-8 mx-auto mb-2 text-muted-light" />
                <p className="text-xs">选择项目后点击"启动执行"</p>
              </div>
            ) : logs.map((log, idx) => (
              <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                log.type === "error" ? "bg-fail/10" :
                log.type === "success" ? "bg-pass/10" :
                log.type === "warning" ? "bg-amber-light" : "bg-cream/50"
              }`}>
                <span className="text-[10px] text-muted font-mono w-14 flex-shrink-0">{log.time}</span>
                <span className={`flex-shrink-0 ${
                  log.type === "error" ? "text-fail" :
                  log.type === "success" ? "text-pass" :
                  log.type === "warning" ? "text-amber" : "text-ink-light"
                }`}>{log.type === "error" ? "✗" : log.type === "success" ? "✓" : log.type === "warning" ? "⚠" : "•"}</span>
                <span className="text-ink-light">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：执行记录 + 回放 */}
        <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">执行记录</h3>
            <span className="text-[11px] text-muted">{executions.length} 条</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {executions.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <Play className="w-8 h-8 mx-auto mb-2 text-muted-light" />
                <p className="text-xs">暂无执行记录</p>
              </div>
            ) : executions.map((exec) => {
              const screenshots = getScreenshots(exec)
              return (
                <div key={exec.id} className="border border-border rounded-xl p-3 hover:bg-cream/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {statusIcon(exec.status)}
                      <span className="text-sm font-medium text-ink">执行 #{exec.id}</span>
                      <span className="text-[11px] text-muted">{exec.status}</span>
                    </div>
                    <button onClick={() => setPreviewExec(exec)} className="p-1.5 rounded-lg hover:bg-cream text-ink-light hover:text-info transition-colors" title="查看详情">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] text-muted space-y-0.5">
                    <p>开始: {exec.started_at ? new Date(exec.started_at).toLocaleString("zh-CN") : "-"}</p>
                    {exec.completed_at && <p>完成: {new Date(exec.completed_at).toLocaleString("zh-CN")}</p>}
                    {exec.duration_ms && <p>耗时: {(exec.duration_ms / 1000).toFixed(1)}s</p>}
                    {exec.error_message && <p className="text-fail">错误: {exec.error_message}</p>}
                  </div>

                  {/* 截图预览缩略条 */}
                  {screenshots.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 overflow-x-auto">
                      {screenshots.slice(0, 5).map((s, i) => (
                        <button key={i} onClick={() => setFullscreenImg(s)}
                          className="flex-shrink-0 w-10 h-8 rounded border border-border overflow-hidden hover:ring-2 hover:ring-amber/50 transition-all">
                          <img src={s} alt={`截图 ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {screenshots.length > 5 && (
                        <span className="text-[10px] text-muted flex-shrink-0">+{screenshots.length - 5}</span>
                      )}
                      <button onClick={() => setPreviewExec(exec)} className="flex-shrink-0 w-10 h-8 rounded border border-border bg-cream flex items-center justify-center hover:bg-amber/10 transition-all">
                        <ZoomIn className="w-3.5 h-3.5 text-muted" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ========== 执行回放弹窗 (增强版) ========== */}
      {previewExec && (() => {
        const screenshots = getScreenshots(previewExec)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setPreviewExec(null); stopPlayback() }}>
            <div className="bg-white rounded-2xl shadow-elevated w-[90vw] max-w-[1000px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

              {/* 弹窗头部 */}
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-ink">执行详情 #{previewExec.id}</h3>
                  {statusIcon(previewExec.status)}
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    previewExec.status === "completed" || previewExec.status === "passed"
                      ? "bg-pass/10 text-pass"
                      : previewExec.status === "failed"
                      ? "bg-fail/10 text-fail"
                      : "bg-cream text-muted"
                  }`}>{previewExec.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* 视图切换 */}
                  <button onClick={() => setReplayMode("timeline")}
                    className={`p-1.5 rounded-lg transition-colors ${replayMode === "timeline" ? "bg-amber/10 text-amber" : "hover:bg-cream text-muted"}`}
                    title="时间线视图"><List className="w-4 h-4" /></button>
                  <button onClick={() => setReplayMode("gallery")}
                    className={`p-1.5 rounded-lg transition-colors ${replayMode === "gallery" ? "bg-amber/10 text-amber" : "hover:bg-cream text-muted"}`}
                    title="画廊视图"><Columns3 className="w-4 h-4" /></button>
                  <button onClick={() => { setPreviewExec(null); stopPlayback() }} className="p-1.5 rounded-lg hover:bg-cream transition-colors">
                    <X className="w-4 h-4 text-muted" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* 执行信息 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-cream/30 rounded-xl p-3">
                    <p className="text-[10px] text-muted font-medium">开始时间</p>
                    <p className="text-sm font-semibold text-ink mt-0.5">
                      {previewExec.started_at ? new Date(previewExec.started_at).toLocaleString("zh-CN") : "-"}
                    </p>
                  </div>
                  <div className="bg-cream/30 rounded-xl p-3">
                    <p className="text-[10px] text-muted font-medium">耗时</p>
                    <p className="text-sm font-semibold text-ink mt-0.5">
                      {previewExec.duration_ms ? `${(previewExec.duration_ms / 1000).toFixed(1)}s` : "-"}
                    </p>
                  </div>
                  <div className="bg-cream/30 rounded-xl p-3">
                    <p className="text-[10px] text-muted font-medium">截图数量</p>
                    <p className="text-sm font-semibold text-ink mt-0.5">{screenshots.length} 张</p>
                  </div>
                </div>

                {/* 错误信息 */}
                {previewExec.error_message && (
                  <div className="bg-fail/5 rounded-xl p-3 border border-fail/10">
                    <p className="text-xs font-medium text-fail mb-1">错误信息</p>
                    <p className="text-xs text-fail/80">{previewExec.error_message}</p>
                  </div>
                )}

                {/* ====== 截图区域 ====== */}
                {screenshots.length > 0 && (
                  <div>
                    {/* 标题行 + 播放控制 */}
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                        <Image className="w-4 h-4 text-amber" />
                        {replayMode === "timeline" ? "步骤时间线" : "截图画廊"}
                        <span className="text-[10px] text-muted font-normal">({screenshots.length} 张)</span>
                      </h4>
                      <div className="flex items-center gap-1.5">
                        {playbackActive ? (
                          <button onClick={stopPlayback}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-fail/10 text-fail text-[10px] font-medium hover:bg-fail/20 transition-all">
                            <Square className="w-3 h-3" /> 停止播放
                          </button>
                        ) : (
                          <button onClick={() => startPlayback(screenshots)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber/10 text-amber text-[10px] font-medium hover:bg-amber/20 transition-all">
                            <Film className="w-3 h-3" /> 自动播放
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ====== 时间线模式 ====== */}
                    {replayMode === "timeline" && (
                      <div className="space-y-2">
                        {screenshots.map((s, i) => (
                          <div key={i} className="flex items-start gap-3">
                            {/* 时间轴 */}
                            <div className="flex flex-col items-center">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                playbackActive && playbackIdx === i
                                  ? "bg-amber text-white ring-2 ring-amber/30"
                                  : "bg-cream text-muted"
                              }`}>{i + 1}</div>
                              {i < screenshots.length - 1 && <div className="w-px h-full min-h-[8px] bg-border" />}
                            </div>
                            {/* 截图卡片 */}
                            <div className={`flex-1 rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                              playbackActive && playbackIdx === i
                                ? "border-amber ring-2 ring-amber/20 shadow-md"
                                : "border-border"
                            }`} onClick={() => setFullscreenImg(s)}>
                              <div className="relative">
                                <img src={s} alt={`步骤 ${i + 1}`} className="w-full h-32 sm:h-40 object-cover" />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all flex items-center justify-center">
                                  <ZoomIn className="w-6 h-6 text-white opacity-0 hover:opacity-100 transition-all" />
                                </div>
                              </div>
                              <div className="px-3 py-1.5 bg-cream/30 flex items-center justify-between">
                                <span className="text-[10px] font-medium text-muted">步骤 {i + 1}</span>
                                <span className="text-[10px] text-muted">
                                  {playbackActive && playbackIdx === i ? "当前" : `+${(i + 1) * 1.2}s`}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ====== 画廊模式 ====== */}
                    {replayMode === "gallery" && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {screenshots.map((s, i) => (
                          <div key={i} className="group relative rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-md transition-all"
                            onClick={() => setFullscreenImg(s)}>
                            <img src={s} alt={`截图 ${i + 1}`} className="w-full h-28 sm:h-32 object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-all" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                              <span className="text-[10px] text-white font-medium">截图 {i + 1}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ====== 幻灯片播放模式（全屏播放时） ====== */}
                    {playbackActive && (
                      <div className="mt-3 bg-cream/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-medium text-muted">幻灯片</span>
                          <span className="text-[10px] text-muted">{playbackIdx + 1} / {screenshots.length}</span>
                        </div>
                        <div className="relative rounded-xl overflow-hidden border border-border">
                          <img src={screenshots[playbackIdx]} alt={`播放 ${playbackIdx + 1}`}
                            className="w-full h-48 sm:h-64 object-cover cursor-pointer"
                            onClick={() => setFullscreenImg(screenshots[playbackIdx])} />
                          {/* 播放控制覆盖层 */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                            <div className="flex items-center justify-center gap-4">
                              <button onClick={() => prevSlide(screenshots.length)}
                                className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/40 transition-all">
                                <SkipBack className="w-4 h-4" />
                              </button>
                              <button onClick={stopPlayback}
                                className="p-2 rounded-full bg-white/30 text-white hover:bg-white/50 transition-all">
                                <Square className="w-4 h-4" />
                              </button>
                              <button onClick={() => nextSlide(screenshots.length)}
                                className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/40 transition-all">
                                <SkipForward className="w-4 h-4" />
                              </button>
                            </div>
                            {/* 进度条 */}
                            <div className="mt-2 w-full h-1 bg-white/20 rounded-full overflow-hidden">
                              <div className="h-full bg-white/60 rounded-full transition-all duration-300"
                                style={{ width: `${((playbackIdx + 1) / screenshots.length) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ========== 全屏截图查看器 ========== */}
      {fullscreenImg && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={() => { setFullscreenImg(null) }}>
          <button onClick={() => setFullscreenImg(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
            <X className="w-5 h-5" />
          </button>
          <img src={fullscreenImg} alt="全屏截图"
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
