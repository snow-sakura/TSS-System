import { useState, useEffect, useCallback, useMemo } from "react"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { projectApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import { useConfirmStore } from "@/stores/confirmStore"
import { useCrudPage } from "@/hooks/useCrudPage"

interface Version {
  id: number
  name: string
  version_no?: string
  project_id?: number
  project_name?: string
  description?: string
  status: string
  release_date?: string
}

const statusConfig = {
  draft: { label: "草稿", color: "bg-cream text-muted border border-border" },
  in_progress: { label: "开发中", color: "bg-info/10 text-info border border-info/20" },
  testing: { label: "测试中", color: "bg-amber/10 text-amber border border-amber/20" },
  released: { label: "已发布", color: "bg-pass/10 text-pass border border-pass/20" },
  archived: { label: "已归档", color: "bg-cream text-muted border border-border" },
}

const statusOptions = [
  { label: "草稿", value: "draft" },
  { label: "开发中", value: "in_progress" },
  { label: "测试中", value: "testing" },
  { label: "已发布", value: "released" },
  { label: "已归档", value: "archived" },
]

const columns: CrudColumn[] = [
  { key: "name", title: "版本名称", width: "min-w-[140px]", align: "center" },
  { key: "version_no", title: "版本号", width: "min-w-[110px]", align: "center" },
  { key: "description", title: "描述", width: "min-w-[180px]", align: "center", render: (v: string) => v || "—" },
  { key: "status", title: "状态", width: "w-28", align: "center" },
  { key: "release_date", title: "发布日期", width: "min-w-[110px]", align: "center", render: (v: string) => v ? new Date(v).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—" },
]

const filters: CrudFilter[] = [
  { key: "search", label: "搜索版本名称或版本号...", type: "search" },
  { key: "project_id", label: "全部项目", type: "select", options: [] },
  { key: "status", label: "全部状态", type: "select", options: statusOptions },
]

const fields: CrudField[] = [
  { key: "project_id", label: "所属项目", type: "select", options: [], required: true },
  { key: "name", label: "版本名称", type: "text", required: true, placeholder: "请输入版本名称" },
  { key: "version_no", label: "版本号", type: "text", placeholder: "例如 v1.0.0" },
  { key: "description", label: "描述", type: "textarea", placeholder: "请输入版本描述" },
  { key: "status", label: "状态", type: "select", options: statusOptions, default: "draft" },
  { key: "release_date", label: "发布日期", type: "date" },
]

export default function VersionManagementPage() {
  const toast = useToast()
  const [projectFilter, setProjectFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingVersion, setEditingVersion] = useState<Version | null>(null)

  const [projectOptions, setProjectOptions] = useState<{ label: string; value: string }[]>([])

  const fetchFn = useCallback((params: Record<string, any>) => projectApi.listVersions(params), [])

  const extraFilters = useMemo(
    () => ({
      project_id: projectFilter || undefined,
      status: statusFilter || undefined,
    }),
    [projectFilter, statusFilter],
  )

  const { data, total, page, setPage, pageSize, setPageSize, loading, searchTerm, setSearchTerm, reload } =
    useCrudPage<Version>({ fetchFn, extraFilters })

  const loadProjects = useCallback(async () => {
    try {
      const res = await projectApi.listProjects({ page_size: 100 })
      const list = res?.data?.items || res?.data || (Array.isArray(res) ? res : [])
      const opts = (Array.isArray(list) ? list : []).map((p: any) => ({
        label: p.name,
        value: String(p.id),
      }))
      setProjectOptions(opts)
    } catch {}
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === "project_id") {
      setProjectFilter(value)
      setPage(1)
    } else if (key === "status") {
      setStatusFilter(value)
      setPage(1)
    }
  }, [setPage])

  const handleCreate = useCallback(() => {
    setDialogMode("create")
    setEditingVersion(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: Version) => {
    setDialogMode("edit")
    setEditingVersion(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: Version) => {
    setDialogMode("view")
    setEditingVersion(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (row: Version) => {
    const confirmed = await useConfirmStore.getState().confirm({
      title: "确认删除",
      message: "确定要删除该版本吗？删除后不可恢复。",
      itemName: row.name,
      confirmText: "删除",
      danger: true,
    })
    if (!confirmed) return
    try {
      await projectApi.deleteVersion(row.id)
      toast.success("删除成功")
      reload()
    } catch (e: any) {
      toast.error(e?.message || "删除失败")
    }
  }, [toast, reload])

  const handleBatchDelete = useCallback(async (ids: (string | number)[]) => {
    const confirmed = await useConfirmStore.getState().confirm({
      title: "批量删除",
      message: `确定要删除选中的 ${ids.length} 个版本吗？删除后不可恢复。`,
      confirmText: "删除",
      danger: true,
    })
    if (!confirmed) return
    try {
      await projectApi.batchDeleteVersions(ids as number[])
      toast.success("批量删除成功")
      setSelectedIds(new Set())
      reload()
    } catch (e: any) {
      toast.error(e?.message || "批量删除失败")
    }
  }, [toast, reload])

  const handleSubmit = useCallback(async (formData: Record<string, any>) => {
    try {
      if (dialogMode === "create") {
        await projectApi.createVersion(formData)
        toast.success("版本创建成功")
      } else if (dialogMode === "edit" && editingVersion) {
        await projectApi.updateVersion(editingVersion.id, formData)
        toast.success("版本更新成功")
      }
      setDialogOpen(false)
      reload()
    } catch (e: any) {
      toast.error(e?.message || "操作失败")
    }
  }, [dialogMode, editingVersion, toast, reload])

  const handleViewEdit = useCallback(() => {
    if (editingVersion) {
      setDialogMode("edit")
    }
  }, [editingVersion])

  const dialogTitle =
    dialogMode === "create" ? "新建版本" :
    dialogMode === "edit" ? "编辑版本" : "版本详情"

  const projectFilterConfig = [...filters]
  const projectFilterList = projectFilterConfig.map((f) =>
    f.key === "project_id" ? { ...f, options: projectOptions } : f
  )

  const fieldsWithProjects = fields.map((f) =>
    f.key === "project_id" ? { ...f, options: projectOptions } : f
  )

  return (
    <div>
      <CrudTable
        title="版本管理"
        subtitle="管理项目的所有版本"
        columns={columns}
        filters={projectFilterList}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        selectedIds={selectedIds}
        statusConfig={statusConfig}
        onSearch={setSearchTerm}
        onFilterChange={handleFilterChange}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        onSelectionChange={setSelectedIds}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        onBatchDelete={handleBatchDelete}
        emptyText="暂无版本数据"
        createButtonText="新建版本"
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fieldsWithProjects}
        initialData={editingVersion ? {
          ...editingVersion,
          project_id: editingVersion.project_id ? String(editingVersion.project_id) : "",
        } : {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />
    </div>
  )
}
