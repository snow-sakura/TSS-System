/**
 * RAG搜索 - 连接真实API的智能搜索
 */
import { useState, useRef, useEffect } from "react"
import { Search, Send, Loader2, BookOpen, Brain, X } from "lucide-react"
import { toast } from "sonner"
import { knowledgeApi } from "@/lib/api"

interface SearchResult {
  id: number
  type: string
  title: string
  content: string
  relevance_score: number
  metadata?: Record<string, any>
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  sources?: SearchResult[]
  responseTime?: number
}

export default function RagSearch() {
  const [query, setQuery] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [useAI, setUseAI] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSearch = async () => {
    if (!query.trim() || searching) return
    const q = query.trim()
    setQuery("")
    setMessages((prev) => [...prev, { role: "user", content: q }])
    setSearching(true)

    try {
      let results: SearchResult[] = []
      let data: any = null

      if (useAI) {
        // AI 增强搜索
        const aiRes: any = await knowledgeApi.aiSearch({ query: q, search_type: "all", limit: 5 })
        data = aiRes?.data || aiRes
        results = data?.results || []
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: data?.answer || (results.length > 0 ? `找到 ${results.length} 条相关知识` : `未找到与"${q}"相关的知识。`),
          sources: results,
        }])
      } else {
        // 基础搜索
        const res: any = await knowledgeApi.searchKnowledge({ query: q, search_type: "all", limit: 5 })
        data = res?.data
        results = data?.results || []
        setSearchResults(results)

        let answer = ""
        if (results.length === 0) {
          answer = `未找到与"${q}"相关的知识。请尝试其他关键词。`
        } else {
          answer = `找到 ${results.length} 条相关知识：\n\n`
          results.forEach((r, i) => {
            const typeLabel = r.type === "test_pattern" ? "测试模式" : "Bug知识"
            answer += `${i + 1}. 【${typeLabel}】${r.title}\n`
            if (r.content) answer += `   ${r.content.slice(0, 100)}${r.content.length > 100 ? "..." : ""}\n`
            answer += `   相关度：${(r.relevance_score * 100).toFixed(0)}%\n\n`
          })
        }

        setMessages((prev) => [...prev, {
          role: "assistant",
          content: answer,
          sources: results,
          responseTime: data?.response_time_ms || 0,
        }])
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "搜索出错，请重试。" }])
      toast.error("搜索失败")
    } finally {
      setSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const typeColor = (type: string) => {
    if (type === "test_pattern") return "bg-info/10 text-info"
    return "bg-warn/10 text-warn"
  }

  const typeLabel = (type: string) => {
    if (type === "test_pattern") return "测试模式"
    return "Bug知识"
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">RAG智能搜索 <span className="text-xs font-normal text-muted">基于知识库的语义搜索</span></h2>
          <button onClick={() => setUseAI(!useAI)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors flex items-center gap-1 ${
              useAI ? "bg-amber text-white shadow-sm" : "bg-white border border-border text-muted hover:text-ink"
            }`}>
            <Brain className={`w-3 h-3 ${useAI ? "text-white" : ""}`} />
            AI 搜索
          </button>
        </div>
        <p className="text-xs text-muted mt-0.5">{useAI ? "AI 增强搜索：自动改写查询、语义重排、生成回答" : "输入问题，从测试模式库和 Bug 知识库中检索相关知识"}</p>
      </div>

      {/* 搜索结果展示 */}
      {searchResults.length > 0 && (
        <div className="mb-4 p-4 bg-white rounded-2xl border border-border shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2"><BookOpen className="w-4 h-4 text-amber" /> 检索到的知识</h3>
            <button onClick={() => setSearchResults([])} className="p-1 rounded-lg hover:bg-cream text-muted"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2">
            {searchResults.map((r) => (
              <div key={r.id} className="p-3 rounded-xl bg-cream/30 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor(r.type)}`}>{typeLabel(r.type)}</span>
                  <span className="text-xs font-medium text-ink">{r.title}</span>
                  <span className="text-[10px] text-muted ml-auto">相关度 {(r.relevance_score * 100).toFixed(0)}%</span>
                </div>
                <p className="text-xs text-ink-light line-clamp-2">{r.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 对话区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-amber-light flex items-center justify-center mb-4">
              <Brain className="w-8 h-8 text-amber" />
            </div>
            <h3 className="text-base font-semibold text-ink mb-2">智能知识搜索</h3>
            <p className="text-sm text-muted mb-4">输入问题，AI将从知识库中检索最相关的答案</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["如何测试登录功能", "购物车并发问题", "SQL注入怎么防", "API测试最佳实践"].map((q) => (
                <button key={q} onClick={() => { setQuery(q); }} className="px-3 py-1.5 rounded-full bg-cream text-xs text-ink-light hover:bg-amber-light hover:text-amber transition-colors">{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "gradient-amber text-white" : "bg-white border border-border shadow-card"}`}>
              {msg.role === "assistant" && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-amber flex items-center justify-center"><Brain className="w-3 h-3 text-white" /></div>
                  <span className="text-xs font-medium text-amber">AI助手</span>
                  {msg.responseTime && <span className="text-[10px] text-muted ml-auto">{msg.responseTime}ms</span>}
                </div>
              )}
              <p className={`text-sm whitespace-pre-wrap ${msg.role === "user" ? "text-white" : "text-ink-light"}`}>{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <p className="text-[10px] text-muted mb-1">引用来源：</p>
                  <div className="flex flex-wrap gap-1">
                    {msg.sources.map((s, i) => (
                      <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] ${typeColor(s.type)}`}>{s.title}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {searching && (
          <div className="flex justify-start">
            <div className="bg-white border border-border shadow-card rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-amber" /><span className="text-sm text-muted">搜索中...</span></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="p-4 border-t border-border bg-white">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入搜索问题..."
            className="flex-1 h-10 px-4 rounded-xl border border-border text-sm text-ink bg-cream/30 focus:border-amber focus:bg-white outline-none transition-colors"
            disabled={searching}
          />
          <button onClick={handleSearch} disabled={!query.trim() || searching} className="h-10 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-1.5">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
