// ============================================================
// TSS AI测试平台 — 应用状态管理
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TabModule {
  id: string
  name: string
  icon: string
  description: string
  path: string
  count?: number
}

export const useAppStore = defineStore('app', () => {
  // 状态
  const sidebarCollapsed = ref(false)
  const currentTab = ref('test-foundation')
  const theme = ref<'light' | 'dark'>('light')
  const systemStatus = ref({
    mcp: { total: 0, online: 0 },
    skills: { total: 0, active: 0 },
    llm: { total: 0, connected: 0 },
    time: '',
  })

  // 模块定义 — 测试基础
  const testFoundationModules: TabModule[] = [
    { id: 'requirements', name: '需求分析', icon: 'file-text', description: '管理测试需求，AI分析提取关键信息', path: '/test-foundation/requirements', count: 0 },
    { id: 'test-points', name: '测试点管理', icon: 'target', description: '从需求提取可测试的功能点', path: '/test-foundation/test-points', count: 0 },
    { id: 'test-plans', name: '测试方案', icon: 'layout-dashboard', description: '制定测试策略，规划排期', path: '/test-foundation/test-plans', count: 0 },
    { id: 'test-cases', name: '测试用例', icon: 'file-check', description: 'AI生成+人工审核的标准测试用例', path: '/test-foundation/test-cases', count: 0 },
    { id: 'executions', name: '执行管理', icon: 'play-circle', description: '调度执行，实时追踪进度', path: '/test-foundation/executions', count: 0 },
    { id: 'defects', name: '缺陷管理', icon: 'bug', description: '缺陷记录与AI分析', path: '/test-foundation/defects', count: 0 },
    { id: 'reports', name: '测试报告', icon: 'bar-chart-3', description: 'AI生成测试报告与质量分析', path: '/test-foundation/reports', count: 0 },
    { id: 'environments', name: '测试环境', icon: 'server', description: '测试环境配置与管理', path: '/test-foundation/environments', count: 0 },
    { id: 'test-data', name: '测试数据', icon: 'database', description: '测试数据池与生成器', path: '/test-foundation/test-data', count: 0 },
    { id: 'assets', name: '资产库', icon: 'library', description: '测试模式/Bug知识/RAG检索', path: '/test-foundation/assets', count: 0 },
  ]

  const configModules: TabModule[] = [
    { id: 'env-config', name: '环境配置', icon: 'settings-2', description: '多环境变量与连接配置', path: '/config/environments' },
    { id: 'llm', name: '大模型配置', icon: 'brain', description: 'LLM提供商/模型/API Key管理', path: '/config/llm' },
    { id: 'prompts', name: '提示词配置', icon: 'message-square', description: '提示词模板与版本管理', path: '/config/prompts' },
    { id: 'de-ai', name: '去AI味配置', icon: 'sparkles', description: '消除AI生成痕迹的策略管理', path: '/config/de-ai' },
    { id: 'mcp', name: 'MCP服务', icon: 'plug', description: 'Model Context Protocol服务管理', path: '/config/mcp' },
    { id: 'skills', name: '技能配置', icon: 'zap', description: 'AI Skills技能管理', path: '/config/skills' },
    { id: 'hermes', name: 'Hermes配置', icon: 'message-circle', description: '多平台消息网关配置', path: '/config/hermes' },
    { id: 'database', name: '数据库配置', icon: 'hard-drive', description: '数据源管理与备份', path: '/config/database' },
    { id: 'storage', name: '存储配置', icon: 'folder', description: '文件存储与附件管理', path: '/config/storage' },
    { id: 'system', name: '系统参数', icon: 'cog', description: '全局参数与安全策略', path: '/config/system' },
  ]

  const personalModules: TabModule[] = [
    { id: 'users', name: '用户管理', icon: 'users', description: '系统用户CRUD与状态管理', path: '/personal/users' },
    { id: 'roles', name: '角色管理', icon: 'shield', description: 'RBAC角色权限管理', path: '/personal/roles' },
    { id: 'profile', name: '个人资料', icon: 'user-circle', description: '个人设置与API Token', path: '/personal/profile' },
    { id: 'logs', name: '操作日志', icon: 'scroll-text', description: '审计日志查询与导出', path: '/personal/logs' },
  ]

  // 计算属性
  const currentModules = computed(() => {
    switch (currentTab.value) {
      case 'test-foundation': return testFoundationModules
      case 'config': return configModules
      case 'personal': return personalModules
      default: return []
    }
  })

  // 方法
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setTab(tab: string) {
    currentTab.value = tab
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', theme.value === 'dark')
  }

  return {
    sidebarCollapsed,
    currentTab,
    theme,
    systemStatus,
    testFoundationModules,
    configModules,
    personalModules,
    currentModules,
    toggleSidebar,
    setTab,
    toggleTheme,
  }
})
