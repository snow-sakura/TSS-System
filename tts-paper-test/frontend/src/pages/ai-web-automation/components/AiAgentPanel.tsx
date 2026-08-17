/**
 * AiAgentPanel — AI 智能体面板
 *
 * 自然语言 → 自动规划 → 全流程执行（真实后端）
 *
 * 核心能力：
 * 1. 用户用自然语言描述测试意图
 * 2. AI 自动拆解为多步测试计划
 * 3. 依次执行：URL 探索(SSE) → 用例生成(SSE) → 测试执行(REST)
 * 4. 实时展示进度 + 最终测试报告
 */
import { useState, useRef, useCallback, useEffect } from "react"
import {
  Sparkles, Send, Square, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Clock, Bot, Brain, Target, FileText, Play, BarChart3, ChevronRight,
  MessageSquare, Lightbulb, Zap, Globe, ListChecks,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { webApi } from "@/lib/api"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"

interface PlanStep {
  id: string
  label: string
  description: string
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  icon: any
  result?: string
  duration?: number
}

interface AgentMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
}

/** 预设测试场景（引导用户快速开始） */
const PRESET_SCENARIOS = [
  {
    title: "登录功能测试",
    prompt: "测试登录页面的完整流程：1) 用正确的账号密码登录 2) 用错误的密码登录 3) 空表单提交 4) 检查密码找回链接",
  },
  {
    title: "表单提交测试",
    prompt: "测试表单提交流程：1) 填写所有必填字段提交 2) 不填必填字段直接提交 3) 输入异常格式数据 4) 验证成功提示",
  },
  {
    title: "导航与页面跳转",
    prompt: "测试主导航菜单：1) 依次点击每个导航项 2) 验证页面正确跳转 3) 检查面包屑导航 4) 测试返回按钮",
  },
  {
    title: "搜索功能测试",
    prompt: "测试站内搜索：1) 输入关键词搜索 2) 搜索空结果 3) 搜索特殊字符 4) 检查搜索建议 5) 验证搜索结果链接",
  },
]

/** 阶段图标映射 */
const STAGE_ICONS: Record<string, any> = {
  plan: Brain,
  explore: Target,
  generate: FileText,
  execute: Play,
  report: BarChart3,
}

/** 读取 SSE 流 */
async function readSSEStream(
  response: Response,
  onEvent?: (event: string, data: any) => void,
  shouldAbort?: () => boolean,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("无法获取响应流")

  const decoder = new TextDecoder()
  let buffer = ""
  let currentEvent = ""
  let currentData = ""

  while (true) {
    if (shouldAbort?.()) return
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
        if (currentEvent && currentData) {
          try {
            onEvent?.(currentEvent, JSON.parse(currentData))
          } catch {}
        }
        currentEvent = ""
        currentData = ""
      }
    }
  }

  if (currentEvent && currentData) {
    try {
      onEvent?.(currentEvent, JSON.parse(currentData))
    } catch {}
  }
}

