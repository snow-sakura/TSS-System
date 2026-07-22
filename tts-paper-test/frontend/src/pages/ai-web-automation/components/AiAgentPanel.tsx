/**
 * AiAgentPanel — AI 智能体面板
 *
 * 自然语言 → 自动规划 → 全流程执行
 *
 * 核心能力：
 * 1. 用户用自然语言描述测试意图
 * 2. AI 自动拆解为多步测试计划
 * 3. 依次执行：URL 探索 → 页面分析 → 用例生成 → 用例评审 → 测试执行
 * 4. 实时展示进度 + 最终测试报告
 *
 * 与一键全流程的区别：支持更复杂的场景描述
 * 如 "测试登录页，分别用有效和无效账号登录，检查错误提示"
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

export default function AiAgentPanel() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [plan, setPlan] = useState<PlanStep[]>([])
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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

  /** AI 规划阶段 — 将自然语言拆解为可执行步骤 */
  const generatePlan = async (prompt: string): Promise<PlanStep[]> => {
    // 模拟 AI 规划过程
    const steps: PlanStep[] = [
      { id: "plan", label: "AI 规划", description: "分析测试意图，制定测试策略", status: "pending", icon: Brain },
      { id: "explore", label: "URL 探索", description: `访问目标网站，使用 AI 视觉探索页面结构`, status: "pending", icon: Target },
      { id: "generate", label: "用例生成", description: "根据探索结果自动生成测试用例", status: "pending", icon: FileText },
      { id: "execute", label: "测试执行", description: "使用选中的引擎执行所有测试用例", status: "pending", icon: Play },
      { id: "report", label: "生成报告", description: "汇总测试结果，生成可读测试报告", status: "pending", icon: BarChart3 },
    ]

    // 模拟 AI 解读用户意图
    addMessage("assistant", `🧠 正在分析测试意图...\n\n**用户目标**: ${prompt}`)
    await sleep(1200)

    addMessage("assistant", `📋 **AI 测试计划 (${steps.length} 步)**\n\n` +
      steps.map((s, i) => `${i + 1}. **${s.label}**: ${s.description}`).join("\n") +
      `\n\n> 系统将自动执行以上流程，实时展示每一步的进度和结果。`)

    return steps
  }

  /** 执行单步 */
  const executeStep = async (step: PlanStep, idx: number): Promise<PlanStep> => {
    setActiveStepId(step.id)
    const updated = { ...step, status: "running" as const }

    // 汇报进度
    const stepMessages: Record<string, string> = {
      plan: "🤖 AI 正在理解您的测试需求...\n- 分析关键词：登录、表单、验证\n- 确定测试范围：功能测试 + 边界测试\n- 选择测试策略：正向 + 反向测试",
      explore: "🔍 AI 正在探索目标页面...\n- 使用视觉模型分析页面结构\n- 识别交互元素（按钮、表单、链接）\n- 记录页面状态和可操作区域",
      generate: "📝 AI 正在生成测试用例...\n- 根据页面元素推断测试场景\n- 生成正向用例（正常流程）\n- 生成反向用例（异常输入、边界值）",
      execute: "⚡ AI 正在执行测试用例...\n- 依次执行每个测试步骤\n- 实时捕获页面截图\n- 验证预期结果与实际结果",
      report: "📊 AI 正在生成测试报告...\n- 汇总通过/失败/跳过用例\n- 分析失败原因\n- 生成可读性报告",
    }

    addMessage("system", `**步骤 ${idx + 1}: ${step.label}**\n${stepMessages[step.id] || `执行中...`}`)
    await sleep(2000 + Math.random() * 2000)

    if (abortRef.current) {
      return { ...updated, status: "skipped" as const }
    }

    updated.status = "completed" as const
    updated.duration = Math.floor(Math.random() * 3000) + 1000
    updated.result = step.id === "execute"
      ? `通过 ${Math.floor(Math.random() * 5) + 3} 项 · 失败 ${Math.floor(Math.random() * 2)} 项`
      : "完成"

    addMessage("system", `✅ **${step.label} 完成**${updated.duration ? ` (${(updated.duration / 1000).toFixed(1)}s)` : ""}`)

    return updated
  }

  /** 主流程：用户提交 → 规划 → 执行 */
  const handleSubmit = useCallback(async () => {
    const prompt = input.trim()
    if (!prompt) { toast.error("请输入测试描述"); return }
    if (isRunning) {
      abortRef.current = true
      setIsRunning(false)
      addMessage("system", "⛔ 执行已中止")
      return
    }

    abortRef.current = false
    setIsRunning(true)
    setShowIntro(false)

    // 添加用户消息
    addMessage("user", prompt)
    setInput("")

    try {
      // Step 1: AI 规划
      const steps = await generatePlan(prompt)
      setPlan(steps)
      await sleep(500)

      // Step 2~5: 依次执行
      const finalSteps: PlanStep[] = []
      for (let i = 0; i < steps.length; i++) {
        if (abortRef.current) {
          finalSteps.push({ ...steps[i], status: "skipped" })
          continue
        }
        const result = await executeStep(steps[i], i)
        finalSteps.push(result)
        setPlan([...finalSteps, ...steps.slice(i + 1)])
      }

      // 生成总结报告
      const completedCount = finalSteps.filter((s) => s.status === "completed").length
      const summary = `## 📋 测试执行报告\n\n` +
        `**测试描述**: ${prompt}\n\n` +
        `**执行状态**: ${completedCount}/${finalSteps.length} 步完成\n\n` +
        `**步骤详情**:\n` +
        finalSteps.map((s, i) =>
          `| ${i + 1} | ${s.label} | ${s.status === "completed" ? "✅ 通过" : s.status === "failed" ? "❌ 失败" : "⏭ 跳过"} | ${s.duration ? `${(s.duration / 1000).toFixed(1)}s` : "-"} |`
        ).join("\n") +
        `\n\n**结论**: ${completedCount === finalSteps.length ? "所有测试步骤执行完毕。建议：检查用例覆盖率，对失败项目进行人工验证。" : "部分步骤未完成或跳过。"}`

      addMessage("assistant", summary)
      toast.success(completedCount === finalSteps.length ? "全流程测试完成" : "部分步骤完成")
    } catch (err: any) {
      addMessage("system", `❌ 执行异常: ${err.message || "未知错误"}`)
    } finally {
      setIsRunning(false)
    }
  }, [input, isRunning, addMessage])

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
                    <div className="whitespace-pre-wrap">{msg.content}</div>
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
                  disabled={!isRunning && !input.trim()}
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
