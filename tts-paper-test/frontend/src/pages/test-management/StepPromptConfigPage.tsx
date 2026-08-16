import { useState, useEffect, useCallback } from "react"
import { 
  Settings, Save, Play, Trash2, Plus, X, ChevronDown, ChevronUp,
  Eye, EyeOff, RotateCcw, FileText, ClipboardList,
  Target, FlaskConical, CheckCircle, Code, Eye as EyeIcon,
  Layers, Wand2, Zap
} from "lucide-react"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"
import { configApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import { useConfirmStore } from "@/stores/confirmStore"
import { loadStepConfigs, type StepPromptConfig as StepPromptConfigService } from "@/lib/stepPromptConfig"

// 步骤图标映射
const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  ClipboardList,
  Target,
  FlaskConical,
  CheckCircle,
}

// Tab类型
type TabType = "system" | "user" | "skill" | "output" | "logs"

// 步骤提示词配置接口
interface StepPromptConfig {
  id?: number
  step_key: string
  step_name: string
  step_order: number
  icon?: string
  description?: string
  system_prompt: string
  user_prompt_template: string
  skill_prompt?: string
  output_template?: string
  skills?: Array<{ name: string; description: string; content: string }>
  variables?: Array<{ name: string; type: string; description: string; required: boolean }>
  output_logs_template?: Array<{ content: string; delay_ms: number }>
  is_default?: boolean
  status?: string
  created_at?: string
  updated_at?: string
}

// 新技能
interface SkillItem {
  name: string
  description: string
  content: string
}

// 新变量
interface VariableItem {
  name: string
  type: string
  description: string
  required: boolean
}

// 新日志模板
interface LogTemplateItem {
  content: string
  delay_ms: number
}

