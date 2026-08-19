import { useState, useEffect, useCallback } from "react"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi, projectApi } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"

interface Report {
  id: number
  title?: string
  name?: string
  report_type?: string
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  created_at?: string
}

const reportTypeOptions = [
  { label: "测试报告", value: "test" },
  { label: "性能报告", value: "performance" },
  { label: "质量报告", value: "quality" },
  { label: "总结报告", value: "summary" },
]

/** 报告类型英文值 → 中文映射 */
const reportTypeConfig: Record<string, string> = {
  test: "测试报告",
  performance: "性能报告",
  quality: "质量报告",
  summary: "总结报告",
  version: "版本报告",
  regression: "回归报告",
  trend: "趋势报告",
}

const columns: CrudColumn[] = [
  {
    key: "title",
    title: "报告名称",
    width: "min-w-[160px]",
    align: "center",
    render: (v: string, row: Report) => v || row.name || <span className="text-muted">—</span>,
  },
  {
    key: "report_type",
    title: "报告类型",
    width: "min-w-[120px]",
    align: "center",
    render: (v: string) => {
      if (!v) return <span className="text-muted">—</span>
      const label = reportTypeConfig[v]
      if (label) return <span className="text-sm text-ink">{label}</span>
      const isChinese = /[\u4e00-\u9fa5]/.test(v)
      return <span className="text-sm text-ink">{isChinese ? v : "—"}</span>
    },
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
    key: "created_at",
    title: "生成时间",
    width: "min-w-[160px]",
    align: "center",
    render: (v: string) => (
      <span className="text-sm text-ink font-mono">{formatDateTime(v)}</span>
    ),
  },
]

export default function ReportsPage() {
  const toast = useToast()
  const [data, setData] = useState<Report[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [reportTypeFilter, setReportTypeFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [projects, setProjects] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [versionOptions, setVersionOptions] = useState<{ label: string; value: string }[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingReport, setEditingReport] = useState<Report | null>(null)

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
    if (!editingReport?.project_id) {
      setVersionOptions(versions.map((v: any) => ({ label: v.name, value: String(v.id) })))
    } else {
      setVersionOptions(
        versions
          .filter((v: any) => v.project_id === editingReport.project_id)
          .map((v: any) => ({ label: v.name, value: String(v.id) }))
      )
    }
  }, [versions, editingReport])

  const projectOptions = projects.map((p: any) => ({ label: p.name, value: String(p.id) }))

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索报告名称...", type: "search" },
    { key: "report_type", label: "全部报告类型", type: "select", options: reportTypeOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: versionOptions },
  ]

  const fields: CrudField[] = [
    { key: "project_id", label: "项目", type: "select", options: projectOptions },
    { key: "version_id", label: "版本", type: "select", options: versionOptions },
    { key: "title", label: "报告名称", type: "text", required: true, placeholder: "请输入报告名称" },
    { key: "report_type", label: "报告类型", type: "select", options: reportTypeOptions, default: "test" },
    { key: "name", label: "负责人", type: "text", placeholder: "请输入负责人姓名" },
  ]

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (searchTerm) params.search = searchTerm
      if (reportTypeFilter) params.report_type = reportTypeFilter
      if (projectFilter) params.project_id = projectFilter
      if (versionFilter) params.version_id = versionFilter
      const res = await lifecycleApi.listReports(params)
      const list = res?.data?.items || res?.data || (Array.isArray(res) ? res : [])
      setData(Array.isArray(list) ? list : [])
      setTotal(res?.data?.total ?? (Array.isArray(list) ? list.length : 0))
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchTerm, reportTypeFilter, projectFilter, versionFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === "report_type") {
      setReportTypeFilter(value)
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
    setEditingReport(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: Report) => {
    setDialogMode("edit")
    setEditingReport(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: Report) => {
    setDialogMode("view")
    setEditingReport(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (row: Report) => {
      if (!window.confirm(`确定要删除报告「${row.title || row.name}」吗？`)) return
      try {
        await lifecycleApi.deleteReport(row.id)
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
      if (!window.confirm(`确定要删除选中的 ${ids.length} 条报告吗？`)) return
      try {
        await lifecycleApi.batchDeleteReports(ids as number[])
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
          await lifecycleApi.createReport(formData)
          toast.success("报告创建成功")
        } else if (dialogMode === "edit" && editingReport) {
          await lifecycleApi.updateReport(editingReport.id, formData)
          toast.success("报告更新成功")
        }
        setDialogOpen(false)
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingReport, toast, loadData]
  )

  const handleViewEdit = useCallback(() => {
    if (editingReport) {
      setDialogMode("edit")
    }
  }, [editingReport])

  const dialogTitle =
    dialogMode === "create" ? "新建报告" : dialogMode === "edit" ? "编辑报告" : "报告详情"

  return (
    <div>
      <CrudTable
        title="测试报告"
        subtitle="管理所有测试报告"
        columns={columns}
        filters={filters}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        selectedIds={selectedIds}
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
        emptyText="暂无报告数据"
        createButtonText="新建报告"
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fields}
        initialData={editingReport || {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />
    </div>
  )
}
