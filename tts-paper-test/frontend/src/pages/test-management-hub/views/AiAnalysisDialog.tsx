/**
 * AiAnalysisDialog — AI 流式分析对话框
 *
 * 通用组件：传入一个返回 SSE Response 的 fetch 函数，
 * 组件自动流式读取并渲染 Markdown 内容。
 * 支持加载态 → 流式输出 → 完成/错误三种状态。
 */
import { useState, useRef, useEffect, useCallback } from "react"
import { X, Loader2, CheckCircle2, AlertCircle, Sparkles, Copy, Check, FileText } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

interface Props {
  /** 对话框标题 */
  title: string
  /** 返回 SSE Response 的 fetch 函数，返回 null 表示跳过 */
  fetchFn: () => Promise<Response | null>
  /** 关闭回调 */
  onClose: () => void
}

export default function AiAnalysisDialog({ title, fetchFn, onClose }: Props) {
  const [phase, setPhase] = useState<"loading" | "streaming" | "done" | "error">("loading")
  const [content, setContent] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [copied, setCopied] = useState(false)
  const contentRef = useRef("")
  const abortRef = useRef<AbortController | null>(null)

  const startStream = useCallback(async () => {
    try {
      const response = await fetchFn()
      if (!response) {
        setPhase("error")
        setErrorMsg("无法启动分析：请求返回空")
        return
      }

      if (!response.ok) {
        setPhase("error")
        setErrorMsg(`请求失败 (${response.status})`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setPhase("error")
        setErrorMsg("无法读取响应流")
        return
      }

      setPhase("streaming")
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === "chunk" || data.type === "token") {
                contentRef.current += data.content
                setContent(contentRef.current)
              } else if (data.type === "done") {
                setPhase("done")
              } else if (data.type === "error") {
                setPhase("error")
                setErrorMsg(data.content || "分析出错")
              }
            } catch {
              // 忽略解析异常行
            }
          }
        }
      }

      if (phase !== "error") {
        setPhase("done")
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setPhase("error")
        setErrorMsg(err.message || "请求失败")
      }
    }
  }, [fetchFn])

  useEffect(() => {
    abortRef.current = new AbortController()
    startStream()
    return () => {
      abortRef.current?.abort()
    }
  }, [startStream])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contentRef.current)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-elevated max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">{title}</h3>
              <p className="text-[11px] text-ink-light">
                {phase === "loading" && "AI 正在思考..."}
                {phase === "streaming" && "正在输出..."}
                {phase === "done" && "分析完成"}
                {phase === "error" && "分析出错"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-cream text-ink-light hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="relative">
                <Loader2 className="w-10 h-10 text-amber animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber" />
                </div>
              </div>
              <p className="text-sm text-ink-light">正在分析内容，请稍候...</p>
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-amber/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-amber/80 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {phase === "streaming" && (
            <div className="prose prose-sm max-w-none text-sm leading-relaxed text-ink">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              <span className="inline-block w-2 h-4 bg-amber animate-pulse ml-0.5" />
            </div>
          )}

          {phase === "done" && (
            <div className="prose prose-sm max-w-none text-sm leading-relaxed text-ink">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-fail" />
              </div>
              <p className="text-sm font-medium text-ink">分析过程中出现问题</p>
              <p className="text-xs text-ink-light max-w-md text-center">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {(phase === "done" || (phase === "error" && content)) && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream text-xs text-ink-light hover:text-ink transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-pass" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "已复制" : "复制内容"}
              </button>
            )}
            {phase === "done" && (
              <span className="flex items-center gap-1 text-xs text-pass">
                <CheckCircle2 className="w-3.5 h-3.5" /> 分析完成
              </span>
            )}
          </div>
          <Button variant="outline" className="h-8 text-xs border-border" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}
