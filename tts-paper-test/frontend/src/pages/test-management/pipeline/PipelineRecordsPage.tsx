import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"
import CrudTable from "@/components/crud/CrudTable"
import type { CrudColumn, CrudFilter } from "@/components/crud/CrudTable"
import { lifecycleApi, projectApi } from "@/lib/api"
import type { Project, Version } from "@/lib/api-types"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { useCrudPage } from "@/hooks/useCrudPage"
import { useConfirmStore } from "@/stores/confirmStore"
import {
  X, Clock, FileText, ClipboardList, Target, FlaskConical,
  CheckCircle, AlertCircle, ChevronDown, ChevronRight, Loader2, RotateCcw
} from "lucide-react"

interface PipelineRecordItem {
  id: number | string
  name?: string
  requirement?: string
  requirement_name?: string
  project_id?: number
  project_name?: string
  version_id?: number
  version_name?: string
  current_stage?: string
  status?: string
  started_at?: string
  completed_at?: string
  created_at?: string
  stage_results?: StageResult[]
  requirement_content?: string
  total_duration?: number
}

interface StageResult {
  stage: string
  label: string
  status: string
  content?: string
  result?: Record<string, unknown>
  duration?: number
  error?: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  success: { label: "成功", color: "bg-pass/10 text-pass border border-pass/20" },
  completed: { label: "成功", color: "bg-pass/10 text-pass border border-pass/20" },
  failed: { label: "失败", color: "bg-fail/10 text-fail border border-fail/20" },
  running: { label: "执行中", color: "bg-info/10 text-info border border-info/20" },
  partial: { label: "部分完成", color: "bg-amber/10 text-amber border border-amber/20" },
  pending: { label: "等待中", color: "bg-cream text-muted border border-border" },
}

const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "成功", value: "success" },
  { label: "失败", value: "failed" },
  { label: "执行中", value: "running" },
  { label: "部分完成", value: "partial" },
]

// 后端状态到前端显示状态的映射
const normalizeStatus = (status: string): string => {
  if (status === "completed") return "success"
  return status
}

const formatDate = (v?: string) => {
  if (!v) return <span className="text-muted">—</span>
  return <span className="text-sm text-ink font-mono">{formatDateTime(v)}</span>
}

const columns: CrudColumn[] = [
  { key: "id", title: "编号", width: "w-[70px]", align: "center" },
  {
    key: "requirement_name",
    title: "需求名称",
    width: "w-[220px]",
    align: "left",
    render: (v: string | null, row: PipelineRecordItem) =>
      v || row.name || <span className="text-muted">—</span>,
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
  {
    key: "current_stage",
    title: "阶段",
    width: "w-[100px]",
    align: "center",
    render: (v: string) => v || <span className="text-muted">—</span>,
  },
  { key: "status", title: "状态", width: "w-[90px]", align: "center" },
  {
    key: "started_at",
    title: "开始时间",
    width: "w-[140px]",
    align: "center",
    render: (v: string) => formatDate(v),
  },
  {
    key: "completed_at",
    title: "完成时间",
    width: "w-[140px]",
    align: "center",
    render: (v: string) => formatDate(v),
  },
]

// 步骤配置映射
const STAGE_LABEL_MAP: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; key: string }> = {
  "requirements": { label: "需求分析", icon: FileText, key: "analyze" },
  "test-plans": { label: "测试方案", icon: ClipboardList, key: "plan" },
  "test-points": { label: "测试点", icon: Target, key: "point" },
  "test-cases": { label: "测试用例", icon: FlaskConical, key: "case" },
  "test-review": { label: "用例评审", icon: CheckCircle, key: "review" },
}

