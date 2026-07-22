import { useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { findModule } from "@/lib/modules"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FlaskConical, ChevronRight, ChevronDown, ArrowLeft, Plus, Search, Edit, Trash2, Eye, X, AlertTriangle, Download, FileText, Target, ClipboardList, Globe, Play, Bug, BarChart3, BookOpen, Server, Brain, MessageSquare, Wand2, Webhook, Puzzle, Key, ScrollText, Users, Shield, Settings, CheckCircle, Bell, Clock } from "lucide-react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { useModuleData } from "@/hooks/useModuleData"
import ReactMarkdown from "react-markdown"

const iconMap: Record<string, React.ComponentType<any>> = { FileText, Target, ClipboardList, FlaskConical, Globe, Play, Bug, BarChart3, BookOpen, Server, Brain, MessageSquare, Wand2, Webhook, Puzzle, Key, ScrollText, Users, Shield, Settings, CheckCircle }

interface ColDef { key: string; label: string; type?: "text" | "select" | "textarea" | "date"; options?: string[] }
const columnsByMenu: Record<string, ColDef[]> = {
  "req-list": [{ key: "name", label: "需求名称" }, { key: "status", label: "状态", type: "select", options: ["草稿","已分析","已评审","已批准"] }, { key: "priority", label: "优先级", type: "select", options: ["P0","P1","P2","P3"] }, { key: "deadline", label: "截止日期", type: "date" }],
  "tc-list": [{ key: "name", label: "用例名称" }, { key: "status", label: "状态", type: "select", options: ["草稿","已确认","已审核"] }, { key: "priority", label: "优先级", type: "select", options: ["P0","P1","P2","P3"] }, { key: "deadline", label: "截止日期", type: "date" }],
  "tp-list": [{ key: "name", label: "测试点名称" }, { key: "status", label: "状态", type: "select", options: ["草稿","激活","已覆盖"] }, { key: "priority", label: "优先级", type: "select", options: ["P0","P1","P2","P3"] }],
  "tpl-list": [{ key: "name", label: "方案名称" }, { key: "status", label: "状态", type: "select", options: ["草稿","进行中","已完成"] }, { key: "priority", label: "优先级", type: "select", options: ["P0","P1","P2","P3"] }],
  "ex-list": [{ key: "name", label: "执行名称" }, { key: "status", label: "状态", type: "select", options: ["待执行","执行中","已完成","失败"] }, { key: "priority", label: "优先级", type: "select", options: ["P0","P1","P2","P3"] }],
  "wa-list": [{ key: "name", label: "项目名称" }, { key: "url", label: "目标URL" }, { key: "status", label: "状态", type: "select", options: ["空闲","探索中","已完成"] }],
  "env-list": [{ key: "name", label: "环境名称" }, { key: "url", label: "环境地址" }, { key: "status", label: "状态", type: "select", options: ["在线","离线"] }],
  "llm-list": [{ key: "name", label: "提供商" }, { key: "model", label: "模型" }, { key: "status", label: "状态", type: "select", options: ["已启用","未启用"] }],
  "usr-list": [{ key: "name", label: "用户名" }, { key: "email", label: "邮箱" }, { key: "role", label: "角色", type: "select", options: ["管理员","测试员","查看者"] }, { key: "status", label: "状态", type: "select", options: ["启用","禁用"] }],
  "role-list": [{ key: "name", label: "角色名" }, { key: "desc", label: "描述" }],
  "df-list": [{ key: "name", label: "缺陷标题" }, { key: "status", label: "状态", type: "select", options: ["新建","已确认","处理中","已解决","已关闭"] }, { key: "priority", label: "优先级", type: "select", options: ["紧急","高","中","低"] }, { key: "deadline", label: "截止日期", type: "date" }],
  "mcp-list": [{ key: "name", label: "服务名称" }, { key: "url", label: "服务地址" }, { key: "status", label: "状态", type: "select", options: ["在线","离线","错误"] }],
  "sk-list": [{ key: "name", label: "技能名称" }, { key: "status", label: "状态", type: "select", options: ["已启用","未启用"] }],
  "rp-list": [{ key: "name", label: "报告名称" }, { key: "status", label: "状态", type: "select", options: ["草稿","已发布"] }, { key: "deadline", label: "截止日期", type: "date" }],
  "kb-list": [{ key: "name", label: "知识名称" }, { key: "status", label: "状态", type: "select", options: ["草稿","已发布"] }],
  "pr-list": [{ key: "name", label: "模板名称" }, { key: "status", label: "状态", type: "select", options: ["草稿","已发布"] }],
  "deai-list": [{ key: "name", label: "策略名称" }, { key: "status", label: "状态", type: "select", options: ["启用","禁用"] }],
  "hm-list": [{ key: "name", label: "渠道名称" }, { key: "status", label: "状态", type: "select", options: ["在线","离线"] }],
  "log-list": [{ key: "name", label: "操作内容" }, { key: "status", label: "结果", type: "select", options: ["成功","失败"] }],
}
const defaultData: Record<string, any[]> = {
  "req-list": [{ id: 1, name: "用户登录功能需求", status: "已分析", priority: "P0", deadline: "2026-07-25" }, { id: 2, name: "商品搜索功能需求", status: "草稿", priority: "P1", deadline: "2026-07-20" }, { id: 3, name: "购物车管理需求", status: "已评审", priority: "P1", deadline: "2026-07-30" }, { id: 4, name: "订单支付流程需求", status: "已分析", priority: "P0", deadline: "2026-07-22" }],
  "tc-list": [{ id: 1, name: "TC01-登录成功验证", status: "已确认", priority: "P0", ai: true, deadline: "2026-07-25" }, { id: 2, name: "TC02-登录失败提示", status: "草稿", priority: "P1", ai: true, deadline: "2026-07-20" }, { id: 3, name: "TC03-搜索功能验证", status: "已审核", priority: "P1", ai: false, deadline: "2026-07-28" }, { id: 4, name: "TC04-购物车操作", status: "草稿", priority: "P2", ai: true, deadline: "2026-07-30" }, { id: 5, name: "TC05-支付流程验证", status: "已确认", priority: "P0", ai: true, deadline: "2026-07-22" }],
  "tp-list": [{ id: 1, name: "登录模块测试点", status: "激活", priority: "P0" }, { id: 2, name: "搜索模块测试点", status: "已覆盖", priority: "P1" }, { id: 3, name: "购物车测试点", status: "草稿", priority: "P1" }, { id: 4, name: "支付模块测试点", status: "激活", priority: "P0" }],
  "tpl-list": [{ id: 1, name: "登录模块测试方案", status: "已完成", priority: "P0" }, { id: 2, name: "搜索模块测试方案", status: "进行中", priority: "P1" }, { id: 3, name: "购物车测试方案", status: "草稿", priority: "P1" }],
  "ex-list": [{ id: 1, name: "回归测试-第1轮", status: "已完成", priority: "P0" }, { id: 2, name: "回归测试-第2轮", status: "执行中", priority: "P1" }, { id: 3, name: "冒烟测试", status: "待执行", priority: "P0" }],
  "wa-list": [{ id: 1, name: "example.com 探索", url: "https://example.com", status: "已完成" }, { id: 2, name: "demo-site 测试", url: "https://demo.testsite.com", status: "探索中" }, { id: 3, name: "官网测试", url: "https://www.testsite.com", status: "空闲" }],
  "env-list": [{ id: 1, name: "开发环境", url: "http://dev.example.com", status: "在线" }, { id: 2, name: "测试环境", url: "http://test.example.com", status: "在线" }, { id: 3, name: "预发布环境", url: "http://staging.example.com", status: "离线" }],
  "llm-list": [{ id: 1, name: "OpenAI", model: "GPT-4o", status: "已启用" }, { id: 2, name: "阿里云", model: "Qwen3.7-plus", status: "已启用" }, { id: 3, name: "DeepSeek", model: "DeepSeek-V3", status: "未启用" }],
  "usr-list": [{ id: 1, name: "admin", email: "admin@tss.local", role: "管理员", status: "启用" }, { id: 2, name: "testuser", email: "test@tss.local", role: "测试员", status: "启用" }, { id: 3, name: "viewer", email: "view@tss.local", role: "查看者", status: "禁用" }],
  "role-list": [{ id: 1, name: "admin", desc: "系统管理员" }, { id: 2, name: "user", desc: "普通用户" }, { id: 3, name: "viewer", desc: "只读查看者" }],
  "df-list": [{ id: 1, name: "登录页面白屏", status: "新建", priority: "紧急", deadline: "2026-07-20" }, { id: 2, name: "搜索结果排序错误", status: "处理中", priority: "中", deadline: "2026-07-25" }, { id: 3, name: "购物车数量异常", status: "已解决", priority: "高", deadline: "2026-07-18" }],
  "mcp-list": [{ id: 1, name: "Playwright Server", url: "http://localhost:3000", status: "在线" }, { id: 2, name: "ChromaDB", url: "http://localhost:8000", status: "离线" }],
  "sk-list": [{ id: 1, name: "web-explorer", desc: "网页自动探索", status: "已启用" }, { id: 2, name: "test-generator", desc: "测试用例生成", status: "已启用" }, { id: 3, name: "defect-analyzer", desc: "缺陷分析", status: "未启用" }],
  "rp-list": [{ id: 1, name: "v2.1.0质量报告", status: "已发布", deadline: "2026-07-25" }, { id: 2, name: "回归测试报告", status: "草稿", deadline: "2026-07-30" }],
  "kb-list": [{ id: 1, name: "登录模块测试模式", status: "已发布" }, { id: 2, name: "常见Bug知识库", status: "已发布" }],
  "pr-list": [{ id: 1, name: "功能测试模板", status: "已发布" }, { id: 2, name: "接口测试模板", status: "草稿" }],
  "deai-list": [{ id: 1, name: "正式风格策略", status: "启用" }, { id: 2, name: "技术文档策略", status: "启用" }],
  "hm-list": [{ id: 1, name: "飞书通知", status: "在线" }, { id: 2, name: "钉钉通知", status: "离线" }],
  "log-list": [{ id: 1, name: "用户登录操作", status: "成功" }, { id: 2, name: "创建需求操作", status: "成功" }, { id: 3, name: "删除用例操作", status: "失败" }],
}
const statusColors: Record<string, string> = {
  "已分析": "bg-pass/10 text-pass border border-pass/20", "已评审": "bg-info/10 text-info border border-info/20",
  "已确认": "bg-pass/10 text-pass border border-pass/20", "已审核": "bg-info/10 text-info border border-info/20",
  "已批准": "bg-pass/10 text-pass border border-pass/20", "草稿": "bg-cream text-muted border border-border",
  "已完成": "bg-pass/10 text-pass border border-pass/20", "探索中": "bg-amber-light text-amber-hover border border-amber/20",
  "在线": "bg-pass/10 text-pass border border-pass/20", "离线": "bg-cream text-muted border border-border",
  "启用": "bg-pass/10 text-pass border border-pass/20", "已启用": "bg-pass/10 text-pass border border-pass/20",
  "未启用": "bg-cream text-muted border border-border", "禁用": "bg-fail/10 text-fail border border-fail/20",
  "新建": "bg-amber-light text-warn border border-amber/20", "处理中": "bg-info/10 text-info border border-info/20",
  "已解决": "bg-pass/10 text-pass border border-pass/20", "已关闭": "bg-cream text-muted border border-border",
  "失败": "bg-fail/10 text-fail border border-fail/20", "错误": "bg-fail/10 text-fail border border-fail/20",
}

