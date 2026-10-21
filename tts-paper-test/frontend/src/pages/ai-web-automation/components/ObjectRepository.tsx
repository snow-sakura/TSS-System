/**
 * ObjectRepository — 对象库（页面对象 + 元素对象管理）
 *
 * 功能:
 *  - 项目选择 → 页面对象列表（截图/URL/元素数量）
 *  - 展开页面查看/管理元素对象（AI探索自动同步 + 手动维护）
 *  - 元素 CRUD：添加、编辑、删除
 */
import { useState, useEffect, useCallback } from "react"
import { Boxes, Globe, ChevronDown, ChevronRight, Plus, Pencil, Trash2, X, RefreshCw, Component, Link2 } from "lucide-react"
import { toast } from "sonner"
import { webApi } from "@/lib/api"

interface RepoPage {
  id: number; project_id: number; url: string; title?: string;
  screenshot_path?: string; element_count?: number; created_at?: string
}

interface UIElement {
  id: number; project_id: number; page_id?: number; name: string;
  element_type?: string; locator?: string;
  locator_type?: string; backup_locators?: string[]; wait_timeout?: number; force_action?: boolean;
  attributes?: Record<string, any>; description?: string
}

/** 定位类型配色 */
const LOCATOR_TYPE_COLORS: Record<string, string> = {
  css: "bg-sky-50 text-sky-600",
  xpath: "bg-violet-50 text-violet-600",
  text: "bg-emerald-50 text-emerald-600",
  id: "bg-amber/10 text-amber",
  name: "bg-cyan-50 text-cyan-600",
  placeholder: "bg-indigo-50 text-indigo-600",
}

/** 截图URL归一化：文件名拼接 /uploads/screenshots/ 前缀 */
const shotUrl = (name?: string): string => {
  if (!name) return ""
  if (name.startsWith("/uploads/") || name.includes("/") || name.includes("\\")) return name
  return `/uploads/screenshots/${name}`
}

const ELEMENT_TYPE_COLORS: Record<string, string> = {
  input: "bg-blue-50 text-blue-600",
  button: "bg-amber/10 text-amber",
  link: "bg-purple-50 text-purple-600",
  form: "bg-emerald-50 text-emerald-600",
  select: "bg-cyan-50 text-cyan-600",
  checkbox: "bg-pink-50 text-pink-600",
  image: "bg-orange-50 text-orange-600",
}

