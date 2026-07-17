// ============================================================
// TSS AI测试平台 — API 请求封装
// ============================================================

import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'

const API_BASE_URL = '/api/v1'

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ============================================================
// 请求拦截器 — 自动注入Token + 前端操作日志
// ============================================================

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ============================================================
// 响应拦截器 — Token刷新 + 错误处理
// ============================================================

api.interceptors.response.use(
  (response) => {
    // 自动解包 ApiResponse<T>：将 {code, message, data} 转为 data
    const body = response.data
    if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
      response.data = body.data
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    // 401 Token过期 → 尝试刷新
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const authStore = useAuthStore()
      
      try {
        const refreshed = await authStore.refreshTokenAction()
        if (refreshed) {
          originalRequest.headers.Authorization = `Bearer ${authStore.token}`
          return api(originalRequest)
        }
      } catch {
        // refresh failed
      }
    }
    
    return Promise.reject(error)
  }
)

// ============================================================
// API 方法
// ============================================================

export const authApi = {
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refresh_token: refreshToken }),
  captcha: () => api.get('/auth/captcha'),
  profile: () => api.get('/auth/profile'),
}

export const requirementsApi = {
  list: (params?: any) => api.get('/requirements', { params }),
  create: (data: any) => api.post('/requirements', data),
  update: (id: string, data: any) => api.put(`/requirements/${id}`, data),
  delete: (id: string) => api.delete(`/requirements/${id}`),
  get: (id: string) => api.get(`/requirements/${id}`),
  analyze: (id: string) => api.post(`/requirements/${id}/analyze`),
  approve: (id: string) => api.post(`/requirements/${id}/approve`),
}

export const testPointsApi = {
  list: (params?: any) => api.get('/test-points', { params }),
  create: (data: any) => api.post('/test-points', data),
  update: (id: string, data: any) => api.put(`/test-points/${id}`, data),
  delete: (id: string) => api.delete(`/test-points/${id}`),
  batchDelete: (ids: string[]) => api.post('/test-points/batch-delete', { ids }),
  aiExtract: (requirementId: string) => api.post('/test-points/ai-extract', { requirement_id: requirementId }),
}

export const testPlansApi = {
  list: (params?: any) => api.get('/test-plans', { params }),
  create: (data: any) => api.post('/test-plans', data),
  update: (id: string, data: any) => api.put(`/test-plans/${id}`, data),
  delete: (id: string) => api.delete(`/test-plans/${id}`),
  aiSuggest: (id: string) => api.post(`/test-plans/${id}/ai-suggest`),
}

export const testCasesApi = {
  list: (params?: any) => api.get('/test-cases', { params }),
  create: (data: any) => api.post('/test-cases', data),
  update: (id: string, data: any) => api.put(`/test-cases/${id}`, data),
  delete: (id: string) => api.delete(`/test-cases/${id}`),
  aiGenerate: (data: any) => api.post('/test-cases/ai-generate', data),
  confirm: (id: string) => api.post(`/test-cases/${id}/confirm`),
}

export const defectsApi = {
  list: (params?: any) => api.get('/defects', { params }),
  create: (data: any) => api.post('/defects', data),
  update: (id: string, data: any) => api.put(`/defects/${id}`, data),
  delete: (id: string) => api.delete(`/defects/${id}`),
  analyze: (id: string) => api.post(`/defects/${id}/analyze`),
}

export const reportsApi = {
  list: (params?: any) => api.get('/reports', { params }),
  create: (data: any) => api.post('/reports', data),
  update: (id: string, data: any) => api.put(`/reports/${id}`, data),
  delete: (id: string) => api.delete(`/reports/${id}`),
  aiGenerate: (data: any) => api.post('/reports/ai-generate', data),
}

export const configApi = {
  // 环境
  environments: {
    list: (params?: any) => api.get('/environments', { params }),
    create: (data: any) => api.post('/environments', data),
    update: (id: string, data: any) => api.put(`/environments/${id}`, data),
    delete: (id: string) => api.delete(`/environments/${id}`),
  },
  // LLM
  llm: {
    list: () => api.get('/llm/providers'),
    create: (data: any) => api.post('/llm/providers', data),
    update: (id: string, data: any) => api.put(`/llm/providers/${id}`, data),
    delete: (id: string) => api.delete(`/llm/providers/${id}`),
    test: (id: string) => api.post(`/llm/providers/${id}/test`),
  },
  // MCP
  mcp: {
    list: () => api.get('/mcp/services'),
    create: (data: any) => api.post('/mcp/services', data),
    update: (id: string, data: any) => api.put(`/mcp/services/${id}`, data),
    delete: (id: string) => api.delete(`/mcp/services/${id}`),
    test: (id: string) => api.post(`/mcp/services/${id}/test`),
  },
}

export const usersApi = {
  list: (params?: any) => api.get('/users', { params }),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
}

export const operationLogsApi = {
  list: (params?: any) => api.get('/operation-logs', { params }),
}

export default api
