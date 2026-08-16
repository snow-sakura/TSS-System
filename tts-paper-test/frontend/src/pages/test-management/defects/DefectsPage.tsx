import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi, projectApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"

interface Defect {
  id: number
  title: string
  description?: string
  status: "new" | "confirmed" | "fixing" | "fixed" | "closed"
  severity: "critical" | "high" | "medium" | "low"
  assignee?: string
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  created_at?: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "新建", color: "bg-cream text-muted border border-border" },
  confirmed: { label: "已确认", color: "bg-info/10 text-info border border-info/20" },
  fixing: { label: "修复中", color: "bg-amber/10 text-amber border border-amber/20" },
  fixed: { label: "已修复", color: "bg-pass/10 text-pass border border-pass/20" },
  closed: { label: "已关闭", color: "bg-cream text-muted border border-border" },
}

const severityColors: Record<string, string> = {
  critical: "bg-fail text-white",
  high: "bg-fail/80 text-white",
  medium: "bg-amber text-white",
  low: "bg-cream text-muted",
}

const severityLabels: Record<string, string> = {
  critical: "致命",
  high: "严重",
  medium: "一般",
  low: "轻微",
}

const statusOptions = [
  { label: "新建", value: "new" },
  { label: "已确认", value: "confirmed" },
  { label: "修复中", value: "fixing" },
  { label: "已修复", value: "fixed" },
  { label: "已关闭", value: "closed" },
]

const severityOptions = [
  { label: "致命", value: "critical" },
  { label: "严重", value: "high" },
  { label: "一般", value: "medium" },
  { label: "轻微", value: "low" },
]

