import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Sparkles, Wand2, X } from "lucide-react"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import CrudDialog from "@/components/crud/CrudDialog"
import type { CrudField } from "@/components/crud/CrudDialog"
import { lifecycleApi } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { useConfirmStore } from "@/stores/confirmStore"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"
import { useCrudPage } from "@/hooks/useCrudPage"
import { useProjectOptions } from "@/hooks/useProjectOptions"

interface Requirement {
  id: number
  name: string
  code?: string
  description?: string
  status: string
  priority: string
  requirement_type?: string
  source?: string
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  created_at?: string
  ai_analysis?: any
}

const statusConfig = {
  draft: { label: "草稿", color: "bg-cream text-muted border border-border" },
  pending: { label: "待分析", color: "bg-cream text-muted border border-border" },
  active: { label: "进行中", color: "bg-info/10 text-info border border-info/20" },
  analyzing: { label: "分析中", color: "bg-amber/10 text-amber border border-amber/20" },
  analyzed: { label: "已分析", color: "bg-amber/10 text-amber border border-amber/20" },
  reviewed: { label: "已评审", color: "bg-info/10 text-info border border-info/20" },
  approved: { label: "已批准", color: "bg-pass/10 text-pass border border-pass/20" },
  archived: { label: "已归档", color: "bg-pass/10 text-pass border border-pass/20" },
}

const sourceConfig: Record<string, string> = {
  manual: "手动输入",
  ai_generated: "AI生成",
  upload: "文档上传",
  import: "导入",
}

const priorityConfig = {
  P0: { label: "P0 - 紧急", color: "text-fail font-semibold" },
  P1: { label: "P1 - 高", color: "text-amber font-semibold" },
  P2: { label: "P2 - 中", color: "text-info font-semibold" },
  P3: { label: "P3 - 低", color: "text-muted" },
}

const statusOptions = [
  { label: "草稿", value: "draft" },
  { label: "进行中", value: "active" },
  { label: "已归档", value: "archived" },
]

const priorityOptions = [
  { label: "P0 - 紧急", value: "P0" },
  { label: "P1 - 高", value: "P1" },
  { label: "P2 - 中", value: "P2" },
  { label: "P3 - 低", value: "P3" },
]

const requirementTypeOptions = [
  { label: "功能需求", value: "功能需求" },
  { label: "非功能需求", value: "非功能需求" },
  { label: "隐含需求", value: "隐含需求" },
]

const sourceOptions = [
  { label: "用户输入", value: "用户输入" },
  { label: "文档上传", value: "文档上传" },
  { label: "隐含推断", value: "隐含推断" },
]

