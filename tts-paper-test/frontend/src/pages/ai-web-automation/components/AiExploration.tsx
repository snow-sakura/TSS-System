/**
 * AI探索 - 给一个URL，AI自动去探索测试
 * 核心区别于传统测试：AI使用视觉观察定位，自动发现页面结构
 * 使用SSE接收实时探索进度
 * 优化：TAB切换布局减少滚动
 */
import { useState, useRef, useEffect, useCallback, memo } from "react"
import { Globe, Play, Loader2, CheckCircle, XCircle, Clock, Sparkles, Eye, ChevronDown, ChevronRight, AlertCircle, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { webApi } from "@/lib/api"

interface PageResult {
  url: string
  title: string
  description?: string
  elements: Array<{ text: string; type: string; description: string; id?: string; name?: string; href?: string }>
  forms: Array<{ action: string; fields: Array<{ name: string; type: string; placeholder?: string }> }>
  sections?: Array<{ name: string; description?: string }>
  screenshot?: string
  status: string
  error?: string
}

interface ExplorationResult {
  pages: PageResult[]
  structure: any
}

interface AiExplorationProps {
  onStatusChange?: (status: Record<string, "pending" | "running" | "completed" | "failed">) => void
}

type TabType = "logs" | "results"

function AiExploration({ onStatusChange }: AiExplorationProps) {
  const [url, setUrl] = useState("")
  const [exploring, setExploring] = useState(false)
  const [result, setResult] = useState<ExplorationResult | null>(null)
  const [logs, setLogs] = useState<Array<{ type: string; message: string; time: string }>>([])
  const [expandedPage, setExpandedPage] = useState<number | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("logs")
  const logsEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const addLog = useCallback((type: string, message: string) => {
    setLogs(prev => [...prev, { type, message, time: new Date().toLocaleTimeString() }])
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const startExploration = useCallback(async () => {
    if (!url.trim()) { toast.error("请输入目标URL"); return }
    if (!url.match(/^https?:\/\//)) { toast.error("请输入有效的URL（以http://或https://开头）"); return }

    setExploring(true)
    setLogs([])
    setResult(null)
    setExpandedPage(null)
    setActiveTab("logs")
    addLog("info", "正在初始化AI探索引擎...")

    // 更新流程状态
    onStatusChange?.({
      project: "running", url: "running", explore: "pending", analyze: "pending",
      generate: "pending", review: "pending", execute: "pending", report: "pending",
    })

    try {
      // 先创建项目
      addLog("info", "创建自动化项目...")
      const projectRes: any = await webApi.createProject({
        name: `AI探索-${new URL(url).hostname}`,
        target_url: url,
        description: `AI自动探索 ${url}`,
      })
      const projectId = projectRes?.data?.id
      setSelectedProjectId(projectId)
      addLog("success", `项目创建成功 (ID: ${projectId})`)

      onStatusChange?.({
        project: "completed", url: "completed", explore: "running", analyze: "pending",
        generate: "pending", review: "pending", execute: "pending", report: "pending",
      })

      // 启动AI探索 - 使用SSE接收实时进度
      addLog("info", "启动AI视觉探索引擎...")
      addLog("info", "正在使用midscene.js + Playwright + AI Agent分析页面...")

      const response = await webApi.exploreSSE(projectId)

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error("无法获取响应流")

      const decoder = new TextDecoder()
      let buffer = ""
      let currentEvent = ""
      let currentData = ""
      const pages: PageResult[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6).trim()
          } else if (line === "") {
            // 空行表示事件结束
            if (currentEvent && currentData) {
              try {
                const data = JSON.parse(currentData)
                handleSSEEvent(currentEvent, data, pages)
              } catch {}
            }
            currentEvent = ""
            currentData = ""
          }
          // 处理没有空行分隔的情况（某些SSE实现）
          else if (currentEvent && currentData && line.startsWith("event:")) {
            try {
              const data = JSON.parse(currentData)
              handleSSEEvent(currentEvent, data, pages)
            } catch {}
            currentEvent = ""
            currentData = ""
          }
        }
      }

      // 处理缓冲区中剩余的数据
      if (currentEvent && currentData) {
        try {
          const data = JSON.parse(currentData)
          handleSSEEvent(currentEvent, data, pages)
        } catch {}
      }

      // 设置最终结果
      setResult({ pages, structure: null })
      addLog("success", `探索完成，共发现 ${pages.length} 个页面`)
      setActiveTab("results")

      onStatusChange?.({
        project: "completed", url: "completed", explore: "completed", analyze: "completed",
        generate: "pending", review: "pending", execute: "pending", report: "pending",
      })

    } catch (error: any) {
      if (error.name !== "AbortError") {
        addLog("error", `探索失败: ${error.message || "未知错误"}`)
        onStatusChange?.({
          project: "completed", url: "completed", explore: "failed", analyze: "pending",
          generate: "pending", review: "pending", execute: "pending", report: "pending",
        })
      }
    } finally {
      setExploring(false)
      abortRef.current = null
    }
  }, [url, addLog, onStatusChange])

  const handleSSEEvent = useCallback((eventType: string, data: any, pages: PageResult[]) => {
    switch (eventType) {
      case "exploration_start":
        addLog("info", `开始探索: ${data.target_url}`)
        break
      case "page_analyzed":
        addLog("success", `页面分析完成: ${data.title} (${data.elements_count || 0} 个元素)`)
        pages.push({
          url: data.url,
          title: data.title || "未知页面",
          description: data.description,
          elements: data.elements || [],
          forms: data.forms || [],
          sections: data.sections,
          screenshot: data.screenshot,
          status: "completed",
        })
        break
      case "exploration_complete":
        addLog("success", `探索完成，共 ${data.total_pages || 0} 个页面`)
        // 若SSE未逐页推送，用完整结果兜底
        if (pages.length === 0 && data.pages?.length) {
          data.pages.forEach((p: any) => pages.push(p))
        }
        if (data.summary) addLog("info", data.summary)
        break
      case "exploration_error":
        addLog("error", `探索错误: ${data.error}`)
        break
      case "status":
        addLog("info", data.message)
        break
    }
  }, [addLog])

  const stopExploration = useCallback(() => {
    abortRef.current?.abort()
    setExploring(false)
    addLog("info", "探索已停止")
    onStatusChange?.({
      project: "completed", url: "completed", explore: "failed", analyze: "pending",
      generate: "pending", review: "pending", execute: "pending", report: "pending",
    })
  }, [addLog, onStatusChange])

  const tabs: Array<{ key: TabType; label: string; count?: number }> = [
    { key: "logs", label: "探索日志", count: logs.length },
    { key: "results", label: "探索结果", count: result?.pages.length },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* 标题 */}
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink flex items-center gap-2">
          AI探索 <Sparkles className="w-4 h-4 text-amber" />
        </h2>
        <p className="text-xs text-muted mt-0.5">输入URL，AI自动使用视觉模型探索网站结构，识别页面元素和交互</p>
      </div>

      {/* URL输入区 - 紧凑 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !exploring && startExploration()}
              placeholder="https://example.com"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border text-sm text-ink font-mono focus:border-amber focus:ring-1 focus:ring-amber outline-none"
            />
          </div>
          {exploring ? (
            <button
              onClick={stopExploration}
              className="h-10 px-6 rounded-xl bg-fail text-white text-sm font-medium shadow-md hover:shadow-lg flex items-center gap-2 transition-all"
            >
              停止探索
            </button>
          ) : (
            <button
              onClick={startExploration}
              disabled={!url.trim()}
              className="h-10 px-6 rounded-xl gradient-amber text-white text-sm font-medium shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Play className="w-4 h-4" /> 开始AI探索
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
          <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber" /> AI视觉模型驱动</span>
          <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> midscene.js + Playwright</span>
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> 自动发现页面结构</span>
        </div>
      </div>

      {/* TAB切换 + 内容区 */}
      <div className="flex-1 bg-white rounded-2xl border border-border shadow-card flex flex-col min-h-0">
        {/* TAB头部 */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-amber"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === tab.key ? "bg-amber/10 text-amber" : "bg-cream text-muted"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </span>
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />
              )}
            </button>
          ))}
        </div>

        {/* TAB内容 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "logs" && (
            <div className="p-3 space-y-1.5">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-muted-light" />
                  <p className="text-xs">输入URL后点击"开始AI探索"</p>
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                    log.type === "error" ? "bg-fail/10" :
                    log.type === "success" ? "bg-pass/10" :
                    "bg-cream/50"
                  }`}>
                    <span className="text-[10px] text-muted font-mono w-14 flex-shrink-0">{log.time}</span>
                    <span className={`flex-shrink-0 ${
                      log.type === "error" ? "text-fail" :
                      log.type === "success" ? "text-pass" :
                      "text-ink-light"
                    }`}>
                      {log.type === "error" ? "✗" : log.type === "success" ? "✓" : "•"}
                    </span>
                    <span className="text-ink-light">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          )}

          {activeTab === "results" && (
            <div className="p-3 space-y-3">
              {!result ? (
                <div className="text-center py-8 text-muted">
                  <Eye className="w-8 h-8 mx-auto mb-2 text-muted-light" />
                  <p className="text-xs">等待探索结果...</p>
                </div>
              ) : result.pages.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-light" />
                  <p className="text-xs">未发现页面</p>
                </div>
              ) : (
                result.pages.map((page, idx) => (
                  <div key={idx} className="border border-border rounded-xl overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-cream/30 cursor-pointer hover:bg-cream/50 transition-colors"
                      onClick={() => setExpandedPage(expandedPage === idx ? null : idx)}
                    >
                      <div className="flex items-center gap-2">
                        {page.status === "completed" ? (
                          <CheckCircle className="w-4 h-4 text-pass" />
                        ) : (
                          <XCircle className="w-4 h-4 text-fail" />
                        )}
                        <span className="text-sm font-medium text-ink">{page.title}</span>
                        <span className="text-[11px] text-muted">{page.elements.length} 元素</span>
                      </div>
                      {expandedPage === idx ? (
                        <ChevronDown className="w-4 h-4 text-muted" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted" />
                      )}
                    </div>
                    {expandedPage === idx && (
                      <div className="px-4 py-3 border-t border-border space-y-2">
                        <p className="text-xs text-muted font-mono break-all">{page.url}</p>
                        {page.screenshot && (
                          <div>
                            <p className="text-xs font-medium text-ink mb-1.5 flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5 text-amber" /> 页面截图
                            </p>
                            <img
                              src={`/uploads/screenshots/${page.screenshot}`}
                              alt={`${page.title} 截图`}
                              className="w-full rounded-lg border border-border object-cover max-h-56"
                              loading="lazy"
                              onClick={(e) => { e.stopPropagation(); window.open(e.currentTarget.src, "_blank") }}
                            />
                          </div>
                        )}
                        {page.description && (
                          <p className="text-xs text-ink-light bg-cream/50 p-2 rounded-lg">{page.description}</p>
                        )}
                        {page.sections && page.sections.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-ink mb-1.5">页面区域 ({page.sections.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {page.sections.map((s, i) => (
                                <span key={i} className="px-2 py-1 rounded-lg bg-amber-light/60 text-[11px] text-ink-light" title={s.description}>
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {page.elements.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-ink mb-1.5">交互元素 ({page.elements.length})</p>
                            <div className="space-y-1">
                              {page.elements.map((el, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs p-1.5 bg-cream/50 rounded-lg">
                                  <span className="px-1.5 py-0.5 rounded bg-cream text-[10px] font-medium flex-shrink-0">{el.type}</span>
                                  <span className="text-ink-light truncate">{el.text}</span>
                                  {(el.id || el.name) && (
                                    <span className="text-[10px] text-muted font-mono ml-auto flex-shrink-0">
                                      {el.id ? `#${el.id}` : ""}{el.name ? ` name=${el.name}` : ""}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {page.forms.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-ink mb-1.5">表单 ({page.forms.length})</p>
                            <div className="space-y-1">
                              {page.forms.map((f, i) => (
                                <div key={i} className="text-xs p-1.5 bg-cream/50 rounded-lg">
                                  <span className="text-ink-light">表单: {f.action}</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {f.fields.map((ff: any, j: number) => (
                                      <span key={j} className="px-1.5 py-0.5 rounded bg-white border border-border text-[10px] text-muted">
                                        {ff.name || ff.type}{ff.placeholder ? ` (${ff.placeholder})` : ""}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {page.error && (
                          <p className="text-xs text-fail bg-fail/10 p-2 rounded-lg">{page.error}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(AiExploration)
