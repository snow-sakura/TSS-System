/**
 * AI 知识分析器 — 自动提取 + 模式建议 + Bug 分析
 */
import { useState } from "react"
import { knowledgeApi } from "@/lib/api"
import {
  Brain, Sparkles, Loader2, FileText, Bug, CheckCircle,
  AlertTriangle, Lightbulb, ArrowRight, BookOpen, Download,
  X, Search as SearchIcon, Zap,
} from "lucide-react"
import { toast } from "sonner"

export default function AIKnowledgeAnalyzer() {
  const [tab, setTab] = useState<"extract" | "suggest" | "ai-search">("ai-search")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  // AI 搜索
  const [aiQuery, setAiQuery] = useState("")
  const [aiSearchResult, setAiSearchResult] = useState<any>(null)

  // 文本建议
  const [inputText, setInputText] = useState("")
  const [inputContext, setInputContext] = useState("")

  // 执行 ID
  const [executionId, setExecutionId] = useState("")

  const handleAiSearch = async () => {
    if (!aiQuery.trim()) return
    setLoading(true)
    setAiSearchResult(null)
    try {
      const res: any = await knowledgeApi.aiSearch({ query: aiQuery.trim(), limit: 8 })
      setAiSearchResult(res?.data || res)
    } catch (e: any) {
      toast.error("AI 搜索失败: " + (e?.message || ""))
    } finally {
      setLoading(false)
    }
  }

  const handleExtract = async () => {
    const id = parseInt(executionId)
    if (!id) { toast.error("请输入有效执行 ID"); return }
    setLoading(true)
    setResult(null)
    try {
      const res: any = await knowledgeApi.aiExtractFromExecution(id)
      setResult(res?.data || res)
      toast.success("提取完成")
    } catch (e: any) {
      toast.error("提取失败: " + (e?.message || ""))
    } finally {
      setLoading(false)
    }
  }

  const handleSuggest = async () => {
    if (!inputText.trim()) { toast.error("请输入文本内容"); return }
    setLoading(true)
    setResult(null)
    try {
      const res: any = await knowledgeApi.aiSuggestPatterns({
        text: inputText,
        context: inputContext || undefined,
      })
      setResult(res?.data || res)
    } catch (e: any) {
      toast.error("建议生成失败: " + (e?.message || ""))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4">
      {/* 标题 */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-ink flex items-center gap-2">
          <Brain className="w-5 h-5 text-amber" /> AI 知识增强
        </h2>
        <p className="text-xs text-muted mt-0.5">智能提取测试模式、Bug分析、AI语义搜索</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-4 p-1 bg-cream/50 rounded-xl w-fit border border-border/50">
        {[
          { key: "ai-search", label: "AI 搜索", icon: SearchIcon },
          { key: "extract", label: "自动提取", icon: Download },
          { key: "suggest", label: "模式建议", icon: Lightbulb },
        ].map((t) => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => { setTab(t.key as any); setResult(null) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === t.key ? "bg-white text-ink shadow-sm border border-border" : "text-muted hover:text-ink"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* ── AI 搜索 ── */}
      {tab === "ai-search" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={aiQuery} onChange={e => setAiQuery(e.target.value)}
              placeholder="输入搜索问题（如：如何处理登录超时？）"
              className="flex-1 h-10 px-4 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"
              onKeyDown={e => e.key === "Enter" && handleAiSearch()}
            />
            <button onClick={handleAiSearch} disabled={loading || !aiQuery.trim()}
              className="h-10 px-4 rounded-xl gradient-amber text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              搜索
            </button>
          </div>

          {aiSearchResult && (
            <div className="space-y-4">
              {/* AI 回答 */}
              {aiSearchResult.answer && (
                <div className="p-4 bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-200/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-amber" />
                    <span className="text-xs font-semibold text-amber">AI 回答</span>
                    {aiSearchResult.rewritten_query && (
                      <span className="text-[10px] text-muted">改写: "{aiSearchResult.rewritten_query}"</span>
                    )}
                  </div>
                  <div className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed">
                    {aiSearchResult.answer}
                  </div>
                  {aiSearchResult.key_insights?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-amber-200/30">
                      <p className="text-xs font-medium text-ink/60 mb-1">关键洞察</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiSearchResult.key_insights.map((insight: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 text-[10px] rounded-full bg-amber-light text-amber">{insight}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiSearchResult.related_topics?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-ink/60 mb-1">相关主题</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiSearchResult.related_topics.map((topic: string, i: number) => (
                          <button key={i} onClick={() => { setAiQuery(topic); handleAiSearch() }}
                            className="px-2 py-0.5 text-[10px] rounded-full bg-white border border-border text-muted hover:text-ink hover:border-amber transition-colors">
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 搜索结果 */}
              {aiSearchResult.results?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-ink/60 mb-2">搜索结果 ({aiSearchResult.total})</p>
                  <div className="space-y-2">
                    {aiSearchResult.results.map((r: any) => (
                      <div key={`${r.type}-${r.id}`} className="p-3 rounded-xl bg-white border border-border/50">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            r.type === "test_pattern" ? "bg-info/10 text-info" : "bg-warn/10 text-warn"
                          }`}>{r.type === "test_pattern" ? "测试模式" : "Bug知识"}</span>
                          <span className="text-xs font-medium text-ink">{r.title}</span>
                          <span className="text-[10px] text-muted ml-auto">{(r.relevance_score * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-xs text-ink-light line-clamp-2">{r.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!aiSearchResult && !loading && (
            <div className="text-center py-12 text-muted">
              <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">AI 增强搜索</p>
              <p className="text-xs mt-1">输入问题获取带语义理解的智能回答</p>
            </div>
          )}
        </div>
      )}

      {/* ── 自动提取 ── */}
      {tab === "extract" && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-border space-y-3">
            <p className="text-xs text-muted">从工作流执行记录中自动提取测试模式或 Bug 知识</p>
            <div className="flex gap-2">
              <input value={executionId} onChange={e => setExecutionId(e.target.value)}
                placeholder="执行记录 ID"
                type="number"
                className="flex-1 h-10 px-4 rounded-xl border border-border text-sm text-ink bg-cream/30 focus:border-amber focus:bg-white outline-none"
              />
              <button onClick={handleExtract} disabled={loading}
                className="h-10 px-4 rounded-xl gradient-amber text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                提取
              </button>
            </div>
          </div>

          {result && (
            <div className={`p-4 rounded-2xl border ${
              result.success
                ? result.extracted_type === "test_pattern"
                  ? "bg-info/5 border-info/20"
                  : result.extracted_type === "bug_knowledge"
                    ? "bg-warn/5 border-warn/20"
                    : "bg-white border-border"
                : "bg-red-50 border-red-200"
            }`}>
              {result.success && result.extracted_type ? (
                <div className="flex items-start gap-3">
                  {result.extracted_type === "test_pattern" ? (
                    <CheckCircle className="w-5 h-5 text-info shrink-0 mt-0.5" />
                  ) : (
                    <Bug className="w-5 h-5 text-warn shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {result.extracted_type === "test_pattern" ? "测试模式" : "Bug 知识"}已提取
                    </p>
                    <p className="text-xs text-ink-light mt-1">{result.title || ""}</p>
                    {result.pattern_id && <p className="text-xs text-info mt-1">模式 ID: {result.pattern_id}</p>}
                    {result.bug_id && <p className="text-xs text-warn mt-1">Bug ID: {result.bug_id}</p>}
                  </div>
                </div>
              ) : result.success ? (
                <div className="flex items-center gap-2 text-muted">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs">未提取到足够信息: {result.reason || "无"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <X className="w-4 h-4" />
                  <span className="text-xs">{result.error || "提取失败"}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 模式建议 ── */}
      {tab === "suggest" && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-border space-y-3">
            <p className="text-xs text-muted">输入测试描述或 Bug 报告，AI 将建议测试模式或 Bug 知识条目</p>
            <textarea value={inputText} onChange={e => setInputText(e.target.value)}
              placeholder="粘贴测试用例、Bug 报告或任何测试相关文本..."
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-border text-sm text-ink bg-cream/30 focus:border-amber focus:bg-white outline-none resize-none"
            />
            <input value={inputContext} onChange={e => setInputContext(e.target.value)}
              placeholder="上下文（可选）：如所属模块、项目等"
              className="w-full h-10 px-4 rounded-xl border border-border text-sm text-ink bg-cream/30 focus:border-amber focus:bg-white outline-none"
            />
            <button onClick={handleSuggest} disabled={loading || !inputText.trim()}
              className="h-10 px-4 rounded-xl gradient-amber text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
              生成建议
            </button>
          </div>

          {result && (
            <div className="space-y-3">
              {result.success && result.extracted && result.suggestion ? (
                <div className="p-4 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-200/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-semibold text-indigo-600">AI 建议</span>
                    <span className="text-[10px] text-muted">置信度: {result.suggestion.confidence || 50}%</span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(result.suggestion).map(([key, val]) => (
                      val && key !== "confidence" ? (
                        <div key={key}>
                          <span className="text-[10px] font-medium text-ink/40 uppercase">{key}</span>
                          <p className="text-xs text-ink/80 mt-0.5">{String(val)}</p>
                        </div>
                      ) : null
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-indigo-200/30 flex gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-600">
                      {result.type === "test_pattern" ? "测试模式" : "Bug 知识"}
                    </span>
                  </div>
                </div>
              ) : result.success ? (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-white border border-border text-muted">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs">{result.reason || "无足够信息生成建议"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600">
                  <X className="w-4 h-4" />
                  <span className="text-xs">{result.error || "分析失败"}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
