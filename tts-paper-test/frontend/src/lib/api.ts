import axios from "axios"

const api = axios.create({
  baseURL: "/api/v1",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
})

// 请求拦截 - 添加Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截 - 处理错误
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      window.location.href = "/login"
    }
    return Promise.reject(error.response?.data || error)
  }
)

// Auth API
export const authApi = {
  login: (data: { username: string; password: string }) =>
    api.post("/auth/login", data),
  register: (data: {
    username: string
    email: string
    password: string
    confirm_password: string
    display_name?: string
  }) => api.post("/auth/register", data),
  refresh: (refresh_token: string) =>
    api.post("/auth/refresh", { refresh_token }),
  profile: () => api.get("/auth/profile"),
}

// Users API
export const usersApi = {
  listUsers: (params?: Record<string, any>) => api.get("/users", { params }),
  listAllUsers: () => api.get("/users/all"),
  getUser: (id: number) => api.get(`/users/${id}`),
  createUser: (data: any) => api.post("/users", data),
  updateUser: (id: number, data: any) => api.put(`/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/users/${id}`),
  getUserStatus: (id: number) => api.get(`/users/${id}/status`),
  listLoginLogs: (params?: Record<string, any>) => api.get("/users/login-logs", { params }),
  // 角色管理
  listRoles: () => api.get("/users/roles/list"),
  getRoleStats: () => api.get("/users/roles/stats"),
  createRole: (data: { name: string; code: string; description?: string; permissions?: string[] }) => api.post("/users/roles", data),
  updateRole: (roleKey: string, data: { name?: string; description?: string; permissions?: string[] }) => api.put(`/users/roles/${roleKey}`, data),
  deleteRole: (roleKey: string) => api.delete(`/users/roles/${roleKey}`),
  // 设备管理
  listDevices: (params?: Record<string, any>) => api.get("/users/devices", { params }),
  getDevice: (id: number) => api.get(`/users/devices/${id}`),
  updateDeviceStatus: (id: number, status: string) => api.put(`/users/devices/${id}/status`, { status }),
  deleteDevice: (id: number) => api.delete(`/users/devices/${id}`),
}

// 通用CRUD API工厂
export function createCrudApi<T>(endpoint: string) {
  return {
    list: (params?: Record<string, any>) => api.get(`/${endpoint}`, { params }),
    get: (id: number) => api.get(`/${endpoint}/${id}`),
    create: (data: Partial<T>) => api.post(`/${endpoint}`, data),
    update: (id: number, data: Partial<T>) => api.put(`/${endpoint}/${id}`, data),
    delete: (id: number) => api.delete(`/${endpoint}/${id}`),
  }
}

/** 封装的fetch调用 — 自动注入Authorization头和Content-Type，返回原生Response用于SSE流式读取 */
function apiFetch(url: string, options?: { method?: string; body?: unknown; signal?: AbortSignal }) {
  const token = localStorage.getItem("access_token")
  return fetch(url, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options?.signal,
  })
}

// Web Automation API
export const webApi = {
  listProjects: (page = 1) =>
    api.get("/web-automation/projects", { params: { page } }),
  createProject: (data: { name: string; target_url: string; description?: string }) =>
    api.post("/web-automation/projects", data),
  getProject: (id: number) =>
    api.get(`/web-automation/projects/${id}`),
  deleteProject: (id: number) =>
    api.delete(`/web-automation/projects/${id}`),
  explore: (projectId: number) =>
    api.post(`/web-automation/projects/${projectId}/explore`),
  /** SSE流式探索 - 返回原生Response用于读取流 */
  exploreSSE: (projectId: number) =>
    apiFetch(`/api/v1/web-automation/projects/${projectId}/explore`, { method: "POST" }),
  listPages: (projectId: number) =>
    api.get(`/web-automation/projects/${projectId}/pages`),
  generateTestCases: (projectId: number) =>
    api.post(`/web-automation/projects/${projectId}/generate`),
  /** SSE流式生成用例 - 返回原生Response用于读取流 */
  generateTestCasesSSE: (projectId: number) =>
    apiFetch(`/api/v1/web-automation/projects/${projectId}/generate`, { method: "POST" }),
  listTestCases: (projectId: number, status?: string) =>
    api.get(`/web-automation/projects/${projectId}/test-cases`, { params: { status } }),
  updateTestCase: (caseId: number, data: any) =>
    api.put(`/web-automation/test-cases/${caseId}`, data),
  approveTestCase: (caseId: number) =>
    api.post(`/web-automation/test-cases/${caseId}/approve`),
  rejectTestCase: (caseId: number) =>
    api.post(`/web-automation/test-cases/${caseId}/reject`),
  deleteTestCase: (caseId: number) =>
    api.delete(`/web-automation/test-cases/${caseId}`),
  execute: (projectId: number) =>
    api.post(`/web-automation/projects/${projectId}/execute`),
  getExecutions: (projectId: number) =>
    api.get(`/web-automation/projects/${projectId}/executions`),
  getExecution: (executionId: number) =>
    api.get(`/web-automation/executions/${executionId}`),
  listProjectsForWorkflow: () =>
    api.get("/web-automation/projects-for-workflow"),
}

