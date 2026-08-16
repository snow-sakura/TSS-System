import { useMemo } from "react"
import {
  Plus, Search, Edit2, Trash2, Eye, X, Filter,
  ChevronLeft, ChevronRight, FileText,
} from "lucide-react"

export interface CrudColumn {
  key: string
  title: string
  width?: string
  sortable?: boolean
  render?: (value: any, row: any) => React.ReactNode
  align?: "left" | "center" | "right"
}

export interface CrudFilter {
  key: string
  label: string
  type: "search" | "select" | "date" | "daterange"
  options?: { label: string; value: string }[]
}

export interface CrudTableProps {
  title: string
  subtitle?: string
  columns: CrudColumn[]
  filters?: CrudFilter[]
  data: any[]
  total: number
  page: number
  pageSize: number
  loading?: boolean
  selectedIds?: Set<string | number>
  showCreateButton?: boolean
  createButtonText?: string
  /** 工具栏右侧额外按钮（在「新建」按钮之前渲染） */
  toolbarExtra?: React.ReactNode
  statusConfig?: Record<string, { label: string; color: string }>
  priorityConfig?: Record<string, { label: string; color: string }>
  onSearch?: (value: string) => void
  onFilterChange?: (key: string, value: string) => void
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  onCreate?: () => void
  onEdit?: (row: any) => void
  onView?: (row: any) => void
  onDelete?: (row: any) => void
  /** 行点击回调（跳转详情页等；点击 checkbox/操作按钮/链接时不触发） */
  onRowClick?: (row: any) => void
  onBatchDelete?: (ids: (string | number)[]) => void
  onSelectionChange?: (ids: Set<string | number>) => void
  onSort?: (key: string, direction: "asc" | "desc") => void
  emptyText?: string
}

