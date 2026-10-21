/**
 * useProjectOptions — 项目/版本选项加载与联动 Hook
 *
 * 消除 CrudTable 页面中重复的项目/版本数据加载和版本联动过滤代码。
 * 每个页面不再需要单独的 useEffect + useState + 版本过滤逻辑。
 */
import { useState, useEffect, useMemo } from "react"
import { projectApi } from "@/lib/api"

export interface ProjectOption {
  label: string
  value: string
}

export interface UseProjectOptionsReturn {
  projects: any[]
  versions: any[]
  projectOptions: ProjectOption[]
  versionOptions: ProjectOption[]          // 全量版本选项
  getVersionOptionsForProject: (projectId?: number | string) => ProjectOption[]
  loading: boolean
}

/**
 * @param filterProjectId  当前选中的项目ID，用于联动过滤版本选项
 */
export function useProjectOptions(filterProjectId?: number | string): UseProjectOptionsReturn {
  const [projects, setProjects] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      projectApi.listProjects().catch(() => ({ data: { items: [] } })),
      projectApi.listVersions().catch(() => ({ data: { items: [] } })),
    ]).then(([projRes, verRes]) => {
      if (cancelled) return
      setProjects(projRes?.data?.items || [])
      setVersions(verRes?.data?.items || [])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const projectOptions: ProjectOption[] = useMemo(
    () => projects.map((p: any) => ({ label: p.name, value: String(p.id) })),
    [projects],
  )

  const versionOptions: ProjectOption[] = useMemo(
    () => versions.map((v: any) => ({ label: v.name, value: String(v.id) })),
    [versions],
  )

  /**
   * 根据项目ID过滤版本选项
   * - 未传 projectId 时返回全部版本
   * - 传入 projectId 时只返回属于该项目的版本
   */
  const getVersionOptionsForProject = (projectId?: number | string): ProjectOption[] => {
    if (!projectId) return versionOptions
    return versions
      .filter((v: any) => String(v.project_id) === String(projectId))
      .map((v: any) => ({ label: v.name, value: String(v.id) }))
  }

  return {
    projects,
    versions,
    projectOptions,
    versionOptions,
    getVersionOptionsForProject,
    loading,
  }
}