// 测试生命周期 API
export const lifecycleApi = {
  // 需求分析
  listRequirements: (params?: Record<string, any>) => api.get("/test-lifecycle/requirements", { params }),
  getRequirement: (id: number) => api.get(`/test-lifecycle/requirements/${id}`),
  createRequirement: (data: any) => api.post("/test-lifecycle/requirements", data),
  updateRequirement: (id: number, data: any) => api.put(`/test-lifecycle/requirements/${id}`, data),
  deleteRequirement: (id: number) => api.delete(`/test-lifecycle/requirements/${id}`),
  batchDeleteRequirements: (ids: number[]) => api.post("/test-lifecycle/requirements/batch-delete", ids),
  updateRequirementStatus: (id: number, status: string) =>
    api.put(`/test-lifecycle/requirements/${id}/status`, { status }, { headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
  uploadRequirement: (formData: FormData) =>
    api.post("/test-lifecycle/requirements/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  createManualRequirement: (formData: FormData) =>
    api.post("/test-lifecycle/requirements/manual", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  // === 需求测试数据管理 CRUD API ===
  listData: (collection: string, params?: Record<string, any>) =>
    api.get(`/data/${collection}`, { params }),
  getData: (collection: string, id: string) =>
    api.get(`/data/${collection}/${id}`),
  createData: (collection: string, data: any) =>
    api.post(`/data/${collection}`, data),
  updateData: (collection: string, id: string, data: any) =>
    api.put(`/data/${collection}/${id}`, data),
  deleteData: (collection: string, id: string) =>
    api.delete(`/data/${collection}/${id}`),
  batchDeleteData: (collection: string, ids: string[]) =>
    api.post(`/data/${collection}/batch-delete`, ids),

  // SSE流式分析 - 使用原生EventSource/SSE
  analyzeRequirementSSE: (id: number): EventSource =>
    new EventSource(`/api/v1/test-lifecycle/requirements/${id}/analyze`),

  // 测试方案
  listTestPlans: (params?: Record<string, any>) => api.get("/test-lifecycle/test-plans", { params }),
  getTestPlan: (id: number) => api.get(`/test-lifecycle/test-plans/${id}`),
  createTestPlan: (data: any) => api.post("/test-lifecycle/test-plans", data),
  updateTestPlan: (id: number, data: any) => api.put(`/test-lifecycle/test-plans/${id}`, data),
  deleteTestPlan: (id: number) => api.delete(`/test-lifecycle/test-plans/${id}`),

  // 测试点
  listTestPoints: (params?: Record<string, any>) => api.get("/test-lifecycle/test-points", { params }),
  getTestPoint: (id: number) => api.get(`/test-lifecycle/test-points/${id}`),
  createTestPoint: (data: any) => api.post("/test-lifecycle/test-points", data),
  updateTestPoint: (id: number, data: any) => api.put(`/test-lifecycle/test-points/${id}`, data),
  deleteTestPoint: (id: number) => api.delete(`/test-lifecycle/test-points/${id}`),

  // 测试用例
  listTestCases: (params?: Record<string, any>) => api.get("/test-lifecycle/test-cases", { params }),
  getTestCase: (id: number) => api.get(`/test-lifecycle/test-cases/${id}`),
  createTestCase: (data: any) => api.post("/test-lifecycle/test-cases", data),
  updateTestCase: (id: number, data: any) => api.put(`/test-lifecycle/test-cases/${id}`, data),
  deleteTestCase: (id: number) => api.delete(`/test-lifecycle/test-cases/${id}`),
  batchDeleteTestCases: (ids: number[]) => api.post("/test-lifecycle/test-cases/batch-delete", ids),
  reviewTestCase: (id: number, data: { action: string; review_comment?: string }) =>
    api.post(`/test-lifecycle/test-cases/${id}/review`, data),
  aiGenerateCases: (data: { requirement_content?: string; requirement_name?: string; module?: string; priority?: string; count?: number }) =>
    api.post("/test-lifecycle/test-cases/ai-generate", data),

  // 执行管理
  listExecutions: (params?: Record<string, any>) => api.get("/test-lifecycle/executions", { params }),
  getExecution: (id: number) => api.get(`/test-lifecycle/executions/${id}`),
  createExecution: (data: any) => api.post("/test-lifecycle/executions", data),
  updateExecution: (id: number, data: any) => api.put(`/test-lifecycle/executions/${id}`, data),
  deleteExecution: (id: number) => api.delete(`/test-lifecycle/executions/${id}`),
  // 执行引擎
  startExecution: (id: number) => api.post(`/test-lifecycle/executions/${id}/start`),
  stopExecution: (id: number) => api.post(`/test-lifecycle/executions/${id}/stop`),
  getExecutionProgress: (id: number) => api.get(`/test-lifecycle/executions/${id}/progress`),
  streamExecutionSSE: (id: number): EventSource => {
    const token = localStorage.getItem("access_token")
    const url = new URL(`/api/v1/test-lifecycle/executions/${id}/stream`, window.location.origin)
    if (token) url.searchParams.set("token", token)
    return new EventSource(url.toString())
  },

  // 缺陷管理
  listDefects: (params?: Record<string, any>) => api.get("/test-lifecycle/defects", { params }),
  getDefect: (id: number) => api.get(`/test-lifecycle/defects/${id}`),
  createDefect: (data: any) => api.post("/test-lifecycle/defects", data),
  updateDefect: (id: number, data: any) => api.put(`/test-lifecycle/defects/${id}`, data),
  deleteDefect: (id: number) => api.delete(`/test-lifecycle/defects/${id}`),
  batchDeleteDefects: (ids: number[]) => api.post("/test-lifecycle/defects/batch-delete", ids),
  aiAnalyzeDefect: (id: number) => api.post(`/test-lifecycle/defects/${id}/ai-analyze`),
  getDefectStatistics: () => api.get("/test-lifecycle/defects/statistics"),

  // 仪表盘
  getDashboardStats: () => api.get("/test-lifecycle/dashboard/stats"),

  // 测试报告
  listReports: (params?: Record<string, any>) => api.get("/test-lifecycle/reports", { params }),
  getReport: (id: number) => api.get(`/test-lifecycle/reports/${id}`),
  createReport: (data: any) => api.post("/test-lifecycle/reports", data),
  updateReport: (id: number, data: any) => api.put(`/test-lifecycle/reports/${id}`, data),
  deleteReport: (id: number) => api.delete(`/test-lifecycle/reports/${id}`),
  generateAiReport: (data: { report_type?: string; name?: string }) =>
    api.post("/test-lifecycle/reports/generate", data),
  getQualityMetrics: () => api.get("/test-lifecycle/quality/metrics"),
  getQualityTrends: () => api.get("/test-lifecycle/quality/trends"),

  // 文档上传解析
  uploadDocument: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return api.post("/data/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    })
  },
  getSupportedFormats: () => api.get("/data/upload/supported"),

  // 全流程 Pipeline
  startPipelineSSE: (data: { requirement_content: string; requirement_name?: string }, signal?: AbortSignal) =>
    apiFetch("/api/v1/pipeline/start", { method: "POST", body: data, signal }),

  // === 用例确认 ===
  confirmCases: (case_ids: string[], confirmed_by = "manual") =>
    api.post("/data/cases/confirm", { case_ids, confirmed_by }),

  listPendingCases: (pipeline_id?: string) =>
    api.get("/data/cases/pending", { params: pipeline_id ? { pipeline_id } : {} }),

  // === 用例导出 ===
  exportCases: (format: string, ids?: string[]) => {
    const params = new URLSearchParams({ format })
    if (ids?.length) params.set("ids", ids.join(","))
    return apiFetch(`/api/v1/data/cases/export?${params}`)
  },

  // === 流程记录 (DB版) ===
  listPipelineRecords: (params?: Record<string, any>) =>
    api.get("/test-lifecycle/pipeline-records", { params }),
  getPipelineRecord: (id: number) =>
    api.get(`/test-lifecycle/pipeline-records/${id}`),

  // === 引擎管理 ===
  getEngineList: () => api.get("/engines"),
  switchEngine: (engineType: string) => api.post("/engines/switch", { engine_type: engineType }),
  getCurrentEngine: () => api.get("/engines/current"),
  checkEngineHealth: (engineType: string) => api.post(`/engines/${engineType}/health`),
}

// ============================
// 基础配置 API
// ============================

export const configApi = {
  // 环境配置
  listEnvironments: (page = 1, pageSize = 20) => api.get("/config/environments", { params: { page, page_size: pageSize } }),
  getEnvironment: (id: number) => api.get(`/config/environments/${id}`),
  createEnvironment: (data: any) => api.post("/config/environments", data),
  updateEnvironment: (id: number, data: any) => api.put(`/config/environments/${id}`, data),
  deleteEnvironment: (id: number) => api.delete(`/config/environments/${id}`),
  healthCheckEnvironment: (id: number) => api.post(`/config/environments/${id}/health-check`),
  batchHealthCheck: () => api.post("/config/environments/batch-health-check"),
  getEnvironmentHealthHistory: (id: number, limit = 10) => api.get(`/config/environments/${id}/health-history`, { params: { limit } }),
  listHealthHistory: (params?: Record<string, any>) => api.get("/config/health-history", { params }),

  // 大模型配置
  listLLMProviders: (page = 1, pageSize = 20) => api.get("/config/llm-providers", { params: { page, page_size: pageSize } }),
  getLLMProvider: (id: number) => api.get(`/config/llm-providers/${id}`),
  createLLMProvider: (data: any) => api.post("/config/llm-providers", data),
  updateLLMProvider: (id: number, data: any) => api.put(`/config/llm-providers/${id}`, data),
  deleteLLMProvider: (id: number) => api.delete(`/config/llm-providers/${id}`),
  toggleLLMProvider: (id: number) => api.post(`/config/llm-providers/${id}/toggle`),
  testLLMConnection: (id: number) => api.post(`/config/llm-providers/${id}/test`),

  // 提示词配置
  listPrompts: (page = 1, pageSize = 20) => api.get("/config/prompts", { params: { page, page_size: pageSize } }),
  getPrompt: (id: number) => api.get(`/config/prompts/${id}`),
  createPrompt: (data: any) => api.post("/config/prompts", data),
  updatePrompt: (id: number, data: any) => api.put(`/config/prompts/${id}`, data),
  deletePrompt: (id: number) => api.delete(`/config/prompts/${id}`),
  publishPrompt: (id: number) => api.post(`/config/prompts/${id}/publish`),
  testPrompt: (id: number, data: { variables?: Record<string, string>; input_text?: string }) => api.post(`/config/prompts/${id}/test`, data),

  // 去AI味配置
  listDeAIStyles: (page = 1, pageSize = 20) => api.get("/config/deai-styles", { params: { page, page_size: pageSize } }),
  getDeAIStyle: (id: number) => api.get(`/config/deai-styles/${id}`),
  createDeAIStyle: (data: any) => api.post("/config/deai-styles", data),
  updateDeAIStyle: (id: number, data: any) => api.put(`/config/deai-styles/${id}`, data),
  deleteDeAIStyle: (id: number) => api.delete(`/config/deai-styles/${id}`),
  testDeAIStyle: (id: number, inputText = "") => api.post(`/config/deai-styles/${id}/test`, { input_text: inputText }),

  // MCP服务配置
  listMCPServices: (page = 1, pageSize = 20) => api.get("/config/mcp-services", { params: { page, page_size: pageSize } }),
  getMCPService: (id: number) => api.get(`/config/mcp-services/${id}`),
  createMCPService: (data: any) => api.post("/config/mcp-services", data),
  updateMCPService: (id: number, data: any) => api.put(`/config/mcp-services/${id}`, data),
  deleteMCPService: (id: number) => api.delete(`/config/mcp-services/${id}`),
  testMCPConnection: (id: number) => api.post(`/config/mcp-services/${id}/test`),
  batchTestMCP: () => api.post("/config/mcp-services/batch-test"),

  // Skills技能配置
  listSkills: (page = 1, pageSize = 20) => api.get("/config/skills", { params: { page, page_size: pageSize } }),
  getSkill: (id: number) => api.get(`/config/skills/${id}`),
  createSkill: (data: any) => api.post("/config/skills", data),
  updateSkill: (id: number, data: any) => api.put(`/config/skills/${id}`, data),
  deleteSkill: (id: number) => api.delete(`/config/skills/${id}`),
  toggleSkill: (id: number) => api.post(`/config/skills/${id}/toggle`),
  executeSkill: (id: number, data: { params?: Record<string, any>; input_text?: string }) => api.post(`/config/skills/${id}/execute`, data),

  // Hermes渠道配置
  listHermesChannels: (page = 1, pageSize = 20) => api.get("/config/hermes-channels", { params: { page, page_size: pageSize } }),
  getHermesChannel: (id: number) => api.get(`/config/hermes-channels/${id}`),
  createHermesChannel: (data: any) => api.post("/config/hermes-channels", data),
  updateHermesChannel: (id: number, data: any) => api.put(`/config/hermes-channels/${id}`, data),
  deleteHermesChannel: (id: number) => api.delete(`/config/hermes-channels/${id}`),
  testHermesChannel: (id: number) => api.post(`/config/hermes-channels/${id}/test`),
  batchTestHermes: () => api.post("/config/hermes-channels/batch-test"),
  sendHermesMessage: (id: number, message: string) => api.post(`/config/hermes-channels/${id}/send`, { message }),

  // LLM 使用统计 & 记录
  getLLMUsageStats: () => api.get("/config/llm-usage-stats"),
  listLLMUsageLogs: (params?: Record<string, any>) => api.get("/config/llm-usage-logs", { params }),

  // 系统健康统计
  getSystemHealthStats: () => api.get("/config/system-health-stats"),

  // 操作日志
  listOperationLogs: (params?: Record<string, any>) => api.get("/config/operation-logs", { params }),
}

// MCP Market API
export const mcpMarketApi = {
  listServices: (params?: Record<string, any>) => api.get("/mcp-marketplace/services", { params }),
  getService: (id: string) => api.get(`/mcp-marketplace/services/${id}`),
  listCategories: () => api.get("/mcp-marketplace/categories"),
  installService: (data: { marketplace_id: string; name?: string; url?: string; config?: any }) =>
    api.post("/mcp-marketplace/install", data),
}

// Knowledge API
export const knowledgeApi = {
  // 测试模式库
  listTestPatterns: (params?: Record<string, any>) => api.get("/knowledge/test-patterns", { params }),
  getTestPattern: (id: number) => api.get(`/knowledge/test-patterns/${id}`),
  createTestPattern: (data: any) => api.post("/knowledge/test-patterns", data),
  updateTestPattern: (id: number, data: any) => api.put(`/knowledge/test-patterns/${id}`, data),
  deleteTestPattern: (id: number) => api.delete(`/knowledge/test-patterns/${id}`),
  batchDeleteTestPatterns: (ids: number[]) => api.post("/knowledge/test-patterns/batch-delete", ids),

  // Bug知识库
  listBugKnowledge: (params?: Record<string, any>) => api.get("/knowledge/bug-knowledge", { params }),
  getBugKnowledge: (id: number) => api.get(`/knowledge/bug-knowledge/${id}`),
  createBugKnowledge: (data: any) => api.post("/knowledge/bug-knowledge", data),
  updateBugKnowledge: (id: number, data: any) => api.put(`/knowledge/bug-knowledge/${id}`, data),
  deleteBugKnowledge: (id: number) => api.delete(`/knowledge/bug-knowledge/${id}`),
  batchDeleteBugKnowledge: (ids: number[]) => api.post("/knowledge/bug-knowledge/batch-delete", ids),

  // RAG搜索
  searchKnowledge: (data: { query: string; search_type?: string; limit?: number }) =>
    api.post("/knowledge/search", data),

  // AI 增强
  aiExtractFromExecution: (executionId: number) =>
    api.post("/knowledge/ai/extract-from-execution", { execution_id: executionId }),
  aiSearch: (data: { query: string; search_type?: string; limit?: number }) =>
    api.post("/knowledge/ai/search", data),
  aiSuggestPatterns: (data: { text: string; context?: string }) =>
    api.post("/knowledge/ai/suggest-patterns", data),
  aiCreateBugFromFailure: (data: { execution_id: number; node_execution_id: number }) =>
    api.post("/knowledge/ai/create-bug-from-failure", data),
}

// AI Chat API - 智能助手
export const aiChatApi = {
  /**
   * 发送聊天消息（流式响应）
   * @param messages 对话历史
   * @param onToken 收到token时的回调
   * @param onDone 完成时的回调
   * @param onError 错误时的回调
   */
  streamChat: async (
    messages: { role: string; content: string }[],
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (error: string) => void,
  ) => {
    try {
      const response = await apiFetch("/api/v1/ai/chat", {
        method: "POST",
        body: { messages, stream: true },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("无法获取响应流")
      }

      const decoder = new TextDecoder()
      let buffer = ""
      let doneCalled = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === "token") {
                onToken(data.content)
              } else if (data.type === "done" && !doneCalled) {
                doneCalled = true
                onDone()
              } else if (data.type === "error") {
                onError(data.content)
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      if (!doneCalled) {
        onDone()
      }
    } catch (error: any) {
      onError(error.message || "聊天请求失败")
    }
  },
}

// Workflow API - 工作流编排
export const workflowApi = {
  // 工作流 CRUD
  listWorkflows: (params?: Record<string, any>) => api.get("/workflows", { params }),
  getWorkflow: (id: number) => api.get(`/workflows/${id}`),
  createWorkflow: (data: { name: string; description?: string; tags?: any }) => api.post("/workflows", data),
  updateWorkflow: (id: number, data: any) => api.put(`/workflows/${id}`, data),
  deleteWorkflow: (id: number) => api.delete(`/workflows/${id}`),

  // 画布全量保存
  saveCanvas: (workflowId: number, data: { nodes: any[]; edges: any[] }) =>
    api.put(`/workflows/${workflowId}/canvas`, data),

  // 节点 CRUD
  addNode: (workflowId: number, data: any) => api.post(`/workflows/${workflowId}/nodes`, data),
  updateNode: (workflowId: number, nodeId: number, data: any) =>
    api.put(`/workflows/${workflowId}/nodes/${nodeId}`, data),
  deleteNode: (workflowId: number, nodeId: number) =>
    api.delete(`/workflows/${workflowId}/nodes/${nodeId}`),

  // 边 CRUD
  addEdge: (workflowId: number, data: { source_node_id: number; target_node_id: number; label?: string }) =>
    api.post(`/workflows/${workflowId}/edges`, data),
  deleteEdge: (workflowId: number, edgeId: number) =>
    api.delete(`/workflows/${workflowId}/edges/${edgeId}`),

  // 执行
  executeWorkflow: (workflowId: number) => api.post(`/workflows/${workflowId}/execute`),
  listExecutions: (workflowId: number, params?: Record<string, any>) =>
    api.get(`/workflows/${workflowId}/executions`, { params }),
  getExecution: (executionId: number) => api.get(`/workflows/executions/${executionId}`),
}

export default api
