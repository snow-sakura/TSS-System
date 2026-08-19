/**
 * 通用数据表格组件
 * 支持搜索、来源筛选、分页、CRUD、行点击预览
 * 列内容居中 + 超过10字截断 + 内容自适应宽度
 */
import { useState, memo, useCallback } from "react"
import { Search, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, FileText, X, Upload, RotateCcw } from "lucide-react"

export interface ColumnDef {
  key: string
  label: string
  width?: string
  render?: (value: any, record: any) => React.ReactNode
  /** 如果为true，则单元格居中且截断 */
  center?: boolean
}

export interface PaginationInfo {
  page: number
  page_size: number
  total: number
  total_pages: number
}

interface DataTableProps {
  title: string
  columns: ColumnDef[]
  data: any[]
  pagination: PaginationInfo
  search: string
  sourceFilter: string
  loading: boolean
  onSearch: (v: string) => void
  onSourceFilter: (v: string) => void
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  onCreate: () => void
  onEdit: (item: any) => void
  onDelete: (item: any) => void
  onBatchDelete?: (ids: Set<string>) => void
  onUpload?: () => void
  extraActions?: React.ReactNode
  onRowClick?: (item: any) => void
  renderActions?: (item: any) => React.ReactNode
}

function DataTable({
  title, columns, data, pagination, search, sourceFilter, loading,
  onSearch, onSourceFilter, onPageChange, onPageSizeChange,
  onCreate, onEdit, onDelete, onBatchDelete, onUpload, extraActions, onRowClick, renderActions,
}: DataTableProps) {
  const [searchInput, setSearchInput] = useState(search)
  const [localSourceFilter, setLocalSourceFilter] = useState(sourceFilter)

  // 查询按钮
  const handleQuery = useCallback(() => {
    onSearch(searchInput)
    onSourceFilter(localSourceFilter)
  }, [searchInput, localSourceFilter, onSearch, onSourceFilter])

  // 重置按钮
  const handleReset = useCallback(() => {
    setSearchInput("")
    setLocalSourceFilter("")
    onSearch("")
    onSourceFilter("")
  }, [onSearch, onSourceFilter])

  // 批量选择
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const toggleSelectAll = () => {
    const pageIds = data.map((r) => String(r.id))
    const allSelected = pageIds.every((id) => selectedIds.has(id))
    if (allSelected) setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.delete(id)); return n })
    else setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.add(id)); return n })
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="搜索..."
              className="w-44 h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber focus:ring-1 focus:ring-amber outline-none transition-colors"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          </div>
          <select
            value={localSourceFilter}
            onChange={(e) => setLocalSourceFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"
          >
            <option value="">全部来源</option>
            <option value="manual">手动</option>
            <option value="ai">AI生成</option>
          </select>
          <button onClick={handleQuery} className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" /> 查询
          </button>
          <button onClick={handleReset} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream transition-colors flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> 重置
          </button>
          {onUpload && (
            <button onClick={onUpload} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:text-ink hover:bg-cream transition-colors flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> 上传
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {extraActions}
          <button
            onClick={onCreate}
            className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> 新建
          </button>
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between mb-3 px-4 py-2 bg-amber-light/50 border border-amber/20 rounded-xl">
          <span className="text-sm text-ink-light">已选择 <span className="font-semibold text-ink">{selectedIds.size}</span> 条</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-ink-light hover:text-ink">取消选择</button>
            {onBatchDelete && (
              <button onClick={() => onBatchDelete(selectedIds)} className="h-7 px-3 text-xs bg-fail text-white hover:bg-fail/80 rounded-lg flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> 批量删除
              </button>
            )}
          </div>
        </div>
      )}

      {/* 表格 */}
      <div className="flex-1 overflow-auto rounded-2xl border border-border bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-ink-light text-sm">
            <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin mr-2" />
            加载中...
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-ink-light">
            <FileText className="w-10 h-10 mb-2 text-muted-light" />
            <p className="text-sm font-medium">暂无数据</p>
            <p className="text-xs mt-1 text-muted">点击「新建」添加或选择「AI自动化」生成</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-cream/50">
                <th className="px-4 py-3 w-10 text-left">
                  <input type="checkbox" checked={data.length > 0 && data.every((r) => selectedIds.has(String(r.id)))} onChange={toggleSelectAll} className="w-4 h-4 rounded border-border text-amber focus:ring-amber" />
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-ink-light tracking-wider w-12">ID</th>
                {columns.map((col) => (
                  <th key={col.key} className="text-center px-4 py-3 text-xs font-semibold text-ink-light tracking-wider" style={{ width: col.width }}>
                    {col.label}
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-xs font-semibold text-ink-light tracking-wider" style={{ width: "120px" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={item.id}
                  className={`border-b border-border/50 last:border-b-0 transition-colors ${selectedIds.has(String(item.id)) ? "bg-amber-light/40" : idx % 2 === 0 ? "bg-white" : "bg-cream/30"} hover:bg-cream/50`}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(String(item.id))} onChange={() => toggleSelect(String(item.id))} className="w-4 h-4 rounded border-border text-amber focus:ring-amber" />
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-ink-light">{item.id}</td>
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-sm ${col.center !== false ? "text-center" : "text-left"} text-ink`}>
                      {col.render ? (
                        col.render(item[col.key], item)
                      ) : (
                        <span className="truncate max-w-[200px] block mx-auto" title={item[col.key]?.length > 10 ? item[col.key] : undefined}>
                          {(item[col.key]?.length > 10 ? item[col.key].slice(0, 10) + "..." : item[col.key]) ?? "-"}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {renderActions && renderActions(item)}
                      {onRowClick && (
                        <button onClick={() => onRowClick(item)} className="p-1.5 rounded-lg hover:bg-info/10 text-ink-light hover:text-info transition-colors" title="预览">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-amber-50 text-ink-light hover:text-amber-700 transition-colors" title="编辑">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(item)} className="p-1.5 rounded-lg hover:bg-fail/10 text-ink-light hover:text-fail transition-colors" title="删除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between mt-3 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-ink-light">
          <span>共 {pagination.total} 条</span>
          <select
            value={pagination.page_size}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 px-2 rounded-lg border border-border text-xs bg-white outline-none"
          >
            <option value="10">10/页</option>
            <option value="20">20/页</option>
            <option value="50">50/页</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="p-1.5 rounded-lg hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed text-ink-light"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: pagination.total_pages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - pagination.page) <= 2 || p === 1 || p === pagination.total_pages)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-ink-light text-xs">...</span>}
                <button
                  onClick={() => onPageChange(p)}
                  className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-medium transition-colors ${
                    p === pagination.page ? "bg-amber text-white shadow-sm" : "text-ink-light hover:bg-cream"
                  }`}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            disabled={pagination.page >= pagination.total_pages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="p-1.5 rounded-lg hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed text-ink-light"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(DataTable)
