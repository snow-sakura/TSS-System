import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi, projectApi } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import { Play, Bug, Clock } from "lucide-react"
import SchedulesPage from "../schedules/SchedulesPage"

interface Execution {
  id: number
  name?: string
  title?: string
  status: "pending" | "running" | "completed" | "passed" | "failed" | "stopped"
  progress: number
  pass_rate?: number
  duration_ms?: number
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  created_at?: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "待执行", color: "bg-cream text-muted border border-border" },
  running: { label: "执行中", color: "bg-info/10 text-info border border-info/20" },
  completed: { label: "已完成", color: "bg-pass/10 text-pass border border-pass/20" },
  passed: { label: "已完成", color: "bg-pass/10 text-pass border border-pass/20" },
  failed: { label: "失败", color: "bg-fail/10 text-fail border border-fail/20" },
  stopped: { label: "已停止", color: "bg-warn/10 text-warn border border-warn/20" },
}

const statusOptions = [
  { label: "待执行", value: "pending" },
  { label: "执行中", value: "running" },
  { label: "已完成", value: "completed" },
  { label: "失败", value: "failed" },
]

export default function ExecutionsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  // 页内 Tab：执行记录 / 调度配置
  const [activeTab, setActiveTab] = useState<"executions" | "schedules">("executions")
  const [data, setData] = useState<Execution[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [projects, setProjects] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [versionOptions, setVersionOptions] = useState<{ label: string; value: string }[]>([])
  const [testCaseOptions, setTestCaseOptions] = useState<{ label: string; value: string }[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingExecution, setEditingExecution] = useState<Execution | null>(null)

  useEffect(() => {
    projectApi
      .listProjects()
      .then((res) => setProjects(res?.data?.items || []))
      .catch(() => {})
    projectApi
      .listVersions()
      .then((res) => setVersions(res?.data?.items || []))
      .catch(() => {})
    lifecycleApi
      .listTestCases({ page_size: 500 })
      .then((res) => {
        const items = res?.data?.items || res?.data || []
        setTestCaseOptions(
          (Array.isArray(items) ? items : []).map((c: any) => ({
            label: `#${c.id} ${c.title || c.name || "未命名用例"}`,
            value: String(c.id),
          }))
        )
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!editingExecution?.project_id) {
      setVersionOptions(versions.map((v: any) => ({ label: v.name, value: String(v.id) })))
    } else {
      setVersionOptions(
        versions
          .filter((v: any) => v.project_id === editingExecution.project_id)
          .map((v: any) => ({ label: v.name, value: String(v.id) }))
      )
    }
  }, [versions, editingExecution])

  const projectOptions = useMemo(
    () => projects.map((p: any) => ({ label: p.name, value: String(p.id) })),
    [projects]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      if (projectFilter) params.project_id = projectFilter
      if (versionFilter) params.version_id = versionFilter
      const res = await lifecycleApi.listExecutions(params)
      const list = res?.data?.items || res?.data || (Array.isArray(res) ? res : [])
      setData(Array.isArray(list) ? list : [])
      setTotal(res?.data?.total ?? (Array.isArray(list) ? list.length : 0))
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchTerm, statusFilter, projectFilter, versionFilter])

  const handleStart = useCallback(
    async (id: number) => {
      try {
        await lifecycleApi.startExecution(id)
        toast.success("执行已启动")
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "启动执行失败")
        return
      }
      // 建立 SSE 消费执行事件流（真实执行由 stream 端点驱动，事件到达即刷新列表）
      const es = lifecycleApi.streamExecutionSSE(id)
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data)
          if (payload?.type === "completed" || payload?.type === "error") {
            es.close()
          }
        } catch {
          // 非 JSON 事件忽略
        }
        loadData()
      }
      es.onerror = () => {
        // 服务端关流可能触发 error；由兜底定时器最终刷新，避免无限重连
        es.close()
      }
      // 兜底：60 秒后强制关闭并刷新一次，避免页面常驻时无限请求
      window.setTimeout(() => {
        es.close()
        loadData()
      }, 60000)
    },
    [toast, loadData]
  )

  /** 一键提交缺陷：跳转缺陷页并预填创建表单（PingCode 对齐：失败记录一键提交缺陷） */
  const handleSubmitDefect = useCallback(
    (row: Execution) => {
      const execName = row.name || row.title || `执行#${row.id}`
      const params = new URLSearchParams({
        new: "1",
        execution_id: String(row.id),
        execution_name: execName,
      })
      navigate(`/test-management/defects?${params.toString()}`)
    },
    [navigate]
  )

  const columns: CrudColumn[] = useMemo(
    () => [
      {
        key: "name",
        title: "执行名称",
        width: "w-[16%]",
        align: "center",
        render: (_v: string, row: Execution) => row.name || row.title || <span className="text-muted">—</span>,
      },
      {
        key: "project_name",
        title: "项目",
        width: "w-[12%]",
        align: "center",
        render: (v: string) => v || <span className="text-muted">—</span>,
      },
      {
        key: "version_name",
        title: "版本",
        width: "w-[12%]",
        align: "center",
        className: "hidden xl:table-cell",
        render: (v: string) => v || <span className="text-muted">—</span>,
      },
      { key: "status", title: "状态", width: "w-28", align: "center" },
      {
        key: "progress",
        title: "进度",
        width: "w-[18%]",
        align: "center",
        render: (_v: number, row: Execution) => {
          const pct = Math.round(row.pass_rate ?? row.progress ?? 0)
          return (
            <div className="flex items-center justify-center gap-2">
              <div className="w-20 h-1.5 bg-cream rounded-full overflow-hidden">
                <div className="h-full gradient-amber" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted">{pct}%</span>
              {(row.status === "pending" || row.status === "failed") && (
                <button
                  onClick={() => handleStart(row.id)}
                  className="p-1 rounded-lg hover:bg-pass/10 text-pass"
                  title="执行"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              {row.status === "failed" && (
                <button
                  onClick={() => handleSubmitDefect(row)}
                  className="p-1 rounded-lg hover:bg-fail/10 text-fail"
                  title="提交缺陷"
                >
                  <Bug className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        },
      },
      {
        key: "created_at",
        title: "创建时间",
        width: "w-[16%]",
        align: "center",
        className: "hidden xl:table-cell",
        render: (v: string) => v || <span className="text-muted">—</span>,
      },
    ],
    [handleStart, handleSubmitDefect]
  )

  const filters: CrudFilter[] = useMemo(
    () => [
      { key: "search", label: "搜索执行名称...", type: "search" },
      { key: "status", label: "全部状态", type: "select", options: statusOptions },
      { key: "project", label: "全部项目", type: "select", options: projectOptions },
      { key: "version", label: "全部版本", type: "select", options: versionOptions },
    ],
    [projectOptions, versionOptions]
  )

  const fields: CrudField[] = useMemo(
    () => [
      { key: "project_id", label: "项目", type: "select", options: projectOptions },
      { key: "version_id", label: "版本", type: "select", options: versionOptions },
      { key: "name", label: "执行名称", type: "text", required: true, placeholder: "请输入执行名称" },
      { key: "title", label: "标题", type: "text", placeholder: "请输入标题" },
      {
        key: "test_case_ids",
        label: "测试用例",
        type: "multiselect",
        options: testCaseOptions,
        helpText: "勾选要执行的用例，未选将无法启动执行",
      },
      { key: "status", label: "状态", type: "select", options: statusOptions, default: "pending" },
    ],
    [projectOptions, versionOptions, testCaseOptions]
  )

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
    setEditingExecution(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: Execution) => {
    setDialogMode("edit")
    setEditingExecution(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: Execution) => {
    setDialogMode("view")
    setEditingExecution(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (row: Execution) => {
      if (!window.confirm(`确定要删除执行「${row.name || row.title}」吗？`)) return
      try {
        await lifecycleApi.deleteExecution(row.id)
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
      if (!window.confirm(`确定要删除选中的 ${ids.length} 条执行记录吗？`)) return
      try {
        await lifecycleApi.batchDeleteExecutions(ids as number[])
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
          await lifecycleApi.createExecution(formData)
          toast.success("执行创建成功")
        } else if (dialogMode === "edit" && editingExecution) {
          await lifecycleApi.updateExecution(editingExecution.id, formData)
          toast.success("执行更新成功")
        }
        setDialogOpen(false)
        loadData()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingExecution, toast, loadData]
  )

  const handleViewEdit = useCallback(() => {
    if (editingExecution) {
      setDialogMode("edit")
    }
  }, [editingExecution])

  const dialogTitle =
    dialogMode === "create" ? "新建执行" : dialogMode === "edit" ? "编辑执行" : "执行详情"

  return (
    <div>
      {/* 页内 Tab：执行记录 / 调度配置 */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {([
          { key: "executions" as const, label: "执行记录", icon: Play },
          { key: "schedules" as const, label: "调度配置", icon: Clock },
        ]).map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "text-amber border-amber"
                  : "text-muted border-transparent hover:text-ink"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 执行记录（保持挂载，切换不丢筛选状态） */}
      <div className={activeTab === "executions" ? "" : "hidden"}>
      <CrudTable
        title="执行管理"
        subtitle="管理所有测试执行"
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
        emptyText="暂无执行数据"
        createButtonText="新建执行"
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fields}
        initialData={editingExecution || {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />
      </div>

      {/* 调度配置 */}
      {activeTab === "schedules" && <SchedulesPage />}
    </div>
  )
}