/**
 * 缺陷看板 - 按状态分列拖拽视图 + API对接
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { Bug, Eye, Edit, Sparkles, RefreshCw, GripVertical } from "lucide-react"
import { toast } from "sonner"
import PreviewModal from "../../requirement-testing/components/PreviewModal"
import { lifecycleApi } from "@/lib/api"

const columns = [
  { key: "新建", color: "border-warn/40 bg-warn/5", statusEn: "new" },
  { key: "已确认", color: "border-info/40 bg-info/5", statusEn: "open" },
  { key: "修复中", color: "border-purple-300 bg-purple-50/50", statusEn: "in_progress" },
  { key: "已修复", color: "border-pass/40 bg-pass/5", statusEn: "resolved" },
  { key: "已关闭", color: "border-border bg-cream/30", statusEn: "closed" },
]

const STATUS_MAP: Record<string, string> = { new: "新建", open: "已确认", in_progress: "修复中", resolved: "已修复", verified: "已验证", closed: "已关闭", reopened: "重新打开" }
const REVERSE_STATUS: Record<string, string> = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, k]))

const initialDefects = [
  { id: 1, title: "登录密码框无明文切换", module: "登录模块", severity: "一般", priority: "P1", status: "修复中", assignee: "zhangsan" },
  { id: 2, title: "搜索分页显示不正确", module: "搜索模块", severity: "严重", priority: "P0", status: "已修复", assignee: "wangwu" },
  { id: 3, title: "购物车数量可减到0", module: "购物车", severity: "一般", priority: "P1", status: "已确认", assignee: "zhangsan" },
  { id: 4, title: "支付超时订单状态异常", module: "支付模块", severity: "致命", priority: "P0", status: "新建", assignee: "" },
  { id: 5, title: "头像上传超2MB无提示", module: "用户管理", severity: "轻微", priority: "P2", status: "已修复", assignee: "lisi" },
  { id: 6, title: "CSV导出中文乱码", module: "订单模块", severity: "严重", priority: "P0", status: "已确认", assignee: "wangwu" },
  { id: 7, title: "邮件模板格式错乱", module: "通知模块", severity: "轻微", priority: "P2", status: "已关闭", assignee: "lisi" },
  { id: 8, title: "登录无速率限制", module: "登录模块", severity: "致命", priority: "P0", status: "修复中", assignee: "admin" },
  { id: 9, title: "购物车并发数量异常", module: "购物车", severity: "严重", priority: "P0", status: "新建", assignee: "" },
]

const severityBadge = (s: string) => {
  if (s === "致命") return "bg-fail text-white"
  if (s === "严重") return "bg-fail/10 text-fail"
  if (s === "一般") return "bg-warn/10 text-warn"
  return "bg-cream text-muted"
}

export default function DefectKanban() {
  const [defects, setDefects] = useState(initialDefects)
  const [previewDefect, setPreviewDefect] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const fetchDefects = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await lifecycleApi.listDefects({ page: 1, page_size: 100 })
      if (res?.data?.items) {
        const mapped = res.data.items.map((d: any) => ({
          id: d.id,
          title: d.title,
          module: d.module || "未指定",
          severity: d.severity || "一般",
          priority: d.priority || "P2",
          status: (STATUS_MAP as Record<string, string>)[d.status] || d.status,
          assignee: d.assigned_to ? String(d.assigned_to) : "",
        }))
        setDefects(mapped)
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDefects() }, [fetchDefects])

  // 拖拽处理
  const handleDragStart = (e: React.DragEvent, defectId: number) => {
    setDragId(defectId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", String(defectId))
    // 半透明拖拽预览
    const el = e.currentTarget as HTMLElement
    el.style.opacity = "0.5"
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDragId(null)
    setDropTarget(null)
    const el = e.currentTarget as HTMLElement
    el.style.opacity = "1"
  }

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTarget(colKey)
  }

  const handleDragLeave = () => {
    setDropTarget(null)
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    setDropTarget(null)
    const defectId = Number(e.dataTransfer.getData("text/plain"))
    if (!defectId) return

    const defect = defects.find((d) => d.id === defectId)
    if (!defect || defect.status === targetStatus) return

    // 乐观更新
    setDefects((prev) => prev.map((d) => d.id === defectId ? { ...d, status: targetStatus } : d))

    // 调用 API 更新状态
    const statusEn = REVERSE_STATUS[targetStatus] || targetStatus
    try {
      await lifecycleApi.updateDefect(defectId, { status: statusEn })
      toast.success(`缺陷 #${defectId} 已移至「${targetStatus}」`)
    } catch {
      // 回滚
      setDefects((prev) => prev.map((d) => d.id === defectId ? { ...d, status: defect.status } : d))
      toast.error("状态更新失败")
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3 flex items-center justify-between">
        <div><h2 className="text-base font-semibold text-ink">看板视图</h2><p className="text-xs text-muted mt-0.5">拖拽缺陷卡片到不同列来变更状态</p></div>
        <button onClick={fetchDefects} className="h-8 px-3 rounded-lg border border-border text-xs text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
      </div>
      <div className="flex gap-3 overflow-x-auto flex-1 pb-2">
        {columns.map((col) => {
          const items = defects.filter((d) => d.status === col.key)
          const isOver = dropTarget === col.key
          return (
            <div
              key={col.key}
              className={`flex-shrink-0 w-72 border rounded-2xl flex flex-col transition-colors ${col.color} ${isOver ? "ring-2 ring-amber ring-offset-2" : ""}`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{col.key}</span>
                  <span className="text-[11px] text-muted bg-white/80 px-1.5 py-0.5 rounded-full">{items.length}</span>
                </div>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[80px]">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted text-xs">暂无缺陷</div>
                ) : items.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, d.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-xl border border-border/50 p-3 hover:shadow-card transition-all cursor-grab active:cursor-grabbing ${dragId === d.id ? "opacity-50 scale-95" : ""}`}
                    onClick={() => setPreviewDefect(d)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${severityBadge(d.severity)}`}>{d.severity}</span>
                      <div className="flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-muted-light" />
                        <span className="text-[10px] text-muted">#{d.id}</span>
                      </div>
                    </div>
                    <h4 className="text-xs font-medium text-ink mb-1.5 line-clamp-2">{d.title}</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted">{d.module}</span>
                      <span className="text-[10px] text-muted">{d.assignee || "未分配"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {previewDefect && <PreviewModal title={`#${previewDefect.id} ${previewDefect.title}`} content={`| 字段 | 值 |\n|------|----|\n| 严重程度 | ${previewDefect.severity} |\n| 优先级 | ${previewDefect.priority} |\n| 模块 | ${previewDefect.module} |\n| 指派人 | ${previewDefect.assignee || "未分配"} |`} onClose={() => setPreviewDefect(null)} />}
    </div>
  )
}
