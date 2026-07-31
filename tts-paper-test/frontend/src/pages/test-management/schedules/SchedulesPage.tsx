/**
 * 调度配置页面
 */
import { useState, useMemo, useCallback } from "react"
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/useToast"

interface Schedule {
  id: number
  name: string
  cron: string
  status: "active" | "inactive"
  description: string
}

const INITIAL_SCHEDULES: Schedule[] = [
  { id: 1, name: "每日回归测试", cron: "0 2 * * *", status: "active", description: "每日凌晨2点执行全量回归测试" },
  { id: 2, name: "每小时健康检查", cron: "0 * * * *", status: "active", description: "每小时执行接口健康检查" },
  { id: 3, name: "每周性能测试", cron: "0 0 ? * MON", status: "inactive", description: "每周一凌晨执行性能压测" },
]

const STAT_CARDS = [
  { label: "活跃调度", type: "active" as const, color: "bg-pass/10 text-pass" },
  { label: "已暂停", type: "inactive" as const, color: "bg-cream text-muted" },
]

export default function SchedulesPage() {
  const toast = useToast()
  const [schedules] = useState<Schedule[]>(INITIAL_SCHEDULES)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const filteredData = useMemo(() => schedules.filter(s =>
    !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase())
  ), [schedules, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const pagedData = useMemo(
    () => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredData, currentPage, pageSize]
  )

  const statusCounts = useMemo(() => ({
    active: schedules.filter(s => s.status === "active").length,
    inactive: schedules.filter(s => s.status === "inactive").length,
  }), [schedules])

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink">调度配置</h2>
          <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">共 {filteredData.length} 条</span>
        </div>
        <button className="h-9 px-4 rounded-xl bg-pass text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-2">
          <Plus className="w-4 h-4" /> 新建调度
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 shadow-card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {STAT_CARDS.map(item => (
            <div key={item.label} className={`p-4 rounded-xl ${item.color}`}>
              <p className="text-xs">{item.label}</p>
              <p className="text-2xl font-bold mt-1">{statusCounts[item.type]}</p>
            </div>
          ))}
          <div className="p-4 rounded-xl bg-info/10 text-info">
            <p className="text-xs">今日执行</p>
            <p className="text-2xl font-bold mt-1">0</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <input
            placeholder="搜索调度..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            className="w-full max-w-sm h-9 px-3 text-sm bg-cream border border-border rounded-xl input-focus"
          />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-cream/50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-ink-light">调度名称</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-ink-light">Cron表达式</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-ink-light">状态</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-ink-light">描述</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-ink-light w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {pagedData.map(s => (
              <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-cream/50">
                <td className="px-5 py-3.5 text-sm font-medium text-ink">{s.name}</td>
                <td className="px-5 py-3.5">
                  <code className="px-2 py-1 rounded bg-cream text-xs text-info">{s.cron}</code>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${
                    s.status === "active" ? "bg-pass/10 text-pass" : "bg-cream text-muted"
                  }`}>
                    {s.status === "active" ? "运行中" : "已暂停"}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm text-muted">{s.description}</td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button className="p-1.5 rounded-lg hover:bg-cream text-info"><Edit2 className="w-4 h-4" /></button>
                    <button className="p-1.5 rounded-lg hover:bg-fail/10 text-fail"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-cream/30">
          <span className="text-xs text-muted">第 {currentPage} / {totalPages} 页</span>
          <div className="flex gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-cream disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-cream disabled:opacity-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
