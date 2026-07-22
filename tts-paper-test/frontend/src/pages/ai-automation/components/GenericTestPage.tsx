/**
 * 通用测试页面组件 — 可配置的列表/CRUD页面
 * 根据typeConfig渲染不同的表格列、操作按钮和统计卡片
 */
import { useState, memo } from "react"
import {
  Search, Plus, Edit, Trash2, Eye, RefreshCw, Download,
  Play, Pause, CheckCircle, XCircle, Clock, Loader2, AlertTriangle,
  Settings, BarChart3, FileText, Filter
} from "lucide-react"
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal"

export interface Column {
  key: string
  label: string
  width?: string
  render?: (value: any, row: any) => React.ReactNode
}

export interface StatCard {
  label: string
  value: string | number
  color: string
  icon?: any
}

export interface Action {
  label: string
  icon: any
  color?: string
  onClick: (row: any) => void
}

export interface GenericTestPageProps {
  title: string
  subtitle?: string
  columns: Column[]
  data: any[]
  stats?: StatCard[]
  actions?: Action[]
  searchPlaceholder?: string
  filters?: { key: string; label: string; options: string[] }[]
  onCreate?: () => void
  onExport?: () => void
  onRefresh?: () => void
  loading?: boolean
  emptyIcon?: any
  emptyText?: string
}

function GenericTestPage({
  title, subtitle, columns, data, stats, actions,
  searchPlaceholder = "搜索...", filters,
  onCreate, onExport, onRefresh,
  loading = false, emptyIcon: EmptyIcon = FileText, emptyText = "暂无数据",
}: GenericTestPageProps) {
  const [search, setSearch] = useState("")
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const pageSize = 10

  const filtered = data.filter((row) => {
    if (search) {
      const searchLower = search.toLowerCase()
      const matchAny = columns.some((col) => {
        const val = row[col.key]
        return val && String(val).toLowerCase().includes(searchLower)
      })
      if (!matchAny) return false
    }
    for (const [key, val] of Object.entries(filterValues)) {
      if (val && row[key] !== val) return false
    }
    return true
  })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4">
      {/* 统计卡片 */}
      {stats && stats.length > 0 && (
        <div className={`grid grid-cols-${Math.min(stats.length, 4)} gap-3`}>
          {stats.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* 操作栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder={searchPlaceholder}
            className="w-48 h-9 pl-9 pr-3 rounded-xl border border-border text-sm bg-white focus:border-amber outline-none" />
        </div>
        {filters?.map((f) => (
          <select key={f.key} value={filterValues[f.key] || ""} onChange={(e) => { setFilterValues({ ...filterValues, [f.key]: e.target.value }); setCurrentPage(1) }}
            className="h-9 px-3 rounded-xl border border-border text-sm bg-white focus:border-amber outline-none">
            <option value="">{f.label}</option>
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <div className="flex-1" />
        {onRefresh && <button onClick={onRefresh} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> 刷新</button>}
        {onCreate && <button onClick={onCreate} className="h-9 px-3 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 新建</button>}
        {onExport && <button onClick={onExport} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 导出</button>}
      </div>

      {/* 数据表格 */}
      <div className="flex-1 bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-amber" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream/50 border-b border-border">
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-3 text-center text-xs font-bold text-ink" style={{ width: col.width }}>{col.label}</th>
                  ))}
                  {actions && actions.length > 0 && <th className="px-4 py-3 text-center text-xs font-bold text-ink w-24">操作</th>}
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-16 text-center text-muted">
                    <EmptyIcon className="w-10 h-10 mx-auto mb-2 text-muted-light" />
                    <p className="text-sm font-medium">{emptyText}</p>
                  </td></tr>
                ) : paged.map((row, idx) => (
                  <tr key={row.id || idx} className={`border-b border-border/50 last:border-b-0 ${idx % 2 === 1 ? "bg-cream/20" : ""} hover:bg-cream/40 transition-colors`}>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-center text-xs text-ink">
                        {col.render ? col.render(row[col.key], row) : row[col.key] || "-"}
                      </td>
                    ))}
                    {actions && actions.length > 0 && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {actions.map((action, ai) => (
                            <button key={ai} onClick={() => action.onClick(row)}
                              className={`p-1.5 rounded-lg hover:bg-cream text-ink-light transition-colors ${action.color || "hover:text-info"}`}
                              title={action.label}>
                              <action.icon className="w-4 h-4" />
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-cream/20">
            <span className="text-xs text-muted">共 {filtered.length} 条，第 {currentPage}/{totalPages} 页</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="h-8 px-3 text-xs rounded-lg border border-border hover:bg-cream disabled:opacity-40">上一页</button>
              <span className="h-8 px-3 text-xs rounded-lg gradient-amber text-white flex items-center">{currentPage}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-8 px-3 text-xs rounded-lg border border-border hover:bg-cream disabled:opacity-40">下一页</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(GenericTestPage)
