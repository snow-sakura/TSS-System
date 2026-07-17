<script setup lang="ts">
// ============================================================
// TSS AI测试平台 — 登录页 (暖阳专业风)
// ============================================================

import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api'
import type { CaptchaResponse } from '@/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// 表单
const form = reactive({
  username: '',
  password: '',
  captcha_answer: '',
})
const errors = reactive({
  username: '',
  password: '',
  captcha_answer: '',
})
const loading = ref(false)
const errorMessage = ref('')

// 验证码
const captcha = ref<CaptchaResponse | null>(null)
const captchaToken = ref('')

async function loadCaptcha() {
  try {
    const res = await authApi.captcha()
    captcha.value = res.data
    captchaToken.value = res.data.token
    form.captcha_answer = ''
  } catch {
    // 静默失败
  }
}

// 表单验证
function validate(): boolean {
  let valid = true
  errors.username = ''
  errors.password = ''
  errors.captcha_answer = ''

  if (!form.username.trim()) {
    errors.username = '请输入用户名'
    valid = false
  }
  if (!form.password) {
    errors.password = '请输入密码'
    valid = false
  }
  if (!form.captcha_answer.trim()) {
    errors.captcha_answer = '请输入验证码'
    valid = false
  }
  return valid
}

// 登录
async function handleLogin() {
  if (!validate()) return
  loading.value = true
  errorMessage.value = ''

  try {
    await authStore.login({
      username: form.username,
      password: form.password,
      captcha_token: captchaToken.value,
      captcha_answer: parseInt(form.captcha_answer),
    })
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || '登录失败，请重试'
    loadCaptcha()
  } finally {
    loading.value = false
  }
}

// 初始化加载验证码
loadCaptcha()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-base relative overflow-hidden">
    <!-- 背景装饰圆 — 暖色调 -->
    <div class="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
    <div class="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-secondary/5 blur-3xl" />
    <div class="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-accent/30 blur-3xl" />

    <div class="w-full max-w-sm mx-4">
      <!-- Logo区 -->
      <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary shadow-warm-md mb-3">
          <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 class="text-xl font-bold tracking-tight" style="color: hsl(var(--foreground))">TSS AI测试平台</h1>
        <p class="text-muted-foreground mt-1 text-sm">多智能体驱动的软件测试管理系统</p>
      </div>

      <!-- 登录卡片 -->
      <div class="bg-surface rounded-xl shadow-warm-lg border p-6">
        <h2 class="text-sm font-semibold mb-5" style="color: hsl(var(--foreground))">登录账户</h2>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {{ errorMessage }}
        </div>

        <!-- 表单 -->
        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- 用户名 -->
          <div>
            <label class="block text-sm font-medium mb-1.5" style="color: hsl(var(--foreground))">用户名</label>
            <input
              v-model="form.username"
              type="text"
              placeholder="请输入用户名"
              class="w-full px-3.5 py-2.5 rounded-xl border bg-base text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60"
              :class="{ 'border-destructive': errors.username }"
            />
            <p v-if="errors.username" class="mt-1 text-xs text-destructive">{{ errors.username }}</p>
          </div>

          <!-- 密码 -->
          <div>
            <label class="block text-sm font-medium mb-1.5" style="color: hsl(var(--foreground))">密码</label>
            <input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              class="w-full px-3.5 py-2.5 rounded-xl border bg-base text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60"
              :class="{ 'border-destructive': errors.password }"
            />
            <p v-if="errors.password" class="mt-1 text-xs text-destructive">{{ errors.password }}</p>
          </div>

          <!-- 验证码 -->
          <div>
            <label class="block text-sm font-medium mb-1.5" style="color: hsl(var(--foreground))">验证码</label>
            <div class="flex gap-3">
              <input
                v-model="form.captcha_answer"
                type="text"
                placeholder="计算结果"
                class="flex-1 px-3.5 py-2.5 rounded-xl border bg-base text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60"
                :class="{ 'border-destructive': errors.captcha_answer }"
              />
              <div class="flex-shrink-0 w-28 h-10 rounded-xl bg-base border flex items-center justify-center text-sm font-mono select-none cursor-pointer transition-all duration-200 hover:border-primary/40 hover:bg-primary/5"
                   @click="loadCaptcha"
                   :title="'点击刷新验证码'">
                {{ captcha?.question || '加载中...' }}
              </div>
            </div>
            <p v-if="errors.captcha_answer" class="mt-1 text-xs text-destructive">{{ errors.captcha_answer }}</p>
          </div>

          <!-- 提交 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-warm-md disabled:opacity-50 disabled:cursor-not-allowed shadow-warm"
          >
            <span v-if="loading" class="inline-flex items-center gap-2">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              登录中...
            </span>
            <span v-else>登录</span>
          </button>
        </form>

        <!-- 注册入口 -->
        <div class="mt-6 text-center text-sm">
          <span class="text-muted-foreground">没有账户？</span>
          <router-link to="/register" class="text-primary font-medium hover:text-primary/80 ml-1 transition-colors">注册账户</router-link>
        </div>
      </div>

      <!-- 底部信息 -->
      <p class="text-center text-xs text-muted-foreground/60 mt-6">
        TSS AI测试平台 v1.0.0
      </p>
    </div>
  </div>
</template>
