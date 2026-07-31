/**
 * 测试管理 Hub - 可视化流水线导航
 *
 * 重新设计的「测试管理」模块首页：
 * - 顶部展示4阶段流水线（需求测试 → 执行测试 → 缺陷管理 → 分析报告）
 * - 每个阶段可展开查看子菜单
 * - 点击子菜单切换数据表格视图
 * - 保持原有CRUD功能（搜索/筛选/排序/分页/导出/新建/编辑/删除）
 */
import { useState, useMemo, useEffect, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, FileText, Target, ClipboardList, FlaskConical, Play,
  Bug, BarChart3, CheckCircle, Clock, AlertTriangle, Plus, Search,
  Edit, Trash2, Eye, X, Bell, Download, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useModuleData } from "@/hooks/useModuleData"
import { lifecycleApi } from "@/lib/api"
import RequirementsView from "./views/RequirementsView"
import ExecutionView from "./views/ExecutionView"
import TestPlanView from "./views/TestPlanView"
import TestCaseView from "./views/TestCaseView"
import DefectListView from "./views/DefectListView"
import ReportListView from "./views/ReportListView"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

// ── NavigateView — 跳转到已有完整页面的中转视图 ─────────────
function NavigateView({ href, label, onBack }: { href: string; label: string; onBack: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <h2 className="text-lg font-semibold text-ink">{label}</h2>
      </div>
      <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-ink-light">此功能在独立页面中提供更完整的操作体验</p>
        <Button className="gradient-amber text-white shadow-sm" onClick={() => navigate(href)}>
          打开 {label} →
        </Button>
      </div>
    </div>
  )
}

// ── 阶段配置 ──────────────────────────────────────────────
interface StageSubMenu {
  label: string
  key: string
}

interface StageConfig {
  id: string
  label: string
  icon: typeof FileText
  gradient: string
  desc: string
  subMenus: StageSubMenu[]
  statsColor: string
}

const PIPELINE_STAGES: StageConfig[] = [
  {
    id: "requirements",
    label: "需求测试",
    icon: FileText,
    gradient: "from-blue-500 to-indigo-600",
    desc: "AI驱动需求分析 → 提取测试点 → 规划方案 → 生成用例 → 用例评审",
    statsColor: "text-blue-600",
    subMenus: [
      { label: "全流程执行", key: "rt-run" },
      { label: "需求列表", key: "rt-req-list" },
      { label: "方案列表", key: "rt-plan-list" },
      { label: "测试点列表", key: "rt-point-list" },
      { label: "用例列表", key: "rt-case-list" },
      { label: "用例评审", key: "rt-case-review" },
    ],
  },
  {
    id: "execution",
    label: "执行测试",
    icon: Play,
    gradient: "from-sky-500 to-blue-600",
    desc: "实时执行追踪与结果收集",
    statsColor: "text-blue-600",
    subMenus: [
      { label: "执行列表", key: "ex-list" },
      { label: "调度配置", key: "ex-schedule" },
    ],
  },
  {
    id: "defects",
    label: "缺陷管理",
    icon: Bug,
    gradient: "from-rose-500 to-red-600",
    desc: "AI缺陷分析与根因定位",
    statsColor: "text-red-600",
    subMenus: [
      { label: "缺陷列表", key: "df-list" },
      { label: "看板视图", key: "df-kanban" },
      { label: "AI根因分析", key: "df-root-cause" },
      { label: "趋势分析", key: "df-trend" },
    ],
  },
  {
    id: "reports",
    label: "分析报告",
    icon: BarChart3,
    gradient: "from-teal-500 to-emerald-600",
    desc: "智能质量洞察与报告生成",
    statsColor: "text-emerald-600",
    subMenus: [
      { label: "报告列表", key: "rp-list" },
      { label: "AI生成报告", key: "rp-generate" },
      { label: "质量概览", key: "rp-overview" },
      { label: "趋势图表", key: "rp-trends" },
    ],
  },
]

// ── 列定义 ──────────────────────────────────────────────
interface ColDef {
  key: string
  label: string
  type?: "text" | "select" | "textarea" | "date"
  options?: string[]
}

