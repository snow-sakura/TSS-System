/**
 * AI用例生成 - 基于需求文档自动生成测试用例
 * 流程：上传需求 → AI分析 → 生成用例 → 人工审核 → 导出
 */
import { useState, useRef, useCallback } from "react"
import { Upload, Sparkles, Loader2, CheckCircle, XCircle, Eye, Download, Plus, Edit, Trash2, Check, X, FileText, ArrowRight, RefreshCw, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import PreviewModal from "../components/PreviewModal"

// Mock AI生成的用例数据
const mockGeneratedCases = [
  { id: 1, title: "TC-AI-001: 用户名格式验证", module: "登录模块", priority: "P0", preconditions: "用户在注册页面", steps: "1. 输入不合法用户名（包含特殊字符）\n2. 点击注册按钮\n3. 检查错误提示", expected: "提示用户名格式不正确", confirmed: false, source: "AI生成" },
  { id: 2, title: "TC-AI-002: 密码强度验证", module: "登录模块", priority: "P1", preconditions: "用户在注册页面", steps: "1. 输入弱密码（纯数字）\n2. 检查密码强度提示", expected: "提示密码强度不足", confirmed: false, source: "AI生成" },
  { id: 3, title: "TC-AI-003: 登录成功正常流程", module: "登录模块", priority: "P0", preconditions: "用户已注册", steps: "1. 输入正确用户名\n2. 输入正确密码\n3. 点击登录\n4. 检查跳转", expected: "成功登录，跳转到首页", confirmed: false, source: "AI生成" },
  { id: 4, title: "TC-AI-004: 登录失败错误提示", module: "登录模块", priority: "P1", preconditions: "用户已注册", steps: "1. 输入正确用户名\n2. 输入错误密码\n3. 点击登录", expected: "提示密码错误", confirmed: false, source: "AI生成" },
  { id: 5, title: "TC-AI-005: 搜索关键词匹配", module: "搜索模块", priority: "P1", preconditions: "系统有商品数据", steps: "1. 在搜索框输入关键词\n2. 点击搜索\n3. 检查结果", expected: "搜索结果匹配关键词", confirmed: false, source: "AI生成" },
  { id: 6, title: "TC-AI-006: 搜索空结果提示", module: "搜索模块", priority: "P2", preconditions: "系统有商品数据", steps: "1. 输入不存在的关键词\n2. 点击搜索", expected: "显示暂无搜索结果", confirmed: false, source: "AI生成" },
  { id: 7, title: "TC-AI-007: 购物车添加商品", module: "购物车", priority: "P0", preconditions: "用户已登录，商品存在", steps: "1. 进入商品详情\n2. 点击加入购物车\n3. 查看购物车", expected: "商品成功添加到购物车", confirmed: false, source: "AI生成" },
  { id: 8, title: "TC-AI-008: 购物车数量修改", module: "购物车", priority: "P1", preconditions: "购物车中有商品", steps: "1. 进入购物车\n2. 修改商品数量\n3. 检查总价", expected: "数量和总价正确更新", confirmed: false, source: "AI生成" },
  { id: 9, title: "TC-AI-009: 支付流程完整验证", module: "支付模块", priority: "P0", preconditions: "购物车中有商品", steps: "1. 点击结算\n2. 选择支付方式\n3. 完成支付\n4. 检查订单状态", expected: "支付成功，订单创建", confirmed: false, source: "AI生成" },
  { id: 10, title: "TC-AI-010: 支付超时回退", module: "支付模块", priority: "P0", preconditions: "订单进入支付页面", steps: "1. 等待支付超时\n2. 检查订单状态", expected: "订单回退为待支付", confirmed: false, source: "AI生成" },
]

const aiSteps = [
  { key: "upload", label: "上传需求", desc: "上传需求文档或粘贴需求内容" },
  { key: "analyze", label: "AI分析", desc: "分析需求提取测试点" },
  { key: "generate", label: "生成用例", desc: "自动生成测试用例" },
  { key: "review", label: "人工审核", desc: "审核确认用例质量" },
  { key: "export", label: "导出入库", desc: "确认后导出到用例库" },
]

const priorityOptions = ["P0", "P1", "P2", "P3"]

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

  // 生成的用例
  const [cases, setCases] = useState(mockGeneratedCases)
  const [editingCase, setEditingCase] = useState<any>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [previewCase, setPreviewCase] = useState<any>(null)

  // 统计
  const confirmedCount = cases.filter((c) => c.confirmed).length
  const totalCount = cases.length

  // 文件上传
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError(null)
    try {
      // 模拟上传解析
      await new Promise((r) => setTimeout(r, 1000))
      const reader = new FileReader()
      reader.onload = (ev) => {
        const content = ev.target?.result as string
        if (content) {
          setRequirementContent(content.slice(0, 5000))
          setRequirementName(file.name.replace(/\.[^.]+$/, ""))
        }
      }
      reader.readAsText(file)
    } catch {
      setUploadError("文件解析失败")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [])

  // 开始AI生成
  const handleGenerate = async () => {
    if (!requirementContent.trim()) { toast.error("请输入需求内容"); return }
    setGenerating(true)
    setCurrentStep(1)
    await new Promise((r) => setTimeout(r, 1200))
    setCurrentStep(2)
    await new Promise((r) => setTimeout(r, 2000))
    setCurrentStep(3)
    setGenerating(false)
    setGenerated(true)
    toast.success(`AI已生成 ${cases.length} 条测试用例`, { description: "请审核并确认需要保留的用例" })
  }

  // 确认/取消用例
  const toggleConfirm = (id: number) => {
    setCases(cases.map((c) => c.id === id ? { ...c, confirmed: !c.confirmed } : c))
  }

  const confirmAll = () => { setCases(cases.map((c) => ({ ...c, confirmed: true }))); toast.success("已全部确认") }
  const cancelAll = () => { setCases(cases.map((c) => ({ ...c, confirmed: false }))); toast.success("已全部取消") }

  // 删除用例
  const handleDeleteCase = (id: number) => {
    setCases(cases.filter((c) => c.id !== id))
    toast.success("用例已删除")
  }

  // 重新生成
  const handleRegenerate = async () => {
    setGenerating(true); setCurrentStep(2)
    await new Promise((r) => setTimeout(r, 2000))
    setCurrentStep(3); setGenerating(false)
    toast.success("已重新生成用例")
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
  const handleSaveEdit = () => {
    if (!editingCase) return
    setCases(cases.map((c) => c.id === editingCase.id ? editingCase : c))
    setShowEditDialog(false)
    toast.success("用例已更新")
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
        {currentStep === 0 && (
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
                  <input ref={fileInputRef} type="file" className="hidden" accept=".docx,.pdf,.txt,.md" onChange={handleFileUpload} disabled={uploading} />
                </label>
                <div className="flex items-center gap-2">
                  {requirementContent.trim() && <span className="text-[11px] text-muted">已输入 {requirementContent.length} 字</span>}
                  <button onClick={() => { setCurrentStep(1); handleGenerate() }} disabled={!requirementContent.trim() || generating}
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
        {(currentStep === 1 || currentStep === 2) && (
          <div className="bg-white rounded-2xl border border-border shadow-card p-8 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-amber animate-spin mb-4" />
            <h2 className="text-lg font-semibold text-ink mb-2">
              {currentStep === 1 ? "AI正在分析需求..." : "AI正在生成测试用例..."}
            </h2>
            <p className="text-sm text-muted mb-6">
              {currentStep === 1 ? "提取功能点、业务规则、边界条件" : "基于分析结果生成完整的测试用例"}
            </p>
            <div className="w-full max-w-md space-y-3">
              {["分析需求文档结构", "提取关键功能点", "识别异常场景", "生成测试用例", "验证用例完整性"].map((item, idx) => (
                <div key={item} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  idx < (currentStep === 1 ? 2 : 5) ? "bg-pass/10" : idx === (currentStep === 1 ? 2 : 5) ? "bg-amber-light" : "bg-cream"
                }`}>
                  {idx < (currentStep === 1 ? 2 : 5) ? <CheckCircle className="w-4 h-4 text-pass flex-shrink-0" /> :
                   idx === (currentStep === 1 ? 2 : 5) ? <Loader2 className="w-4 h-4 text-amber animate-spin flex-shrink-0" /> :
                   <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />}
                  <span className={`text-sm ${idx <= (currentStep === 1 ? 2 : 5) ? "text-ink" : "text-muted"}`}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: 审核用例 */}
        {currentStep === 3 && (
          <div className="space-y-4">
            {/* 操作栏 */}
            <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-ink">生成结果</h2>
                <span className="text-xs text-muted bg-cream px-2 py-0.5 rounded-full">共 {totalCount} 条</span>
                <span className="text-xs text-pass bg-pass/10 px-2 py-0.5 rounded-full">已确认 {confirmedCount} 条</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRegenerate} className="h-8 px-3 text-xs border border-border text-ink-light hover:bg-cream rounded-lg flex items-center gap-1"><RefreshCw className="w-3 h-3" /> 重新生成</button>
                <button onClick={confirmAll} className="h-8 px-3 text-xs bg-pass/10 text-pass hover:bg-pass/20 rounded-lg flex items-center gap-1"><Check className="w-3 h-3" /> 全部确认</button>
                <button onClick={cancelAll} className="h-8 px-3 text-xs bg-cream text-muted hover:bg-border rounded-lg flex items-center gap-1"><X className="w-3 h-3" /> 全部取消</button>
                <button onClick={handleExport} disabled={confirmedCount === 0} className="h-8 px-4 text-xs gradient-amber text-white rounded-lg flex items-center gap-1 shadow-sm disabled:opacity-50"><Download className="w-3 h-3" /> 导出 ({confirmedCount})</button>
              </div>
            </div>
            {/* 用例列表 */}
            <div className="space-y-3">
              {cases.map((c) => (
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
                      <span className="text-[11px] text-amber bg-amber-light px-2 py-0.5 rounded-full">AI生成</span>
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
              <button onClick={() => { setCurrentStep(0); setGenerated(false); setCases(mockGeneratedCases); setRequirementContent(""); setRequirementName("") }} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">重新开始</button>
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
