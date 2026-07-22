/**
 * 测试模式库 - 连接真实API
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, Eye, X, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { knowledgeApi } from "@/lib/api"
import { Skeleton } from "@/components/ui/Skeleton"

interface TestPattern {
  id: number
  name: string
  category: string
  description: string
  steps: string
  expected_result: string
  applicable_scenarios: string
  examples: string
  ai_score: number
  usage_count: number
  tags: string
  status: string
}

export default function TestPatterns() {
  const [patterns, setPatterns] = useState<TestPattern[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [selectedPattern, setSelectedPattern] = useState<TestPattern | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingPattern, setEditingPattern] = useState<TestPattern | null>(null)
  const [form, setForm] = useState({ name: "", category: "功能测试", description: "", steps: "", expected_result: "", applicable_scenarios: "", examples: "", tags: "" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 })

  const fetchPatterns = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await knowledgeApi.listTestPatterns({
        page: pagination.page,
        page_size: pagination.page_size,
        search: search || undefined,
        category: categoryFilter || undefined,
      })
      if (res?.data) {
        setPatterns(res.data.items || [])
        setPagination((p) => ({ ...p, total: res.data.total, total_pages: res.data.total_pages }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.page_size, search, categoryFilter])

  useEffect(() => { fetchPatterns() }, [fetchPatterns])

  const categories = ["功能测试", "性能测试", "安全测试", "API测试", "UI测试", "兼容性测试", "异常测试", "自动化测试"]

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "名称不能为空"
    if (!form.description.trim()) errors.description = "描述不能为空"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      if (editingPattern) {
        await knowledgeApi.updateTestPattern(editingPattern.id, form)
        toast.success("模式更新成功")
      } else {
        await knowledgeApi.createTestPattern(form)
        toast.success("模式创建成功")
      }
      setShowDialog(false)
      fetchPatterns()
    } catch (e) {
      toast.error("操作失败")
    }
  }

  const handleDelete = async (p: TestPattern) => {
    if (!confirm(`确定删除模式「${p.name}」？`)) return
    try {
      await knowledgeApi.deleteTestPattern(p.id)
      toast.success("模式已删除")
      fetchPatterns()
    } catch (e) {
      toast.error("删除失败")
    }
  }

  const openCreate = () => {
    setEditingPattern(null)
    setForm({ name: "", category: "功能测试", description: "", steps: "", expected_result: "", applicable_scenarios: "", examples: "", tags: "" })
    setFormErrors({})
    setShowDialog(true)
  }

  const openEdit = (p: TestPattern) => {
    setEditingPattern(p)
    setForm({ name: p.name, category: p.category, description: p.description || "", steps: p.steps || "", expected_result: p.expected_result || "", applicable_scenarios: p.applicable_scenarios || "", examples: p.examples || "", tags: p.tags || "" })
    setFormErrors({})
    setShowDialog(true)
  }

  const severityColor = (score: number) => {
    if (score >= 90) return "bg-fail/10 text-fail border border-fail/20"
    if (score >= 70) return "bg-warn/10 text-warn border border-warn/20"
    return "bg-cream text-muted border border-border"
  }

  const parseTags = (tags: string) => tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : []

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3"><h2 className="text-base font-semibold text-ink flex items-center gap-2">测试模式库 <span className="text-xs font-normal text-muted">({pagination.total}条)</span></h2><p className="text-xs text-muted mt-0.5">常见测试模式和最佳实践，支持分类管理和AI评分</p></div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchPatterns()} placeholder="搜索模式名称/标签..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部分类</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <button onClick={fetchPatterns} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 ml-auto"><Plus className="w-3.5 h-3.5" /> 新建模式</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Skeleton className="h-4 w-48" count={3} /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 overflow-y-auto">
          {patterns.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-border shadow-card p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${severityColor(p.ai_score)}`}>{p.category}</span>
                  {p.ai_score > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-light text-amber-hover">AI {p.ai_score}分</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSelectedPattern(p)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-700 transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h4 className="text-sm font-semibold text-ink mb-1">{p.name}</h4>
              <p className="text-xs text-ink-light mb-2 line-clamp-2">{p.description}</p>
              <div className="flex flex-wrap gap-1 mb-2">{parseTags(p.tags).map((t) => (<span key={t} className="px-1.5 py-0.5 rounded bg-cream text-[10px] text-muted">{t}</span>))}</div>
              {p.applicable_scenarios && <p className="text-[11px] text-muted">适用场景：{p.applicable_scenarios}</p>}
            </div>
          ))}
          {patterns.length === 0 && <div className="col-span-2 text-center py-12 text-muted text-sm">暂无测试模式</div>}
        </div>
      )}

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{editingPattern ? "编辑测试模式" : "新建测试模式"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">
              <div><label className="block text-xs font-medium text-ink-light mb-1">名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.name ? "border-fail" : "border-border"}`} placeholder="如：边界值分析法" />{formErrors.name && <p className="text-[11px] text-fail mt-1">{formErrors.name}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">分类</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none">{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">描述 *</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink focus:border-amber outline-none resize-none ${formErrors.description ? "border-fail" : "border-border"}`} placeholder="模式的详细描述..." />{formErrors.description && <p className="text-[11px] text-fail mt-1">{formErrors.description}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">执行步骤</label><textarea value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="1. 第一步&#10;2. 第二步" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">预期结果</label><textarea value={form.expected_result} onChange={(e) => setForm({ ...form, expected_result: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">适用场景</label><textarea value={form.applicable_scenarios} onChange={(e) => setForm({ ...form, applicable_scenarios: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" placeholder="表单输入、数值范围校验..." /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">标签（逗号分隔）</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" placeholder="边界值, 功能测试, 输入验证" /></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">保存</button>
            </div>
          </div>
        </div>
      )}

      {selectedPattern && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedPattern(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{selectedPattern.name}</h3>
              <button onClick={() => setSelectedPattern(null)} className="p-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-cream text-muted">{selectedPattern.category}</span>{selectedPattern.ai_score > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-light text-amber-hover">AI {selectedPattern.ai_score}分</span>}</div>
              <div className="text-sm text-ink-light leading-relaxed">{selectedPattern.description}</div>
              {selectedPattern.steps && <div><p className="text-xs font-medium text-ink mb-1">执行步骤</p><pre className="text-xs text-ink-light bg-cream/30 rounded-lg p-3 whitespace-pre-wrap">{selectedPattern.steps}</pre></div>}
              {selectedPattern.expected_result && <div><p className="text-xs font-medium text-ink mb-1">预期结果</p><p className="text-xs text-ink-light bg-cream/30 rounded-lg p-2">{selectedPattern.expected_result}</p></div>}
              {selectedPattern.applicable_scenarios && <div><p className="text-xs font-medium text-ink mb-1">适用场景</p><p className="text-xs text-ink-light bg-cream/30 rounded-lg p-2">{selectedPattern.applicable_scenarios}</p></div>}
              {selectedPattern.examples && <div><p className="text-xs font-medium text-ink mb-1">示例</p><pre className="text-xs text-ink-light bg-cream/30 rounded-lg p-3 whitespace-pre-wrap">{selectedPattern.examples}</pre></div>}
              <div><p className="text-xs font-medium text-ink mb-1">标签</p><div className="flex flex-wrap gap-1">{parseTags(selectedPattern.tags).map((t) => <span key={t} className="px-2 py-0.5 rounded bg-cream text-[11px] text-muted">{t}</span>)}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
