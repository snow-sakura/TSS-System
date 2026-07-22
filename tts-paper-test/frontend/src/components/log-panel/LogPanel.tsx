import { useState, useEffect, useRef, useCallback } from "react"
import { Terminal, X, ChevronRight, ChevronLeft, Trash2, Download, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface LogEntry {
  id: number
  timestamp: string
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "AGENT"
  stage: string
  message: string
  detail?: string
}

interface LogPanelProps {
  /** 当前阶段标识 */
  currentStage?: string
  /** SSE 连接地址，为空时不连接 */
  sseUrl?: string
  /** 外部添加日志 */
  onLogAdd?: (log: LogEntry) => void
  /** 是否默认展开 */
  defaultOpen?: boolean
}

const STAGE_LABELS: Record<string, string> = {
  requirements: "需求分析",
  "test-plans": "测试方案",
  "test-points": "测试点管理",
  "test-cases": "测试用例",
  executions: "执行管理",
  defects: "缺陷管理",
  reports: "分析报告",
}

const levelColors: Record<string, string> = {
  INFO: "text-blue-500",
  WARN: "text-amber-500",
  ERROR: "text-red-500",
  DEBUG: "text-muted",
  AGENT: "text-emerald-500",
}

const levelBgs: Record<string, string> = {
  INFO: "bg-blue-50",
  WARN: "bg-amber-50",
  ERROR: "bg-red-50",
  DEBUG: "bg-gray-50",
  AGENT: "bg-emerald-50",
}

export default function LogPanel({ currentStage = "", sseUrl = "", defaultOpen = false }: LogPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [filterLevel, setFilterLevel] = useState<string>("ALL")
  const [isMaximized, setIsMaximized] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const logIdRef = useRef(0)

  // SSE 连接
  useEffect(() => {
    if (!sseUrl) return

    const es = new EventSource(sseUrl)
    eventSourceRef.current = es

    es.onopen = () => {
      addLog({
        level: "INFO",
        message: "日志连接已建立",
        stage: "system",
      })
    }

    es.addEventListener("log", (event) => {
      try {
        const data = JSON.parse(event.data)
        addLog({
          level: data.level || "INFO",
          message: data.message,
          stage: data.stage || currentStage,
          detail: data.detail,
        })
      } catch {
        addLog({
          level: "INFO",
          message: event.data,
          stage: "system",
        })
      }
    })

    es.addEventListener("agent", (event) => {
      try {
        const data = JSON.parse(event.data)
        addLog({
          level: "AGENT",
          message: data.message,
          stage: data.stage || currentStage,
          detail: data.detail,
        })
      } catch {
        addLog({
          level: "AGENT",
          message: event.data,
          stage: "system",
        })
      }
    })

    es.onerror = () => {
      addLog({
        level: "ERROR",
        message: "日志连接断开，正在重连...",
        stage: "system",
      })
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [sseUrl])

  // 自动滚动
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs, autoScroll])

  const addLog = useCallback((entry: { level: string; message: string; stage: string; detail?: string }) => {
    const now = new Date()
    const log: LogEntry = {
      id: ++logIdRef.current,
      timestamp: now.toISOString(),
      level: entry.level as LogEntry["level"],
      stage: entry.stage,
      message: entry.message,
      detail: entry.detail,
    }
    setLogs((prev) => [...prev, log])
  }, [])

  // 暴露 addLog 方法
  useEffect(() => {
    if (typeof window !== "undefined") {
      ;(window as any).__tssLogAdd = addLog
    }
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__tssLogAdd
      }
    }
  }, [addLog])

  const filteredLogs = filterLevel === "ALL"
    ? logs
    : logs.filter((l) => l.level === filterLevel)

  const clearLogs = () => setLogs([])

  const exportLogs = () => {
    const content = logs.map((l) =>
      `[${l.timestamp}] [${l.level}] [${STAGE_LABELS[l.stage] || l.stage}] ${l.message}${l.detail ? ` | ${l.detail}` : ""}`
    ).join("\n")
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tss-logs-${new Date().toISOString().slice(0, 19)}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  const logCountByLevel = {
    ALL: logs.length,
    ERROR: logs.filter((l) => l.level === "ERROR").length,
    WARN: logs.filter((l) => l.level === "WARN").length,
    AGENT: logs.filter((l) => l.level === "AGENT").length,
  }

  return (
    <>
      {/* 浮动打开按钮 (面板收起时显示) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-white border border-border border-r-0 rounded-l-xl shadow-elevated p-2.5 hover:bg-cream transition-colors group"
          title="打开日志面板"
        >
          <ChevronLeft className="w-4 h-4 text-ink-light group-hover:text-ink" />
          {logCountByLevel.ERROR > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {logCountByLevel.ERROR}
            </span>
          )}
        </button>
      )}

      {/* 日志面板 */}
      <div className={`${isOpen ? "translate-x-0" : "translate-x-full"} fixed right-0 top-0 h-full z-40 bg-white border-l border-border shadow-elevated transition-transform duration-300 flex flex-col ${isMaximized ? "w-full" : "w-[420px]"}`}>
        {/* 面板头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-cream/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-ink-light" />
            <h3 className="text-sm font-semibold text-ink">运行日志</h3>
            <span className="text-[11px] text-ink-light bg-white px-1.5 py-0.5 rounded-md border border-border">
              {logs.length} 条
            </span>
            {logCountByLevel.ERROR > 0 && (
              <span className="text-[11px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-200">
                {logCountByLevel.ERROR} 错误
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 rounded-md hover:bg-white transition-colors" title={isMaximized ? "还原" : "最大化"}>
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5 text-ink-light" /> : <Maximize2 className="w-3.5 h-3.5 text-ink-light" />}
            </button>
            <button onClick={exportLogs} className="p-1.5 rounded-md hover:bg-white transition-colors" title="导出日志">
              <Download className="w-3.5 h-3.5 text-ink-light" />
            </button>
            <button onClick={clearLogs} className="p-1.5 rounded-md hover:bg-white transition-colors" title="清空日志">
              <Trash2 className="w-3.5 h-3.5 text-ink-light" />
            </button>
            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-md hover:bg-white transition-colors" title="关闭">
              <X className="w-3.5 h-3.5 text-ink-light" />
            </button>
          </div>
        </div>

        {/* 过滤栏 */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-white flex-shrink-0">
          {(["ALL", "AGENT", "INFO", "WARN", "ERROR"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                filterLevel === level
                  ? "bg-amber text-white shadow-sm"
                  : "text-ink-light hover:bg-cream border border-transparent hover:border-border"
              }`}
            >
              {level === "ALL" ? `全部(${logCountByLevel.ALL})` : `${level}(${(logCountByLevel as any)[level] || 0})`}
            </button>
          ))}
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-[11px] text-ink-light cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3 h-3 rounded border-border text-amber focus:ring-amber"
            />
            自动滚动
          </label>
        </div>

        {/* 日志列表 */}
        <div className="flex-1 overflow-y-auto bg-[#1a1a2e]">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Terminal className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">暂无日志</p>
              <p className="text-xs mt-1 opacity-60">执行AI Agent后将显示实时日志</p>
            </div>
          ) : (
            <div className="p-2 font-mono text-xs space-y-0.5">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`px-2.5 py-1.5 rounded hover:bg-white/5 transition-colors group ${
                    log.level === "ERROR" ? "bg-red-900/20" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 select-none w-16 flex-shrink-0">
                      {log.timestamp.slice(11, 19)}
                    </span>
                    <span className={`select-none w-12 flex-shrink-0 font-bold ${levelColors[log.level] || "text-gray-400"}`}>
                      [{log.level}]
                    </span>
                    <span className="text-gray-500 select-none w-16 flex-shrink-0 truncate">
                      {STAGE_LABELS[log.stage] || log.stage}
                    </span>
                    <span className={`flex-1 ${log.level === "ERROR" ? "text-red-300" : log.level === "WARN" ? "text-amber-300" : log.level === "AGENT" ? "text-emerald-300" : "text-gray-200"}`}>
                      {log.message}
                      {log.detail && <span className="text-gray-500 ml-1">| {log.detail}</span>}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* 底部状态 */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-cream/30 flex-shrink-0">
          <span className="text-[10px] text-ink-light">
            {eventSourceRef.current ? "🟢 已连接" : "🔴 未连接"}
          </span>
          <span className="text-[10px] text-ink-light">
            {currentStage ? `当前阶段: ${STAGE_LABELS[currentStage] || currentStage}` : ""}
          </span>
        </div>
      </div>
    </>
  )
}
