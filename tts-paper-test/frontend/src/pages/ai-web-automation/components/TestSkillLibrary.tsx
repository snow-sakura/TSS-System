/**
 * TestSkillLibrary — 测试技能库
 *
 * 专注于 AI Web 自动化场景的技能库，提供三类技能模板：
 *  - 选择器 (Selector): CSS/XPath/文本选择器技巧
 *  - 断言 (Assertion): 页面状态/元素/属性断言
 *  - 场景模板 (Scenario): 完整测试场景模板
 *
 * 接入 configApi.listSkills/createSkill/deleteSkill/executeSkill。
 * 支持快速复制应用到当前项目测试中。
 */
import { useState, useEffect, useCallback } from "react"
import { configApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"
import {
  Search, Plus, Code, CheckCircle, XCircle, Copy, Play,
  Layers, Crosshair, FileJson, Filter,
  Zap, BookOpen, ChevronDown, ChevronUp, Loader2, RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

interface Skill {
  id: number
  name: string
  description: string
  category: string
  version: string
  status: string
  content: any
  created_at: string
  updated_at: string
}

/** 技能分类配置 */
const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  selector: {
    label: "选择器",
    icon: Crosshair,
    color: "from-blue-500 to-indigo-600",
    desc: "CSS 选择器 / XPath / 文本匹配模板",
  },
  assertion: {
    label: "断言",
    icon: CheckCircle,
    color: "from-green-500 to-emerald-600",
    desc: "页面状态 / 元素属性 / 数据校验断言",
  },
  scenario: {
    label: "场景模板",
    icon: Layers,
    color: "from-violet-500 to-purple-600",
    desc: "登录 / 表单 / 导航等完整测试场景",
  },
  general: {
    label: "通用",
    icon: Code,
    color: "from-gray-400 to-gray-500",
    desc: "通用技能和工具函数",
  },
}


export default function TestSkillLibrary() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(false)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "", description: "", category: "selector", version: "v1.0", content: "{\n  \n}",
  })

  /** 加载技能列表 */
  const fetchSkills = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await configApi.listSkills(1, 100)
      const data = res?.data?.items || res?.data || res?.items || []
      if (Array.isArray(data)) {
        setSkills(data)
        setApiError(false)
      } else {
        // 响应格式异常：明确提示，不降级假数据
        setSkills([])
        setApiError(true)
        toast.error("获取技能数据格式异常，请稍后重试")
      }
    } catch {
      // API 失败：明确提示 + 重试，不显示预设假数据
      setSkills([])
      setApiError(true)
      toast.error("无法连接服务器，请检查服务端连接")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSkills() }, [fetchSkills])

  /** 过滤 */
  const filtered = skills.filter((s) => {
    const matchCat = activeCategory === "all" || s.category === activeCategory
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  /** 归类统计 */
  const categoryCounts = skills.reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1
    return acc
  }, {})

  /** 删除技能 */
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await configApi.deleteSkill(deleteTarget.id)
      toast.success(`已删除 "${deleteTarget.name}"`)
      await fetchSkills()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "删除失败")
    }
    setDeleteTarget(null)
  }

  /** 创建技能 */
  const handleCreate = async () => {
    if (!createForm.name.trim()) { toast.error("请输入技能名称"); return }
    try {
      let content: any = {}
      try { content = JSON.parse(createForm.content) } catch { content = { raw: createForm.content } }
      await configApi.createSkill({
        name: createForm.name,
        description: createForm.description,
        category: createForm.category,
        version: createForm.version,
        content,
      })
      toast.success("技能创建成功")
      setShowCreateModal(false)
      setCreateForm({ name: "", description: "", category: "selector", version: "v1.0", content: "{\n  \n}" })
      await fetchSkills()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "创建失败")
    }
  }

  /** 复制技能内容 */
  const handleCopy = (skill: Skill) => {
    const text = skill.content ? JSON.stringify(skill.content, null, 2) : skill.description
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`已复制 "${skill.name}" 内容`)
    }).catch(() => {
      toast.error("复制失败")
    })
  }

  /** 执行技能 */
  const handleExecute = async (skill: Skill) => {
    toast.loading(`执行 "${skill.name}"...`, { id: "exec" })
    try {
      const res: any = await configApi.executeSkill(skill.id, { params: {}, input_text: "" })
      toast.success(res?.output || "执行完成", { id: "exec" })
    } catch {
      // API 失败：明确提示，不做模拟执行
      toast.error(`执行 "${skill.name}" 失败，请检查服务器连接`, { id: "exec" })
    }
  }

  /** 快速应用到当前项目（触发自定义事件供父组件监听） */
  const handleQuickApply = (skill: Skill) => {
    window.dispatchEvent(new CustomEvent("skill-apply", {
      detail: { skill, content: JSON.stringify(skill.content, null, 2) },
    }))
    toast.success(`已应用 "${skill.name}" 到当前项目`)
  }

  /** 分类标签列表 */
  const categories = [
    { key: "all", label: "全部", icon: Filter, color: "bg-muted text-muted" },
    ...Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => ({
      key, label: cfg.label, icon: cfg.icon, color: "hover:bg-cream",
    })),
  ]

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber" />
            测试技能库
          </h2>
          <p className="text-[11px] text-muted mt-0.5">选择器模板 · 断言模板 · 场景模板</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} size="sm" variant="outline" className="h-8 px-3 text-[11px]">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          新建技能
        </Button>
      </div>

      {/* 搜索 + 分类过滤 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber/50 transition-all"
            placeholder="搜索技能名称或描述..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => {
          const Icon = cat.icon
          const isActive = activeCategory === cat.key
          const count = cat.key === "all" ? skills.length : (categoryCounts[cat.key] || 0)
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-amber text-white shadow-sm"
                  : "bg-cream text-muted hover:bg-amber/10"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                isActive ? "bg-white/20" : "bg-white"
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* API 失败提示 */}
      {apiError && !loading && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-fail/5 border border-fail/20 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-fail">
            <span className="w-2 h-2 rounded-full bg-fail animate-pulse" />
            服务连接失败，技能库暂不可用（已停止显示内置示例数据）
          </div>
          <button onClick={fetchSkills} className="h-7 px-3 text-xs bg-fail text-white hover:bg-fail/80 rounded-lg flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> 重试
          </button>
        </div>
      )}

      {/* 技能列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-amber" />
        </div>
      ) : apiError ? null : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted opacity-50" />
          <p className="text-sm text-muted">暂无技能</p>
          <p className="text-[11px] text-muted mt-1">点击「新建技能」创建，或稍后刷新重试</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((skill) => {
            const catCfg = CATEGORY_CONFIG[skill.category] || CATEGORY_CONFIG.general
            const CatIcon = catCfg.icon
            const isExpanded = expandedId === skill.id

            return (
              <div
                key={skill.id}
                className={`bg-white rounded-xl border transition-all ${
                  isExpanded ? "border-amber/40 shadow-md" : "border-border hover:border-amber/30 hover:shadow-sm"
                }`}
              >
                {/* 卡片头 */}
                <div className="p-3.5">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${catCfg.color} flex items-center justify-center shadow-sm flex-shrink-0`}>
                      <CatIcon className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-ink truncate">{skill.name}</span>
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-cream text-muted rounded-full">{skill.version}</span>
                        {skill.status === "已启用" ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-pass font-medium">
                            <CheckCircle className="w-3 h-3" /> 已启用
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] text-fail font-medium">
                            <XCircle className="w-3 h-3" /> 未启用
                          </span>
                        )}
                      </div>
                      {skill.description && (
                        <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{skill.description}</p>
                      )}
                    </div>
                  </div>

                  {/* 操作栏 */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
                    <button
                      onClick={() => handleQuickApply(skill)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber to-orange-400 text-white text-[10px] font-semibold hover:shadow-md transition-all"
                      title="应用到当前项目"
                    >
                      <Zap className="w-3 h-3" />
                      快速应用
                    </button>
                    <button
                      onClick={() => handleCopy(skill)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream text-muted text-[10px] font-medium hover:bg-amber/10 transition-all"
                      title="复制内容"
                    >
                      <Copy className="w-3 h-3" />
                      复制
                    </button>
                    <button
                      onClick={() => handleExecute(skill)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream text-muted text-[10px] font-medium hover:bg-amber/10 transition-all"
                      title="执行技能"
                    >
                      <Play className="w-3 h-3" />
                      运行
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream text-muted text-[10px] font-medium hover:bg-amber/10 transition-all ml-auto"
                    >
                      {isExpanded ? (
                        <><ChevronUp className="w-3 h-3" /> 收起</>
                      ) : (
                        <><ChevronDown className="w-3 h-3" /> 详情</>
                      )}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(skill)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream text-fail text-[10px] font-medium hover:bg-fail/10 transition-all"
                      title="删除"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 展开内容 */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 border-t border-border/50 pt-3">
                    {/* 场景步骤（场景模板特有） */}
                    {skill.category === "scenario" && skill.content?.steps && (
                      <div className="space-y-1.5 mb-3">
                        <span className="text-[10px] font-semibold text-muted flex items-center gap-1">
                          <Layers className="w-3 h-3" /> 测试步骤
                        </span>
                        {skill.content.steps.map((step: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] bg-cream/50 rounded-lg px-2.5 py-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber/10 text-amber flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                            <span className="font-mono text-[10px] text-amber bg-amber/5 px-1.5 py-0.5 rounded">{step.action}</span>
                            <span className="text-ink-light truncate">{step.description || step.target}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 断言/选择器特殊展示 */}
                    {skill.content?.assertion && (
                      <div className="mb-3">
                        <span className="text-[10px] font-semibold text-muted flex items-center gap-1 mb-1">
                          <Code className="w-3 h-3" /> 断言表达式
                        </span>
                        <code className="block text-[11px] bg-cream/50 rounded-lg px-2.5 py-2 font-mono text-ink break-all">
                          {skill.content.assertion}
                          {skill.content.expected ? ` === "${skill.content.expected}"` : ""}
                        </code>
                      </div>
                    )}

                    {skill.content?.selector && (
                      <div className="mb-3">
                        <span className="text-[10px] font-semibold text-muted flex items-center gap-1 mb-1">
                          <Crosshair className="w-3 h-3" /> 选择器
                        </span>
                        <code className="block text-[11px] bg-blue-50 rounded-lg px-2.5 py-2 font-mono text-blue-700 break-all">
                          {skill.content.selector}
                        </code>
                      </div>
                    )}

                    {/* JSON 定义预览 */}
                    {skill.content && !skill.content.steps && !skill.content.assertion && !skill.content.selector && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted flex items-center gap-1 mb-1">
                          <FileJson className="w-3 h-3" /> 定义内容
                        </span>
                        <pre className="text-[10px] bg-cream/50 rounded-lg px-2.5 py-2 font-mono text-ink-light max-h-32 overflow-auto">
                          {JSON.stringify(skill.content, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 创建技能对话框 */}
      {showCreateModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowCreateModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-border w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-5">
                <h3 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber" />
                  新建测试技能
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-ink-light mb-1 block">名称 *</label>
                    <input className="w-full h-9 px-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-amber/30" placeholder="技能名称" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-ink-light mb-1 block">描述</label>
                    <textarea className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-amber/30 resize-none" rows={2} placeholder="技能描述" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] font-medium text-ink-light mb-1 block">分类</label>
                      <select className="w-full h-9 px-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-amber/30" value={createForm.category} onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}>
                        <option value="selector">选择器</option>
                        <option value="assertion">断言</option>
                        <option value="scenario">场景模板</option>
                        <option value="general">通用</option>
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="text-[11px] font-medium text-ink-light mb-1 block">版本</label>
                      <input className="w-full h-9 px-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-amber/30" value={createForm.version} onChange={(e) => setCreateForm({ ...createForm, version: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-ink-light mb-1 block">内容 (JSON)</label>
                    <textarea className="w-full px-3 py-2 rounded-xl border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber/30 resize-none" rows={6} value={createForm.content} onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 mt-5 pt-4 border-t border-border/50">
                  <Button onClick={() => setShowCreateModal(false)} variant="outline" size="sm" className="h-9 flex-1 text-[11px]">取消</Button>
                  <Button onClick={handleCreate} size="sm" className="h-9 flex-1 text-[11px] gradient-amber text-white">创建</Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 删除确认 */}
      {deleteTarget && (
        <ConfirmDeleteModal
          open={true}
          title="删除技能"
          message="确定要删除该技能吗？"
          itemName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
