// ============================================================
// TSS AI测试平台 — 认证状态管理 (Pinia)
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const token = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const user = ref<User | null>(null)

  // 计算属性
  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const username = computed(() => user.value?.username ?? '')

  // 登录
  async function login(credentials: { username: string; password: string; captcha_token?: string; captcha_answer?: number }) {
    const response = await authApi.login(credentials)
    token.value = response.data.access_token
    refreshToken.value = response.data.refresh_token
    user.value = response.data.user
    return response.data
  }

  // 注册
  async function register(data: any) {
    const response = await authApi.register(data)
    return response.data
  }

  // 刷新Token
  async function refreshTokenAction(): Promise<boolean> {
    if (!refreshToken.value) return false
    try {
      const response = await authApi.refresh(refreshToken.value)
      token.value = response.data.access_token
      refreshToken.value = response.data.refresh_token
      return true
    } catch {
      logout()
      return false
    }
  }

  // 获取个人资料
  async function fetchProfile() {
    try {
      const response = await authApi.profile()
      user.value = response.data
    } catch {
      logout()
    }
  }

  // 登出
  function logout() {
    token.value = null
    refreshToken.value = null
    user.value = null
  }

  return {
    token,
    refreshToken,
    user,
    isAuthenticated,
    isAdmin,
    username,
    login,
    register,
    refreshTokenAction,
    fetchProfile,
    logout,
  }
})