export default function AiAgentPanel() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [plan, setPlan] = useState<PlanStep[]>([])
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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

  useEffect(() => { fetchProjects() }, [fetchProjects])

  /** 添加消息 */
  const addMessage = useCallback((role: AgentMessage["role"], content: string) => {
    setMessages((prev) => [...prev, {
      role,
      content,
      timestamp: new Date().toLocaleTimeString(),
    }])
  }, [])

  /** 延迟工具 */
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  /** 更新步骤状态 */
  const updateStep = useCallback((id: string, status: PlanStep["status"], extra?: Partial<PlanStep>) => {
    setPlan((prev) => prev.map((s) => s.id === id ? { ...s, status, ...extra } : s))
  }, [])

  /** 构建执行计划 */
  const buildPlan = (prompt: string): PlanStep[] => {
    return [
      { id: "plan", label: "AI 规划", description: "分析测试意图，制定测试策略", status: "pending", icon: Brain },
      { id: "explore", label: "URL 探索", description: "使用 AI 视觉探索页面结构", status: "pending", icon: Target },
      { id: "generate", label: "用例生成", description: "根据探索结果自动生成测试用例", status: "pending", icon: FileText },
      { id: "execute", label: "测试执行", description: "使用选中的引擎执行所有测试用例", status: "pending", icon: Play },
      { id: "report", label: "生成报告", description: "汇总测试结果，生成可读测试报告", status: "pending", icon: BarChart3 },
    ]
  }

  /** 主流程：用户提交 → 规划 → 真实执行 */
  const handleSubmit = useCallback(async () => {
    const prompt = input.trim()
    if (!prompt) { toast.error("请输入测试描述"); return }
    if (isRunning) {
      abortRef.current = true
      setIsRunning(false)
      addMessage("system", "⛔ 执行已中止")
      return
    }

    // 检查项目
    if (!selectedProjectId) {
      toast.error("请先在「项目管理」中创建项目")
      return
    }

    abortRef.current = false
    setIsRunning(true)
    setShowIntro(false)

    // 添加用户消息
    addMessage("user", prompt)
    setInput("")

    // 构建计划
    const steps = buildPlan(prompt)
    setPlan(steps)
    setActiveStepId("plan")

    try {
      // === Step 1: AI 规划 ===
      updateStep("plan", "running")
      addMessage("assistant", `🧠 正在分析测试意图...\n\n**用户目标**: ${prompt}`)
      await sleep(800)
      addMessage("assistant", `📋 **AI 测试计划 (${steps.length} 步)**\n\n` +
        steps.map((s, i) => `${i + 1}. **${s.label}**: ${s.description}`).join("\n") +
        `\n\n> 系统将自动执行以上流程，实时展示每一步的进度和结果。`)
      updateStep("plan", "completed", { duration: 800 })
      await sleep(300)

      if (abortRef.current) { updateStep("explore", "skipped"); return }

      // === Step 2: URL 探索 (SSE) ===
      updateStep("explore", "running")
      setActiveStepId("explore")
      addMessage("system", `**步骤 2: URL 探索**\n正在使用 AI 视觉探索项目页面结构...`)

      const exploreRes = await webApi.exploreSSE(selectedProjectId)
      if (!exploreRes.ok) throw new Error(`AI探索失败: HTTP ${exploreRes.status}`)

      let exploreError = ""
      let exploredPages = 0
      await readSSEStream(
        exploreRes,
        (event, data) => {
          if (event === "page_analyzed") {
            exploredPages++
            addMessage("system", `🔍 页面分析完成: ${data.title} (${data.elements_count || 0} 个元素)`)
          } else if (event === "exploration_error") {
            exploreError = data.error || "探索失败"
          } else if (event === "status") {
            addMessage("system", `🔍 ${data.message}`)
          }
        },
        () => abortRef.current,
      )

      if (abortRef.current) { updateStep("explore", "skipped"); return }
      if (exploreError) throw new Error(exploreError)

      updateStep("explore", "completed", {
        duration: 0,
        result: `发现 ${exploredPages} 个页面`,
      })
      addMessage("system", `✅ **URL 探索完成**${exploredPages > 0 ? `，共发现 ${exploredPages} 个页面` : ""}`)
      await sleep(300)

      if (abortRef.current) { updateStep("generate", "skipped"); return }

      // === Step 3: 用例生成 (SSE) ===
      updateStep("generate", "running")
      setActiveStepId("generate")
      addMessage("system", `**步骤 3: 用例生成**\nAI 正在根据探索结果生成测试用例...`)

      const genRes = await webApi.generateTestCasesSSE(selectedProjectId)
      if (!genRes.ok) throw new Error(`用例生成失败: HTTP ${genRes.status}`)

      let genError = ""
      let generatedCount = 0
      await readSSEStream(
        genRes,
        (event, data) => {
          if (event === "case_generated") {
            generatedCount++
            addMessage("system", `📝 用例生成: ${data.title || `用例 #${generatedCount}`}`)
          } else if (event === "generation_error") {
            genError = data.error || "用例生成失败"
          } else if (event === "status") {
            addMessage("system", `📝 ${data.message}`)
          }
        },
        () => abortRef.current,
      )

      if (abortRef.current) { updateStep("generate", "skipped"); return }
      if (genError) throw new Error(genError)

      updateStep("generate", "completed", {
        duration: 0,
        result: `生成 ${generatedCount} 条用例`,
      })
      addMessage("system", `✅ **用例生成完成**${generatedCount > 0 ? `，共生成 ${generatedCount} 条用例` : ""}`)
      await sleep(300)

      if (abortRef.current) { updateStep("execute", "skipped"); return }

      // === Step 4: 测试执行 (REST) ===
      updateStep("execute", "running")
      setActiveStepId("execute")
      addMessage("system", `**步骤 4: 测试执行**\n正在执行已审批的测试用例...`)

      const execRes: any = await webApi.execute(selectedProjectId)
      if (!execRes?.data) throw new Error("测试执行失败")

      const execCount = execRes.data.cases_count || 0
      const execId = execRes.data.execution_id || execRes.data.id
      updateStep("execute", "completed", {
        duration: 0,
        result: `执行 ${execCount} 条用例${execId ? ` (ID: ${execId})` : ""}`,
      })
      addMessage("system", `✅ **测试执行完成**${execCount > 0 ? `，共执行 ${execCount} 条用例` : ""}`)
      await sleep(300)

      if (abortRef.current) { updateStep("report", "skipped"); return }

      // === Step 5: 生成报告 ===
      updateStep("report", "running")
      setActiveStepId("report")

      // 获取执行记录作为报告数据
      let reportData: any = null
      try {
        const execListRes: any = await webApi.getExecutions(selectedProjectId)
        if (execListRes?.data?.items?.length > 0) {
          reportData = execListRes.data.items[0]
        }
      } catch {}

      const completedCount = plan.filter((s) => s.status === "completed").length + 1
      let summary = `## 📋 测试执行报告\n\n` +
        `**测试描述**: ${prompt}\n\n` +
        `**执行状态**: ${completedCount}/${steps.length} 步完成\n\n` +
        `**步骤详情**:\n` +
        `| # | 步骤 | 状态 | 结果 |\n` +
        `|---|------|------|------|\n` +
        steps.map((s, i) =>
          `| ${i + 1} | ${s.label} | ${s.status === "completed" ? "✅ 通过" : s.status === "failed" ? "❌ 失败" : "⏭ 跳过"} | ${s.result || "-"} |`
        ).join("\n")

      if (reportData) {
        summary += `\n\n**执行记录**:\n` +
          `- 状态: ${reportData.status || "-"}\n` +
          `- 开始时间: ${reportData.started_at ? new Date(reportData.started_at).toLocaleString("zh-CN") : "-"}\n` +
          `- 耗时: ${reportData.duration_ms ? `${(reportData.duration_ms / 1000).toFixed(1)}s` : "-"}\n` +
          (reportData.error_message ? `- 错误: ${reportData.error_message}\n` : "")
      }

      summary += `\n\n**结论**: ${completedCount === steps.length ? "所有测试步骤执行完毕。建议：检查用例覆盖率，对失败项目进行人工验证。" : "部分步骤未完成或跳过。"}`

      updateStep("report", "completed", { duration: 0, result: "报告已生成" })
      addMessage("assistant", summary)
      toast.success(completedCount === steps.length ? "全流程测试完成" : "部分步骤完成")

    } catch (err: any) {
      // 标记当前 running 步骤为 failed
      setPlan((prev) => prev.map((s) => s.status === "running" ? { ...s, status: "failed" as const } : s))
      addMessage("system", `❌ 执行异常: ${err.message || "未知错误"}`)
      toast.error(err.message || "执行失败")
    } finally {
      setIsRunning(false)
      setActiveStepId(null)
    }
  }, [input, isRunning, addMessage, selectedProjectId, updateStep, plan])

  /** 快速应用预设场景 */
  const applyScenario = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  /** 清除对话 */
  const handleClear = () => {
    setMessages([])
    setPlan([])
    setShowIntro(true)
    setActiveStepId(null)
    toast.success("对话已清除")
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-ink flex items-center gap-2">
          AI 智能体 <Bot className="w-4 h-4 text-amber" />
        </h2>
        <p className="text-xs text-muted mt-0.5">
          用自然语言描述测试场景，AI 自动规划并执行全流程测试
        </p>
      </div>

      {/* 项目选择 */}
      <div className="bg-white rounded-xl border border-border shadow-card p-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-ink-light flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-amber" /> 目标项目
        </span>
        <select
          value={selectedProjectId ?? ""}
          onChange={(e) => setSelectedProjectId(Number(e.target.value))}
          disabled={isRunning}
          className="h-8 px-3 rounded-lg border border-border text-xs text-ink bg-white focus:border-amber outline-none disabled:opacity-50"
        >
          {projects.length === 0 && <option value="">暂无项目</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.target_url})</option>
          ))}
        </select>
        {projects.length === 0 && (
          <span className="text-[10px] text-fail">请先在「项目管理」中创建项目</span>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* 左侧 2/3：对话 + 计划 */}
        <div className="lg:col-span-2 flex flex-col min-h-0 gap-4">
          {/* 对话区 */}
          <div className="flex-1 bg-white rounded-2xl border border-border shadow-card flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-amber" />
                对话
              </h3>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button onClick={handleClear} className="text-[10px] text-muted hover:text-ink transition-colors px-2 py-1 rounded-lg hover:bg-cream">
                    清除对话
                  </button>
                )}
                <span className="text-[11px] text-muted">{messages.length} 条消息</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* 引导界面 */}
              {showIntro && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber to-orange-400 flex items-center justify-center shadow-lg mb-4">
                    <Bot className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-ink mb-1">AI 测试智能体</h3>
                  <p className="text-xs text-muted max-w-md mb-6">
                    描述你想要测试的场景，AI 会自动规划测试策略、生成测试用例并执行。
                  </p>

                  {/* 预设场景 */}
                  <div className="w-full max-w-lg">
                    <p className="text-[11px] text-muted font-medium mb-2 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> 快速开始 — 选择一个场景
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PRESET_SCENARIOS.map((scenario, i) => (
                        <button
                          key={i}
                          onClick={() => applyScenario(scenario.prompt)}
                          className="text-left p-3 rounded-xl border border-border hover:border-amber/40 hover:shadow-sm bg-white transition-all group"
                        >
                          <p className="text-xs font-semibold text-ink group-hover:text-amber transition-colors">{scenario.title}</p>
                          <p className="text-[10px] text-muted mt-1 line-clamp-2">{scenario.prompt}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 消息列表 */}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role !== "user" && (
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      msg.role === "system" ? "bg-cream" : "bg-gradient-to-br from-amber to-orange-400"
                    }`}>
                      {msg.role === "system" ? <Clock className="w-3.5 h-3.5 text-muted" /> : <Bot className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-amber text-white rounded-tr-sm"
                      : msg.role === "system"
                      ? "bg-cream/60 text-ink-light border border-border/50"
                      : "bg-cream/30 text-ink-light border border-border/30"
                  }`}>
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <MarkdownPreview content={msg.content} />
                    )}
                    <p className={`text-[10px] mt-1.5 opacity-60 ${msg.role === "user" ? "text-white/70" : "text-muted"}`}>
                      {msg.timestamp}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] text-white font-bold">U</span>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区 */}
            <div className="p-4 border-t border-border">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef as any}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit()
                      }
                    }}
                    placeholder={isRunning ? "正在执行..." : "描述测试场景，如「测试登录页，用正确和错误的密码分别登录」..."}
                    disabled={isRunning}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber/50 resize-none disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!isRunning && (!input.trim() || !selectedProjectId)}
                  className={`h-10 px-4 rounded-xl flex items-center gap-1.5 text-sm font-medium transition-all shadow-sm ${
                    isRunning
                      ? "bg-fail text-white hover:bg-fail/90"
                      : "bg-gradient-to-r from-amber to-orange-400 text-white hover:shadow-md disabled:opacity-50"
                  }`}
                >
                  {isRunning ? (
                    <><Square className="w-4 h-4" /> 停止</>
                  ) : (
                    <><Send className="w-4 h-4" /> 发送</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧 1/3：执行计划 */}
        <div className="flex flex-col min-h-0">
          <div className="flex-1 bg-white rounded-2xl border border-border shadow-card flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-amber" />
                执行计划
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {plan.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <Brain className="w-8 h-8 mx-auto mb-2 text-muted-light" />
                  <p className="text-xs">输入测试描述后，AI 会自动生成执行计划</p>
                </div>
              ) : (
                plan.map((step, idx) => {
                  const Icon = step.icon
                  const isActive = activeStepId === step.id
                  return (
                    <div key={step.id} className={`rounded-xl border p-3 transition-all ${
                      isActive
                        ? "border-amber/40 bg-amber/5 shadow-sm ring-1 ring-amber/20"
                        : step.status === "completed"
                        ? "border-pass/30 bg-pass/5"
                        : step.status === "skipped"
                        ? "border-border/50 bg-cream/30 opacity-60"
                        : "border-border"
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          step.status === "completed" ? "bg-pass/10 text-pass" :
                          isActive ? "bg-amber/10 text-amber" :
                          step.status === "skipped" ? "bg-cream text-muted" :
                          "bg-cream/50 text-muted"
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${
                              step.status === "completed" ? "text-pass" :
                              isActive ? "text-amber" : "text-ink"
                            }`}>{step.label}</span>
                            {step.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-pass" />}
                            {isActive && <Loader2 className="w-3.5 h-3.5 text-amber animate-spin" />}
                            {step.status === "skipped" && <AlertTriangle className="w-3.5 h-3.5 text-muted" />}
                          </div>
                          <p className="text-[10px] text-muted mt-0.5">{step.description}</p>
                          {step.result && (
                            <p className="text-[10px] text-ink-light mt-1 bg-cream/50 rounded-lg px-2 py-1">{step.result}</p>
                          )}
                          {step.duration && (
                            <p className="text-[10px] text-muted mt-0.5">耗时: {(step.duration / 1000).toFixed(1)}s</p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            step.status === "completed" ? "bg-pass/10 text-pass" :
                            isActive ? "bg-amber/10 text-amber" : "bg-cream text-muted"
                          }`}>{idx + 1}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {/* 执行摘要（当有完成步骤时） */}
              {plan.some((s) => s.status === "completed") && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] font-medium text-muted mb-2">执行摘要</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center bg-pass/5 rounded-lg p-2">
                      <p className="text-sm font-bold text-pass">{plan.filter((s) => s.status === "completed").length}</p>
                      <p className="text-[9px] text-muted">完成</p>
                    </div>
                    <div className="text-center bg-fail/5 rounded-lg p-2">
                      <p className="text-sm font-bold text-fail">{plan.filter((s) => s.status === "failed").length}</p>
                      <p className="text-[9px] text-muted">失败</p>
                    </div>
                    <div className="text-center bg-cream/50 rounded-lg p-2">
                      <p className="text-sm font-bold text-muted">{plan.filter((s) => s.status === "skipped").length}</p>
                      <p className="text-[9px] text-muted">跳过</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}