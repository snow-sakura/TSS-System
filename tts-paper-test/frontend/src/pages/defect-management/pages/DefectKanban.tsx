/**
 * 缺陷看板 - 按状态分列拖拽视图 + API对接
 */
import { useState, useEffect, useCallback } from "react"
import { Bug, Eye, Edit, Sparkles, RefreshCw } from "lucide-react"
import PreviewModal from "../../requirement-testing/components/PreviewModal"
import { lifecycleApi } from "@/lib/api"

const columns = [
  { key: "新建", color: "border-warn/40 bg-warn/5" },
  { key: "已确认", color: "border-info/40 bg-info/5" },
  { key: "修复中", color: "border-purple-300 bg-purple-50/50" },
  { key: "已修复", color: "border-pass/40 bg-pass/5" },
  { key: "已关闭", color: "border-border bg-cream/30" },
]

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
          statusMap: { new: "新建", open: "已确认", in_progress: "修复中", resolved: "已修复", verified: "已验证", closed: "已关闭", reopened: "重新打开" },
          status: ({ new: "新建", open: "已确认", in_progress: "修复中", resolved: "已修复", verified: "已验证", closed: "已关闭", reopened: "重新打开" } as Record<string, string>)[d.status] || d.status,
          assignee: d.assigned_to ? String(d.assigned_to) : "",
        }))
        setDefects(mapped)
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDefects() }, [fetchDefects])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3 flex items-center justify-between">
        <div><h2 className="text-base font-semibold text-ink">看板视图</h2><p className="text-xs text-muted mt-0.5">按状态分列展示缺陷，清晰追踪流转进度</p></div>
        <button onClick={fetchDefects} className="h-8 px-3 rounded-lg border border-border text-xs text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新</button>
      </div>
      <div className="flex gap-3 overflow-x-auto flex-1 pb-2">
        {columns.map((col) => {
          const items = defects.filter((d) => d.status === col.key)
          return (
            <div key={col.key} className={`flex-shrink-0 w-72 border rounded-2xl flex flex-col ${col.color}`}>
              <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{col.key}</span>
                  <span className="text-[11px] text-muted bg-white/80 px-1.5 py-0.5 rounded-full">{items.length}</span>
                </div>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted text-xs">暂无缺陷</div>
                ) : items.map((d) => (
                  <div key={d.id} className="bg-white rounded-xl border border-border/50 p-3 hover:shadow-card transition-all cursor-pointer" onClick={() => setPreviewDefect(d)}>
                    <div className="flex items-start justify-between mb-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${severityBadge(d.severity)}`}>{d.severity}</span>
                      <span className="text-[10px] text-muted">#{d.id}</span>
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
