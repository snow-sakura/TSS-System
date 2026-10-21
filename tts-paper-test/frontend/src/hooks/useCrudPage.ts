/**
 * useCrudPage — 通用 CRUD 列表页逻辑 Hook
 *
 * 封装 CrudTable 页面中重复的数据加载、分页、搜索、筛选逻辑。
 * 每个页面不再需要手动编写 loadData + useEffect + 状态管理。
 */
import { useState, useEffect, useCallback, useRef } from "react"

/** 空对象常量，避免默认值创建新引用导致无限循环 */
const EMPTY_FILTERS: Record<string, string | number | undefined> = {}

export interface UseCrudPageOptions<T> {
  /** 数据加载函数（调用后端 API），返回 { items: T[], total: number } 或类似结构 */
  fetchFn: (params: Record<string, any>) => Promise<any>
  /** 初始页码，默认 1 */
  initialPage?: number
  /** 每页条数，默认 10 */
  initialPageSize?: number
  /** 默认搜索关键词 */
  initialSearch?: string
  /** 额外的筛选参数（页面级），每个 key 对应 API 参数名 */
  extraFilters?: Record<string, string | number | undefined>
  /** 是否自动加载（默认 true） */
  autoLoad?: boolean
}

export interface UseCrudPageReturn<T> {
  data: T[]
  total: number
  page: number
  setPage: (p: number) => void
  pageSize: number
  setPageSize: (s: number) => void
  loading: boolean
  searchTerm: string
  setSearchTerm: (s: string) => void
  /** 手动触发重新加载 */
  reload: () => void
}

export function useCrudPage<T = any>(
  options: UseCrudPageOptions<T>,
): UseCrudPageReturn<T> {
  const {
    fetchFn,
    initialPage = 1,
    initialPageSize = 10,
    initialSearch = "",
    extraFilters,
    autoLoad = true,
  } = options

  const extraFiltersRef = useRef(extraFilters)
  extraFiltersRef.current = extraFilters

  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (searchTerm) params.search = searchTerm
      // 合并额外筛选条件（使用 ref 避免引用变化导致循环）
      const filters = extraFiltersRef.current || EMPTY_FILTERS
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          params[key] = value
        }
      })

      const res = await fetchFn(params)
      const payload = res?.data
      const list = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : []
      const totalCount =
        typeof payload?.total === "number" ? payload.total : list.length

      setData(list)
      setTotal(totalCount)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchTerm, fetchFn])

  useEffect(() => {
    if (autoLoad) loadData()
  }, [loadData, autoLoad, reloadKey])

  return {
    data,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    loading,
    searchTerm,
    setSearchTerm,
    reload,
  }
}