export default function CrudTable({
  title,
  subtitle,
  columns,
  filters = [],
  data,
  total,
  page,
  pageSize,
  loading = false,
  selectedIds = new Set(),
  showCreateButton = true,
  createButtonText = "新建",
  toolbarExtra,
  statusConfig = {},
  priorityConfig = {},
  onSearch,
  onFilterChange,
  onPageChange,
  onPageSizeChange,
  onCreate,
  onEdit,
  onView,
  onDelete,
  onRowClick,
  onBatchDelete,
  onSelectionChange,
  onSort,
  emptyText = "暂无数据",
}: CrudTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const allCurrentPageSelected = useMemo(() => {
    if (data.length === 0) return false
    return data.every((row) => selectedIds.has(row.id))
  }, [data, selectedIds])

  const hasActiveFilters = useMemo(() => {
    return filters.some((f) => {
      if (f.type === "search") return false
      return false
    })
  }, [filters])

  const handleSelectAll = () => {
    if (allCurrentPageSelected) {
      const next = new Set(selectedIds)
      data.forEach((row) => next.delete(row.id))
      onSelectionChange?.(next)
    } else {
      const next = new Set(selectedIds)
      data.forEach((row) => next.add(row.id))
      onSelectionChange?.(next)
    }
  }

  const handleSelectOne = (id: string | number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange?.(next)
  }

  const getDefaultRender = (col: CrudColumn, row: any): React.ReactNode => {
    const value = row[col.key]
    if (col.key === "status" && statusConfig[value]) {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[value].color}`}>
          {statusConfig[value].label}
        </span>
      )
    }
    if (col.key === "priority" && priorityConfig[value]) {
      return (
        <span className={`text-sm ${priorityConfig[value].color}`}>
          {priorityConfig[value].label}
        </span>
      )
    }
    if (value === undefined || value === null || value === "") {
      return <span className="text-xs text-muted">—</span>
    }
    return <span className="text-sm text-ink">{String(value)}</span>
  }

  const renderFilter = (filter: CrudFilter) => {
    switch (filter.type) {
      case "search":
        return (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              placeholder={filter.label}
              onChange={(e) => onSearch?.(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm bg-cream border border-border rounded-xl input-focus"
            />
          </div>
        )
      case "select":
        return (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted" />
            <select
              onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
              className="h-9 px-3 pr-8 text-sm bg-cream border border-border rounded-xl input-focus appearance-none cursor-pointer"
            >
              <option value="">{filter.label}</option>
              {filter.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )
      case "date":
        return (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted" />
            <input
              type="date"
              onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
              className="h-9 px-3 text-sm bg-cream border border-border rounded-xl input-focus"
            />
          </div>
        )
      case "daterange":
        return (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted" />
            <input
              type="date"
              onChange={(e) => onFilterChange?.(`${filter.key}_start`, e.target.value)}
              className="h-9 px-3 text-sm bg-cream border border-border rounded-xl input-focus"
            />
            <span className="text-xs text-muted">至</span>
            <input
              type="date"
              onChange={(e) => onFilterChange?.(`${filter.key}_end`, e.target.value)}
              className="h-9 px-3 text-sm bg-cream border border-border rounded-xl input-focus"
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
          <span className="text-xs text-muted bg-cream px-2 py-1 rounded-md">
            共 {total} 条
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {toolbarExtra}
          {showCreateButton && onCreate && (
            <button
              onClick={onCreate}
              className="h-9 px-4 rounded-xl bg-pass text-white text-sm font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {createButtonText}
            </button>
          )}
        </div>
      </div>

      {filters.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-4 shadow-card mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {filters.map((filter) => (
              <div key={filter.key}>{renderFilter(filter)}</div>
            ))}

            {selectedIds.size > 0 && onBatchDelete && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted">已选 {selectedIds.size} 项</span>
                <button
                  onClick={() => onBatchDelete(Array.from(selectedIds))}
                  className="h-8 px-3 rounded-lg bg-fail/10 text-fail border border-fail/20 text-xs hover:bg-fail/20 transition-colors"
                >
                  批量删除
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 text-center">
          <div className="inline-flex items-center gap-2 text-muted">
            <div className="w-5 h-5 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
            加载中...
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cream flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted" />
          </div>
          <p className="text-sm font-medium text-ink mb-1">{emptyText}</p>
          <p className="text-xs text-muted mb-4">
            点击「{createButtonText}」创建第一条记录
          </p>
          {onCreate && (
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pass text-white text-sm font-medium shadow-sm hover:shadow-md transition-all"
            >
              <Plus className="w-4 h-4" /> {createButtonText}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-cream/50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-border text-amber focus:ring-amber cursor-pointer"
                    />
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-5 py-3 text-xs font-semibold text-ink-light uppercase tracking-wider ${
                        col.align === "center"
                          ? "text-center"
                          : col.align === "right"
                            ? "text-right"
                            : "text-left"
                      }`}
                      style={{ width: col.width }}
                    >
                      {col.sortable && onSort ? (
                        <button
                          onClick={() => onSort(col.key, "asc")}
                          className="flex items-center gap-1 hover:text-ink"
                        >
                          {col.title}
                        </button>
                      ) : (
                        col.title
                      )}
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right text-xs font-semibold text-ink-light uppercase tracking-wider w-32">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.id}
                    onClick={(e) => {
                      // 点击行跳转详情；checkbox / 按钮 / 链接等交互元素不触发行点击
                      if (!onRowClick) return
                      const target = e.target as HTMLElement
                      if (target.closest("button, input, a, select")) return
                      onRowClick(row)
                    }}
                    className={`border-b border-border/50 last:border-0 transition-colors ${
                      selectedIds.has(row.id) ? "bg-amber-light/50" : "hover:bg-cream/50"
                    } ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => handleSelectOne(row.id)}
                        className="w-4 h-4 rounded border-border text-amber focus:ring-amber cursor-pointer"
                      />
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-5 py-3.5 ${
                          col.align === "center"
                            ? "text-center"
                            : col.align === "right"
                              ? "text-right"
                              : "text-left"
                        }`}
                      >
                        {col.render
                          ? col.render(row[col.key], row)
                          : getDefaultRender(col, row)}
                      </td>
                    ))}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onView && (
                          <button
                            onClick={() => onView(row)}
                            className="p-1.5 rounded-lg hover:bg-cream text-ink-light hover:text-ink transition-colors"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="p-1.5 rounded-lg hover:bg-cream text-info hover:text-info transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            className="p-1.5 rounded-lg hover:bg-fail/10 text-fail hover:text-fail transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-cream/30">
            <span className="text-xs text-muted">
              共 {total} 条，第 {page} / {totalPages} 页
            </span>
            <div className="flex items-center gap-1">
              {onPageSizeChange && (
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-8 px-2 text-xs bg-cream border border-border rounded-lg input-focus"
                >
                  {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>{size} 条/页</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => onPageChange?.(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}