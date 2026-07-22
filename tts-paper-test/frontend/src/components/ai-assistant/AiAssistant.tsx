/**
 * AI智能助手 - 对接真实大模型
 * 功能：流式对话 / Markdown渲染 / 会话上下文 / 全功能覆盖
 */
import { useState, useRef, useEffect, useCallback } from "react"
import { Bot, Send, X, Sparkles, Copy, Check, Trash2, Loader2 } from "lucide-react"
import { aiChatApi } from "@/lib/api"

interface Message {
  id: number
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

// 简单的Markdown渲染组件
function MarkdownContent({ content }: { content: string }) {
  // 简单的Markdown解析
  const renderMarkdown = (text: string) => {
    // 代码块
    let result = text.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-ink/5 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono"><code>$2</code></pre>')
    // 行内代码
    result = result.replace(/`([^`]+)`/g, '<code class="bg-ink/5 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    // 粗体
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // 标题
    result = result.replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold text-ink mt-3 mb-1">$1</h4>')
    result = result.replace(/^## (.+)$/gm, '<h3 class="text-base font-bold text-ink mt-4 mb-2">$1</h3>')
    result = result.replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold text-ink mt-4 mb-2">$1</h2>')
    // 列表
    result = result.replace(/^- (.+)$/gm, '<li class="ml-4 text-sm">• $1</li>')
    result = result.replace(/^(\d+) (.+)$/gm, '<li class="ml-4 text-sm">$1. $2</li>')
    // 表格（简单支持）
    result = result.replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim())
      if (cells.every(c => c.trim().match(/^-+$/))) return ''
      return '<tr>' + cells.map(c => `<td class="px-3 py-1.5 border border-border text-xs">${c.trim()}</td>`).join('') + '</tr>'
    })
    // 换行
    result = result.replace(/\n/g, '<br/>')
    return result
  }

  return (
    <div
      className="text-sm leading-relaxed prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  )
}

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content: "你好！我是TSS AI测试助手，基于DeepSeek大模型。我可以帮你：\n\n- **查询项目数据**：用例、缺陷、报告、环境配置等\n- **执行操作**：生成报告、分析缺陷、生成用例等\n- **咨询建议**：测试策略、最佳实践、质量分析\n\n请问有什么需要帮助的？",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [messageCounter, setMessageCounter] = useState(2)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent])

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return

    const userMessageId = messageCounter
    setMessageCounter((prev) => prev + 1)

    const userMessage: Message = {
      id: userMessageId,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsStreaming(true)
    setStreamingContent("")

    // 构建对话历史
    const chatHistory = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    let fullResponse = ""
    const aiMessageId = messageCounter + 1
    setMessageCounter((prev) => prev + 2)

    await aiChatApi.streamChat(
      chatHistory,
      // onToken
      (token) => {
        fullResponse += token
        setStreamingContent(fullResponse)
      },
      // onDone
      () => {
        if (fullResponse) {
          const aiMessage: Message = {
            id: aiMessageId,
            role: "assistant",
            content: fullResponse,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, aiMessage])
        }
        setStreamingContent("")
        setIsStreaming(false)
      },
      // onError
      (error) => {
        const errorMessage: Message = {
          id: aiMessageId,
          role: "assistant",
          content: `抱歉，遇到了一些问题：${error}\n\n请稍后重试，或者检查网络连接。`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
        setStreamingContent("")
        setIsStreaming(false)
      },
    )
  }, [inputValue, isStreaming, messages, messageCounter])

  const handleCopy = (content: string, id: number) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleClear = () => {
    setMessages([
      {
        id: 1,
        role: "assistant",
        content: "对话已清空。请问有什么需要帮助的？",
        timestamp: new Date(),
      },
    ])
  }

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-6 bottom-6 w-14 h-14 rounded-full gradient-amber shadow-lg shadow-amber/30 flex items-center justify-center text-white hover:scale-110 transition-transform z-50"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      {/* 聊天面板 */}
      {isOpen && (
        <div className="fixed right-6 bottom-24 w-[400px] h-[520px] bg-white rounded-2xl shadow-elevated border border-border z-50 flex flex-col animate-scale-in">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border gradient-amber rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">TSS AI助手</h3>
                <p className="text-[11px] text-white/70">DeepSeek大模型驱动</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleClear} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" title="清空对话">
                <Trash2 className="w-4 h-4 text-white/80" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-4 h-4 text-white/80" />
              </button>
            </div>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-amber text-white rounded-br-md"
                    : "bg-cream text-ink rounded-bl-md"
                }`}>
                  {msg.role === "assistant" ? (
                    <MarkdownContent content={msg.content} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <div className={`flex items-center justify-between mt-2 ${msg.role === "user" ? "text-white/60" : "text-muted"}`}>
                    <p className="text-[10px]">
                      {msg.timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="p-1 rounded hover:bg-ink/5 transition-colors"
                        title="复制"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-pass" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* 流式输出中的消息 */}
            {isStreaming && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-cream text-ink">
                  <MarkdownContent content={streamingContent} />
                  <span className="inline-block w-2 h-4 bg-amber animate-pulse ml-0.5" />
                </div>
              </div>
            )}

            {/* 加载状态 */}
            {isStreaming && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-cream rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">思考中...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入框 */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="输入消息... (Enter发送)"
                className="flex-1 h-10 px-4 rounded-xl bg-cream border border-border text-sm text-ink focus:border-amber outline-none"
                disabled={isStreaming}
              />
              <button
                onClick={handleSend}
                className="h-10 w-10 rounded-xl gradient-amber text-white flex items-center justify-center shadow-sm hover:shadow-md transition-shadow disabled:opacity-50"
                disabled={!inputValue.trim() || isStreaming}
              >
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted mt-2 text-center">基于DeepSeek大模型 · 会话内保持上下文</p>
          </div>
        </div>
      )}
    </>
  )
}
