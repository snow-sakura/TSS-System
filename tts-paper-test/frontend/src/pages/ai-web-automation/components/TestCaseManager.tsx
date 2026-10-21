/**
 * 测试用例管理 - 连接真实API
 * AI生成用例 + 审核 + 批准
 */
import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, Eye, X, FlaskConical, Check, XCircle, CheckCircle, Download, Loader2, RefreshCw, Sparkles, BookOpen, PanelRightClose } from "lucide-react"
import { toast } from "sonner"
import { webApi } from "@/lib/api"
import TestSkillLibrary from "./TestSkillLibrary"
import { useConfirmStore } from "@/stores/confirmStore"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"

interface TestCase {
  id: number; project_id: number; title: string; description?: string; preconditions?: string;
  steps: Array<Record<string, any>>;
  expected_result: string; priority: string; status: string; ai_generated: boolean; page_url?: string
}

interface AssertionForm { type: string; expected: string; attribute: string }
interface StepForm {
  action: string; target: string; value: string;
  locator: string; locator_type: string; wait_timeout: number; force_action: boolean;
  assertions: AssertionForm[]
}

/** 结构化操作（需要元素定位器） */
const LOCATOR_ACTIONS = ["点击", "输入", "选择", "悬浮", "滚动", "断言", "AI点击", "AI输入", "AI断言"]
/** 需要输入值的操作 */
const VALUE_ACTIONS = ["输入", "选择", "AI输入", "AI查询", "等待"]

const ACTION_OPTIONS = ["打开页面", "点击", "输入", "选择", "悬浮", "断言", "等待", "滚动", "AI点击", "AI输入", "AI断言", "AI查询"]
const ASSERTION_TYPES = [
  { v: "visible", label: "可见" }, { v: "hidden", label: "隐藏" },
  { v: "text", label: "文本包含" }, { v: "attribute", label: "属性" },
  { v: "value", label: "值" }, { v: "url", label: "URL包含" },
  { v: "enabled", label: "可用" }, { v: "disabled", label: "禁用" },
]
const LOCATOR_TYPES = ["css", "xpath", "text", "id", "name", "placeholder"]

const statusLabels: Record<string, string> = { draft: "草稿", pending: "待审批", approved: "已通过", rejected: "已驳回" }
const statusColors: Record<string, string> = {
  draft: "bg-cream text-muted border border-border",
  pending: "bg-amber-light text-warn border border-amber/20",
  approved: "bg-pass/10 text-pass border border-pass/20",
  rejected: "bg-fail/10 text-fail border border-fail/20",
}
const priorityColors: Record<string, string> = { P0: "text-fail", P1: "text-amber-hover", P2: "text-info", P3: "text-muted" }

