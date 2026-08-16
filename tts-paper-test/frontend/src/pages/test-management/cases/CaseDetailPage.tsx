/**
 * 测试用例详情页
 *
 * 嵌套路由 /test-management/cases/:id（在 TestManagementLayout 模块壳内渲染）
 * 对标竞品 TestHub：详情页保持在模块左右布局壳内（左侧菜单不变），
 * 面包屑定位 + 工具栏 + 内容区，所有操作（编辑/删除）均以弹窗完成，不跳转新页面。
 *
 * 详情内容采用 detail-section 分区式结构：
 *   - 基本信息（detail-row 标签/值成对排列）
 *   - 前置条件 / 测试步骤 / 预期结果 各占独立分区卡片
 *   - 评审记录
 */
import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { lifecycleApi } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { useConfirmStore } from "@/stores/confirmStore"
import DetailPageLayout from "@/components/layout/DetailPageLayout"
import CrudDialog from "@/components/crud/CrudDialog"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"
import { Skeleton } from "@/components/ui/Skeleton"
import {
  Info, ClipboardList, ListChecks, Target, Star,
  Edit2, Trash2, FileText, User, Clock, Zap, Bug,
} from "lucide-react"
import {
  type TestCase,
  statusConfig,
  priorityConfig,
  testTypeConfig,
  caseFields,
} from "./caseConfig"

/** 用例类型中文显示 */
function typeLabel(v?: string): string {
  if (!v) return "—"
  const label = testTypeConfig[v]
  if (label) return label
  return /[\u4e00-\u9fa5]/.test(v) ? v : "—"
}

