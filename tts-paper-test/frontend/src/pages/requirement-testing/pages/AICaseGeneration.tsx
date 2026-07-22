/**
 * AI用例生成 - 基于需求文档自动生成测试用例
 * 流程：上传需求 → AI分析 → 生成用例 → 人工审核 → 导出
 */
import { useState, useRef, useCallback } from "react"
import { Upload, Sparkles, Loader2, CheckCircle, XCircle, Eye, Download, Plus, Edit, Trash2, Check, X, FileText, ArrowRight, RefreshCw, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { lifecycleApi } from "@/lib/api"
import PreviewModal from "../components/PreviewModal"

const aiSteps = [
  { key: "upload", label: "上传需求", desc: "上传需求文档或粘贴需求内容" },
  { key: "analyze", label: "AI分析", desc: "分析需求提取测试点" },
  { key: "generate", label: "生成用例", desc: "自动生成测试用例" },
  { key: "review", label: "人工审核", desc: "审核确认用例质量" },
  { key: "export", label: "导出入库", desc: "确认后导出到用例库" },
]

const priorityOptions = ["P0", "P1", "P2", "P3"]

/** 后端 API 用例 → UI 展示格式 */
function apiToCase(item: any) {
  const stepsArr: any[] = item.steps || []
  const stepsStr = stepsArr.length > 0
    ? stepsArr.map((s: any, i: number) => `${i + 1}. ${typeof s === "string" ? s : (s.action || s.content || "")}`).join("\n")
    : (typeof item.steps === "string" ? item.steps : "")
  return {
    id: item.id,
    title: item.name || item.title || "",
    module: item.module || item.test_module || "",
    priority: item.priority || "P2",
    preconditions: item.preconditions || "",
    steps: stepsStr,
    expected: item.expected_result || item.expected || "",
    confirmed: item.status === "approved",
    source: item.ai_generated ? "AI生成" : "手动",
  }
}

/** UI 用例格式 → 后端 update payload */
function caseToApi(c: any) {
  const stepLines = c.steps.split("\n").filter((s: string) => s.trim())
  const steps = stepLines.map((s: string) => {
    const cleaned = s.replace(/^\d+[\.\、\)\s]+/, "").trim()
    return { action: cleaned || s.trim() }
  })
  return {
    name: c.title,
    module: c.module,
    priority: c.priority,
    preconditions: c.preconditions,
    steps: steps.length > 0 ? steps : undefined,
    expected_result: c.expected,
  }
}