const columnsByMenu: Record<string, ColDef[]> = {
  "rt-req-list": [
    { key: "name", label: "需求名称" },
    { key: "status", label: "状态", type: "select", options: ["草稿", "已分析", "已评审", "已批准"] },
    { key: "priority", label: "优先级", type: "select", options: ["P0", "P1", "P2", "P3"] },
    { key: "deadline", label: "截止日期", type: "date" },
  ],
  "rt-plan-list": [
    { key: "name", label: "方案名称" },
    { key: "status", label: "状态", type: "select", options: ["草稿", "进行中", "已完成"] },
    { key: "priority", label: "优先级", type: "select", options: ["P0", "P1", "P2", "P3"] },
  ],
  "rt-point-list": [
    { key: "name", label: "测试点名称" },
    { key: "status", label: "状态", type: "select", options: ["草稿", "激活", "已覆盖"] },
    { key: "priority", label: "优先级", type: "select", options: ["P0", "P1", "P2", "P3"] },
  ],
  "rt-case-list": [
    { key: "name", label: "用例名称" },
    { key: "status", label: "状态", type: "select", options: ["草稿", "已确认", "已审核"] },
    { key: "priority", label: "优先级", type: "select", options: ["P0", "P1", "P2", "P3"] },
    { key: "deadline", label: "截止日期", type: "date" },
  ],
  "rt-case-review": [
    { key: "name", label: "用例名称" },
    { key: "status", label: "状态", type: "select", options: ["待评审", "已通过", "需修改"] },
    { key: "priority", label: "优先级", type: "select", options: ["P0", "P1", "P2", "P3"] },
  ],
  "ex-list": [
    { key: "name", label: "执行名称" },
    { key: "status", label: "状态", type: "select", options: ["待执行", "执行中", "已完成", "失败"] },
    { key: "priority", label: "优先级", type: "select", options: ["P0", "P1", "P2", "P3"] },
  ],
  "ex-schedule": [
    { key: "name", label: "调度名称" },
    { key: "status", label: "状态", type: "select", options: ["启用", "停用"] },
    { key: "cron", label: "Cron表达式" },
  ],
  "df-list": [
    { key: "name", label: "缺陷标题" },
    { key: "status", label: "状态", type: "select", options: ["新建", "已确认", "处理中", "已解决", "已关闭"] },
    { key: "priority", label: "优先级", type: "select", options: ["紧急", "高", "中", "低"] },
    { key: "deadline", label: "截止日期", type: "date" },
  ],
  "rp-list": [
    { key: "name", label: "报告名称" },
    { key: "status", label: "状态", type: "select", options: ["草稿", "已发布"] },
    { key: "deadline", label: "截止日期", type: "date" },
  ],
}

const statusColors: Record<string, string> = {
  "已分析": "bg-pass/10 text-pass border border-pass/20",
  "已评审": "bg-info/10 text-info border border-info/20",
  "已确认": "bg-pass/10 text-pass border border-pass/20",
  "已审核": "bg-info/10 text-info border border-info/20",
  "已批准": "bg-pass/10 text-pass border border-pass/20",
  "草稿": "bg-cream text-muted border border-border",
  "已完成": "bg-pass/10 text-pass border border-pass/20",
  "待评审": "bg-amber-light text-amber border border-amber/20",
  "已通过": "bg-pass/10 text-pass border border-pass/20",
  "需修改": "bg-fail/10 text-fail border border-fail/20",
  "启用": "bg-pass/10 text-pass border border-pass/20",
  "停用": "bg-cream text-muted border border-border",
  "新建": "bg-amber-light text-warn border border-amber/20",
  "处理中": "bg-info/10 text-info border border-info/20",
  "已解决": "bg-pass/10 text-pass border border-pass/20",
  "已关闭": "bg-cream text-muted border border-border",
  "失败": "bg-fail/10 text-fail border border-fail/20",
  "执行中": "bg-blue-50 text-blue-600 border border-blue-200",
  "待执行": "bg-stone-50 text-stone-500 border border-stone-200",
}