export default function ModulePage() {
  const { moduleKey } = useParams<{ moduleKey: string }>()
  const navigate = useNavigate()
  const mod = findModule(moduleKey || "")
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})
  const [activeMenu, setActiveMenu] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [filters, setFilters] = useState<Record<string, string>>({})
  const { data, create: createItem, update: updateItem, remove: removeItem, batchRemove } = useModuleData("")
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingRow, setEditingRow] = useState<any>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingRow, setDeletingRow] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpToPage, setJumpToPage] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({})
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [previewItem, setPreviewItem] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)

  if (!mod) return <div className="min-h-screen bg-paper flex items-center justify-center"><div className="text-center"><p className="text-lg font-medium text-ink">模块不存在</p><Button onClick={() => navigate("/")} className="mt-4 gradient-amber text-white">返回首页</Button></div></div>
  if (!activeMenu && mod.menus[0]?.children[0]) setActiveMenu(mod.menus[0].children[0].key)
  const toggleMenu = (key: string) => setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }))
  const currentData = useMemo(() => {
    let raw = data[activeMenu] || []
    // 搜索过滤
    if (searchTerm) raw = raw.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(searchTerm.toLowerCase())))
    // 筛选过滤
    Object.entries(filters).forEach(([key, val]) => { if (val) raw = raw.filter((row) => String(row[key]) === val) })
    // 排序
    if (sortConfig) {
      raw = [...raw].sort((a, b) => {
        const aVal = a[sortConfig.key] || ""
        const bVal = b[sortConfig.key] || ""
        // 优先级特殊排序
        if (sortConfig.key === "priority") {
          const priorityOrder: Record<string, number> = { "P0": 0, "紧急": 0, "P1": 1, "高": 1, "P2": 2, "中": 2, "P3": 3, "低": 3 }
          const aNum = priorityOrder[aVal] ?? 99
          const bNum = priorityOrder[bVal] ?? 99
          return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum
        }
        // 其他字段通用排序
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
    }
    return raw
  }, [data, activeMenu, searchTerm, filters, sortConfig])
  const totalPages = Math.max(1, Math.ceil(currentData.length / pageSize))
  const pagedData = currentData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const cols = columnsByMenu[activeMenu] || [{ key: "name", label: "名称" }]
  let activeTitle = ""; for (const menu of mod.menus) for (const child of menu.children) if (child.key === activeMenu) activeTitle = child.label
  const MenuIcon = iconMap[mod.icon] || FileText

  const openCreate = () => { setDialogMode("create"); setEditingRow(null); const init: Record<string, string> = {}; cols.forEach((c) => { init[c.key] = "" }); setFormData(init); setFormErrors({}); setFormTouched({}); setShowDialog(true) }
  const openEdit = (row: any) => { setDialogMode("edit"); setEditingRow(row); const init: Record<string, string> = {}; cols.forEach((c) => { init[c.key] = String(row[c.key] || "") }); setFormData(init); setFormErrors({}); setFormTouched({}); setShowDialog(true) }
  const openView = (row: any) => { setDialogMode("view"); setEditingRow(row); const init: Record<string, string> = {}; cols.forEach((c) => { init[c.key] = String(row[c.key] || "") }); setFormData(init); setShowDialog(true) }

  // 表单验证
  const validateField = (key: string, value: string): string => {
    const col = cols.find((c) => c.key === key)
    if (!col) return ""
    if (!value || value.trim() === "") {
      if (col.key === "name" || col.key === "url" || col.key === "email" || col.type === "select") return `${col.label}不能为空`
    }
    if (col.key === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "请输入有效的邮箱地址"
    if (col.key === "url" && value && !/^https?:\/\/.+\..+/.test(value)) return "请输入有效的URL地址"
    if (value && value.length > 200) return `${col.label}不能超过200个字符`
    return ""
  }
  const validateForm = (): boolean => { const errors: Record<string, string> = {}; cols.forEach((col) => { const error = validateField(col.key, formData[col.key] || ""); if (error) errors[col.key] = error }); setFormErrors(errors); return Object.keys(errors).length === 0 }
  const handleFieldChange = (key: string, value: string) => { setFormData({ ...formData, [key]: value }); setFormTouched({ ...formTouched, [key]: true }); if (formTouched[key] || value) { const error = validateField(key, value); setFormErrors({ ...formErrors, [key]: error }) } }

  // 排序切换
  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" }
        return null // 第三次点击取消排序
      }
      return { key, direction: "asc" }
    })
  }

  const handleSave = () => {
    if (!validateForm()) return
    if (dialogMode === "create") createItem(activeMenu, formData)
    else if (dialogMode === "edit" && editingRow) updateItem(activeMenu, editingRow.id, formData)
    setShowDialog(false)
  }
  const confirmDelete = (row: any) => { setDeletingRow(row); setShowDeleteConfirm(true) }
  const handleDelete = () => { if (!deletingRow) return; removeItem(activeMenu, deletingRow.id); setSelectedIds((prev) => { const n = new Set(prev); n.delete(deletingRow.id); return n }); setShowDeleteConfirm(false); setDeletingRow(null) }
  const toggleSelect = (id: number) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleSelectAll = () => { const pageIds = pagedData.map((r) => r.id); const allSelected = pageIds.every((id) => selectedIds.has(id)); if (allSelected) setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.delete(id)); return n }); else setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.add(id)); return n }) }
  const handleBatchDelete = () => { batchRemove(activeMenu, selectedIds); setSelectedIds(new Set()); setShowBatchDeleteConfirm(false) }
  const exportToExcel = () => { const exportData = selectedIds.size > 0 ? currentData.filter((r) => selectedIds.has(r.id)) : currentData; const headers = ["ID", ...cols.map((c) => c.label)]; const rows = exportData.map((row) => [row.id, ...cols.map((c) => row[c.key] || "")]); const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, activeTitle || "Sheet1"); XLSX.writeFile(wb, `${activeTitle || "export"}_${new Date().toISOString().slice(0, 10)}.xlsx`) }
  const exportToPDF = () => { const exportData = selectedIds.size > 0 ? currentData.filter((r) => selectedIds.has(r.id)) : currentData; const doc = new jsPDF({ orientation: cols.length > 4 ? "landscape" : "portrait" }); doc.setFontSize(16); doc.text(activeTitle || "Export", 14, 20); doc.setFontSize(10); doc.setTextColor(128); doc.text(`Exported: ${new Date().toLocaleDateString("zh-CN")}  Total: ${exportData.length}`, 14, 28); const headers = ["ID", ...cols.map((c) => c.label)]; const rows = exportData.map((row) => [String(row.id), ...cols.map((c) => String(row[c.key] || ""))]); autoTable(doc, { startY: 34, head: [headers], body: rows, styles: { fontSize: 9 }, headStyles: { fillColor: [212, 165, 116] } }); doc.save(`${activeTitle || "export"}_${new Date().toISOString().slice(0, 10)}.pdf`) }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* 顶部栏 */}
      <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group">
            <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
            <span className="text-xs font-medium text-ink-light group-hover:text-ink transition-colors hidden sm:block">返回</span>
          </button>
          <div className="h-8 w-px bg-border/60" />
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-cream transition-colors lg:hidden"><svg className="w-4 h-4 text-ink-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center shadow-md`}><MenuIcon className="w-4.5 h-4.5 text-white" /></div>
          <div className="min-w-0"><h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{mod.title}</h1><p className="text-[11px] text-muted truncate">{mod.desc}</p></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-ink-light">{activeTitle && <span>当前: {activeTitle}</span>}</div>
          {/* 通知铃铛 */}
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 rounded-lg hover:bg-cream transition-colors relative">
              <Bell className="w-5 h-5 text-ink-light" />
              {(currentData.filter((r) => r.status === "草稿").length + currentData.filter((r) => r.deadline && new Date(r.deadline) < new Date()).length + currentData.filter((r) => r.deadline && (new Date(r.deadline).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000 && new Date(r.deadline) >= new Date()).length) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-fail text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {currentData.filter((r) => r.status === "草稿").length + currentData.filter((r) => r.deadline && new Date(r.deadline as string) < new Date()).length + currentData.filter((r) => r.deadline && (new Date(r.deadline as string).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000 && new Date(r.deadline as string) >= new Date()).length}
                </span>
              )}
            </button>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-border rounded-2xl shadow-elevated z-50 animate-fade-in-up">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-ink">提醒事项</h3>
                    <p className="text-xs text-ink-light mt-0.5">
                      {currentData.filter((r) => r.status === "草稿").length + currentData.filter((r) => r.deadline && new Date(r.deadline) < new Date()).length + currentData.filter((r) => r.deadline && (new Date(r.deadline).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000 && new Date(r.deadline) >= new Date()).length} 条待处理
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {/* 截止日期已过 */}
                    {currentData.filter((r) => r.deadline && new Date(r.deadline) < new Date()).map((row) => (
                      <div key={`overdue-${row.id}`} onClick={() => { setShowNotifications(false); navigate(`/${moduleKey}/detail/${row.id}`) }} className="px-4 py-3 hover:bg-cream/50 cursor-pointer border-b border-border/50 transition-colors">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-fail mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{row.name}</p>
                            <p className="text-xs text-fail">截止日期已过: {row.deadline}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* 即将到期 */}
                    {currentData.filter((r) => r.deadline && (new Date(r.deadline).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000 && new Date(r.deadline) >= new Date()).map((row) => (
                      <div key={`soon-${row.id}`} onClick={() => { setShowNotifications(false); navigate(`/${moduleKey}/detail/${row.id}`) }} className="px-4 py-3 hover:bg-cream/50 cursor-pointer border-b border-border/50 transition-colors">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-amber mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{row.name}</p>
                            <p className="text-xs text-amber">即将到期: {row.deadline}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* 草稿状态 */}
                    {currentData.filter((r) => r.status === "草稿").map((row) => (
                      <div key={`draft-${row.id}`} onClick={() => { setShowNotifications(false); navigate(`/${moduleKey}/detail/${row.id}`) }} className="px-4 py-3 hover:bg-cream/50 cursor-pointer border-b border-border/50 last:border-0 transition-colors">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{row.name}</p>
                            <p className="text-xs text-info">状态: 草稿，需要审核</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {currentData.filter((r) => r.status === "草稿").length === 0 &&
                     currentData.filter((r) => r.deadline && new Date(r.deadline) < new Date()).length === 0 &&
                     currentData.filter((r) => r.deadline && (new Date(r.deadline).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000 && new Date(r.deadline) >= new Date()).length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-ink-light">暂无提醒</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {/* 移动端遮罩 */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧菜单 */}
        <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:relative z-40 lg:z-auto w-[260px] lg:w-[220px] h-full bg-paper border-r border-border flex-shrink-0 overflow-y-auto transition-transform duration-300`}>
          <div className="p-3 space-y-2">
            {mod.menus.map((menu) => { const MIcon = iconMap[menu.icon] || FileText; const isOpen = openMenus[menu.key] !== false; return (
              <div key={menu.key} className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
                <button onClick={() => toggleMenu(menu.key)} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-ink hover:bg-cream transition-colors font-semibold">
                  <MIcon className="w-4 h-4 flex-shrink-0 text-amber" /><span className="flex-1 text-left truncate">{menu.label}</span>
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-muted" />}
                </button>
                {isOpen && <div className="px-3 pb-3 space-y-1">{menu.children.map((child) => (
                  <button key={child.key} onClick={() => {
                    if (child.key === "rt-records-list") {
                      navigate("/ai-automation")
                    } else {
                      setActiveMenu(child.key); setCurrentPage(1); setSearchTerm(""); setFilters({})
                    }
                  }}
                    className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors ${activeMenu === child.key ? "bg-amber-light text-amber font-semibold shadow-sm" : "text-ink-light hover:text-ink hover:bg-cream font-medium"}`}>{child.label}</button>
                ))}</div>}
              </div>
            )})}
          </div>
        </aside>
        {/* 右侧内容区 */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-5 gap-3">
            <div className="flex items-center gap-3"><h2 className="text-lg font-semibold text-ink">{activeTitle || "内容"}</h2><span className="text-xs text-ink-light bg-cream px-2 py-1 rounded-md">{currentData.length} 条</span></div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><Input placeholder="搜索..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }} className="w-40 sm:w-56 h-9 pl-9 text-sm bg-white border-border focus:border-amber" /></div>
              <div className="relative group hidden sm:block">
                <Button variant="outline" className="h-9 border-border text-ink-light text-sm hover:bg-cream"><Download className="w-4 h-4 mr-1" /> 导出</Button>
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-border rounded-xl shadow-elevated opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button onClick={exportToExcel} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-light hover:bg-cream rounded-t-xl transition-colors"><svg className="w-4 h-4 text-pass" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>导出 Excel</button>
                  <button onClick={exportToPDF} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-light hover:bg-cream rounded-b-xl transition-colors"><svg className="w-4 h-4 text-fail" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>导出 PDF</button>
                </div>
              </div>
              <Button className="h-9 gradient-amber text-white text-sm shadow-sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> 新建</Button>
            </div>
          </div>
          {/* 筛选栏 */}
          {cols.filter((c) => c.type === "select" && c.options).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4 bg-white px-3 md:px-4 py-2.5 md:py-3 rounded-2xl border border-border shadow-card">
              {cols.filter((c) => c.type === "select" && c.options).map((col) => (
                <div key={col.key} className="flex items-center gap-2">
                  <label className="text-xs text-ink-light">{col.label}:</label>
                  <select value={filters[col.key] || ""} onChange={(e) => { setFilters({ ...filters, [col.key]: e.target.value }); setCurrentPage(1) }}
                    className="h-8 px-2 pr-6 text-xs rounded-lg bg-white border border-border text-ink-light focus:border-amber focus:outline-none appearance-none cursor-pointer shadow-sm"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239C8E82' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: "right 4px center", backgroundRepeat: "no-repeat", backgroundSize: "14px" }}>
                    <option value="">全部</option>{col.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select>
                </div>
              ))}
              {Object.values(filters).some((v) => v) && <button onClick={() => { setFilters({}); setCurrentPage(1) }} className="text-xs text-amber hover:text-amber-hover flex items-center gap-1 font-medium"><X className="w-3 h-3" /> 清除筛选</button>}
              {Object.values(filters).some((v) => v) && <span className="text-xs text-ink-light">筛选中 · {currentData.length} 条结果</span>}
            </div>
          )}
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-500" /></div>
                <div>
                  <p className="text-xs text-ink-light">总计</p>
                  <p className="text-xl font-bold text-ink">{data[activeMenu]?.length || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Clock className="w-5 h-5 text-amber" /></div>
                <div>
                  <p className="text-xs text-ink-light">草稿</p>
                  <p className="text-xl font-bold text-ink">{data[activeMenu]?.filter((r) => r.status === "草稿").length || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-pass" /></div>
                <div>
                  <p className="text-xs text-ink-light">已完成</p>
                  <p className="text-xl font-bold text-ink">{data[activeMenu]?.filter((r) => r.status === "已分析" || r.status === "已评审" || r.status === "已确认").length || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-fail" /></div>
                <div>
                  <p className="text-xs text-ink-light">即将到期</p>
                  <p className="text-xl font-bold text-ink">{data[activeMenu]?.filter((r) => r.deadline && (new Date(r.deadline).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000 && new Date(r.deadline) >= new Date()).length || 0}</p>
                </div>
              </div>
            </div>
          </div>
          {/* 图表可视化 */}
          {data[activeMenu] && data[activeMenu].length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* 状态分布饼图 */}
              <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                <h3 className="text-sm font-semibold text-ink mb-3">状态分布</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(
                        data[activeMenu].reduce((acc: Record<string, number>, r: any) => {
                          acc[r.status] = (acc[r.status] || 0) + 1
                          return acc
                        }, {})
                      ).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {Object.entries(
                        data[activeMenu].reduce((acc: Record<string, number>, r: any) => {
                          acc[r.status] = (acc[r.status] || 0) + 1
                          return acc
                        }, {})
                      ).map(([_, __], index) => (
                        <Cell key={`cell-${index}`} fill={["#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EF4444"][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* 优先级分布柱状图 */}
              <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                <h3 className="text-sm font-semibold text-ink mb-3">优先级分布</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={Object.entries(
                      data[activeMenu].reduce((acc: Record<string, number>, r: any) => {
                        acc[r.priority] = (acc[r.priority] || 0) + 1
                        return acc
                      }, {})
                    ).map(([name, value]) => ({ name, value }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6B5B4F" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#6B5B4F" }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#D4A574" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {/* 批量操作栏 */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between mb-4 px-4 py-3 bg-amber-light border border-amber/20 rounded-2xl shadow-card animate-fade-in-up">
              <div className="flex items-center gap-3"><span className="text-sm text-amber">已选择 <span className="font-semibold text-ink">{selectedIds.size}</span> 条</span><button onClick={() => setSelectedIds(new Set())} className="text-xs text-ink-light hover:text-ink">取消选择</button></div>
              <Button onClick={() => setShowBatchDeleteConfirm(true)} className="h-8 px-3 bg-fail-light text-fail border border-fail/20 text-xs hover:bg-fail/10"><Trash2 className="w-3.5 h-3.5 mr-1" /> 批量删除</Button>
            </div>
          )}
          {/* 数据表格 */}
          {pagedData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col items-center justify-center py-20"><div className="w-16 h-16 rounded-2xl bg-cream flex items-center justify-center mb-4"><FileText className="w-8 h-8 text-ink-light" /></div><p className="text-sm font-medium text-ink">{searchTerm ? "没有匹配的数据" : "暂无数据"}</p><p className="text-xs mt-1 text-ink-light">点击"新建"按钮添加数据</p></div>
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-cream/50">
                  <th className="px-4 py-3 w-10"><input type="checkbox" checked={pagedData.length > 0 && pagedData.every((r) => selectedIds.has(r.id))} onChange={toggleSelectAll} className="w-4 h-4 rounded border-border text-amber focus:ring-amber cursor-pointer" /></th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-ink-light uppercase tracking-wider w-16">ID</th>
                  {cols.map((c) => <th key={c.key} className="text-center px-5 py-3 text-xs font-semibold text-ink-light uppercase tracking-wider">
                    <button onClick={() => handleSort(c.key)} className="flex items-center gap-1 hover:text-ink transition-colors">
                      {c.label}
                      <span className="text-[10px]">
                        {sortConfig?.key === c.key ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  </th>)}
                  <th className="text-right px-5 py-3 text-xs font-semibold text-ink-light uppercase tracking-wider w-28">操作</th>
                </tr></thead>
                <tbody>
                  {pagedData.map((row: any) => (
                    <tr key={row.id} onClick={(e) => { e.stopPropagation(); setPreviewItem(row); setShowPreview(true) }} className={`border-b border-border/50 last:border-0 transition-colors cursor-pointer ${selectedIds.has(row.id) ? "bg-amber-light/50" : "hover:bg-cream/50"}`}>
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(row.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(row.id) }} className="w-4 h-4 rounded border-border text-amber focus:ring-amber cursor-pointer" /></td>
                      <td className="px-5 py-3.5 text-sm text-ink-light text-center">{row.id}</td>
                      {cols.map((c) => { const val = row[c.key]; const truncated = val && String(val).length > 10 ? String(val).slice(0, 10) + "..." : val; if (c.key === "status" && val) return <td key={c.key} className="px-3 md:px-5 py-3.5 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[val] || "bg-gray-100 text-gray-600 border border-gray-200"}`}>{val}</span></td>; if (c.key === "priority" && val) { const cls = val === "P0" || val === "紧急" ? "text-fail" : val === "P1" || val === "高" ? "text-amber" : "text-muted"; return <td key={c.key} className="px-5 py-3.5 text-center"><span className={`text-xs font-semibold ${cls}`}>{val}</span></td> }; if (c.key === "deadline" && val) { const isPast = new Date(val as string) < new Date(); const isSoon = (new Date(val as string).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000 && new Date(val as string) >= new Date(); return <td key={c.key} className="px-3 md:px-5 py-3.5 text-center"><span className={`inline-flex items-center gap-1 text-xs ${isPast ? "text-fail font-semibold" : isSoon ? "text-amber font-medium" : "text-ink-light"}`}><Clock className="w-3 h-3" />{val as string}</span></td> }; if (c.key === "name") return <td key={c.key} className="px-3 md:px-5 py-3.5 text-center"><div className="flex items-center justify-center gap-2 min-w-0"><span className="text-sm font-medium text-ink truncate max-w-[200px]" title={String(val)}>{truncated}</span>{row.ai && <span className="ai-badge flex-shrink-0">AI</span>}</div>{row.url && <p className="text-xs text-muted mt-0.5 truncate max-w-[200px]" title={row.url}>{row.url}</p>}{row.email && <p className="text-xs text-muted mt-0.5 truncate max-w-[200px]" title={row.email}>{row.email}</p>}</td>; return <td key={c.key} className="px-5 py-3.5 text-sm text-ink-light text-center truncate max-w-[150px]" title={String(val || "")}>{truncated || "-"}</td> })}
                      <td className="px-5 py-3.5 text-center"><div className="flex items-center justify-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setPreviewItem(row); setShowPreview(true) }} className="p-1.5 rounded-md hover:bg-cream transition-colors" title="预览"><Eye className="w-4 h-4 text-ink-light" /></button>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-1.5 rounded-md hover:bg-cream transition-colors" title="编辑"><Edit className="w-4 h-4 text-ink-light" /></button>
                        <button onClick={(e) => { e.stopPropagation(); confirmDelete(row) }} className="p-1.5 rounded-md hover:bg-fail-light transition-colors" title="删除"><Trash2 className="w-4 h-4 text-fail" /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* 分页 */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 md:px-5 py-3 border-t border-border bg-cream/30 gap-3">
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <span className="text-xs text-ink-light">共 {currentData.length} 条</span>
                  <div className="flex items-center gap-1.5"><span className="text-xs text-ink-light hidden sm:inline">每页</span>
                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }} className="h-7 px-2 text-xs rounded-lg bg-white border border-border text-ink focus:border-amber focus:outline-none shadow-sm"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select>
                    <span className="text-xs text-ink-light">条</span></div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center">
                  <div className="flex items-center gap-1.5"><span className="text-xs text-ink-light hidden sm:inline">跳至</span>
                    <input type="number" min={1} max={totalPages} value={jumpToPage} onChange={(e) => setJumpToPage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { const p = parseInt(jumpToPage); if (p >= 1 && p <= totalPages) { setCurrentPage(p); setJumpToPage("") } } }}
                      className="w-12 md:w-14 h-7 px-1 md:px-2 text-xs rounded-lg bg-white border border-border text-ink text-center focus:border-amber focus:outline-none shadow-sm" />
                    <span className="text-xs text-ink-light">页</span></div>
                  <div className="flex items-center gap-0.5 md:gap-1">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage <= 1} className="px-1.5 md:px-2 py-1 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40 shadow-sm hidden sm:block">«</button>
                    <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-2 py-1 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40 shadow-sm">‹</button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => { let page: number; if (totalPages <= 5) page = i + 1; else if (currentPage <= 3) page = i + 1; else if (currentPage >= totalPages - 2) page = totalPages - 4 + i; else page = currentPage - 2 + i; return <button key={page} onClick={() => setCurrentPage(page)} className={`px-2 md:px-2.5 py-1 text-xs rounded-lg shadow-sm ${page === currentPage ? "gradient-amber text-white" : "border border-border text-ink-light hover:bg-cream"}`}>{page}</button> })}
                    <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-2 py-1 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40 shadow-sm">›</button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} className="px-1.5 md:px-2 py-1 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40 shadow-sm hidden sm:block">»</button>
                  </div>
                  <span className="text-xs text-ink-light">{currentPage}/{totalPages}页</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      {/* 新建/编辑弹窗 */}
      {showDialog && <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowDialog(false)} />
        <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-lg mx-4 animate-fade-in-up">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border"><h3 className="text-base font-semibold text-ink">{dialogMode === "create" ? "新建" : dialogMode === "edit" ? "编辑" : "查看详情"} - {activeTitle}</h3><button onClick={() => setShowDialog(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button></div>
          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {cols.map((col) => (<div key={col.key} className="space-y-1.5">
              <label className="text-sm font-medium text-ink">
                {col.label}
                {(col.key === "name" || col.type === "select") && dialogMode !== "view" && <span className="text-fail ml-1">*</span>}
              </label>
              {dialogMode === "view" ? <div className="px-3 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink">{formData[col.key] || "-"}</div>
              : col.type === "select" ? <select value={formData[col.key] || ""} onChange={(e) => handleFieldChange(col.key, e.target.value)}
                className={`w-full h-10 px-3 rounded-lg bg-white border text-sm text-ink focus:outline-none shadow-sm transition-colors ${formErrors[col.key] ? "border-fail focus:border-fail" : "border-border focus:border-amber"}`}>
                <option value="">请选择</option>{col.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select>
              : col.type === "date" ? <input type="date" value={formData[col.key] || ""} onChange={(e) => handleFieldChange(col.key, e.target.value)}
                className={`w-full h-10 px-3 rounded-lg bg-white border text-sm text-ink focus:outline-none shadow-sm transition-colors ${formErrors[col.key] ? "border-fail focus:border-fail" : "border-border focus:border-amber"}`} />
              : col.type === "textarea" ? <textarea value={formData[col.key] || ""} onChange={(e) => handleFieldChange(col.key, e.target.value)} rows={3} placeholder={`请输入${col.label}`}
                className={`w-full px-3 py-2.5 rounded-lg bg-white border text-sm text-ink placeholder:text-muted focus:outline-none resize-none shadow-sm transition-colors ${formErrors[col.key] ? "border-fail focus:border-fail" : "border-border focus:border-amber"}`} />
              : <Input value={formData[col.key] || ""} onChange={(e) => handleFieldChange(col.key, e.target.value)} placeholder={`请输入${col.label}`}
                className={`h-10 bg-white border focus:border-amber shadow-sm transition-colors ${formErrors[col.key] ? "border-fail focus:border-fail" : "border-border"}`} />}
              {formErrors[col.key] && dialogMode !== "view" && <p className="text-xs text-fail flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{formErrors[col.key]}</p>}
            </div>))}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="h-9 border-border text-ink-light hover:bg-cream">{dialogMode === "view" ? "关闭" : "取消"}</Button>
            {dialogMode !== "view" && <Button onClick={handleSave} className="h-9 gradient-amber text-white shadow-sm">{dialogMode === "create" ? "创建" : "保存"}</Button>}
          </div>
        </div>
      </div>}
      {/* 单个删除确认 */}
      {showDeleteConfirm && <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
        <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-sm mx-4 animate-fade-in-up">
          <div className="px-6 py-5 text-center"><div className="w-12 h-12 rounded-full bg-fail-light flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-fail" /></div><h3 className="text-base font-semibold text-ink mb-1">确认删除</h3><p className="text-sm text-ink-light">确定要删除 <span className="text-ink font-medium">{deletingRow?.name}</span> 吗？此操作不可撤销。</p></div>
          <div className="flex items-center justify-center gap-2 px-6 pb-5"><Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="h-9 border-border text-ink-light hover:bg-cream">取消</Button><Button onClick={handleDelete} className="h-9 bg-fail text-white hover:bg-fail/90">确认删除</Button></div>
        </div>
      </div>}
      {/* 批量删除确认 */}
      {showBatchDeleteConfirm && <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowBatchDeleteConfirm(false)} />
        <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-sm mx-4 animate-fade-in-up">
          <div className="px-6 py-5 text-center"><div className="w-12 h-12 rounded-full bg-fail-light flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-fail" /></div><h3 className="text-base font-semibold text-ink mb-1">确认批量删除</h3><p className="text-sm text-ink-light">确定要删除选中的 <span className="text-ink font-medium">{selectedIds.size}</span> 条数据吗？此操作不可撤销。</p></div>
          <div className="flex items-center justify-center gap-2 px-6 pb-5"><Button variant="outline" onClick={() => setShowBatchDeleteConfirm(false)} className="h-9 border-border text-ink-light hover:bg-cream">取消</Button><Button onClick={handleBatchDelete} className="h-9 bg-fail text-white hover:bg-fail/90">确认删除</Button></div>
        </div>
      </div>}
      {/* 预览弹窗 */}
      {showPreview && previewItem && <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
        <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-2xl mx-4 animate-fade-in-up max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <h3 className="text-base font-semibold text-ink">{previewItem.name || "详情预览"}</h3>
            <button onClick={() => setShowPreview(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"><X className="w-4 h-4 group-hover:text-ink" /><span className="text-xs font-medium hidden sm:block">关闭</span></button>
          </div>
          <div className="px-6 py-5 overflow-y-auto flex-1">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-1"><span className="text-xs text-ink-light">ID</span><p className="text-sm font-medium text-ink">{previewItem.id}</p></div>
              <div className="space-y-1"><span className="text-xs text-ink-light">状态</span><p className="text-sm"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[previewItem.status] || ""}`}>{previewItem.status}</span></p></div>
              <div className="space-y-1"><span className="text-xs text-ink-light">优先级</span><p className="text-sm font-medium text-ink">{previewItem.priority}</p></div>
              {previewItem.deadline && <div className="space-y-1"><span className="text-xs text-ink-light">截止日期</span><p className="text-sm text-ink">{previewItem.deadline}</p></div>}
            </div>
            {/* 内容描述 */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-ink mb-2">详细描述</h4>
              <div className="bg-cream/50 rounded-xl p-4 prose prose-sm max-w-none">
                <ReactMarkdown>
                  {`## ${previewItem.name}\n\n这是一个需求的详细描述。在实际应用中，这里会显示从数据库查询到的完整数据。\n\n### 功能点\n\n- 实现用户登录功能\n- 支持用户名+密码登录\n- 支持记住密码功能\n\n### 技术要求\n\n1. 前端使用React框架\n2. 后端使用FastAPI\n3. 数据库使用PostgreSQL\n\n### 验收标准\n\n| 标准 | 说明 |\n|------|------|\n| 登录成功率 | >= 99% |\n| 响应时间 | < 2s |\n| 安全性 | 支持HTTPS |`}
                </ReactMarkdown>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
            <Button variant="outline" onClick={() => setShowPreview(false)} className="h-9 border-border text-ink-light hover:bg-cream">关闭</Button>
            <Button onClick={() => { setShowPreview(false); openEdit(previewItem) }} className="h-9 gradient-amber text-white">编辑</Button>
          </div>
        </div>
      </div>}
    </div>
  )
}