export default function AICaseGeneration() {
  // 步骤状态
  const [currentStep, setCurrentStep] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  // 需求输入
  const [requirementName, setRequirementName] = useState("")
  const [requirementContent, setRequirementContent] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [requirementId, setRequirementId] = useState<number | null>(null)

  // 生成的用例
  const [cases, setCases] = useState<any[]>([])
  const [editingCase, setEditingCase] = useState<any>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [previewCase, setPreviewCase] = useState<any>(null)

  // 统计
  const confirmedCount = cases.filter((c) => c.confirmed).length
  const totalCount = cases.length

  // 文件上传 - 通过后端 upload 端点解析文档
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res: any = await lifecycleApi.uploadRequirement(formData)
      const data = res?.data
      // 后端返回 raw_content (RequirementResponse.raw_content), 也保留 content 作为兼容
      const fileContent = data?.raw_content || data?.content
      if (fileContent) {
        setRequirementContent(fileContent)
        setRequirementName(data.name || file.name.replace(/\.[^.]+$/, ""))
        setRequirementId(data.id || null)
      } else {
        setUploadError("文件内容为空或无法提取文本")
      }
    } catch (e: any) {
      setUploadError("文件解析失败: " + (e?.message || "未知错误"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [])

  // 开始AI生成
  const handleGenerate = async () => {
    if (!requirementContent.trim()) { toast.error("请输入需求内容"); return }
    setGenerating(true)
    setCurrentStep(2) // 跳转到"生成中"步骤
    try {
      const res: any = await lifecycleApi.aiGenerateCases({
        requirement_content: requirementContent,
        requirement_name: requirementName || "未命名需求",
        module: "",
        priority: "",
        count: 10,
      })
      const items = res?.data?.cases || []
      setCases(items.map(apiToCase))
      setCurrentStep(3)
      setGenerated(true)
      toast.success(`AI已生成 ${items.length} 条测试用例`, { description: "请审核并确认需要保留的用例" })
    } catch (e: any) {
      toast.error("AI生成用例失败: " + (e?.message || "未知错误"))
      setCurrentStep(0)
    } finally {
      setGenerating(false)
    }
  }

  // 确认/取消用例
  const toggleConfirm = async (id: number) => {
    const c = cases.find((c) => c.id === id)
    if (!c) return
    const newConfirmed = !c.confirmed
    setCases(cases.map((c) => c.id === id ? { ...c, confirmed: newConfirmed } : c))
    try {
      await lifecycleApi.reviewTestCase(id, { action: newConfirmed ? "approved" : "rejected" })
    } catch {
      // 静默处理
    }
  }

  const confirmAll = async () => {
    setCases(cases.map((c) => ({ ...c, confirmed: true })))
    toast.success("已全部确认")
    for (const c of cases) {
      try { await lifecycleApi.reviewTestCase(c.id, { action: "approved" }) } catch {}
    }
  }
  const cancelAll = () => {
    setCases(cases.map((c) => ({ ...c, confirmed: false })))
    toast.success("已全部取消")
  }

  // 删除用例
  const handleDeleteCase = async (id: number) => {
    try {
      await lifecycleApi.deleteTestCase(id)
      setCases(cases.filter((c) => c.id !== id))
      toast.success("用例已删除")
    } catch (e: any) {
      toast.error("删除失败: " + (e?.message || "未知错误"))
    }
  }

  // 重新生成
  const handleRegenerate = async () => {
    setGenerating(true)
    try {
      const res: any = await lifecycleApi.aiGenerateCases({
        requirement_content: requirementContent,
        requirement_name: requirementName || "未命名需求",
        module: "",
        priority: "",
        count: 10,
      })
      const items = res?.data?.cases || []
      setCases(items.map(apiToCase))
      toast.success("已重新生成用例")
    } catch (e: any) {
      toast.error("重新生成失败: " + (e?.message || "未知错误"))
    } finally {
      setGenerating(false)
    }
  }

  // 导出
  const handleExport = () => {
    const confirmed = cases.filter((c) => c.confirmed)
    if (confirmed.length === 0) { toast.error("请至少确认一条用例"); return }
    const data = confirmed.map((c) => ({
      用例标题: c.title, 所属模块: c.module, 优先级: c.priority, 前置条件: c.preconditions, 测试步骤: c.steps, 预期结果: c.expected, 来源: "AI生成",
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "AI生成用例")
    XLSX.writeFile(wb, `AI生成用例_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success(`已导出 ${confirmed.length} 条确认的用例`)
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingCase) return
    try {
      await lifecycleApi.updateTestCase(editingCase.id, caseToApi(editingCase))
      setCases(cases.map((c) => c.id === editingCase.id ? editingCase : c))
      setShowEditDialog(false)
      toast.success("用例已更新")
    } catch (e: any) {
      toast.error("更新失败: " + (e?.message || "未知错误"))
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-4">
      {/* 步骤导航 */}
      <div className="bg-white rounded-2xl border border-border shadow-card px-5 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          {aiSteps.map((step, idx) => (
            <div key={step.key} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                idx < currentStep ? "bg-pass text-white" : idx === currentStep ? "bg-amber text-white" : "bg-cream text-muted"
              }`}>
                {idx < currentStep ? <Check className="w-4 h-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
              </div>
              <div className="hidden sm:block">
                <p className={`text-xs font-medium ${idx <= currentStep ? "text-ink" : "text-muted"}`}>{step.label}</p>
                <p className="text-[10px] text-muted hidden lg:block">{step.desc}</p>
              </div>
              {idx < aiSteps.length - 1 && <ArrowRight className="w-4 h-4 text-border flex-shrink-0 hidden sm:block" />}
            </div>
          ))}
        </div>
      </div>

      {/* 步骤内容 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Step 0: 上传需求 */}
        {currentStep === 0 && !generating && (
          <div className="bg-white rounded-2xl border border-border shadow-card p-6">
            <h2 className="text-base font-semibold text-ink mb-4">上传需求文档</h2>
            <div className="space-y-4">
              <input type="text" placeholder="需求名称（如：用户登录功能）" value={requirementName} onChange={(e) => setRequirementName(e.target.value)}
                className="w-full h-10 px-4 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber focus:ring-1 focus:ring-amber outline-none" />
              <textarea placeholder="请输入或粘贴需求文档内容...&#10;&#10;AI将分析以下内容来生成测试用例：&#10;- 功能描述&#10;- 业务规则&#10;- 输入输出&#10;- 异常场景" value={requirementContent} onChange={(e) => setRequirementContent(e.target.value)}
                rows={10} className="w-full px-4 py-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber focus:ring-1 focus:ring-amber outline-none resize-none" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted hover:text-ink transition-colors">
                  {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 解析中...</> : <><Upload className="w-3.5 h-3.5" /> 上传文档 (.docx/.pdf/.txt/.md)</>}
                  <input ref={fileInputRef} type="file" className="hidden" accept=".docx,.doc,.pdf,.xlsx,.xls,.pptx,.ppt,.md,.txt,.csv,.xmind" onChange={handleFileUpload} disabled={uploading} />
                </label>
                <div className="flex items-center gap-2">
                  {requirementContent.trim() && <span className="text-[11px] text-muted">已输入 {requirementContent.length} 字</span>}
                  <button onClick={handleGenerate} disabled={!requirementContent.trim() || generating}
                    className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Sparkles className="w-4 h-4" /> AI生成用例
                  </button>
                </div>
              </div>
              {uploadError && <p className="text-[11px] text-fail">{uploadError}</p>}
            </div>
          </div>
        )}

        {/* Step 1-2: AI分析生成中 */}
        {(generating || currentStep === 1 || currentStep === 2) && !generated && (
          <div className="bg-white rounded-2xl border border-border shadow-card p-8 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-amber animate-spin mb-4" />
            <h2 className="text-lg font-semibold text-ink mb-2">AI正在生成测试用例...</h2>
            <p className="text-sm text-muted mb-6">基于需求内容生成完整的测试用例集</p>
            <div className="w-full max-w-md space-y-3">
              {["分析需求文档结构", "提取关键功能点", "识别异常场景", "生成测试用例", "验证用例完整性"].map((item, idx) => (
                <div key={item} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  idx < 5 ? "bg-pass/10" : "bg-cream"
                }`}>
                  {idx < 5 ? <CheckCircle className="w-4 h-4 text-pass flex-shrink-0" /> :
                   idx === 5 ? <Loader2 className="w-4 h-4 text-amber animate-spin flex-shrink-0" /> :
                   <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />}
                  <span className="text-sm text-ink">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: 审核用例 */}
        {currentStep === 3 && generated && (
          <div className="space-y-4">
            {/* 操作栏 */}
            <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-ink">生成结果</h2>
                <span className="text-xs text-muted bg-cream px-2 py-0.5 rounded-full">共 {totalCount} 条</span>
                <span className="text-xs text-pass bg-pass/10 px-2 py-0.5 rounded-full">已确认 {confirmedCount} 条</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRegenerate} disabled={generating} className="h-8 px-3 text-xs border border-border text-ink-light hover:bg-cream rounded-lg flex items-center gap-1"><RefreshCw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} /> 重新生成</button>
                <button onClick={confirmAll} className="h-8 px-3 text-xs bg-pass/10 text-pass hover:bg-pass/20 rounded-lg flex items-center gap-1"><Check className="w-3 h-3" /> 全部确认</button>
                <button onClick={cancelAll} className="h-8 px-3 text-xs bg-cream text-muted hover:bg-border rounded-lg flex items-center gap-1"><X className="w-3 h-3" /> 全部取消</button>
                <button onClick={handleExport} disabled={confirmedCount === 0} className="h-8 px-4 text-xs gradient-amber text-white rounded-lg flex items-center gap-1 shadow-sm disabled:opacity-50"><Download className="w-3 h-3" /> 导出 ({confirmedCount})</button>
              </div>
            </div>
            {/* 用例列表 */}
            <div className="space-y-3">
              {cases.length === 0 ? (
                <div className="bg-white rounded-2xl border border-border shadow-card p-12 text-center text-muted">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-light" />
                  <p className="text-sm">暂无生成的用例</p>
                </div>
              ) : cases.map((c) => (
                <div key={c.id} className={`bg-white rounded-2xl border shadow-card p-5 transition-all ${c.confirmed ? "border-pass/30 ring-1 ring-pass/10" : "border-border"}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleConfirm(c.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        c.confirmed ? "bg-pass border-pass text-white" : "border-border hover:border-amber"
                      }`}>
                        {c.confirmed && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        c.priority === "P0" ? "bg-fail/10 text-fail" : c.priority === "P1" ? "bg-warn/10 text-warn" : "bg-info/10 text-info"
                      }`}>{c.priority}</span>
                      <span className="text-[11px] text-muted bg-cream px-2 py-0.5 rounded-full">{c.module}</span>
                      <span className="text-[11px] text-amber bg-amber-light px-2 py-0.5 rounded-full">{c.source}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPreviewCase(c)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingCase({ ...c }); setShowEditDialog(true) }} className="p-1.5 rounded-lg hover:bg-amber-light text-ink-light hover:text-amber-hover transition-colors"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteCase(c.id)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-ink mb-2">{c.title}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div><span className="text-muted">前置条件：</span><span className="text-ink-light">{c.preconditions}</span></div>
                    <div><span className="text-muted">预期结果：</span><span className="text-ink-light">{c.expected}</span></div>
                  </div>
                  <div className="mt-2 text-xs"><span className="text-muted">测试步骤：</span><pre className="text-ink-light whitespace-pre-wrap mt-1 bg-cream/30 rounded-lg p-2">{c.steps}</pre></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: 导出完成 */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl border border-border shadow-card p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-pass/10 flex items-center justify-center mb-4"><CheckCircle className="w-8 h-8 text-pass" /></div>
            <h2 className="text-lg font-semibold text-ink mb-2">导出完成</h2>
            <p className="text-sm text-muted mb-6">已成功导出 {confirmedCount} 条测试用例到用例库</p>
            <div className="flex gap-3">
              <button onClick={() => { setCurrentStep(0); setGenerated(false); setCases([]); setRequirementContent(""); setRequirementName("") }} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">重新开始</button>
              <button onClick={handleExport} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 导出Excel</button>
            </div>
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {showEditDialog && editingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowEditDialog(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[520px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>编辑用例</h3>
              <button onClick={() => setShowEditDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div><label className="block text-xs font-medium text-ink-light mb-1">用例标题</label><input value={editingCase.title} onChange={(e) => setEditingCase({ ...editingCase, title: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ink-light mb-1">模块</label><input value={editingCase.module} onChange={(e) => setEditingCase({ ...editingCase, module: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" /></div>
                <div><label className="block text-xs font-medium text-ink-light mb-1">优先级</label><select value={editingCase.priority} onChange={(e) => setEditingCase({ ...editingCase, priority: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink outline-none focus:border-amber">{priorityOptions.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">前置条件</label><input value={editingCase.preconditions} onChange={(e) => setEditingCase({ ...editingCase, preconditions: e.target.value })} className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">测试步骤</label><textarea value={editingCase.steps} onChange={(e) => setEditingCase({ ...editingCase, steps: e.target.value })} rows={4} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" /></div>
              <div><label className="block text-xs font-medium text-ink-light mb-1">预期结果</label><textarea value={editingCase.expected} onChange={(e) => setEditingCase({ ...editingCase, expected: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" /></div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowEditDialog(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
              <button onClick={handleSaveEdit} className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewCase && <PreviewModal title={previewCase.title} content={`# ${previewCase.title}\n\n| 字段 | 值 |\n|------|----|\n| 模块 | ${previewCase.module} |\n| 优先级 | ${previewCase.priority} |\n| 来源 | ${previewCase.source} |\n\n## 前置条件\n${previewCase.preconditions}\n\n## 测试步骤\n${previewCase.steps}\n\n## 预期结果\n${previewCase.expected}`} onClose={() => setPreviewCase(null)} />}
    </div>
  )
}
