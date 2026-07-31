/**
 * LogPanelFooter — 嵌入式底部日志面板
 *
 * 深色终端风格日志输出，支持：
 *   - 折叠/展开（默认折叠为3行预览）
 *   - 日志级别过滤（ALL/ERROR/WARN/INFO/AGENT）
 *   - 自动滚动到底部
 *   - 终端风格配色
 */
import { memo, useRef, useEffect, useState, useCallback, useMemo } from "react"
import {
  Terminal, ChevronDown, ChevronUp, Filter,
  XCircle, AlertTriangle, Info, Bot,
} from "lucide-react"
import type { PipelineStatus } from "./PipelineHeader"

export interface LogEntry {
  id: string
  timestamp: string
  level: "info" | "warn" | "error" | "agent"
  message: string
  step?: string
}

interface LogPanelFooterProps {
  logs: LogEntry[]
  pipelineStatus: PipelineStatus
  onClearLogs: () => void
}

type LogFilter = "all" | "error" | "warn" | "info" | "agent"

const FILTER_OPTIONS: { value: LogFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "error", label: "错误" },
  { value: "warn", label: "警告" },
  { value: "info", label: "信息" },
  { value: "agent", label: "Agent" },
]

const LEVEL_ICONS: Record<string, typeof Info> = {
  error: XCircle,
  warn: AlertTriangle,
  info: Info,
  agent: Bot,
}

const LEVEL_COLORS: Record<string, string> = {
  error: "text-red-400",
  warn: "text-yellow-400",
  info: "text-sky-300",
  agent: "text-emerald-300",
}

const LEVEL_BG: Record<string, string> = {
  error: "bg-red-500/10",
  warn: "bg-yellow-500/10",
  info: "bg-sky-500/5",
  agent: "bg-emerald-500/10",
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp)
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return timestamp
  }
}

function LogPanelFooterInner({ logs, pipelineStatus, onClearLogs }: LogPanelFooterProps) {
  const [expanded, setExpanded] = useState(false)
  const [filter, setFilter] = useState<LogFilter>("all")
  const scrollRef = useRef<HTMLDivElement>(null)
  const isRunning = pipelineStatus === "running"

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs.length, expanded])

  // 过滤后的日志
  const filteredLogs = useMemo(() => {
    if (filter === "all") return logs
    return logs.filter((l) => l.level === filter)
  }, [logs, filter])

  // 运行中但未展开时显示实时预览（最后2条）
  const previewLogs = useMemo(() => {
    if (expanded) return []
    return logs.slice(-2)
  }, [logs, expanded])

  // 有错误？
  const hasErrors = logs.some((l) => l.level === "error")

  // 清除过滤
  const handleClear = useCallback(() => {
    onClearLogs()
  }, [onClearLogs])

  if (logs.length === 0 && !isRunning) return null

  return (
    <div
      className={`
        flex-shrink-0 border-t border-border transition-all duration-300
        ${expanded ? "bg-[#1a1b26]" : "bg-cream-dark/80"}
      `}
    >
      {/* 折叠按钮行 */}
      <div
        className={`
          flex items-center gap-2 px-4 cursor-pointer select-none
          ${expanded ? "py-2 border-b border-white/5" : "py-1"}
          ${isRunning ? "hover:bg-black/30" : "hover:bg-black/10"}
          transition-colors
        `}
        onClick={() => setExpanded(!expanded)}
      >
        <Terminal
          className={`w-3.5 h-3.5 ${expanded ? "text-amber" : "text-muted"}`}
        />
        <span
          className={`text-xs font-semibold ${expanded ? "text-amber" : "text-muted"}`}
        >
          日志控制台
        </span>
        {hasErrors && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
        {/* 预览行（折叠时显示） */}
        {!expanded && previewLogs.length > 0 && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {previewLogs.map((log) => {
              const Icon = LEVEL_ICONS[log.level] || Info
              return (
                <span
                  key={log.id}
                  className="flex items-center gap-1 text-[10px] truncate max-w-[200px] text-muted-light"
                >
                  <Icon className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate">{log.message}</span>
                </span>
              )
            })}
          </div>
        )}
        {/* 计数 */}
        <span
          className={`text-[10px] font-mono ${
            expanded ? "text-white/40" : "text-muted-light"
          }`}
        >
          {logs.length} 条
        </span>
        {/* 展开/折叠图标 */}
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-muted-light flex-shrink-0" />
        )}
      </div>

      {/* 展开后的日志面板 */}
      {expanded && (
        <div className="h-48 flex flex-col">
          {/* 工具栏 */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 flex-shrink-0">
            <Filter className="w-3 h-3 text-white/30" />
            <div className="flex gap-1">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`
                    px-2 py-0.5 rounded text-[10px] font-medium transition-all
                    ${filter === opt.value
                      ? "bg-amber/20 text-amber"
                      : "text-white/40 hover:text-white/70 hover:bg-white/5"
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button
              onClick={handleClear}
              className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              清空
            </button>
          </div>

          {/* 日志内容 */}
          <div
            ref={scrollRef}
            className="flex-1 h-0 min-h-0 overflow-y-auto p-2 space-y-0.5 font-mono text-xs"
          >
            {filteredLogs.length === 0 ? (
              <p className="text-white/20 p-2 text-center">暂无匹配日志</p>
            ) : (
              filteredLogs.map((log) => {
                const Icon = LEVEL_ICONS[log.level] || Info
                return (
                  <div
                    key={log.id}
                    className={`
                      flex items-start gap-2 px-2 py-1 rounded
                      ${LEVEL_BG[log.level] || ""}
                    `}
                  >
                    <span className="text-white/25 w-14 flex-shrink-0 text-[10px]">
                      {formatTime(log.timestamp)}
                    </span>
                    <Icon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${LEVEL_COLORS[log.level] || "text-white/40"}`} />
                    {log.step && (
                      <span className="text-white/25 text-[10px] flex-shrink-0">
                        [{log.step}]
                      </span>
                    )}
                    <span className="text-white/80 leading-tight break-all">
                      {log.message}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(LogPanelFooterInner)