const columns: CrudColumn[] = [
  { key: "title", title: "缺陷标题", width: "min-w-[160px]", align: "center" },
  {
    key: "severity",
    title: "严重度",
    width: "w-28",
    align: "center",
    render: (v: string) => (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityColors[v] || severityColors.low}`}>
        {severityLabels[v] || (v ? (/[\u4e00-\u9fa5]/.test(v) ? v : "—") : "—")}
      </span>
    ),
  },
  {
    key: "status",
    title: "状态",
    width: "w-28",
    align: "center",
  },
  {
    key: "project_name",
    title: "项目",
    width: "min-w-[120px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "version_name",
    title: "版本",
    width: "min-w-[120px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "assignee",
    title: "责任人",
    width: "min-w-[100px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "created_at",
    title: "创建时间",
    width: "min-w-[160px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
]

export default function DefectsPage() {
  const toast = useToast()
  const [data, setData] = useState<Defect[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [severityFilter, setSeverityFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [projects, setProjects] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [versionOptions, setVersionOptions] = useState<{ label: string; value: string }[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingDefect, setEditingDefect] = useState<Defect | null>(null)
  /** 一键提交缺陷的预填数据（来自用例详情页跳转） */
  const [prefill, setPrefill] = useState<Record<string, any> | null>(null)

  // 支持从用例详情页「提交缺陷」跳转预填（?new=1&case_id=xx&case_title=xx&project_id=xx）
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get("new") !== "1") return
    const caseId = searchParams.get("case_id")
    const caseTitle = searchParams.get("case_title")
    const next: Record<string, any> = {}
    if (caseTitle) next.title = `[用例] ${caseTitle}`
    if (caseId) {
      next.test_case_id = Number(caseId)
      next.description = `关联用例 #${caseId}（${caseTitle || ""}）发现的缺陷`
    }
    const pid = searchParams.get("project_id")
    if (pid) next.project_id = Number(pid)
    const vid = searchParams.get("version_id")
    if (vid) next.version_id = Number(vid)
    setPrefill(next)
    setDialogMode("create")
    setEditingDefect(null)
    setDialogOpen(true)
    // 清理 URL 参数，避免刷新后重复弹出
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    projectApi
      .listProjects()
      .then((res) => setProjects(res?.data?.items || []))
      .catch(() => {})
    projectApi
      .listVersions()
      .then((res) => setVersions(res?.data?.items || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!editingDefect?.project_id) {
      setVersionOptions(versions.map((v: any) => ({ label: v.name, value: String(v.id) })))
    } else {
      setVersionOptions(
        versions
          .filter((v: any) => v.project_id === editingDefect.project_id)
          .map((v: any) => ({ label: v.name, value: String(v.id) }))
      )
    }
  }, [versions, editingDefect])

  const projectOptions = projects.map((p: any) => ({ label: p.name, value: String(p.id) }))

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索缺陷标题...", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "severity", label: "全部严重度", type: "select", options: severityOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: versionOptions },
  ]

  const fields: CrudField[] = [
    { key: "project_id", label: "项目", type: "select", options: projectOptions },
    { key: "version_id", label: "版本", type: "select", options: versionOptions },
    { key: "title", label: "缺陷标题", type: "text", required: true, placeholder: "请输入缺陷标题" },
    { key: "description", label: "描述", type: "textarea", placeholder: "请输入缺陷描述" },
    { key: "status", label: "状态", type: "select", options: statusOptions, default: "new" },
    { key: "severity", label: "严重度", type: "select", options: severityOptions, default: "medium" },
    { key: "assignee", label: "责任人", type: "text", placeholder: "请输入责任人姓名" },
    // 一键提交缺陷：关联用例 ID 隐藏展示（禁用输入）
    ...(prefill?.test_case_id
      ? ([
          {
            key: "test_case_id",
            label: "关联用例ID",
            type: "text" as const,
            disabled: true,
            helpText: "该缺陷由用例一键提交，自动关联",
          },
        ] as CrudField[])
      : []),
  ]

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      if (severityFilter) params.severity = severityFilter
      if (projectFilter) params.project_id = projectFilter
      if (versionFilter) params.version_id = versionFilter
      const res = await lifecycleApi.listDefects(params)
      const list = res?.data?.items || res?.data || (Array.isArray(res) ? res : [])
      setData(Array.isArray(list) ? list : [])
      setTotal(res?.data?.total ?? (Array.isArray(list) ? list.length : 0))
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchTerm, statusFilter, severityFilter, projectFilter, versionFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === "status") {
      setStatusFilter(value)
      setPage(1)
    } else if (key === "severity") {
      setSeverityFilter(value)
      setPage(1)
    } else if (key === "project") {
      setProjectFilter(value)
      setPage(1)
    } else if (key === "version") {
      setVersionFilter(value)
      setPage(1)
    }
  }, [])

  const handleCreate = useCallback(() => {
    setDialogMode("create")
    setEditingDefect(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: Defect) => {
    setDialogMode("edit")
    setEditingDefect(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: Defect) => {
    setDialogMode("view")
    setEditingDefect(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (row: Defect) => {
      if (!window.confirm(`确定要删除缺陷「${row.title}」吗？`)) return
      try {
        await lifecycleApi.deleteDefect(row.id)
        toast.success("删除成功")
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "删除失败")
      }
    },
    [toast, loadData]
  )

  const handleBatchDelete = useCallback(
    async (ids: (string | number)[]) => {
      if (!window.confirm(`确定要删除选中的 ${ids.length} 个缺陷吗？`)) return
      try {
        await lifecycleApi.batchDeleteDefects(ids as number[])
        toast.success("批量删除成功")
        setSelectedIds(new Set())
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "批量删除失败")
      }
    },
    [toast, loadData]
  )

  const handleSubmit = useCallback(
    async (formData: Record<string, any>) => {
      try {
        if (dialogMode === "create") {
          await lifecycleApi.createDefect(formData)
          toast.success("缺陷创建成功")
        } else if (dialogMode === "edit" && editingDefect) {
          await lifecycleApi.updateDefect(editingDefect.id, formData)
          toast.success("缺陷更新成功")
        }
        setDialogOpen(false)
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingDefect, toast, loadData]
  )

  const handleViewEdit = useCallback(() => {
    if (editingDefect) {
      setDialogMode("edit")
    }
  }, [editingDefect])

  const dialogTitle =
    dialogMode === "create" ? "新建缺陷" : dialogMode === "edit" ? "编辑缺陷" : "缺陷详情"

  return (
    <div>
      <CrudTable
        title="缺陷管理"
        subtitle="管理所有缺陷"
        columns={columns}
        filters={filters}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        selectedIds={selectedIds}
        statusConfig={statusConfig}
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSelectionChange={setSelectedIds}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        onBatchDelete={handleBatchDelete}
        emptyText="暂无缺陷数据"
        createButtonText="新建缺陷"
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fields}
        initialData={editingDefect || prefill || {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />
    </div>
  )
}