// ── 主组件 ──────────────────────────────────────────────
export default function TestManagementHubPage() {
  const navigate = useNavigate()
  const { subKey } = useParams<{ subKey: string }>()
  const { data, create: createItem, update: updateItem, remove: removeItem, batchRemove, getMeta, setPage, setPageSize } = useModuleData("")

  // 流水线阶段统计数据（来自后端聚合 API）
  const [stageData, setStageData] = useState<Record<string, any>>({})
  const [stageLoading, setStageLoading] = useState(true)

  const fetchStageStats = useCallback(async () => {
    try {
      setStageLoading(true)
      const res: any = await lifecycleApi.getPipelineStages()
      const stagesMap: Record<string, any> = {}
      const stages = res?.data?.data?.stages || res?.data?.stages || res?.stages || []
      stages.forEach((s: any) => { stagesMap[s.id] = s })
      setStageData(stagesMap)
    } catch (e) {
      // 静默失败，数据保持空
    } finally {
      setStageLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStageStats()
  }, [fetchStageStats])

  // 从 URL 参数同步 activeMenu
  useEffect(() => {
    if (subKey) {
      setActiveMenu(subKey)
      setSearchTerm("")
      setFilters({})
      setSortConfig(null)
      setSelectedIds(new Set())
    } else {
      setActiveMenu("")
    }
  }, [subKey])

  // 阶段展开控制
  const [expandedStage, setExpandedStage] = useState<string>("requirements")
  // 当前选中的子菜单
  const [activeMenu, setActiveMenu] = useState<string>("")

  // 菜单变化时加载服务端第一页
  useEffect(() => {
    if (activeMenu) {
      setPage(activeMenu, 1)
    }
  }, [activeMenu, setPage])

  // 数据表格状态
  const [searchTerm, setSearchTerm] = useState("")
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [jumpToPage, setJumpToPage] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingRow, setEditingRow] = useState<any>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingRow, setDeletingRow] = useState<any>(null)
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [previewItem, setPreviewItem] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)

  // 当前阶段
  const activeStage = PIPELINE_STAGES.find((s) => s.subMenus.some((m) => m.key === activeMenu))
  const currentCols = columnsByMenu[activeMenu] || [{ key: "name", label: "名称" }]

  // 数据表格处理
  const currentData = useMemo(() => {
    let raw = (data[activeMenu] || []).filter(() => true)
    if (searchTerm) {
      raw = raw.filter((row) =>
        Object.values(row).some((v) => String(v).toLowerCase().includes(searchTerm.toLowerCase())),
      )
    }
    Object.entries(filters).forEach(([key, val]) => {
      if (val) raw = raw.filter((row) => String(row[key]) === val)
    })
    if (sortConfig) {
      raw = [...raw].sort((a, b) => {
        const aVal = a[sortConfig.key] || ""
        const bVal = b[sortConfig.key] || ""
        if (sortConfig.key === "priority") {
          const order: Record<string, number> = { P0: 0, 紧急: 0, P1: 1, 高: 1, P2: 2, 中: 2, P3: 3, 低: 3 }
          return sortConfig.direction === "asc"
            ? (order[aVal] ?? 99) - (order[bVal] ?? 99)
            : (order[bVal] ?? 99) - (order[aVal] ?? 99)
        }
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
    }
    return raw
  }, [data, activeMenu, searchTerm, filters, sortConfig])

  // 服务端分页：total 来自后端元信息，当前页数据即为服务端返回
  const pagination = getMeta(activeMenu)
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
  const pagedData = currentData

  // 选择子菜单 -> 导航到子页面
  const handleSelectMenu = (key: string) => {
    navigate(`/test-management-hub/${key}`)
  }

  // 返回总览
  const goToOverview = () => {
    navigate("/test-management-hub")
  }

  // 表单操作
  const validateField = (key: string, value: string): string => {
    const col = currentCols.find((c) => c.key === key)
    if (!col) return ""
    if (!value || value.trim() === "") {
      if (col.key === "name" || col.type === "select") return `${col.label}不能为空`
    }
    if (value && value.length > 200) return `${col.label}不能超过200个字符`
    return ""
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    currentCols.forEach((col) => {
      const error = validateField(col.key, formData[col.key] || "")
      if (error) errors[col.key] = error
    })
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFieldChange = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value })
    setFormTouched({ ...formTouched, [key]: true })
    if (formTouched[key] || value) {
      const error = validateField(key, value)
      setFormErrors({ ...formErrors, [key]: error })
    }
  }

  const openCreate = () => {
    setDialogMode("create")
    setEditingRow(null)
    const init: Record<string, string> = {}
    currentCols.forEach((c) => { init[c.key] = "" })
    setFormData(init)
    setFormErrors({})
    setFormTouched({})
    setShowDialog(true)
  }

  const openEdit = (row: any) => {
    setDialogMode("edit")
    setEditingRow(row)
    const init: Record<string, string> = {}
    currentCols.forEach((c) => { init[c.key] = String(row[c.key] || "") })
    setFormData(init)
    setFormErrors({})
    setFormTouched({})
    setShowDialog(true)
  }

  const handleSave = () => {
    if (!validateForm()) return
    if (dialogMode === "create") createItem(activeMenu, formData)
    else if (dialogMode === "edit" && editingRow) updateItem(activeMenu, editingRow.id, formData)
    setShowDialog(false)
  }

  const confirmDelete = (row: any) => {
    setDeletingRow(row)
    setShowDeleteConfirm(true)
  }

  const handleDelete = () => {
    if (!deletingRow) return
    removeItem(activeMenu, deletingRow.id)
    setSelectedIds((prev) => {
      const n = new Set(prev)
      n.delete(deletingRow.id)
      return n
    })
    setShowDeleteConfirm(false)
    setDeletingRow(null)
  }

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleSelectAll = () => {
    const pageIds = pagedData.map((r) => r.id)
    const allSelected = pageIds.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds((prev) => {
        const n = new Set(prev)
        pageIds.forEach((id) => n.delete(id))
        return n
      })
    } else {
      setSelectedIds((prev) => {
        const n = new Set(prev)
        pageIds.forEach((id) => n.add(id))
        return n
      })
    }
  }

  const handleBatchDelete = () => {
    batchRemove(activeMenu, selectedIds)
    setSelectedIds(new Set())
    setShowBatchDeleteConfirm(false)
  }

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" }
        return null
      }
      return { key, direction: "asc" }
    })
  }

  const exportToExcel = () => {
    const exportData = selectedIds.size > 0 ? currentData.filter((r) => selectedIds.has(r.id)) : currentData
    const headers = ["ID", ...currentCols.map((c) => c.label)]
    const rows = exportData.map((row) => [row.id, ...currentCols.map((c) => row[c.key] || "")])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, activeMenu || "Sheet1")
    XLSX.writeFile(wb, `${activeMenu}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const exportToPDF = () => {
    const exportData = selectedIds.size > 0 ? currentData.filter((r) => selectedIds.has(r.id)) : currentData
    const doc = new jsPDF({ orientation: currentCols.length > 4 ? "landscape" : "portrait" })
    doc.setFontSize(16)
    doc.text(activeMenu || "Export", 14, 20)
    doc.setFontSize(10)
    doc.setTextColor(128)
    doc.text(`导出时间: ${new Date().toLocaleDateString("zh-CN")}  共 ${exportData.length} 条`, 14, 28)
    const headers = ["ID", ...currentCols.map((c) => c.label)]
    const rows = exportData.map((row) => [String(row.id), ...currentCols.map((c) => String(row[c.key] || ""))])
    autoTable(doc, { startY: 34, head: [headers], body: rows, styles: { fontSize: 9 }, headStyles: { fillColor: [212, 165, 116] } })
    doc.save(`${activeMenu}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // 展开/折叠阶段
  const toggleStage = (stageId: string) => {
    setExpandedStage(expandedStage === stageId ? "" : stageId)
  }

  // ── 渲染 ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* ═══ 顶部栏 ═══ */}
      <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group"
          >
            <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
            <span className="text-xs font-medium text-ink-light group-hover:text-ink transition-colors hidden sm:block">
              返回
            </span>
          </button>
          <div className="h-8 w-px bg-border/60" />
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber to-orange-500 flex items-center justify-center shadow-md">
            <FlaskConical className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1
              className="text-sm font-bold text-ink truncate"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              测试管理
            </h1>
            <p className="text-[11px] text-muted truncate">
              全流程测试管理：需求分析 → 执行测试 → 缺陷跟踪 → 分析报告
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeMenu && (
            <span className="text-xs text-ink-light hidden sm:block">
              当前: {PIPELINE_STAGES.flatMap((s) => s.subMenus).find((m) => m.key === activeMenu)?.label || ""}
            </span>
          )}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg hover:bg-cream transition-colors relative"
            >
              <Bell className="w-5 h-5 text-ink-light" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ 流水线导航 ═══ */}
      <div className="bg-white border-b border-border px-4 md:px-6 py-4 md:py-5">
        {/* 流水线阶段卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl mx-auto">
          {PIPELINE_STAGES.map((stage, idx) => {
            const Icon = stage.icon
            const isExpanded = expandedStage === stage.id
            const hasActive = activeMenu && stage.subMenus.some((m) => m.key === activeMenu)
            const stageInfo = stageData[stage.id]
            const subDataCount = stageInfo?.total ?? stage.subMenus.reduce((sum, m) => sum + (data[m.key]?.length || 0), 0)

            return (
              <div key={stage.id} className="relative">
                {/* 连接箭头（桌面端） */}
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-muted">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                )}

                {/* 阶段卡片 */}
                <div
                  onClick={() => toggleStage(stage.id)}
                  className={`rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                    isExpanded
                      ? "border-amber shadow-card-hover"
                      : hasActive
                        ? "border-amber/30 shadow-card"
                        : "border-border shadow-card hover:border-amber/30 hover:shadow-card-hover"
                  }`}
                >
                  {/* 头部 */}
                  <div className={`bg-gradient-to-r ${stage.gradient} px-4 py-3`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <Icon className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{stage.label}</h3>
                        <p className="text-[10px] text-white/70 truncate">{stage.desc}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">
                          {subDataCount}
                        </span>
                        <svg
                          className={`w-4 h-4 text-white/70 transition-transform duration-300 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* 展开的子菜单 */}
                  <div
                    className={`transition-all duration-300 overflow-hidden ${
                      isExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="px-3 pb-3 pt-2 space-y-1">
                      {stage.subMenus.map((menu) => {
                        // 优先使用后端聚合数据中的子项计数
                        let count = data[menu.key]?.length || 0
                        const si = stageData[stage.id]
                        if (si?.subCounts) {
                          const keyMap: Record<string, string> = {
                            "rt-req-list": "requirements", "rt-plan-list": "plans",
                            "rt-point-list": "points", "rt-case-list": "cases",
                            "rt-case-review": "reviews", "ex-list": "executions",
                            "df-list": "defects", "rp-list": "reports",
                          }
                          const mappedKey = keyMap[menu.key]
                          if (mappedKey && si.subCounts[mappedKey] !== undefined) {
                            count = si.subCounts[mappedKey]
                          }
                        }
                        const isActive = activeMenu === menu.key
                        return (
                          <button
                            key={menu.key}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectMenu(menu.key)
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                              isActive
                                ? "bg-amber-light text-amber-hover font-semibold shadow-sm ring-1 ring-amber/20"
                                : "text-ink-light hover:text-ink hover:bg-cream/70 font-medium"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                count > 0 ? "bg-amber" : "bg-border"
                              }`}
                            />
                            <span className="flex-1 text-left truncate">{menu.label}</span>
                            <span className="text-[10px] text-muted bg-cream/50 px-1.5 py-0.5 rounded-md">
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 折叠时显示的小统计 */}
                  {!isExpanded && (
                    <div className="px-4 py-2 flex items-center gap-2 text-[10px] text-muted">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {stage.subMenus.length} 个子模块
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ 内容区域 ═══ */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* 专用视图 */}
        {activeMenu === "rt-req-list" && <RequirementsView onBack={goToOverview} />}
        {activeMenu === "rt-plan-list" && <TestPlanView onBack={goToOverview} />}
        {activeMenu === "rt-case-list" && <TestCaseView onBack={goToOverview} />}
        {activeMenu === "ex-list" && <ExecutionView onBack={goToOverview} />}
        {activeMenu === "df-list" && <DefectListView onBack={goToOverview} />}
        {activeMenu === "rp-list" && <ReportListView onBack={goToOverview} />}
        {/* 跳转到独立完整页面的子菜单 */}
        {activeMenu === "rt-run" && <NavigateView href="/requirement-testing" label="全流程执行" onBack={goToOverview} />}
        {activeMenu === "rt-case-review" && <NavigateView href="/requirement-testing" label="用例评审" onBack={goToOverview} />}
        {activeMenu === "rt-point-list" && <NavigateView href="/requirement-testing" label="测试点列表" onBack={goToOverview} />}
        {activeMenu === "ex-schedule" && <NavigateView href="/requirement-testing" label="调度配置" onBack={goToOverview} />}
        {activeMenu === "df-kanban" && <NavigateView href="/defects" label="缺陷看板" onBack={goToOverview} />}
        {activeMenu === "df-root-cause" && <NavigateView href="/defects" label="AI根因分析" onBack={goToOverview} />}
        {activeMenu === "df-trend" && <NavigateView href="/defects" label="趋势分析" onBack={goToOverview} />}
        {activeMenu === "rp-generate" && <NavigateView href="/reports" label="AI生成报告" onBack={goToOverview} />}
        {activeMenu === "rp-overview" && <NavigateView href="/reports" label="质量概览" onBack={goToOverview} />}
        {activeMenu === "rp-trends" && <NavigateView href="/reports" label="趋势图表" onBack={goToOverview} />}
        {/* 其他子菜单 → 通用数据表格 */}
        {activeMenu && ![
          "rt-req-list","rt-plan-list","rt-case-list",
          "ex-list","df-list","rp-list",
          "rt-run","rt-case-review","rt-point-list","ex-schedule",
          "df-kanban","df-root-cause","df-trend",
          "rp-generate","rp-overview","rp-trends",
        ].includes(activeMenu) && (
          <div className="max-w-6xl mx-auto">
            {/* 标题 + 操作栏 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={goToOverview}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group mr-2"
                  title="返回工作台总览"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <h2 className="text-lg font-semibold text-ink">
                  {PIPELINE_STAGES.flatMap((s) => s.subMenus).find((m) => m.key === activeMenu)?.label || "内容"}
                </h2>
                <span className="text-xs text-ink-light bg-cream px-2 py-1 rounded-md">
                  {currentData.length} 条
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <Input
                    placeholder="搜索..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                    }}
                    className="w-40 sm:w-56 h-9 pl-9 text-sm bg-white border-border focus:border-amber"
                  />
                </div>
                <div className="relative group hidden sm:block">
                  <Button variant="outline" className="h-9 border-border text-ink-light text-sm hover:bg-cream">
                    <Download className="w-4 h-4 mr-1" /> 导出
                  </Button>
                  <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-border rounded-xl shadow-elevated opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <button
                      onClick={exportToExcel}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-light hover:bg-cream rounded-t-xl transition-colors"
                    >
                      <svg className="w-4 h-4 text-pass" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      导出 Excel
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-light hover:bg-cream rounded-b-xl transition-colors"
                    >
                      <svg className="w-4 h-4 text-fail" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      导出 PDF
                    </button>
                  </div>
                </div>
                <Button className="h-9 gradient-amber text-white text-sm shadow-sm" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1" /> 新建
                </Button>
              </div>
            </div>

            {/* 筛选栏 */}
            {currentCols.filter((c) => c.type === "select" && c.options).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4 bg-white px-3 md:px-4 py-2.5 md:py-3 rounded-2xl border border-border shadow-card">
                {currentCols
                  .filter((c) => c.type === "select" && c.options)
                  .map((col) => (
                    <div key={col.key} className="flex items-center gap-2">
                      <label className="text-xs text-ink-light">{col.label}:</label>
                      <select
                        value={filters[col.key] || ""}
                        onChange={(e) => {
                          setFilters({ ...filters, [col.key]: e.target.value })
                        }}
                        className="h-8 px-2 pr-6 text-xs rounded-lg bg-white border border-border text-ink-light focus:border-amber focus:outline-none appearance-none cursor-pointer shadow-sm"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239C8E82' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: "right 4px center",
                          backgroundRepeat: "no-repeat",
                          backgroundSize: "14px",
                        }}
                      >
                        <option value="">全部</option>
                        {col.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                {Object.values(filters).some((v) => v) && (
                  <>
                    <button
                      onClick={() => {
                        setFilters({})
                      }}
                      className="text-xs text-amber hover:text-amber-hover flex items-center gap-1 font-medium"
                    >
                      <X className="w-3 h-3" /> 清除筛选
                    </button>
                    <span className="text-xs text-ink-light">
                      筛选中 · {currentData.length} 条结果
                    </span>
                  </>
                )}
              </div>
            )}

            {/* 统计卡片 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-ink-light">总计</p>
                    <p className="text-xl font-bold text-ink">{data[activeMenu]?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber" />
                  </div>
                  <div>
                    <p className="text-xs text-ink-light">草稿</p>
                    <p className="text-xl font-bold text-ink">
                      {data[activeMenu]?.filter((r) => r.status === "草稿").length || 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-pass" />
                  </div>
                  <div>
                    <p className="text-xs text-ink-light">已完成</p>
                    <p className="text-xl font-bold text-ink">
                      {data[activeMenu]?.filter((r) => ["已分析", "已评审", "已确认", "已通过", "已解决"].includes(r.status)).length || 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-fail" />
                  </div>
                  <div>
                    <p className="text-xs text-ink-light">即将到期</p>
                    <p className="text-xl font-bold text-ink">
                      {data[activeMenu]?.filter(
                        (r) =>
                          r.deadline &&
                          new Date(r.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 &&
                          new Date(r.deadline) >= new Date(),
                      ).length || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 图表可视化 */}
            {data[activeMenu] && data[activeMenu].length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                  <h3 className="text-sm font-semibold text-ink mb-3">状态分布</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={Object.entries(
                          data[activeMenu].reduce((acc: Record<string, number>, r: any) => {
                            acc[r.status] = (acc[r.status] || 0) + 1
                            return acc
                          }, {}),
                        ).map(([name, value]) => ({ name, value }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {data[activeMenu]
                          .reduce((acc: Record<string, number>, r: any) => {
                            acc[r.status] = (acc[r.status] || 0) + 1
                            return acc
                          }, {})
                          .length > 0 &&
                          Object.entries(
                            data[activeMenu].reduce((acc: Record<string, number>, r: any) => {
                              acc[r.status] = (acc[r.status] || 0) + 1
                              return acc
                            }, {}),
                          ).map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={["#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EF4444"][index % 5]}
                            />
                          ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl border border-border p-4 shadow-card">
                  <h3 className="text-sm font-semibold text-ink mb-3">优先级分布</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={Object.entries(
                        data[activeMenu].reduce((acc: Record<string, number>, r: any) => {
                          acc[r.priority] = (acc[r.priority] || 0) + 1
                          return acc
                        }, {}),
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
                <div className="flex items-center gap-3">
                  <span className="text-sm text-amber">
                    已选择 <span className="font-semibold text-ink">{selectedIds.size}</span> 条
                  </span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-ink-light hover:text-ink"
                  >
                    取消选择
                  </button>
                </div>
                <Button
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  className="h-8 px-3 bg-fail-light text-fail border border-fail/20 text-xs hover:bg-fail/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> 批量删除
                </Button>
              </div>
            )}

            {/* 数据表格 */}
            {pagedData.length === 0 ? (
              <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-cream flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-ink-light" />
                </div>
                <p className="text-sm font-medium text-ink">
                  {searchTerm ? "没有匹配的数据" : "暂无数据"}
                </p>
                <p className="text-xs mt-1 text-ink-light">点击"新建"按钮添加数据</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-cream/50">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={pagedData.length > 0 && pagedData.every((r) => selectedIds.has(r.id))}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-border text-amber focus:ring-amber cursor-pointer"
                        />
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-ink-light uppercase tracking-wider w-16">
                        ID
                      </th>
                      {currentCols.map((c) => (
                        <th
                          key={c.key}
                          className="text-center px-5 py-3 text-xs font-semibold text-ink-light uppercase tracking-wider"
                        >
                          <button
                            onClick={() => handleSort(c.key)}
                            className="flex items-center gap-1 hover:text-ink transition-colors"
                          >
                            {c.label}
                            <span className="text-[10px]">
                              {sortConfig?.key === c.key
                                ? sortConfig.direction === "asc"
                                  ? "↑"
                                  : "↓"
                                : "↕"}
                            </span>
                          </button>
                        </th>
                      ))}
                      <th className="text-right px-5 py-3 text-xs font-semibold text-ink-light uppercase tracking-wider w-28">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedData.map((row: any) => (
                      <tr
                        key={row.id}
                        className={`border-b border-border/50 last:border-0 transition-colors cursor-pointer ${
                          selectedIds.has(row.id) ? "bg-amber-light/50" : "hover:bg-cream/50"
                        }`}
                        onClick={() => {
                          setPreviewItem(row)
                          setShowPreview(true)
                        }}
                      >
                        <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelect(row.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-border text-amber focus:ring-amber cursor-pointer"
                          />
                        </td>
                        <td className="px-5 py-3.5 text-sm text-ink-light text-center">{row.id}</td>
                        {currentCols.map((c) => {
                          const val = row[c.key]
                          const truncated =
                            val && String(val).length > 10 ? String(val).slice(0, 10) + "..." : val

                          if (c.key === "status" && val) {
                            return (
                              <td key={c.key} className="px-3 md:px-5 py-3.5 text-center">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                                    statusColors[val] ||
                                    "bg-gray-100 text-gray-600 border border-gray-200"
                                  }`}
                                >
                                  {val}
                                </span>
                              </td>
                            )
                          }

                          if (c.key === "priority" && val) {
                            const cls =
                              val === "P0" || val === "紧急"
                                ? "text-fail"
                                : val === "P1" || val === "高"
                                  ? "text-amber"
                                  : "text-muted"
                            return (
                              <td key={c.key} className="px-5 py-3.5 text-center">
                                <span className={`text-xs font-semibold ${cls}`}>{val}</span>
                              </td>
                            )
                          }

                          if (c.key === "deadline" && val) {
                            const isPast = new Date(val as string) < new Date()
                            const isSoon =
                              new Date(val as string).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 &&
                              new Date(val as string) >= new Date()
                            return (
                              <td key={c.key} className="px-3 md:px-5 py-3.5 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 text-xs ${
                                    isPast
                                      ? "text-fail font-semibold"
                                      : isSoon
                                        ? "text-amber font-medium"
                                        : "text-ink-light"
                                  }`}
                                >
                                  <Clock className="w-3 h-3" />
                                  {val as string}
                                </span>
                              </td>
                            )
                          }

                          if (c.key === "name") {
                            return (
                              <td key={c.key} className="px-3 md:px-5 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-2 min-w-0">
                                  <span
                                    className="text-sm font-medium text-ink truncate max-w-[200px]"
                                    title={String(val)}
                                  >
                                    {truncated}
                                  </span>
                                </div>
                              </td>
                            )
                          }

                          return (
                            <td
                              key={c.key}
                              className="px-5 py-3.5 text-sm text-ink-light text-center truncate max-w-[150px]"
                              title={String(val || "")}
                            >
                              {truncated || "-"}
                            </td>
                          )
                        })}
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setPreviewItem(row)
                                setShowPreview(true)
                              }}
                              className="p-1.5 rounded-md hover:bg-cream transition-colors"
                              title="预览"
                            >
                              <Eye className="w-4 h-4 text-ink-light" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openEdit(row)
                              }}
                              className="p-1.5 rounded-md hover:bg-cream transition-colors"
                              title="编辑"
                            >
                              <Edit className="w-4 h-4 text-ink-light" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                confirmDelete(row)
                              }}
                              className="p-1.5 rounded-md hover:bg-fail-light transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4 text-fail" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 分页 */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-4 md:px-5 py-3 border-t border-border bg-cream/30 gap-3">
                  <div className="flex items-center gap-3 flex-wrap justify-center">
                    <span className="text-xs text-ink-light">共 {currentData.length} 条</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-ink-light hidden sm:inline">每页</span>
                      <select
                        value={pagination.pageSize}
                        onChange={(e) => {
                          setPageSize(activeMenu, Number(e.target.value))
                        }}
                        className="h-7 px-2 text-xs rounded-lg bg-white border border-border text-ink focus:border-amber focus:outline-none shadow-sm"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                      <span className="text-xs text-ink-light">条</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-ink-light hidden sm:inline">跳至</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={jumpToPage}
                        onChange={(e) => setJumpToPage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const p = parseInt(jumpToPage)
                            if (p >= 1 && p <= totalPages) {
                              setPage(activeMenu, p)
                              setJumpToPage("")
                            }
                          }
                        }}
                        className="w-12 md:w-14 h-7 px-1 md:px-2 text-xs rounded-lg bg-white border border-border text-ink text-center focus:border-amber focus:outline-none shadow-sm"
                      />
                      <span className="text-xs text-ink-light">页</span>
                    </div>
                    <div className="flex items-center gap-0.5 md:gap-1">
                      <button
                        onClick={() => setPage(activeMenu, 1)}
                        disabled={pagination.page <= 1}
                        className="px-1.5 md:px-2 py-1 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40 shadow-sm hidden sm:block"
                      >
                        «
                      </button>
                      <button
                        onClick={() => setPage(activeMenu, Math.max(1, pagination.page - 1))}
                        disabled={pagination.page <= 1}
                        className="px-2 py-1 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40 shadow-sm"
                      >
                        ‹
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let page: number
                        if (totalPages <= 5) page = i + 1
                        else if (pagination.page <= 3) page = i + 1
                        else if (pagination.page >= totalPages - 2) page = totalPages - 4 + i
                        else page = pagination.page - 2 + i
                        return (
                          <button
                            key={page}
                            onClick={() => setPage(activeMenu, page)}
                            className={`px-2 md:px-2.5 py-1 text-xs rounded-lg shadow-sm ${
                              page === pagination.page
                                ? "gradient-amber text-white"
                                : "border border-border text-ink-light hover:bg-cream"
                            }`}
                          >
                            {page}
                          </button>
                        )
                      })}
                      <button
                        onClick={() => setPage(activeMenu, Math.min(totalPages, pagination.page + 1))}
                        disabled={pagination.page >= totalPages}
                        className="px-2 py-1 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40 shadow-sm"
                      >
                        ›
                      </button>
                      <button
                        onClick={() => setPage(activeMenu, totalPages)}
                        disabled={pagination.page >= totalPages}
                        className="px-1.5 md:px-2 py-1 text-xs rounded-lg border border-border text-ink-light hover:bg-cream disabled:opacity-40 shadow-sm hidden sm:block"
                      >
                        »
                      </button>
                    </div>
                    <span className="text-xs text-ink-light">
                      {pagination.page}/{totalPages}页
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {!activeMenu && (
          /* ── 未选择子菜单时的概览 ── */
          <div className="max-w-4xl mx-auto text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber/25">
              <FlaskConical className="w-10 h-10 text-white" />
            </div>
            <h2
              className="text-2xl font-bold text-ink mb-3"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              测试管理 工作台
            </h2>
            <p className="text-sm text-muted max-w-md mx-auto leading-relaxed mb-8">
              在上方流水线中选择一个模块开始工作。<br />
              AI 将辅助您完成从需求分析到报告输出的全流程测试管理。
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {PIPELINE_STAGES.map((stage) => {
                const si = stageData[stage.id]
                const totalCount = si?.total ?? stage.subMenus.reduce((sum, m) => sum + (data[m.key]?.length || 0), 0)
                const Icon = stage.icon
                return (
                  <button
                    key={stage.id}
                    onClick={() => {
                      setExpandedStage(stage.id)
                      if (stage.subMenus.length > 0) navigate(`/test-management-hub/${stage.subMenus[0].key}`)
                    }}
                    className="bg-white rounded-2xl border border-border p-5 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all text-center group"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stage.gradient} flex items-center justify-center mx-auto mb-3 shadow-md group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-ink mb-1">{stage.label}</h3>
                    <p className="text-2xl font-bold text-amber">{totalCount}</p>
                    <p className="text-[10px] text-muted">条数据</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ 新建/编辑弹窗 ═══ */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowDialog(false)} />
          <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-lg mx-4 animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-ink">
                {dialogMode === "create" ? "新建" : dialogMode === "edit" ? "编辑" : "查看详情"}
              </h3>
              <button
                onClick={() => setShowDialog(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"
              >
                <X className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:block">关闭</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {currentCols.map((col) => (
                <div key={col.key} className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">
                    {col.label}
                    {(col.key === "name" || col.type === "select") && dialogMode !== "view" && (
                      <span className="text-fail ml-1">*</span>
                    )}
                  </label>
                  {dialogMode === "view" ? (
                    <div className="px-3 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink">
                      {formData[col.key] || "-"}
                    </div>
                  ) : col.type === "select" ? (
                    <select
                      value={formData[col.key] || ""}
                      onChange={(e) => handleFieldChange(col.key, e.target.value)}
                      className={`w-full h-10 px-3 rounded-lg bg-white border text-sm text-ink focus:outline-none shadow-sm transition-colors ${
                        formErrors[col.key] ? "border-fail focus:border-fail" : "border-border focus:border-amber"
                      }`}
                    >
                      <option value="">请选择</option>
                      {col.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : col.type === "date" ? (
                    <input
                      type="date"
                      value={formData[col.key] || ""}
                      onChange={(e) => handleFieldChange(col.key, e.target.value)}
                      className={`w-full h-10 px-3 rounded-lg bg-white border text-sm text-ink focus:outline-none shadow-sm transition-colors ${
                        formErrors[col.key] ? "border-fail focus:border-fail" : "border-border focus:border-amber"
                      }`}
                    />
                  ) : (
                    <Input
                      value={formData[col.key] || ""}
                      onChange={(e) => handleFieldChange(col.key, e.target.value)}
                      placeholder={`请输入${col.label}`}
                      className={`h-10 bg-white border focus:border-amber shadow-sm transition-colors ${
                        formErrors[col.key] ? "border-fail focus:border-fail" : "border-border"
                      }`}
                    />
                  )}
                  {formErrors[col.key] && dialogMode !== "view" && (
                    <p className="text-xs text-fail flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {formErrors[col.key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="h-9 border-border text-ink-light hover:bg-cream"
              >
                {dialogMode === "view" ? "关闭" : "取消"}
              </Button>
              {dialogMode !== "view" && (
                <Button onClick={handleSave} className="h-9 gradient-amber text-white shadow-sm">
                  {dialogMode === "create" ? "创建" : "保存"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 删除确认弹窗 ═══ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-sm mx-4 animate-fade-in-up">
            <div className="px-6 py-5 text-center">
              <div className="w-12 h-12 rounded-full bg-fail-light flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-fail" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">确认删除</h3>
              <p className="text-sm text-ink-light">
                确定要删除 <span className="text-ink font-medium">{deletingRow?.name}</span> 吗？此操作不可撤销。
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 px-6 pb-5">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="h-9 border-border text-ink-light hover:bg-cream"
              >
                取消
              </Button>
              <Button onClick={handleDelete} className="h-9 bg-fail text-white hover:bg-fail/90">
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 批量删除确认 ═══ */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowBatchDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-sm mx-4 animate-fade-in-up">
            <div className="px-6 py-5 text-center">
              <div className="w-12 h-12 rounded-full bg-fail-light flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-fail" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">确认批量删除</h3>
              <p className="text-sm text-ink-light">
                确定要删除选中的 <span className="text-ink font-medium">{selectedIds.size}</span> 条数据吗？此操作不可撤销。
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 px-6 pb-5">
              <Button
                variant="outline"
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="h-9 border-border text-ink-light hover:bg-cream"
              >
                取消
              </Button>
              <Button onClick={handleBatchDelete} className="h-9 bg-fail text-white hover:bg-fail/90">
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 预览弹窗 ═══ */}
      {showPreview && previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white rounded-2xl border border-border shadow-elevated w-full max-w-2xl mx-4 animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-ink">{previewItem.name || "详情预览"}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 text-ink-light hover:text-ink transition-all group"
              >
                <X className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:block">关闭</span>
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                {currentCols.map((col) => (
                  <div key={col.key} className={col.key === "name" ? "col-span-2" : ""}>
                    <p className="text-xs text-muted mb-1">{col.label}</p>
                    <p className="text-sm text-ink font-medium">
                      {previewItem[col.key] || "-"}
                    </p>
                  </div>
                ))}
                <div className="col-span-2 border-t border-border pt-3 mt-1">
                  <p className="text-xs text-muted mb-1">ID</p>
                  <p className="text-sm text-ink font-mono">{previewItem.id}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowPreview(false)}
                className="h-9 border-border text-ink-light hover:bg-cream"
              >
                关闭
              </Button>
              <Button
                onClick={() => {
                  setShowPreview(false)
                  openEdit(previewItem)
                }}
                className="h-9 gradient-amber text-white shadow-sm"
              >
                <Edit className="w-4 h-4 mr-1" /> 编辑
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