/** 步骤字段：后端 steps 为 list，兼容 string 写法 */
function stepsToText(steps?: string[] | string): string {
  if (!steps) return ""
  if (Array.isArray(steps)) return steps.join("\n")
  return steps
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const caseId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [detail, setDetail] = useState<TestCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const res = await lifecycleApi.getTestCase(caseId)
      const data = res?.data
      if (!data || typeof data !== "object") {
        setLoadError("未找到该测试用例")
      } else {
        setDetail(data as TestCase)
      }
    } catch {
      setLoadError("加载测试用例详情失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  /** 返回用例列表 */
  const handleBack = useCallback(() => {
    navigate("/test-management/cases")
  }, [navigate])

  /** 删除用例（ConfirmDialog 确认，通过后返回列表） */
  const handleDelete = useCallback(async () => {
    if (!detail) return
    const confirmed = await useConfirmStore.getState().confirm({
      title: "确认删除",
      message: "确定要删除该测试用例吗？删除后不可恢复。",
      itemName: detail.name,
      confirmText: "删除",
      danger: true,
    })
    if (!confirmed) return
    try {
      await lifecycleApi.deleteTestCase(detail.id)
      toast.success("用例删除成功")
      navigate("/test-management/cases")
    } catch (e: any) {
      toast.error(e?.message || "删除失败")
    }
  }, [detail, toast, navigate])

  /** 一键提交缺陷：跳转缺陷页并预填创建表单（PingCode 对齐：一键提交缺陷） */
  const handleSubmitDefect = useCallback(() => {
    if (!detail) return
    const params = new URLSearchParams({
      new: "1",
      case_id: String(detail.id),
      case_title: detail.name,
    })
    if (detail.project_id) params.set("project_id", String(detail.project_id))
    if (detail.version_id) params.set("version_id", String(detail.version_id))
    navigate(`/test-management/defects?${params.toString()}`)
  }, [detail, navigate])

  /** 编辑提交 */
  const handleSubmit = useCallback(
    async (formData: Record<string, any>) => {
      try {
        await lifecycleApi.updateTestCase(caseId, formData)
        toast.success("用例更新成功")
        setDialogOpen(false)
        loadDetail()
      } catch (e: any) {
        toast.error(e?.message || "更新失败")
      }
    },
    [caseId, toast, loadDetail]
  )

  /** 面包屑：父级链路 + 当前页（最后一项由工具栏标题展示；模块壳已有「测试管理」层级，故从「测试用例」起） */
  const crumbs = [
    { label: "测试用例", path: "/test-management/cases" },
    { label: detail ? `#${detail.id} ${detail.name}` : `用例 #${caseId}` },
  ]

  /** 渲染详情页外壳（嵌套模式：无左侧导航，面包屑/工具栏统一） */
  const renderShell = (body: React.ReactNode) => (
    <DetailPageLayout
      crumbs={crumbs}
      onBack={handleBack}
      showNav={false}
      toolbar={
        detail && (
          <>
            <button
              onClick={handleSubmitDefect}
              title="关联当前用例，快速提交缺陷"
              className="h-9 px-4 rounded-xl border border-fail/30 bg-fail/5 text-fail text-sm font-medium shadow-sm hover:shadow-md hover:bg-fail/10 transition-all flex items-center gap-2"
            >
              <Bug className="w-4 h-4" />
              提交缺陷
            </button>
            <button
              onClick={() => setDialogOpen(true)}
              className="h-9 px-4 rounded-xl bg-info text-white text-sm font-medium shadow-sm hover:shadow-md hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              编辑
            </button>
            <button
              onClick={handleDelete}
              className="h-9 px-4 rounded-xl bg-fail text-white text-sm font-medium shadow-sm hover:shadow-md hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </>
        )
      }
      subtitle={
        detail && (
          <>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> ID: {detail.id}
            </span>
            {detail.ai_generated && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber/10 text-amber border border-amber/20">
                <Zap className="w-3 h-3" /> AI 生成
              </span>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                statusConfig[detail.status]?.color || statusConfig.draft.color
              }`}
            >
              {statusConfig[detail.status]?.label || statusConfig.draft.label}
            </span>
            <span className={`text-xs font-semibold ${priorityConfig[detail.priority]?.color || priorityConfig.P2.color}`}>
              {priorityConfig[detail.priority]?.label || priorityConfig.P2.label}
            </span>
          </>
        )
      }
    >
      {body}
    </DetailPageLayout>
  )

  // ── 加载态 ──
  if (loading) {
    return renderShell(
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  // ── 错误态 ──
  if (loadError || !detail) {
    return renderShell(
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-fail/10 flex items-center justify-center mb-4">
          <FileText className="w-7 h-7 text-fail" />
        </div>
        <h3 className="text-base font-bold text-ink mb-1">加载失败</h3>
        <p className="text-sm text-muted mb-6 max-w-sm">{loadError || "未找到该测试用例"}</p>
        <button
          onClick={handleBack}
          className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream transition-colors"
        >
          返回用例列表
        </button>
      </div>
    )
  }

  const status = statusConfig[detail.status] || statusConfig.draft
  const stepsText = stepsToText(detail.steps)

  return renderShell(
    <>
      <div className="space-y-4">
        {/* ── 基本信息 ── */}
        <section
          id="detail-section-basic"
          className="bg-white rounded-2xl border border-border shadow-card p-5 scroll-mt-4"
        >
          <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-muted" /> 基本信息
          </h3>

          {/* detail-row：标签/值成对排列 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted w-20 flex-shrink-0">用例类型</span>
              <span className="text-ink">{typeLabel(detail.test_type)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted w-20 flex-shrink-0">所属模块</span>
              <span className="text-ink">{detail.module || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted w-20 flex-shrink-0">所属项目</span>
              <span className="text-ink">{detail.project_name || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted w-20 flex-shrink-0">所属版本</span>
              <span className="text-ink">{detail.version_name || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted w-20 flex-shrink-0 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> 创建人
              </span>
              <span className="text-ink">{detail.created_by ? `用户 #${detail.created_by}` : "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted w-20 flex-shrink-0 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 创建时间
              </span>
              <span className="text-ink font-mono">{formatDateTime(detail.created_at)}</span>
            </div>
            <div className="flex items-start gap-2 text-sm sm:col-span-2">
              <span className="text-muted w-20 flex-shrink-0 mt-1">用例描述</span>
              {detail.description ? (
                <div className="flex-1 min-w-0">
                  <MarkdownPreview content={detail.description} />
                </div>
              ) : (
                <span className="text-ink-light">—</span>
              )}
            </div>
          </div>
        </section>

        {/* ── 前置条件 ── */}
        <section
          id="detail-section-preconditions"
          className="bg-white rounded-2xl border border-border shadow-card p-5 scroll-mt-4"
        >
          <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-muted" /> 前置条件
          </h3>
          <div className="bg-cream/50 rounded-xl p-4 text-sm text-ink-light leading-relaxed whitespace-pre-wrap">
            {detail.preconditions || "无"}
          </div>
        </section>

        {/* ── 测试步骤 ── */}
        <section
          id="detail-section-steps"
          className="bg-white rounded-2xl border border-border shadow-card p-5 scroll-mt-4"
        >
          <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-muted" /> 测试步骤
          </h3>
          <div className="bg-cream/50 rounded-xl p-4 text-sm text-ink-light leading-loose whitespace-pre-wrap">
            {stepsText || "无"}
          </div>
        </section>

        {/* ── 预期结果 ── */}
        <section
          id="detail-section-expected"
          className="bg-white rounded-2xl border border-border shadow-card p-5 scroll-mt-4"
        >
          <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-muted" /> 预期结果
          </h3>
          <div className="bg-cream/50 rounded-xl p-4 text-sm text-ink-light leading-relaxed whitespace-pre-wrap">
            {detail.expected_result || "无"}
          </div>
        </section>

        {/* ── 评审记录 ── */}
        <section
          id="detail-section-review"
          className="bg-white rounded-2xl border border-border shadow-card p-5 scroll-mt-4"
        >
          <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-muted" /> 评审记录
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-cream/50 rounded-xl p-4">
              <p className="text-xs text-muted mb-1">评审状态</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
            <div className="bg-cream/50 rounded-xl p-4">
              <p className="text-xs text-muted mb-1">评审人</p>
              <p className="text-sm text-ink">{detail.reviewed_by ? `用户 #${detail.reviewed_by}` : "—"}</p>
            </div>
            <div className="bg-cream/50 rounded-xl p-4">
              <p className="text-xs text-muted mb-1">评审时间</p>
              <p className="text-sm text-ink font-mono">{detail.reviewed_at ? formatDateTime(detail.reviewed_at) : "—"}</p>
            </div>
          </div>
        </section>
      </div>

      {/* 编辑弹窗（复用 CrudDialog） */}
      <CrudDialog
        open={dialogOpen}
        mode="edit"
        title={`编辑用例 #${detail.id}`}
        fields={caseFields}
        initialData={detail}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  )
}