export default function TestCaseManager() {
  const [cases, setCases] = useState<TestCase[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [previewCase, setPreviewCase] = useState<TestCase | null>(null)
  const [showSkillLibrary, setShowSkillLibrary] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingCase, setEditingCase] = useState<TestCase | null>(null)
  const [form, setForm] = useState({ title: "", description: "", expected_result: "", priority: "P1", preconditions: "" })
  const [steps, setSteps] = useState<StepForm[]>([])
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const pageSize = 10

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

  // 加载测试用例
  const fetchCases = useCallback(async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const res: any = await webApi.listTestCases(selectedProjectId)
      if (res?.data) {
        const items = Array.isArray(res.data) ? res.data : (res.data.items || [])
        setCases(items.map((c: any) => ({
          id: c.id,
          project_id: c.project_id,
          title: c.title,
          description: c.description,
          preconditions: c.preconditions,
          steps: c.steps || [],
          expected_result: c.expected_result || "",
          priority: c.priority || "P1",
          status: c.status || "draft",
          ai_generated: c.ai_generated || false,
          page_url: c.page_url,
        })))
      }
    } catch {
      setCases([])
      toast.error("无法加载测试用例，请检查服务器连接")
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchCases() }, [fetchCases])

  const filtered = cases.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && c.status !== statusFilter) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // AI生成测试用例
  const handleGenerate = useCallback(async () => {
    if (!selectedProjectId) { toast.error("请先选择项目"); return }
    setGenerating(true)
    try {
      const response = await webApi.generateTestCasesSSE(selectedProjectId)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error("无法获取响应流")

      const decoder = new TextDecoder()
      let buffer = ""
      let currentEvent = ""
      let currentData = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("event: ")) currentEvent = line.slice(7).trim()
          else if (line.startsWith("data: ")) currentData = line.slice(6).trim()
          else if (line === "" && currentEvent && currentData) {
            try {
              const data = JSON.parse(currentData)
              if (currentEvent === "generation_complete") {
                toast.success(`成功生成 ${data.total || 0} 条测试用例`)
                fetchCases()
              } else if (currentEvent === "generation_error") {
                toast.error(`生成失败: ${data.error}`)
              }
              } catch {}
            currentEvent = ""
            currentData = ""
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "生成失败")
    } finally {
      setGenerating(false)
    }
  }, [selectedProjectId, fetchCases])

  // 审批操作
  const handleApprove = async (c: TestCase) => {
    try {
      await webApi.approveTestCase(c.id)
      toast.success("已通过")
      fetchCases()
    } catch { toast.error("操作失败") }
  }

  const handleReject = async (c: TestCase) => {
    const note = prompt("请输入驳回原因：")
    if (note === null) return
    try {
      await webApi.rejectTestCase(c.id)
      toast.success("已驳回")
      fetchCases()
    } catch { toast.error("操作失败") }
  }

  const handleDelete = async (c: TestCase) => {
    const confirmed = await useConfirmStore.getState().confirm({ title: "确认删除", message: `确定删除用例「${c.title}」？`, danger: true, confirmText: "删除" })
    if (!confirmed) return
    try {
      await webApi.deleteTestCase(c.id)
      toast.success("已删除")
      fetchCases()
    } catch { toast.error("删除失败") }
  }

  const newStep = (): StepForm => ({ action: "", target: "", value: "", locator: "", locator_type: "css", wait_timeout: 5, force_action: false, assertions: [] })

  const openCreate = () => {
    setEditingCase(null)
    setForm({ title: "", description: "", expected_result: "", priority: "P1", preconditions: "" })
    setSteps([{ ...newStep(), action: "打开页面" }])
    setFormErrors({})
    setShowDialog(true)
  }

  const openEdit = (c: TestCase) => {
    setEditingCase(c)
    setForm({ title: c.title, description: c.description || "", expected_result: c.expected_result, priority: c.priority, preconditions: c.preconditions || "" })
    setSteps((c.steps && c.steps.length ? c.steps : [{}]).map((s: any) => ({
      action: s.action || "",
      target: s.target || "",
      value: s.value || "",
      locator: s.locator || "",
      locator_type: s.locator_type || "css",
      wait_timeout: s.wait_timeout ?? 5,
      force_action: s.force_action ?? false,
      assertions: Array.isArray(s.assertions) && s.assertions.length
        ? s.assertions.map((a: any) => ({ type: a.type || "visible", expected: a.expected || "", attribute: a.attribute || "" }))
        : [],
    })))
    setFormErrors({})
    setShowDialog(true)
  }

  const addStep = () => setSteps([...steps, newStep()])
  const removeStep = (idx: number) => setSteps(steps.filter((_, i) => i !== idx))
  const updateStep = (idx: number, field: keyof StepForm, value: any) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))
  }
  const addAssertion = (idx: number) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, assertions: [...s.assertions, { type: "text", expected: "", attribute: "" }] } : s)))
  }
  const removeAssertion = (idx: number, ai: number) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, assertions: s.assertions.filter((_, x) => x !== ai) } : s)))
  }
  const updateAssertion = (idx: number, ai: number, field: keyof AssertionForm, value: string) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, assertions: s.assertions.map((a, x) => (x === ai ? { ...a, [field]: value } : a)) } : s)))
  }
  // 历史遗留的未知动作并入下拉选项，避免编辑时选项丢失
  const actionOptions = ACTION_OPTIONS.concat(
    steps.map((s) => s.action).filter((a) => a && !ACTION_OPTIONS.includes(a))
  )

  const handleSave = async () => {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = "标题不能为空"
    if (!form.expected_result.trim()) errs.expected_result = "预期结果不能为空"
    if (steps.some((s) => !s.action.trim())) errs.steps = "每个步骤需填写操作类型"
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return

    if (!selectedProjectId) { toast.error("请先选择项目"); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || undefined,
        preconditions: form.preconditions || undefined,
        expected_result: form.expected_result,
        priority: form.priority,
        steps: steps.map((s) => ({
          action: s.action,
          target: s.target || undefined,
          value: s.value || undefined,
          locator: s.locator || undefined,
          locator_type: s.locator_type || undefined,
          wait_timeout: s.wait_timeout || undefined,
          force_action: s.force_action || undefined,
          assertions: s.assertions.filter((a) => a.type).map((a) => ({ type: a.type, expected: a.expected || undefined, attribute: a.attribute || undefined })),
        })).filter((s) => s.action),
      }
      if (editingCase) {
        await webApi.updateTestCase(editingCase.id, payload)
        toast.success("更新成功")
      } else {
        await webApi.createTestCase(selectedProjectId, payload)
        toast.success("创建成功")
      }
      setShowDialog(false)
      fetchCases()
    } catch {
      toast.error(editingCase ? "更新失败" : "创建失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4">
      <div className="mb-1"><h2 className="text-base font-semibold text-ink flex items-center gap-2">测试用例管理 <FlaskConical className="w-4 h-4 text-amber" /></h2><p className="text-xs text-muted mt-0.5">AI自动生成测试用例，支持审批工作流</p></div>

      {/* 项目选择 + 操作 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-light">项目:</label>
            <select value={selectedProjectId || ""} onChange={(e) => { setSelectedProjectId(Number(e.target.value)); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
              <option value="">请选择项目</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={fetchCases} disabled={!selectedProjectId} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-40"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
          <button onClick={handleGenerate} disabled={!selectedProjectId || generating} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 disabled:opacity-50">
            {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 生成中...</> : <><Sparkles className="w-3.5 h-3.5" /> AI生成用例</>}
          </button>
          <button onClick={openCreate} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 新建用例</button>
          <button onClick={() => setShowSkillLibrary(!showSkillLibrary)} className={`h-9 px-3 rounded-xl border text-sm flex items-center gap-1.5 transition-all ${showSkillLibrary ? "bg-amber text-white border-amber" : "border-border text-ink-light hover:bg-cream"}`}><BookOpen className="w-3.5 h-3.5" /> 技能库</button>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }} placeholder="搜索用例标题..." className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" /></div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"><option value="">全部状态</option><option value="draft">草稿</option><option value="pending">待审批</option><option value="approved">已通过</option><option value="rejected">已驳回</option></select>
      </div>

      {/* 统计 - 紧凑单行徽章 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="h-7 px-2.5 rounded-full bg-white border border-border text-[11px] text-ink-light flex items-center gap-1">总用例 <b className="text-ink">{cases.length}</b></span>
        <span className="h-7 px-2.5 rounded-full bg-white border border-amber/20 text-[11px] text-ink-light flex items-center gap-1">待审批 <b className="text-amber">{cases.filter((c) => c.status === "pending").length}</b></span>
        <span className="h-7 px-2.5 rounded-full bg-white border border-pass/20 text-[11px] text-ink-light flex items-center gap-1">已通过 <b className="text-pass">{cases.filter((c) => c.status === "approved").length}</b></span>
        <span className="h-7 px-2.5 rounded-full bg-white border border-fail/20 text-[11px] text-ink-light flex items-center gap-1">已驳回 <b className="text-fail">{cases.filter((c) => c.status === "rejected").length}</b></span>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-amber" /></div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted"><FlaskConical className="w-8 h-8 mb-2 text-muted-light" /><p className="text-sm">暂无测试用例</p></div>
        ) : (
          <table className="w-full text-sm table-fixed">
             <thead><tr className="border-b border-border bg-cream/50">
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-ink w-10">ID</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-ink w-[220px]">标题</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-ink w-[80px]">优先级</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-ink w-[80px]">状态</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-ink w-[70px]">来源</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-ink w-[140px]">操作</th>
            </tr></thead>
            <tbody>
              {paged.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-cream/30 transition-colors">
                  <td className="px-3 py-2.5 text-center text-xs text-muted">{c.id}</td>
                  <td className="px-3 py-2.5"><span className="text-sm font-medium text-ink truncate block">{c.title}</span></td>
                  <td className="px-3 py-2.5 text-center"><span className={`text-xs font-semibold whitespace-nowrap ${priorityColors[c.priority] || "text-muted"}`}>{c.priority}</span></td>
                  <td className="px-3 py-2.5 text-center"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${statusColors[c.status] || "bg-cream text-muted"}`}>{statusLabels[c.status] || c.status}</span></td>
                  <td className="px-3 py-2.5 text-center">{c.ai_generated ? <span className="px-1.5 py-0.5 rounded bg-amber-light text-[10px] font-medium text-amber">AI</span> : <span className="text-[11px] text-muted">手动</span>}</td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setPreviewCase(c)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors" title="预览"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-700 transition-colors" title="编辑"><Edit className="w-3.5 h-3.5" /></button>
                      {c.status === "pending" && (
                        <>
                          <button onClick={() => handleApprove(c)} className="p-1.5 rounded-lg hover:bg-pass/10 text-ink-light hover:text-pass transition-colors" title="通过"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleReject(c)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="驳回"><XCircle className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* 分页 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-cream/20">
          <span className="text-xs text-muted">共 {filtered.length} 条</span>
          <div className="flex items-center gap-1">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="h-7 px-2 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">上一页</button>
            <span className="h-7 px-2 text-xs rounded-lg gradient-amber text-white flex items-center">{currentPage}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="h-7 px-2 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40">下一页</button>
          </div>
        </div>
      </div>

      {/* 预览弹窗 */}
      {previewCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPreviewCase(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{previewCase.title}</h3>
              <button onClick={() => setPreviewCase(null)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[previewCase.status]}`}>{statusLabels[previewCase.status]}</span>
                <span className={`text-xs font-semibold ${priorityColors[previewCase.priority]}`}>{previewCase.priority}</span>
                {previewCase.ai_generated && <span className="px-1.5 py-0.5 rounded bg-amber-light text-[10px] font-medium text-amber">AI生成</span>}
              </div>
              {previewCase.description && <div><p className="text-xs font-medium text-ink mb-1">描述</p><MarkdownPreview content={previewCase.description} /></div>}
              {previewCase.preconditions && <div><p className="text-xs font-medium text-ink mb-1">前置条件</p><MarkdownPreview content={previewCase.preconditions} /></div>}
              <div><p className="text-xs font-medium text-ink mb-1">测试步骤</p>
                <div className="space-y-1">{previewCase.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 bg-cream/30 rounded-lg">
                    <span className="px-1.5 py-0.5 rounded bg-amber-light text-[10px] font-medium text-amber">{s.action}</span>
                    <span className="text-ink-light truncate">{s.target}{s.value ? ` → "${s.value}"` : ""}</span>
                    {s.locator && <span className="px-1.5 py-0.5 rounded bg-info/10 text-[10px] font-mono text-info truncate max-w-[140px]">{s.locator}</span>}
                    {Array.isArray(s.assertions) && s.assertions.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-pass/10 text-[10px] font-medium text-pass flex-shrink-0">断言×{s.assertions.length}</span>
                    )}
                  </div>
                ))}</div>
              </div>
              <div><p className="text-xs font-medium text-ink mb-1">预期结果</p><MarkdownPreview content={previewCase.expected_result} /></div>
            </div>
          </div>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[560px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{editingCase ? "编辑用例" : "新建用例"}</h3>
              <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">
              <div><label className="block text-xs font-medium text-ink-light mb-1">标题 *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`w-full h-9 px-3 rounded-xl border text-sm text-ink focus:border-amber outline-none ${formErrors.title ? "border-fail" : "border-border"}`} />{formErrors.title && <p className="text-[11px] text-fail mt-1">{formErrors.title}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">描述</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">前置条件</label><textarea value={form.preconditions} onChange={(e) => setForm({ ...form, preconditions: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" /></div>

              {/* 测试步骤编辑 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-ink-light">测试步骤 *</label>
                  <button onClick={addStep} className="h-6 px-2 rounded-lg border border-border text-[11px] text-ink-light hover:bg-cream flex items-center gap-1"><Plus className="w-3 h-3" /> 添加步骤</button>
                </div>
                {formErrors.steps && <p className="text-[11px] text-fail mb-1">{formErrors.steps}</p>}
                <div className="space-y-1.5">
                  {steps.map((s, i) => (
                    <div key={i} className="rounded-lg bg-cream/40 border border-border/60 p-2 space-y-1.5">
                      {/* 主行：序号 + 操作 + 目标 + 值 + 删除 */}
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 text-center text-[11px] text-muted font-mono flex-shrink-0">{i + 1}</span>
                        <select value={s.action} onChange={(e) => updateStep(i, "action", e.target.value)} className={`h-8 px-2 rounded-lg border text-xs text-ink bg-white focus:border-amber outline-none w-24 flex-shrink-0 ${!s.action.trim() && formErrors.steps ? "border-fail" : "border-border"}`}>
                          <option value="">操作</option>
                          {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <input value={s.target} onChange={(e) => updateStep(i, "target", e.target.value)} placeholder={LOCATOR_ACTIONS.includes(s.action) ? "目标（可留空，执行时自动跳转）" : "目标（URL或元素）"} className="flex-1 h-8 px-2 rounded-lg border border-border text-xs text-ink focus:border-amber outline-none min-w-0" />
                        {VALUE_ACTIONS.includes(s.action) && (
                          <input value={s.value} onChange={(e) => updateStep(i, "value", e.target.value)} placeholder={s.action === "等待" ? "秒数" : "值"} className="w-28 h-8 px-2 rounded-lg border border-border text-xs text-ink focus:border-amber outline-none flex-shrink-0" />
                        )}
                        <button onClick={() => removeStep(i)} disabled={steps.length <= 1} className="p-1 rounded hover:bg-fail/10 text-muted hover:text-fail disabled:opacity-30 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {/* 定位策略行 */}
                      {LOCATOR_ACTIONS.includes(s.action) && (
                        <div className="flex items-center gap-1.5 pl-7">
                          <input value={s.locator} onChange={(e) => updateStep(i, "locator", e.target.value)} placeholder="结构化定位器（如 #btn-login / //button[1]，留空自动推断）" className="flex-1 h-7 px-2 rounded-lg border border-border text-[11px] font-mono text-ink focus:border-amber outline-none min-w-0" />
                          <select value={s.locator_type} onChange={(e) => updateStep(i, "locator_type", e.target.value)} className="h-7 px-1.5 rounded-lg border border-border text-[11px] text-ink bg-white outline-none w-20 flex-shrink-0">
                            {LOCATOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input type="number" min={1} value={s.wait_timeout} onChange={(e) => updateStep(i, "wait_timeout", Number(e.target.value) || 5)} title="超时（秒）" className="h-7 w-14 px-1.5 rounded-lg border border-border text-[11px] text-ink outline-none flex-shrink-0" />
                          <label className="flex items-center gap-1 text-[11px] text-ink-light flex-shrink-0 cursor-pointer select-none">
                            <input type="checkbox" checked={s.force_action} onChange={(e) => updateStep(i, "force_action", e.target.checked)} className="accent-amber" /> 强制
                          </label>
                        </div>
                      )}
                      {/* 断言行 */}
                      {(s.action === "断言" || s.action === "AI断言") && (
                        <div className="pl-7 space-y-1">
                          {s.assertions.map((a, ai) => (
                            <div key={ai} className="flex items-center gap-1.5">
                              <select value={a.type} onChange={(e) => updateAssertion(i, ai, "type", e.target.value)} className="h-7 px-1.5 rounded-lg border border-border text-[11px] text-ink bg-white outline-none w-24 flex-shrink-0">
                                {ASSERTION_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                              </select>
                              {a.type === "attribute" && (
                                <input value={a.attribute} onChange={(e) => updateAssertion(i, ai, "attribute", e.target.value)} placeholder="属性名" className="h-7 w-20 px-2 rounded-lg border border-border text-[11px] text-ink outline-none flex-shrink-0" />
                              )}
                              {!["visible", "hidden", "enabled", "disabled"].includes(a.type) && (
                                <input value={a.expected} onChange={(e) => updateAssertion(i, ai, "expected", e.target.value)} placeholder="期望值" className="flex-1 h-7 px-2 rounded-lg border border-border text-[11px] text-ink outline-none min-w-0" />
                              )}
                              <button onClick={() => removeAssertion(i, ai)} className="p-0.5 rounded hover:bg-fail/10 text-muted hover:text-fail flex-shrink-0"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                          <button onClick={() => addAssertion(i)} className="h-6 px-2 rounded-lg border border-dashed border-border text-[11px] text-amber hover:bg-amber-light flex items-center gap-1"><Plus className="w-3 h-3" /> 添加断言</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div><label className="block text-xs font-medium text-ink-light mb-1">预期结果 *</label><textarea value={form.expected_result} onChange={(e) => setForm({ ...form, expected_result: e.target.value })} rows={2} className={`w-full px-3 py-2 rounded-xl border text-sm text-ink focus:border-amber outline-none resize-none ${formErrors.expected_result ? "border-fail" : "border-border"}`} />{formErrors.expected_result && <p className="text-[11px] text-fail mt-1">{formErrors.expected_result}</p>}</div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">优先级</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none"><option value="P0">P0 核心</option><option value="P1">P1 重要</option><option value="P2">P2 一般</option><option value="P3">P3 低优先</option></select></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSave} disabled={saving} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 保存中...</> : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 技能库 slide-over 面板 */}
      {showSkillLibrary && (
        <>
          <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setShowSkillLibrary(false)} />
          <div className="fixed top-0 right-0 z-40 h-full w-[480px] max-w-[90vw] bg-white shadow-elevated border-l border-border overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-border px-4 py-3 flex items-center justify-between z-10">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber" />
                测试技能库
              </h3>
              <button onClick={() => setShowSkillLibrary(false)} className="p-1.5 rounded-lg hover:bg-cream transition-colors">
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>
            <div className="p-4">
              <TestSkillLibrary />
            </div>
          </div>
        </>
      )}

    </div>
  )
}