export default function ObjectRepository() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [pages, setPages] = useState<RepoPage[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedPageId, setExpandedPageId] = useState<number | null>(null)
  const [elementsMap, setElementsMap] = useState<Record<number, UIElement[]>>({})
  const [loadingElements, setLoadingElements] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  // 元素编辑弹窗状态
  const [showEditor, setShowEditor] = useState(false)
  const [editing, setEditing] = useState<{ pageId: number; element?: UIElement } | null>(null)
  const [form, setForm] = useState({
    name: "", element_type: "element", locator: "",
    locator_type: "css", backup_locators: "", wait_timeout: 5, force_action: false,
    description: "",
  })
  const [saving, setSaving] = useState(false)

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

  const fetchRepo = useCallback(async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const res: any = await webApi.listObjectRepo(selectedProjectId)
      setPages(Array.isArray(res?.data) ? res.data : [])
    } catch {
      setPages([])
      toast.error("无法加载对象库")
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchRepo() }, [fetchRepo])

  // 展开页面 → 加载元素
  const togglePage = async (pageId: number) => {
    if (expandedPageId === pageId) {
      setExpandedPageId(null)
      return
    }
    setExpandedPageId(pageId)
    setLoadingElements(true)
    try {
      const res: any = await webApi.listPageElements(pageId)
      const items = Array.isArray(res?.data) ? res.data : []
      setElementsMap((prev) => ({ ...prev, [pageId]: items }))
    } catch {
      setElementsMap((prev) => ({ ...prev, [pageId]: [] }))
      toast.error("无法加载元素列表")
    } finally {
      setLoadingElements(false)
    }
  }

  const reloadElements = async (pageId: number) => {
    try {
      const res: any = await webApi.listPageElements(pageId)
      const items = Array.isArray(res?.data) ? res.data : []
      setElementsMap((prev) => ({ ...prev, [pageId]: items }))
    } catch {}
  }

  // 打开添加/编辑弹窗
  const openCreate = (pageId: number) => {
    setEditing({ pageId })
    setForm({ name: "", element_type: "element", locator: "", locator_type: "css", backup_locators: "", wait_timeout: 5, force_action: false, description: "" })
    setShowEditor(true)
  }
  const openEdit = (pageId: number, element: UIElement) => {
    setEditing({ pageId, element })
    setForm({
      name: element.name,
      element_type: element.element_type || "element",
      locator: element.locator || "",
      locator_type: element.locator_type || "css",
      backup_locators: Array.isArray(element.backup_locators) ? element.backup_locators.join("\n") : "",
      wait_timeout: element.wait_timeout ?? 5,
      force_action: element.force_action ?? false,
      description: element.description || "",
    })
    setShowEditor(true)
  }

  // 保存元素
  const handleSave = async () => {
    if (!editing) return
    if (!form.name.trim()) { toast.error("请输入元素名称"); return }
    const backupLocators = form.backup_locators
      .split("\n").map((s) => s.trim()).filter(Boolean)
    const payload = {
      name: form.name.trim(),
      element_type: form.element_type || "element",
      locator: form.locator.trim() || null,
      locator_type: form.locator_type || "css",
      backup_locators: backupLocators.length > 0 ? backupLocators : null,
      wait_timeout: form.wait_timeout || 5,
      force_action: form.force_action,
      description: form.description.trim() || null,
    }
    setSaving(true)
    try {
      if (editing.element) {
        await webApi.updatePageElement(editing.element.id, payload)
        toast.success("元素已更新")
      } else {
        await webApi.createPageElement(editing.pageId, payload)
        toast.success("元素已添加")
      }
      await reloadElements(editing.pageId)
      await fetchRepo()
      setShowEditor(false)
    } catch {
      toast.error(editing.element ? "更新失败" : "添加失败")
    } finally {
      setSaving(false)
    }
  }

  // 删除元素（两段确认）
  const handleDelete = async (pageId: number, elementId: number) => {
    if (confirmDeleteId !== elementId) {
      setConfirmDeleteId(elementId)
      setTimeout(() => setConfirmDeleteId((cur) => (cur === elementId ? null : cur)), 3000)
      return
    }
    setConfirmDeleteId(null)
    try {
      await webApi.deletePageElement(elementId)
      toast.success("元素已删除")
      await reloadElements(pageId)
      await fetchRepo()
    } catch {
      toast.error("删除失败")
    }
  }

  const attrSummary = (el: UIElement): string => {
    const a = el.attributes || {}
    const parts: string[] = []
    if (a.id) parts.push(`id=${a.id}`)
    if (a.placeholder) parts.push(`placeholder=${a.placeholder}`)
    if (a.href) parts.push(`href=${a.href}`)
    if (a.text) parts.push(`text=${String(a.text).slice(0, 20)}`)
    return parts.join(" · ")
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-ink flex items-center gap-2">
          对象库 <Boxes className="w-4 h-4 text-amber" />
        </h2>
        <p className="text-xs text-muted mt-0.5">页面对象与元素对象集中管理，AI探索自动同步，可手动维护供用例复用</p>
      </div>

      {/* 控制区 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-light">项目:</label>
            <select value={selectedProjectId || ""} onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
              <option value="">请选择项目</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={fetchRepo} disabled={!selectedProjectId}
            className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5 disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
          </button>
          <span className="text-[11px] text-muted">共 {pages.length} 个页面对象 · {pages.reduce((s, p) => s + (p.element_count || 0), 0)} 个元素</span>
        </div>
      </div>

      {/* 页面对象列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-12 text-muted">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-muted-light" />
            <p className="text-xs">加载中...</p>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center text-muted">
            <Boxes className="w-10 h-10 mb-2 text-muted-light" />
            <p className="text-xs">暂无页面对象，请先在「AI探索」中探索项目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pages.map((page) => {
              const expanded = expandedPageId === page.id
              const elements = elementsMap[page.id] || []
              return (
                <div key={page.id} className="bg-white rounded-2xl border border-border shadow-card overflow-hidden flex flex-col">
                  {/* 页面头部 */}
                  <button onClick={() => togglePage(page.id)} className="flex items-start gap-3 p-3 hover:bg-cream/40 transition-colors text-left">
                    <div className="flex-shrink-0 w-16 h-12 rounded-lg border border-border overflow-hidden bg-cream">
                      {shotUrl(page.screenshot_path) ? (
                        <img src={shotUrl(page.screenshot_path)} alt={page.title || page.url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Globe className="w-4 h-4 text-muted-light" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted flex-shrink-0" />}
                        <span className="text-sm font-medium text-ink truncate">{page.title || "未命名页面"}</span>
                      </div>
                      <p className="text-[11px] text-muted truncate mt-0.5">{page.url}</p>
                    </div>
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-amber/10 text-amber text-[10px] font-medium">
                      {page.element_count || 0} 元素
                    </span>
                  </button>

                  {/* 元素列表 */}
                  {expanded && (
                    <div className="border-t border-border bg-cream/20 flex-1 p-2 space-y-1.5">
                      {loadingElements && expandedPageId === page.id && elements.length === 0 ? (
                        <div className="text-center py-4 text-muted text-xs">加载元素...</div>
                      ) : elements.length === 0 ? (
                        <div className="text-center py-4 text-muted text-xs">暂无元素对象</div>
                      ) : (
                        elements.map((el) => (
                          <div key={el.id} className="bg-white rounded-xl border border-border p-2.5 flex items-start gap-2 hover:shadow-sm transition-all">
                            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium mt-0.5 ${ELEMENT_TYPE_COLORS[el.element_type || "element"] || "bg-cream text-muted"}`}>
                              {el.element_type || "element"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-ink truncate">{el.name}</p>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {el.locator_type && (
                                  <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${LOCATOR_TYPE_COLORS[el.locator_type] || "bg-cream text-muted"}`}>
                                    {el.locator_type}
                                  </span>
                                )}
                                {Array.isArray(el.backup_locators) && el.backup_locators.length > 0 && (
                                  <span className="px-1 py-0.5 rounded bg-cream text-muted text-[9px] font-medium">
                                    备用×{el.backup_locators.length}
                                  </span>
                                )}
                                {el.wait_timeout != null && el.wait_timeout !== 5 && (
                                  <span className="px-1 py-0.5 rounded bg-cream text-muted text-[9px] font-medium">
                                    超时{el.wait_timeout}s
                                  </span>
                                )}
                                {el.force_action && (
                                  <span className="px-1 py-0.5 rounded bg-fail/10 text-fail text-[9px] font-medium">
                                    强制
                                  </span>
                                )}
                              </div>
                              {el.locator && (
                                <p className="text-[10px] text-muted font-mono truncate flex items-center gap-1 mt-0.5">
                                  <Link2 className="w-2.5 h-2.5 flex-shrink-0" />{el.locator}
                                </p>
                              )}
                              {attrSummary(el) && <p className="text-[10px] text-muted truncate mt-0.5">{attrSummary(el)}</p>}
                              {el.description && <p className="text-[10px] text-muted-light truncate mt-0.5">{el.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => openEdit(page.id, el)} title="编辑"
                                className="p-1.5 rounded-lg hover:bg-cream text-ink-light hover:text-info transition-colors">
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDelete(page.id, el.id)} title={confirmDeleteId === el.id ? "再次点击确认删除" : "删除"}
                                className={`p-1.5 rounded-lg transition-colors ${confirmDeleteId === el.id ? "bg-fail/10 text-fail" : "hover:bg-cream text-ink-light hover:text-fail"}`}>
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                      <button onClick={() => openCreate(page.id)}
                        className="w-full py-1.5 rounded-xl border border-dashed border-border text-[11px] text-muted hover:text-amber hover:border-amber/40 flex items-center justify-center gap-1 transition-colors">
                        <Plus className="w-3 h-3" /> 添加元素
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 元素编辑弹窗 */}
      {showEditor && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[440px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <Component className="w-4 h-4 text-amber" />
                {editing.element ? "编辑元素对象" : "添加元素对象"}
              </h3>
              <button onClick={() => setShowEditor(false)} className="p-1.5 rounded-lg hover:bg-cream transition-colors">
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs text-ink-light mb-1 block">元素名称 <span className="text-fail">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：登录按钮"
                  className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" />
              </div>
              <div>
                <label className="text-xs text-ink-light mb-1 block">元素类型</label>
                <select value={form.element_type} onChange={(e) => setForm({ ...form, element_type: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none bg-white">
                  {["element", "input", "button", "link", "form", "select", "checkbox", "image", "text"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-light mb-1 block">定位器 (Locator)</label>
                <input value={form.locator} onChange={(e) => setForm({ ...form, locator: e.target.value })}
                  placeholder="如：#login-btn 或 button.login"
                  className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink font-mono focus:border-amber outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-light mb-1 block">定位策略</label>
                  <select value={form.locator_type} onChange={(e) => setForm({ ...form, locator_type: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none bg-white">
                    {["css", "xpath", "text", "id", "name", "placeholder"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-ink-light mb-1 block">等待超时 (秒)</label>
                  <input type="number" min={1} max={60} value={form.wait_timeout}
                    onChange={(e) => setForm({ ...form, wait_timeout: Number(e.target.value) || 5 })}
                    className="w-full h-9 px-3 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-light mb-1 block">备用定位器 (每行一个，主定位器失效时依次回退)</label>
                <textarea value={form.backup_locators} onChange={(e) => setForm({ ...form, backup_locators: e.target.value })}
                  placeholder={"如：//input[@id='username']\n[name='user-name']"}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink font-mono focus:border-amber outline-none resize-none" />
              </div>
              <label className="flex items-center gap-2 text-xs text-ink-light cursor-pointer select-none">
                <input type="checkbox" checked={form.force_action} onChange={(e) => setForm({ ...form, force_action: e.target.checked })}
                  className="w-4 h-4 rounded border-border accent-amber" />
                强制操作（元素被遮挡/不可交互时强制点击/输入）
              </label>
              <div>
                <label className="text-xs text-ink-light mb-1 block">描述</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="用途说明（可选）" rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm text-ink focus:border-amber outline-none resize-none" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowEditor(false)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream transition-colors">
                取消
              </button>
              <button onClick={handleSave} disabled={saving}
                className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {editing.element ? "保存修改" : "添加元素"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}