export default function PipelineRecordsPage() {
  const toast = useToast()
  const navigate = useNavigate()

  const [statusFilter, setStatusFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [versionFilter, setVersionFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const [projects, setProjects] = useState<Project[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [versionOptions, setVersionOptions] = useState<{ label: string; value: string }[]>([])

  // 弹窗相关状态
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<PipelineRecordItem | null>(null)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())

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
    if (!projectFilter) {
      setVersionOptions(versions.map((v) => ({ label: v.name, value: String(v.id) })))
    } else {
      setVersionOptions(
        versions
          .filter((v) => String(v.project_id) === projectFilter)
          .map((v) => ({ label: v.name, value: String(v.id) }))
      )
    }
  }, [versions, projectFilter])

  const projectOptions = useMemo(
    () => projects.map((p) => ({ label: p.name, value: String(p.id) })),
    [projects]
  )

  const filters: CrudFilter[] = useMemo(
    () => [
      { key: "search", label: "搜索需求名称或记录ID...", type: "search" },
      { key: "status", label: "全部状态", type: "select", options: statusOptions },
      { key: "project", label: "全部项目", type: "select", options: projectOptions },
      { key: "version", label: "全部版本", type: "select", options: versionOptions },
    ],
    [projectOptions, versionOptions]
  )

  // 额外筛选条件
  const extraFilters: Record<string, string | undefined> = useMemo(
    () => ({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(projectFilter ? { project_id: projectFilter } : {}),
      ...(versionFilter ? { version_id: versionFilter } : {}),
    }),
    [statusFilter, projectFilter, versionFilter]
  )

  // 数据加载：封装 normalizeStatus 逻辑
  const fetchFn = useCallback(async (params: Record<string, unknown>) => {
    const res = await lifecycleApi.listPipelineRecords(params)
    const payload = (res as unknown as { data?: { items?: PipelineRecordItem[]; total?: number } })?.data ?? (res as unknown as { items?: PipelineRecordItem[]; total?: number })
    const list = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []
    const normalized = list.map((item) => ({
      ...item,
      status: normalizeStatus(item.status),
    }))
    return { data: { items: normalized, total: payload?.total ?? normalized.length } }
  }, [])

  const {
    data, total, page, setPage, pageSize, setPageSize,
    loading, searchTerm, setSearchTerm, reload,
  } = useCrudPage<PipelineRecordItem>({ fetchFn, extraFilters })

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      if (key === "status") {
        setStatusFilter(value)
        setPage(1)
      } else if (key === "project") {
        setProjectFilter(value)
        setVersionFilter("")
        setPage(1)
      } else if (key === "version") {
        setVersionFilter(value)
        setPage(1)
      }
    },
    [setPage]
  )

  // 点击查看详情 - 成功/失败都弹窗，失败记录额外显示继续执行按钮
  const handleView = useCallback(async (row: PipelineRecordItem) => {
    const normalizedStatus = normalizeStatus(row.status || "")
    // 所有状态都弹窗展示详情
    setDetailData(row)
    setDetailModalOpen(true)
    setDetailLoading(true)
    setExpandedStages(new Set())
    try {
      const res = await lifecycleApi.getPipelineRecord(row.id as number)
      const recordData = res?.data || res
      // 规范化返回数据的状态
      if (recordData) {
        recordData.status = normalizeStatus(recordData.status)
      }
      setDetailData(recordData || row)
      // 自动展开第一个步骤
      const stageResults = recordData?.stage_results
      if (stageResults && Array.isArray(stageResults) && stageResults.length > 0) {
        setExpandedStages(new Set([stageResults[0]?.stage]))
      }
    } catch {
      // 错误在 finally 中处理
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleEdit = useCallback((row: PipelineRecordItem) => {
    navigate(`/test-management/pipeline?recordId=${row.id}`)
  }, [navigate])

  const handleDelete = useCallback(
    async (row: PipelineRecordItem) => {
      const confirmed = await useConfirmStore.getState().confirm({
        title: "确认删除",
        message: "确定要删除该记录吗？删除后不可恢复。",
        itemName: String(row.requirement_name || row.name || row.id),
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.deletePipelineRecord(row.id as number)
        toast.success("删除成功")
        reload()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "删除失败")
      }
    },
    [toast, reload]
  )

  const handleBatchDelete = useCallback(
    async (ids: (string | number)[]) => {
      const confirmed = await useConfirmStore.getState().confirm({
        title: "批量删除",
        message: `确定要删除选中的 ${ids.length} 条记录吗？删除后不可恢复。`,
        confirmText: "删除",
        danger: true,
      })
      if (!confirmed) return
      try {
        await lifecycleApi.batchDeletePipelineRecords(ids as number[])
        toast.success("批量删除成功")
        setSelectedIds(new Set())
        reload()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "批量删除失败")
      }
    },
    [toast, reload]
  )

  const handleCreate = useCallback(() => {
    navigate("/test-management/pipeline")
  }, [navigate])

  // 切换步骤展开状态
  const toggleStage = (stage: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  // 格式化步骤结果为可读文本
  const formatStageResult = (result: Record<string, unknown> | unknown): string => {
    if (!result) return ""
    if (typeof result === "string") return result
    if (Array.isArray(result)) {
      return JSON.stringify(result, null, 2)
    }
    if (typeof result === "object") {
      return JSON.stringify(result, null, 2)
    }
    return String(result)
  }

  // 获取步骤内容
  const getStageContent = (stage: StageResult): string => {
    if (!stage) return ""
    // 优先使用 content 字段
    if (stage.content) return stage.content
    // 否则使用 result 字段
    if (stage.result) return formatStageResult(stage.result)
    return ""
  }

  return (
    <div>
      <CrudTable
        title="流水线记录"
        subtitle="查看AI流水线执行历史"
        columns={columns}
        filters={filters}
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
        emptyText="暂无流水线记录数据"
        createButtonText="新建流水线"
        showCreateButton
      />

      {/* 详情弹窗 */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* 弹窗头部 */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pass/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-pass" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink">流水线执行详情</h3>
                  <p className="text-xs text-muted">
                    {detailData?.requirement_name || detailData?.name || "未知需求"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-cream flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-amber animate-spin" />
                  <span className="ml-3 text-sm text-muted">加载中...</span>
                </div>
              ) : detailData ? (
                <div className="space-y-4">
                  {/* 基本信息 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-cream/50 rounded-xl">
                    <div>
                      <p className="text-xs text-muted mb-1">状态</p>
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        detailData.status === "success" ? "bg-pass/10 text-pass" :
                        detailData.status === "failed" ? "bg-fail/10 text-fail" :
                        "bg-info/10 text-info"
                      }`}>
                        {statusConfig[detailData.status || ""]?.label || detailData.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">总耗时</p>
                      <p className="text-sm font-medium text-ink">
                        {detailData.total_duration ? `${detailData.total_duration}s` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">开始时间</p>
                      {formatDate(detailData.started_at || detailData.created_at)}
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">完成时间</p>
                      {formatDate(detailData.completed_at)}
                    </div>
                  </div>

                  {/* 需求内容 */}
                  {detailData.requirement_content && (
                    <div className="p-4 bg-white border border-border rounded-xl">
                      <h4 className="text-sm font-semibold text-ink mb-2">需求描述</h4>
                      <div className="max-h-48 overflow-y-auto">
                        <MarkdownPreview content={detailData.requirement_content} />
                      </div>
                    </div>
                  )}

                  {/* 步骤详情 */}
                  <div>
                    <h4 className="text-sm font-semibold text-ink mb-3">执行步骤详情</h4>
                    <div className="space-y-2">
                      {detailData.stage_results && Array.isArray(detailData.stage_results) ? (
                        detailData.stage_results.map((stage: StageResult, index: number) => {
                          // 兼容后端数据格式：使用 key 字段
                          const stageKey = stage.stage || stage.key
                          // 判断步骤状态：优先使用 status 字段，否则根据内容推断
                          const hasContent = !!(stage.content && stage.content.trim()) || !!(stage.result && stage.result !== null)
                          const stageStatus = stage.status === "completed" || stage.status === "failed" 
                            ? stage.status 
                            : (hasContent ? "completed" : "pending")
                          const config = STAGE_LABEL_MAP[stageKey] || { label: stage.label || stageKey, icon: FileText, key: stageKey }
                          const Icon = config.icon
                          const isExpanded = expandedStages.has(stageKey)
                          const stageContent = getStageContent({ ...stage, status: stageStatus })

                          return (
                            <div key={stageKey} className="border border-border rounded-xl overflow-hidden">
                              <button
                                onClick={() => toggleStage(stageKey)}
                                className="w-full flex items-center gap-3 p-4 hover:bg-cream/30 transition-colors text-left"
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  stageStatus === "completed" ? "bg-pass text-white" :
                                  stageStatus === "failed" ? "bg-fail text-white" :
                                  "bg-info text-white"
                                }`}>
                                  {stageStatus === "completed" ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : stageStatus === "failed" ? (
                                    <AlertCircle className="w-4 h-4" />
                                  ) : (
                                    <Icon className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-ink">
                                      {index + 1}. {config.label}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                      stageStatus === "completed" ? "bg-pass/10 text-pass" :
                                      stageStatus === "failed" ? "bg-fail/10 text-fail" :
                                      "bg-info/10 text-info"
                                    }`}>
                                      {stageStatus === "completed" ? "已完成" : stageStatus === "failed" ? "失败" : "执行中"}
                                    </span>
                                    {stage.duration && (
                                      <span className="text-[10px] text-muted flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {stage.duration}s
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-muted" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted" />
                                )}
                              </button>

                              {/* 展开的步骤内容 - 富文本展示 */}
                              {isExpanded && (
                                <div className="border-t border-border p-4 bg-cream/30">
                                  {stageContent ? (
                                    <MarkdownPreview content={stageContent} />
                                  ) : stage.result ? (
                                    <div className="bg-white border border-border rounded-lg p-3 text-xs text-ink-light font-mono overflow-x-auto">
                                      {typeof stage.result === "object" ? (
                                        <pre className="whitespace-pre-wrap">{JSON.stringify(stage.result, null, 2)}</pre>
                                      ) : (
                                        stage.result
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted">暂无输出内容</p>
                                  )}
                                  
                                  {/* 错误信息 */}
                                  {stage.error && (
                                    <div className="mt-3 p-3 bg-fail/10 border border-fail/30 rounded-lg">
                                      <p className="text-xs text-fail font-medium">错误信息：</p>
                                      <p className="text-sm text-fail">{stage.error}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-sm text-muted text-center py-8">暂无步骤详情数据</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted text-center py-8">暂无数据</p>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted">
                {detailData?.status === "failed" && (
                  <span className="flex items-center gap-1 text-fail">
                    <AlertCircle className="w-3.5 h-3.5" />
                    执行失败，可从失败处继续
                  </span>
                )}
                {detailData?.status === "success" && (
                  <span className="flex items-center gap-1 text-pass">
                    <CheckCircle className="w-3.5 h-3.5" />
                    所有步骤已完成，结果已同步
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {detailData?.status === "failed" && (
                  <button
                    onClick={() => {
                      setDetailModalOpen(false)
                      navigate(`/test-management/pipeline?recordId=${detailData.id}&mode=continue`)
                    }}
                    className="h-9 px-4 rounded-lg bg-info text-white text-sm font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    从失败处继续执行
                  </button>
                )}
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="h-9 px-4 rounded-lg bg-amber text-white text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