export default function StepPromptConfigPage() {
  const toast = useToast()
  const confirm = useConfirmStore(s => s.confirm)
  const [configs, setConfigs] = useState<StepPromptConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("system")
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<StepPromptConfig | null>(null)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [testVariables, setTestVariables] = useState<Record<string, string>>({})
  const [previewMode, setPreviewMode] = useState<Record<string, boolean>>({ system: false, user: false, skill: false, output: false })

  // 加载配置列表（优先后端 API，失败回退到内置丰富模板）
  const loadConfigs = useCallback(async (forceResetStep = false) => {
    try {
      setLoading(true)
      const items: StepPromptConfigService[] = await loadStepConfigs()
      setConfigs(items as unknown as StepPromptConfig[])
      if (items.length > 0 && (forceResetStep || !activeStep)) {
        setActiveStep(items[0].step_key)
      }
    } catch (e) {
      toast?.error?.("加载步骤配置失败")
    } finally {
      setLoading(false)
    }
  }, [toast, activeStep])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  // 初始化默认配置
  const handleInitDefaults = async () => {
    try {
      const res = await configApi.initDefaultStepPromptConfigs() as any
      toast?.success?.(res?.message || "初始化成功")
      await loadConfigs(true)
    } catch (e) {
      toast?.error?.("初始化默认配置失败")
    }
  }

  // 选择步骤
  const handleSelectStep = (stepKey: string) => {
    setActiveStep(stepKey)
    setActiveTab("system")
  }

  // 打开编辑弹窗
  const handleOpenEdit = (config: StepPromptConfig) => {
    setEditingConfig({ ...config })
    setEditModalOpen(true)
  }

  // 保存配置
  const handleSave = async () => {
    if (!editingConfig) return
    try {
      if (editingConfig.id) {
        await configApi.updateStepPromptConfig(editingConfig.id, editingConfig)
        toast?.success?.("配置更新成功")
      } else {
        await configApi.createStepPromptConfig(editingConfig)
        toast?.success?.("配置创建成功")
      }
      setEditModalOpen(false)
      setEditingConfig(null)
      await loadConfigs()
    } catch (e) {
      toast?.error?.("保存失败")
    }
  }

  // 删除配置
  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "删除配置",
      message: "确定要删除此步骤提示词配置吗？此操作不可恢复。",
      danger: true,
    })
    if (!ok) return
    try {
      await configApi.deleteStepPromptConfig(id)
      toast?.success?.("删除成功")
      await loadConfigs()
    } catch (e) {
      toast?.error?.("删除失败")
    }
  }

  // 打开测试弹窗
  const handleOpenTest = async (config: StepPromptConfig) => {
    setEditingConfig(config)
    // 初始化变量默认值
    const vars: Record<string, string> = {}
    if (config.variables) {
      config.variables.forEach(v => {
        vars[v.name] = v.name === "content" ? "这是一个测试需求内容，用于验证步骤提示词配置的效果" : 
                       v.name === "files_list" ? "需求文档.pdf, 原型设计.figma" : ""
      })
    }
    setTestVariables(vars)
    setTestResult(null)
    setTestModalOpen(true)
  }

  // 执行测试
  const handleExecuteTest = async () => {
    if (!editingConfig?.id) return
    try {
      const res = await configApi.testStepPromptConfig(editingConfig.id, {
        variables: testVariables,
        input_text: testVariables.content || "",
      }) as any
      setTestResult(res?.data || res)
    } catch (e) {
      toast?.error?.("测试执行失败")
    }
  }

  // 获取当前激活步骤的配置
  const activeConfig = configs.find(c => c.step_key === activeStep)

  // 更新编辑中的配置
  const updateEditingConfig = (field: keyof StepPromptConfig, value: any) => {
    if (!editingConfig) return
    setEditingConfig(prev => {
      if (!prev) return prev
      return { ...prev, [field]: value }
    })
  }

  // 更新技能列表
  const updateSkills = (index: number, field: keyof SkillItem, value: string) => {
    if (!editingConfig?.skills) return
    const newSkills = [...editingConfig.skills]
    newSkills[index] = { ...newSkills[index], [field]: value }
    updateEditingConfig("skills", newSkills)
  }

  const addSkill = () => {
    if (!editingConfig) return
    const newSkill: SkillItem = { name: "新技能", description: "技能描述", content: "技能内容" }
    updateEditingConfig("skills", [...(editingConfig.skills || []), newSkill])
  }

  const removeSkill = (index: number) => {
    if (!editingConfig?.skills) return
    updateEditingConfig("skills", editingConfig.skills.filter((_, i) => i !== index))
  }

  // 更新变量列表
  const updateVariables = (index: number, field: keyof VariableItem, value: any) => {
    if (!editingConfig?.variables) return
    const newVars = [...editingConfig.variables]
    newVars[index] = { ...newVars[index], [field]: value }
    updateEditingConfig("variables", newVars)
  }

  const addVariable = () => {
    if (!editingConfig) return
    const newVar: VariableItem = { name: "new_var", type: "string", description: "变量描述", required: false }
    updateEditingConfig("variables", [...(editingConfig.variables || []), newVar])
  }

  const removeVariable = (index: number) => {
    if (!editingConfig?.variables) return
    updateEditingConfig("variables", editingConfig.variables.filter((_, i) => i !== index))
  }

  // 更新日志模板
  const updateLogs = (index: number, field: keyof LogTemplateItem, value: any) => {
    if (!editingConfig?.output_logs_template) return
    const newLogs = [...editingConfig.output_logs_template]
    newLogs[index] = { ...newLogs[index], [field]: value }
    updateEditingConfig("output_logs_template", newLogs)
  }

  const addLog = () => {
    if (!editingConfig) return
    const newLog: LogTemplateItem = { content: "新日志内容", delay_ms: 500 }
    updateEditingConfig("output_logs_template", [...(editingConfig.output_logs_template || []), newLog])
  }

  const removeLog = (index: number) => {
    if (!editingConfig?.output_logs_template) return
    updateEditingConfig("output_logs_template", editingConfig.output_logs_template.filter((_, i) => i !== index))
  }

  // 切换预览模式
  const togglePreview = (tab: TabType) => {
    setPreviewMode(prev => ({ ...prev, [tab]: !prev[tab] }))
  }

  // 渲染Markdown预览
  const renderMarkdown = (content: string) => (
    <MarkdownPreview content={content} />
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber"></div>
        <span className="ml-3 text-muted">加载中...</span>
      </div>
    )
  }

  return (
    <div className="p-6 min-h-full">
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber" />
            步骤提示词配置
          </h1>
          <p className="text-sm text-muted mt-1">
            配置AI全流程各步骤的系统提示词、用户提示词、技能和输出模板
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInitDefaults}
            className="px-3 py-2 text-sm bg-cream border border-border rounded-xl hover:bg-amber hover:text-white transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            初始化默认配置
          </button>
          {activeConfig && (
            <button
              onClick={() => handleOpenEdit(activeConfig)}
              className="px-3 py-2 text-sm bg-amber text-white rounded-xl hover:bg-amber/90 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              编辑配置
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {/* 左侧步骤列表 */}
        <div className="w-48 flex-shrink-0">
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-cream/50">
              <h2 className="text-sm font-semibold text-ink">步骤列表</h2>
            </div>
            <div className="p-2 space-y-1">
              {configs.map(config => {
                const Icon = STEP_ICONS[config.icon || ""] || FileText
                const isActive = activeStep === config.step_key
                return (
                  <button
                    key={config.step_key}
                    onClick={() => handleSelectStep(config.step_key)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      isActive 
                        ? "bg-amber text-white shadow-sm" 
                        : "text-ink-light hover:text-ink hover:bg-cream/50"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{config.step_name}</span>
                    {config.is_default && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-500'}`}>
                        默认
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 右侧配置详情 */}
        <div className="flex-1 min-w-0">
          {activeConfig ? (
            <div className="bg-white rounded-xl border border-border">
              {/* 步骤信息 */}
              <div className="px-4 py-3 border-b border-border bg-cream/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = STEP_ICONS[activeConfig.icon || ""] || FileText
                    return <Icon className="w-5 h-5 text-amber" />
                  })()}
                  <div>
                    <h2 className="font-semibold text-ink">{activeConfig.step_name}</h2>
                    <p className="text-xs text-muted">{activeConfig.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenTest(activeConfig)}
                  className="px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  测试执行
                </button>
              </div>

              {/* Tab切换 */}
              <div className="border-b border-border px-4 flex gap-1">
                {([
                  { key: "system" as TabType, label: "系统提示词", icon: Settings },
                  { key: "user" as TabType, label: "用户提示词", icon: FileText },
                  { key: "skill" as TabType, label: "技能配置", icon: Zap },
                  { key: "output" as TabType, label: "输出模板", icon: Code },
                  { key: "logs" as TabType, label: "日志模板", icon: Layers },
                ]).map(tab => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${
                        activeTab === tab.key
                          ? "border-amber text-amber"
                          : "border-transparent text-muted hover:text-ink"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {/* Tab内容 */}
              <div className="p-4 min-h-[400px]">
                {/* 系统提示词 */}
                {activeTab === "system" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                        <Settings className="w-4 h-4 text-amber" />
                        系统提示词
                      </h3>
                      <button
                        onClick={() => togglePreview("system")}
                        className="text-xs text-muted hover:text-ink flex items-center gap-1"
                      >
                        {previewMode.system ? <EyeOff className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                        {previewMode.system ? "编辑模式" : "预览模式"}
                      </button>
                    </div>
                    <p className="text-xs text-muted mb-3">
                      定义AI的角色、专业领域和行为准则。系统提示词决定了AI的专业程度和输出风格。
                    </p>
                    {previewMode.system ? (
                      <div className="bg-cream p-4 rounded-lg border border-border min-h-[300px]">
                        {renderMarkdown(activeConfig.system_prompt)}
                      </div>
                    ) : (
                      <div className="bg-cream p-4 rounded-lg border border-border font-mono text-sm whitespace-pre-wrap min-h-[300px]">
                        {activeConfig.system_prompt}
                      </div>
                    )}
                  </div>
                )}

                {/* 用户提示词 */}
                {activeTab === "user" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber" />
                        用户提示词模板
                      </h3>
                      <button
                        onClick={() => togglePreview("user")}
                        className="text-xs text-muted hover:text-ink flex items-center gap-1"
                      >
                        {previewMode.user ? <EyeOff className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                        {previewMode.user ? "编辑模式" : "预览模式"}
                      </button>
                    </div>
                    <p className="text-xs text-muted mb-3">
                      用户提示词模板，支持变量占位符如 <code className="bg-cream px-1 rounded">{"{content}"}</code>、<code className="bg-cream px-1 rounded">{"{files_list}"}</code>。
                      这些变量会在执行时被实际内容替换。
                    </p>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-3">
                      <p className="text-xs text-blue-600">
                        <strong>可用变量:</strong>{" "}
                        {activeConfig.variables?.map(v => (
                          <span key={v.name} className="inline-block bg-white px-2 py-0.5 rounded mr-1 my-0.5 text-xs">
                            {`{${v.name}}`} ({v.type})
                          </span>
                        )) || "暂无变量"}
                      </p>
                    </div>
                    {previewMode.user ? (
                      <div className="bg-cream p-4 rounded-lg border border-border min-h-[300px]">
                        {renderMarkdown(activeConfig.user_prompt_template)}
                      </div>
                    ) : (
                      <div className="bg-cream p-4 rounded-lg border border-border font-mono text-sm whitespace-pre-wrap min-h-[300px]">
                        {activeConfig.user_prompt_template}
                      </div>
                    )}
                  </div>
                )}

                {/* 技能配置 */}
                {activeTab === "skill" && (
                  <div>
                    <h3 className="text-sm font-medium text-ink flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-amber" />
                      技能与方法论
                    </h3>
                    <p className="text-xs text-muted mb-4">
                      该步骤使用的技能和方法论，AI会参考这些内容来执行任务。
                    </p>

                    {/* 技能提示词 */}
                    {activeConfig.skill_prompt && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-medium text-ink-light flex items-center gap-2">
                            <Wand2 className="w-3 h-3 text-purple-500" />
                            技能提示词
                          </h4>
                          <button
                            onClick={() => togglePreview("skill")}
                            className="text-xs text-muted hover:text-ink flex items-center gap-1"
                          >
                            {previewMode.skill ? <EyeOff className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                            {previewMode.skill ? "编辑" : "预览"}
                          </button>
                        </div>
                        {previewMode.skill ? (
                          <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                            {renderMarkdown(activeConfig.skill_prompt)}
                          </div>
                        ) : (
                          <div className="bg-cream p-3 rounded-lg border border-border font-mono text-xs whitespace-pre-wrap">
                            {activeConfig.skill_prompt}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 关联技能列表 */}
                    <div>
                      <h4 className="text-xs font-medium text-ink-light mb-2">关联技能</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {activeConfig.skills?.map((skill, idx) => (
                          <div key={idx} className="bg-cream p-3 rounded-lg border border-border">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-ink">{skill.name}</span>
                              <span className="text-xs text-muted">{skill.description}</span>
                            </div>
                            <p className="text-xs text-ink-light line-clamp-2">{skill.content}</p>
                          </div>
                        ))}
                        {!activeConfig.skills?.length && (
                          <p className="text-xs text-muted text-center py-4">暂无关联技能</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 输出模板 */}
                {activeTab === "output" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                        <Code className="w-4 h-4 text-amber" />
                        输出格式模板
                      </h3>
                      <button
                        onClick={() => togglePreview("output")}
                        className="text-xs text-muted hover:text-ink flex items-center gap-1"
                      >
                        {previewMode.output ? <EyeOff className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                        {previewMode.output ? "编辑模式" : "预览模式"}
                      </button>
                    </div>
                    <p className="text-xs text-muted mb-3">
                      定义该步骤的输出格式和结构，AI会按照这个模板组织输出内容。
                    </p>
                    {previewMode.output ? (
                      <div className="bg-cream p-4 rounded-lg border border-border min-h-[300px]">
                        {activeConfig.output_template ? renderMarkdown(activeConfig.output_template) : (
                          <p className="text-muted text-center py-4">暂无输出模板</p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-cream p-4 rounded-lg border border-border font-mono text-sm whitespace-pre-wrap min-h-[300px]">
                        {activeConfig.output_template || "暂无输出模板"}
                      </div>
                    )}
                  </div>
                )}

                {/* 日志模板 */}
                {activeTab === "logs" && (
                  <div>
                    <h3 className="text-sm font-medium text-ink flex items-center gap-2 mb-3">
                      <Layers className="w-4 h-4 text-amber" />
                      步骤日志输出模板
                    </h3>
                    <p className="text-xs text-muted mb-4">
                      定义步骤执行时的流式日志输出内容，支持 <code className="bg-cream px-1 rounded">{"{content_preview}"}</code>、<code className="bg-cream px-1 rounded">{"{files_list}"}</code> 等变量。
                    </p>
                    <div className="space-y-3">
                      {activeConfig.output_logs_template?.map((log, idx) => (
                        <div key={idx} className="bg-cream p-3 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-amber">日志 {idx + 1}</span>
                            <span className="text-xs text-muted">延迟 {log.delay_ms}ms</span>
                          </div>
                          <div className="bg-white p-2 rounded font-mono text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {log.content}
                          </div>
                        </div>
                      ))}
                      {!activeConfig.output_logs_template?.length && (
                        <p className="text-muted text-center py-4">暂无日志模板</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border p-12 text-center">
              <Settings className="w-12 h-12 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-ink mb-2">选择一个步骤</h3>
              <p className="text-muted">请从左侧列表选择要配置的步骤</p>
            </div>
          )}
        </div>
      </div>

      {/* 编辑弹窗 */}
      {editModalOpen && editingConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 弹窗头部 */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-amber" />
                <h2 className="text-lg font-semibold">编辑步骤配置</h2>
                <span className="text-sm text-muted">- {editingConfig.step_name}</span>
              </div>
              <button
                onClick={() => { setEditModalOpen(false); setEditingConfig(null) }}
                className="p-2 hover:bg-cream rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 基本信息 */}
              <div className="bg-cream rounded-xl p-4 border border-border">
                <h3 className="text-sm font-medium text-ink mb-3">基本信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted mb-1 block">步骤名称</label>
                    <input
                      type="text"
                      value={editingConfig.step_name}
                      onChange={(e) => updateEditingConfig("step_name", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-amber"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1">步骤顺序</label>
                    <input
                      type="number"
                      value={editingConfig.step_order}
                      onChange={(e) => updateEditingConfig("step_order", parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-amber"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted mb-1">步骤描述</label>
                    <input
                      type="text"
                      value={editingConfig.description || ""}
                      onChange={(e) => updateEditingConfig("description", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-amber"
                    />
                  </div>
                </div>
              </div>

              {/* 系统提示词 */}
              <div>
                <h3 className="text-sm font-medium text-ink mb-2 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-amber" />
                  系统提示词
                </h3>
                <textarea
                  value={editingConfig.system_prompt}
                  onChange={(e) => updateEditingConfig("system_prompt", e.target.value)}
                  className="w-full h-48 px-3 py-2 text-sm border border-border rounded-lg font-mono focus:outline-none focus:border-amber resize-y"
                  placeholder="定义AI的角色、专业领域和行为准则..."
                />
              </div>

              {/* 用户提示词模板 */}
              <div>
                <h3 className="text-sm font-medium text-ink mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber" />
                  用户提示词模板
                </h3>
                <textarea
                  value={editingConfig.user_prompt_template}
                  onChange={(e) => updateEditingConfig("user_prompt_template", e.target.value)}
                  className="w-full h-40 px-3 py-2 text-sm border border-border rounded-lg font-mono focus:outline-none focus:border-amber resize-y"
                  placeholder="使用 {variable_name} 作为变量占位符..."
                />
              </div>

              {/* 技能提示词 */}
              <div>
                <h3 className="text-sm font-medium text-ink mb-2 flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-purple-500" />
                  技能提示词
                </h3>
                <textarea
                  value={editingConfig.skill_prompt || ""}
                  onChange={(e) => updateEditingConfig("skill_prompt", e.target.value)}
                  className="w-full h-32 px-3 py-2 text-sm border border-border rounded-lg font-mono focus:outline-none focus:border-amber resize-y"
                  placeholder="定义该步骤使用的技能和方法论..."
                />
              </div>

              {/* 输出模板 */}
              <div>
                <h3 className="text-sm font-medium text-ink mb-2 flex items-center gap-2">
                  <Code className="w-4 h-4 text-amber" />
                  输出格式模板
                </h3>
                <textarea
                  value={editingConfig.output_template || ""}
                  onChange={(e) => updateEditingConfig("output_template", e.target.value)}
                  className="w-full h-32 px-3 py-2 text-sm border border-border rounded-lg font-mono focus:outline-none focus:border-amber resize-y"
                  placeholder="定义该步骤的输出格式和结构..."
                />
              </div>

              {/* 关联技能 */}
              <div className="bg-cream rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber" />
                    关联技能
                  </h3>
                  <button
                    onClick={addSkill}
                    className="text-xs px-2 py-1 bg-amber text-white rounded hover:bg-amber/90 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    添加技能
                  </button>
                </div>
                <div className="space-y-3">
                  {editingConfig.skills?.map((skill, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted">技能 {idx + 1}</span>
                        <button
                          onClick={() => removeSkill(idx)}
                          className="text-rose-500 hover:text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={skill.name}
                          onChange={(e) => updateSkills(idx, "name", e.target.value)}
                          placeholder="技能名称"
                          className="px-2 py-1 text-xs border border-border rounded"
                        />
                        <input
                          type="text"
                          value={skill.description}
                          onChange={(e) => updateSkills(idx, "description", e.target.value)}
                          placeholder="技能描述"
                          className="px-2 py-1 text-xs border border-border rounded"
                        />
                      </div>
                      <textarea
                        value={skill.content}
                        onChange={(e) => updateSkills(idx, "content", e.target.value)}
                        placeholder="技能详细内容"
                        className="w-full mt-2 px-2 py-1 text-xs border border-border rounded font-mono h-16 resize-y"
                      />
                    </div>
                  ))}
                  {!editingConfig.skills?.length && (
                    <p className="text-xs text-muted text-center py-3">暂无关联技能，点击上方按钮添加</p>
                  )}
                </div>
              </div>

              {/* 变量定义 */}
              <div className="bg-cream rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber" />
                    变量定义
                  </h3>
                  <button
                    onClick={addVariable}
                    className="text-xs px-2 py-1 bg-amber text-white rounded hover:bg-amber/90 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    添加变量
                  </button>
                </div>
                <div className="space-y-2">
                  {editingConfig.variables?.map((variable, idx) => (
                    <div key={idx} className="bg-white p-2 rounded-lg border border-border flex items-center gap-2">
                      <input
                        type="text"
                        value={variable.name}
                        onChange={(e) => updateVariables(idx, "name", e.target.value)}
                        placeholder="变量名"
                        className="w-24 px-2 py-1 text-xs border border-border rounded"
                      />
                      <select
                        value={variable.type}
                        onChange={(e) => updateVariables(idx, "type", e.target.value)}
                        className="w-20 px-2 py-1 text-xs border border-border rounded"
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="array">array</option>
                      </select>
                      <input
                        type="text"
                        value={variable.description}
                        onChange={(e) => updateVariables(idx, "description", e.target.value)}
                        placeholder="变量描述"
                        className="flex-1 px-2 py-1 text-xs border border-border rounded"
                      />
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={variable.required}
                          onChange={(e) => updateVariables(idx, "required", e.target.checked)}
                        />
                        必需
                      </label>
                      <button
                        onClick={() => removeVariable(idx)}
                        className="text-rose-500 hover:text-rose-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {!editingConfig.variables?.length && (
                    <p className="text-xs text-muted text-center py-2">暂无变量定义</p>
                  )}
                </div>
              </div>

              {/* 日志模板 */}
              <div className="bg-cream rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber" />
                    日志输出模板
                  </h3>
                  <button
                    onClick={addLog}
                    className="text-xs px-2 py-1 bg-amber text-white rounded hover:bg-amber/90 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    添加日志
                  </button>
                </div>
                <div className="space-y-3">
                  {editingConfig.output_logs_template?.map((log, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted">日志 {idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={log.delay_ms}
                            onChange={(e) => updateLogs(idx, "delay_ms", parseInt(e.target.value) || 500)}
                            className="w-20 px-2 py-1 text-xs border border-border rounded"
                            placeholder="延迟ms"
                          />
                          <button
                            onClick={() => removeLog(idx)}
                            className="text-rose-500 hover:text-rose-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={log.content}
                        onChange={(e) => updateLogs(idx, "content", e.target.value)}
                        placeholder="日志内容，支持 {content_preview}、{files_list} 等变量..."
                        className="w-full px-2 py-1 text-xs border border-border rounded font-mono h-24 resize-y"
                      />
                    </div>
                  ))}
                  {!editingConfig.output_logs_template?.length && (
                    <p className="text-xs text-muted text-center py-3">暂无日志模板</p>
                  )}
                </div>
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-cream/30">
              <div className="text-xs text-muted">
                {editingConfig.is_default && <span className="bg-blue-50 text-blue-500 px-2 py-0.5 rounded">系统默认配置</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditModalOpen(false); setEditingConfig(null) }}
                  className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-cream transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm bg-amber text-white rounded-xl hover:bg-amber/90 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  保存配置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 测试弹窗 */}
      {testModalOpen && editingConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Play className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold">测试步骤配置</h2>
                <span className="text-sm text-muted">- {editingConfig.step_name}</span>
              </div>
              <button
                onClick={() => { setTestModalOpen(false); setTestResult(null) }}
                className="p-2 hover:bg-cream rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-cream rounded-xl p-4 border border-border">
                <h3 className="text-sm font-medium text-ink mb-3">测试变量</h3>
                <div className="space-y-3">
                  {editingConfig.variables?.map((variable) => (
                    <div key={variable.name}>
                      <label className="text-xs text-muted mb-1 block">
                        {variable.name} {variable.required && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        value={testVariables[variable.name] || ""}
                        onChange={(e) => setTestVariables(prev => ({ ...prev, [variable.name]: e.target.value }))}
                        placeholder={variable.description}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-amber"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleExecuteTest}
                className="w-full py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                执行测试
              </button>

              {testResult && (
                <div className="bg-cream rounded-xl p-4 border border-border">
                  <h3 className="text-sm font-medium text-ink mb-3">测试结果</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">配置名称:</span>
                      <span>{testResult.config_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">执行耗时:</span>
                      <span>{testResult.duration}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">关联技能数:</span>
                      <span>{testResult.skills_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">变量数:</span>
                      <span>{testResult.variables_count}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-muted mb-1">渲染后的用户提示词:</h4>
                      <div className="bg-white p-2 rounded border border-border text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {testResult.rendered_user_prompt}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