const columns: CrudColumn[] = [
  { key: "name", title: "需求名称", width: "w-[220px]", align: "left" },
  {
    key: "code",
    title: "需求编号",
    width: "w-[120px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "project_name",
    title: "项目",
    width: "w-[100px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "version_name",
    title: "版本",
    width: "w-[110px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  { key: "priority", title: "优先级", width: "w-[90px]", align: "center" },
  { key: "status", title: "状态", width: "w-[80px]", align: "center" },
  {
    key: "requirement_type",
    title: "类型",
    width: "w-[100px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  {
    key: "source",
    title: "来源",
    width: "w-[90px]",
    align: "center",
    render: (v: string) => {
      if (!v) return <span className="text-muted">—</span>
      const label = sourceConfig[v] || v
      return <span className="text-sm text-ink">{label}</span>
    },
  },
  {
    key: "created_at",
    title: "创建时间",
    width: "w-[140px]",
    align: "center",
    render: (v: string) => (
      <span className="text-sm text-ink font-mono">{formatDateTime(v)}</span>
    ),
  },
]

export default function RequirementsPage() {
  const toast = useToast()
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null)

  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const [showAiAnalysis, setShowAiAnalysis] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<number | null>(null)
  const [aiOutput, setAiOutput] = useState<string>("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiEventSourceRef = useRef<{ close: () => void } | null>(null)
  const isAnalyzingRef = useRef(false)

  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing
  }, [isAnalyzing])

  useEffect(() => {
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
      if (aiEventSourceRef.current) aiEventSourceRef.current.close()
    }
  }, [])

  const fetchFn = useCallback(
    (params: Record<string, any>) => lifecycleApi.listRequirements(params),
    [],
  )

  const {
    data, total, page, setPage, pageSize, setPageSize,
    loading, searchTerm, setSearchTerm, reload,
  } = useCrudPage<Requirement>({ fetchFn })

  const {
    projectOptions,
    getVersionOptionsForProject,
  } = useProjectOptions()

  const dialogVersionOptions = useMemo(
    () => getVersionOptionsForProject(editingRequirement?.project_id),
    [getVersionOptionsForProject, editingRequirement?.project_id],
  )

  const filterVersionOptions = useMemo(
    () => getVersionOptionsForProject(projectFilter || undefined),
    [getVersionOptionsForProject, projectFilter],
  )

  const filters: CrudFilter[] = [
    { key: "search", label: "搜索需求名称...", type: "search" },
    { key: "status", label: "全部状态", type: "select", options: statusOptions },
    { key: "priority", label: "全部优先级", type: "select", options: priorityOptions },
    { key: "project", label: "全部项目", type: "select", options: projectOptions },
    { key: "version", label: "全部版本", type: "select", options: filterVersionOptions },
  ]

  const fields: CrudField[] = [
    { key: "project_id", label: "项目", type: "select", options: projectOptions },
    { key: "version_id", label: "版本", type: "select", options: dialogVersionOptions },
    { key: "name", label: "需求名称", type: "text", required: true, placeholder: "请输入需求名称" },
    { key: "description", label: "需求描述", type: "textarea", placeholder: "请输入详细的需求描述" },
    { key: "priority", label: "优先级", type: "select", options: priorityOptions, default: "P2" },
    { key: "status", label: "状态", type: "select", options: statusOptions, default: "draft" },
    { key: "requirement_type", label: "需求类型", type: "select", options: requirementTypeOptions },
    { key: "source", label: "来源", type: "select", options: sourceOptions },
  ]

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setPage(1)
  }, [setSearchTerm, setPage])

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === "status") setStatusFilter(value)
    else if (key === "priority") setPriorityFilter(value)
    else if (key === "project") setProjectFilter(value)
    else if (key === "version") setVersionFilter(value)
    setPage(1)
  }, [setPage])

  const handleCreate = useCallback(() => {
    setDialogMode("create")
    setEditingRequirement(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((row: Requirement) => {
    setDialogMode("edit")
    setEditingRequirement(row)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((row: Requirement) => {
    setDialogMode("view")
    setEditingRequirement(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (row: Requirement) => {
      const confirmed = await useConfirmStore.getState().confirm({
        title: "确认删除",
        message: "确定要删除该需求吗？删除后不可恢复。",
        itemName: row.name,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.deleteRequirement(row.id)
        toast.success("删除成功")
        reload()
      } catch (e: any) {
        toast.error(e?.message || "删除失败")
      }
    },
    [toast, reload],
  )

  const handleBatchDelete = useCallback(
    async (ids: (string | number)[]) => {
      const confirmed = await useConfirmStore.getState().confirm({
        title: "批量删除",
        message: `确定要删除选中的 ${ids.length} 个需求吗？删除后不可恢复。`,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.batchDeleteRequirements(ids as number[])
        toast.success("批量删除成功")
        setSelectedIds(new Set())
        reload()
      } catch (e: any) {
        toast.error(e?.message || "批量删除失败")
      }
    },
    [toast, reload],
  )

  const handleSubmit = useCallback(
    async (formData: Record<string, any>) => {
      try {
        if (dialogMode === "create") {
          await lifecycleApi.createRequirement(formData)
          toast.success("需求创建成功")
        } else if (dialogMode === "edit" && editingRequirement) {
          await lifecycleApi.updateRequirement(editingRequirement.id, formData)
          toast.success("需求更新成功")
        }
        setDialogOpen(false)
        reload()
      } catch (e: any) {
        toast.error(e?.message || "操作失败")
      }
    },
    [dialogMode, editingRequirement, toast, reload],
  )

  const handleViewEdit = useCallback(() => {
    if (editingRequirement) setDialogMode("edit")
  }, [editingRequirement])

  const handleUpload = useCallback(async () => {
    if (!uploadFile) {
      toast.error("请选择要上传的文件")
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      await lifecycleApi.uploadRequirement(formData)
      toast.success("文档上传成功")
      setShowUploadDialog(false)
      setUploadFile(null)
      reload()
    } catch (e: any) {
      toast.error(e?.message || "上传失败")
    } finally {
      setUploading(false)
    }
  }, [uploadFile, toast, reload])

  const startAiAnalysis = useCallback(
    async (req: Requirement) => {
      setAnalyzingId(req.id)
      setShowAiAnalysis(true)
      setAiOutput("")
      setIsAnalyzing(true)

      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current)
        aiTimeoutRef.current = null
      }

      try {
        const eventSource = lifecycleApi.analyzeRequirementSSE(req.id)
        aiEventSourceRef.current = eventSource

        const resetAiTimeout = () => {
          if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
          aiTimeoutRef.current = setTimeout(() => {
            if (isAnalyzingRef.current) {
              setIsAnalyzing(false)
              setAiOutput((prev) => prev + "\n\n⏱️ 分析超时")
              if (aiEventSourceRef.current) {
                aiEventSourceRef.current.close()
                aiEventSourceRef.current = null
              }
            }
          }, 120000)
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === "thinking") {
              setAiOutput((prev) => prev + "\n💭 " + data.content)
              resetAiTimeout()
            } else if (data.type === "output") {
              setAiOutput((prev) => prev + "\n✨ " + data.content)
              resetAiTimeout()
            } else if (data.type === "suggestion") {
              setAiOutput((prev) => prev + "\n💡 " + data.content)
              resetAiTimeout()
            } else if (data.type === "chunk") {
              setAiOutput((prev) => prev + data.content)
              resetAiTimeout()
            } else if (data.type === "error") {
              setAiOutput((prev) => prev + "\n\n❌ " + data.content)
              setIsAnalyzing(false)
              eventSource.close()
            } else if (data.type === "done") {
              setAiOutput((prev) => prev + "\n\n✅ 分析完成！")
              setIsAnalyzing(false)
              if (aiTimeoutRef.current) {
                clearTimeout(aiTimeoutRef.current)
                aiTimeoutRef.current = null
              }
              eventSource.close()
            }
          } catch {
            setAiOutput((prev) => prev + event.data)
          }
        }

        eventSource.onerror = () => {
          setAiOutput((prev) => prev + "\n\n⚠️ 连接已关闭")
          setIsAnalyzing(false)
          if (aiTimeoutRef.current) {
            clearTimeout(aiTimeoutRef.current)
            aiTimeoutRef.current = null
          }
          eventSource.close()
        }

        aiTimeoutRef.current = setTimeout(() => {
          if (isAnalyzingRef.current) {
            setIsAnalyzing(false)
            setAiOutput((prev) => prev + "\n\n⏱️ 分析超时")
            if (aiEventSourceRef.current) {
              aiEventSourceRef.current.close()
              aiEventSourceRef.current = null
            }
          }
        }, 120000)
      } catch (e: any) {
        toast.error("AI分析失败: " + e.message)
        setIsAnalyzing(false)
      }
    },
    [toast],
  )

  const dialogTitle =
    dialogMode === "create" ? "新建需求" : dialogMode === "edit" ? "编辑需求" : "需求详情"

  return (
    <div>
      <CrudTable
        title="需求管理"
        subtitle="管理所有需求"
        columns={columns}
        filters={filters}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        selectedIds={selectedIds}
        statusConfig={statusConfig}
        priorityConfig={priorityConfig}
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        onSelectionChange={setSelectedIds}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        onBatchDelete={handleBatchDelete}
        emptyText="暂无需求数据"
        createButtonText="新建需求"
        toolbarExtra={
          <>
            <button
              onClick={() => setShowUploadDialog(true)}
              className="h-9 px-4 rounded-xl bg-white border border-border text-ink text-sm font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber" /> 上传文档
            </button>
            {analyzingId !== null && (
              <button
                onClick={() => setShowAiAnalysis(true)}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber to-orange-500 text-white text-sm font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              >
                <Wand2 className="w-4 h-4" /> 查看 AI 分析
              </button>
            )}
          </>
        }
      />

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        title={dialogTitle}
        fields={fields}
        initialData={editingRequirement || {}}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onViewEdit={handleViewEdit}
      />

      {showUploadDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUploadDialog(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-elevated animate-scale-in">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-ink">上传需求文档</h3>
                <button onClick={() => setShowUploadDialog(false)} className="p-1 rounded-lg hover:bg-cream">
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-ink mb-1.5 block">选择文件</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xls,.pptx,.ppt,.csv,.xmind"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-ink file:mr-3 file:h-10 file:px-4 file:rounded-xl file:border-0 file:bg-amber/10 file:text-amber file:font-medium hover:file:bg-amber/20"
                  />
                  <p className="text-xs text-muted mt-1">支持 PDF、Word、Excel、PPT、TXT、Markdown、CSV、XMind 格式</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
                <button
                  onClick={() => setShowUploadDialog(false)}
                  className="h-9 px-4 rounded-xl border border-border text-ink-light text-sm hover:bg-cream transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                >
                  {uploading ? "上传中..." : "上传"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAiAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowAiAnalysis(false); setIsAnalyzing(false) }} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-elevated animate-scale-in">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-ink">AI 需求分析</h3>
                    <p className="text-xs text-muted">
                      {isAnalyzing ? "AI 正在分析需求内容..." : "分析完成"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowAiAnalysis(false); setIsAnalyzing(false) }}
                  className="p-1 rounded-lg hover:bg-cream"
                >
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>

              {isAnalyzing && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
                    <span className="text-xs text-muted">实时输出中...</span>
                  </div>
                  <div className="h-2 bg-cream rounded-full overflow-hidden">
                    <div className="h-full gradient-amber animate-pulse" style={{ width: "60%" }} />
                  </div>
                </div>
              )}

              <div className="bg-cream rounded-xl p-4 max-h-96 overflow-y-auto">
                {isAnalyzing ? (
                  <pre className="text-sm text-ink-light whitespace-pre-wrap font-mono">
                    {aiOutput || "等待AI输出..."}
                    <span className="animate-pulse">▊</span>
                  </pre>
                ) : (
                  <MarkdownPreview content={aiOutput} emptyText="等待AI输出..." />
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
                <button
                  onClick={() => { setShowAiAnalysis(false); setIsAnalyzing(false) }}
                  className="h-9 px-4 rounded-xl border border-border text-ink-light text-sm hover:bg-cream transition-colors"
                >
                  {isAnalyzing ? "取消" : "关闭"}
                </button>
                {!isAnalyzing && aiOutput && (
                  <button
                    onClick={() => {
                      toast.success("分析结果已应用")
                      setShowAiAnalysis(false)
                    }}
                    className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    应用结果
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {data.map((req) => (
        <div key={`ai-action-${req.id}`} className="hidden">
          <button
            onClick={() => startAiAnalysis(req)}
            data-ai-trigger={`req-${req.id}`}
          />
        </div>
      ))}
    </div>
  )
}
