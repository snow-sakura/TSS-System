/**
 * 通用模块数据 Hook - 连接真实API
 * 根据 menuKey 自动映射到对应的后端API
 */
import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import api from "@/lib/api"

// API 端点映射
const API_MAP: Record<string, { base: string; nameField?: string }> = {
  "req-list": { base: "/test-lifecycle/requirements", nameField: "title" },
  "tc-list": { base: "/test-lifecycle/test-cases", nameField: "name" },
  "tp-list": { base: "/test-lifecycle/test-points", nameField: "name" },
  "tpl-list": { base: "/test-lifecycle/test-plans", nameField: "name" },
  "ex-list": { base: "/test-lifecycle/executions", nameField: "name" },
  "df-list": { base: "/test-lifecycle/defects", nameField: "title" },
  "rp-list": { base: "/test-lifecycle/reports", nameField: "title" },
  "env-list": { base: "/config/environments" },
  "llm-list": { base: "/config/llm-providers" },
  "pr-list": { base: "/config/prompts" },
  "deai-list": { base: "/config/deai-styles" },
  "mcp-list": { base: "/config/mcp-services" },
  "sk-list": { base: "/config/skills" },
  "hm-list": { base: "/config/hermes-channels" },
  "usr-list": { base: "/users" },
  "wa-list": { base: "/web-automation/projects" },
  "log-list": { base: "/config/operation-logs" },
}

// 字段映射：将通用字段名映射到API返回的字段名
const FIELD_MAP: Record<string, Record<string, string>> = {
  "req-list": { name: "title", status: "status", priority: "priority", deadline: "deadline" },
  "tc-list": { name: "name", status: "status", priority: "priority", deadline: "deadline" },
  "df-list": { name: "title", status: "status", priority: "priority", deadline: "deadline" },
  "rp-list": { name: "title", status: "status", deadline: "deadline" },
  "env-list": { name: "name", url: "url", status: "status" },
  "llm-list": { name: "name", model: "model", status: "status" },
  "usr-list": { name: "username", email: "email", role: "role", status: "status" },
  "mcp-list": { name: "name", url: "url", status: "status" },
  "sk-list": { name: "name", desc: "description", status: "status" },
}

// 反向映射：将API字段名映射回通用字段名
const REVERSE_FIELD_MAP: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([key, map]) => [
    key,
    Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]))
  ])
)


// 字段转换：将通用字段名转换为API字段名
function toApiFields(menuKey: string, data: Record<string, any>): Record<string, any> {
  const fieldMap = FIELD_MAP[menuKey] || {}
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    const apiKey = fieldMap[key] || key
    result[apiKey] = value
  }
  return result
}

// 字段转换：将API字段名转换为通用字段名
function fromApiFields(menuKey: string, data: Record<string, any>): Record<string, any> {
  const reverseMap = REVERSE_FIELD_MAP[menuKey] || {}
  const result: Record<string, any> = { ...data }
  for (const [apiKey, genericKey] of Object.entries(reverseMap)) {
    if (apiKey in data) {
      result[genericKey] = data[apiKey]
    }
  }
  // 确保有 name 字段
  if (!result.name && data.title) result.name = data.title
  if (!result.name && data.username) result.name = data.username
  return result
}

export function useModuleData(initialMenu: string) {
  const [data, setData] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  // 加载数据
  const fetchData = useCallback(async (menuKey: string) => {
    const config = API_MAP[menuKey]
    if (!config) return

    setLoading((prev) => ({ ...prev, [menuKey]: true }))
    try {
      const res: any = await api.get(config.base, { params: { page: 1, page_size: 100 } })
      const items = res?.items || res?.data?.items || res?.data || []
      const normalized = Array.isArray(items) ? items.map((item: any) => fromApiFields(menuKey, item)) : []
      setData((prev) => ({ ...prev, [menuKey]: normalized }))
    } catch (e: any) {
      console.warn(`获取 ${menuKey} 数据失败:`, e?.response?.data || e?.message || e)
      toast.error(`加载失败: ${e?.response?.data?.detail || e?.message || "未知错误"}`)
    } finally {
      setLoading((prev) => ({ ...prev, [menuKey]: false }))
    }
  }, [])

  // 初始加载
  useEffect(() => {
    if (initialMenu && API_MAP[initialMenu]) {
      fetchData(initialMenu)
    }
  }, [initialMenu, fetchData])

  const getList = useCallback((menuKey: string) => {
    return data[menuKey] || []
  }, [data])

  const create = useCallback(async (menuKey: string, item: any) => {
    const config = API_MAP[menuKey]
    if (!config) {
      toast.error("不支持的模块")
      return
    }

    try {
      const apiData = toApiFields(menuKey, item)
      await api.post(config.base, apiData)
      toast.success("创建成功")
      fetchData(menuKey)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || "创建失败")
    }
  }, [fetchData])

  const update = useCallback(async (menuKey: string, id: number, item: any) => {
    const config = API_MAP[menuKey]
    if (!config) {
      toast.error("不支持的模块")
      return
    }

    try {
      const apiData = toApiFields(menuKey, item)
      await api.put(`${config.base}/${id}`, apiData)
      toast.success("保存成功")
      fetchData(menuKey)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || "保存失败")
    }
  }, [fetchData])

  const remove = useCallback(async (menuKey: string, id: number) => {
    const config = API_MAP[menuKey]
    if (!config) {
      toast.error("不支持的模块")
      return
    }

    try {
      await api.delete(`${config.base}/${id}`)
      toast.success("删除成功")
      fetchData(menuKey)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || "删除失败")
    }
  }, [fetchData])

  const batchRemove = useCallback(async (menuKey: string, ids: Set<number>) => {
    const config = API_MAP[menuKey]
    if (!config) {
      toast.error("不支持的模块")
      return
    }

    try {
      for (const id of ids) {
        await api.delete(`${config.base}/${id}`)
      }
      toast.success(`已删除 ${ids.size} 条数据`)
      fetchData(menuKey)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || "批量删除失败")
    }
  }, [fetchData])

  return { data, loading, getList, create, update, remove, batchRemove, refresh: fetchData }
}
