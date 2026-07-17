<script setup lang="ts">
// ============================================================
// TSS AI测试平台 — 注册页 (暖阳专业风)
// ============================================================

import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})
const errors = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})
const loading = ref(false)
const errorMessage = ref('')

const passwordsMatch = computed(() => form.password === form.confirmPassword)

function validate(): boolean {
  let valid = true
  Object.keys(errors).forEach(k => (errors as any)[k] = '')

  if (!form.username.trim() || form.username.length < 3) {
    errors.username = '用户名至少3个字符'
    valid = false
  }
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = '请输入有效的邮箱地址'
    valid = false
  }
  if (!form.password || form.password.length < 6) {
    errors.password = '密码至少6个字符'
    valid = false
  }
  if (!passwordsMatch.value) {
    errors.confirmPassword = '两次密码输入不一致'
    valid = false
  }
  return valid
}

async function handleRegister() {
  if (!validate()) return
  loading.value = true
  errorMessage.value = ''

  try {
    await authStore.register({
      username: form.username,
      email: form.email,
      password: form.password,
      confirm_password: form.confirmPassword,
    })
    router.push('/login')
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || '注册失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-base relative overflow-hidden">
    <div class="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
    <div class="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-secondary/5 blur-3xl" />
    <div class="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-accent/30 blur-3xl" />

    <div class="w-full max-w-sm mx-4">
      <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary shadow-warm-md mb-3">
          <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h1 class="text-xl font-bold tracking-tight" style="color: hsl(var(--foreground))">创建账户</h1>
        <p class="text-muted-foreground mt-1 text-sm">加入 TSS AI测试平台</p>
      </div>

      <div class="bg-surface rounded-xl shadow-warm-lg border p-6">
        <div v-if="errorMessage" class="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {{ errorMessage }}
        </div>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1.5" style="color: hsl(var(--foreground))">用户名</label>
            <input v-model="form.username" type="text" placeholder="3-20个字符"
              class="w-full px-3.5 py-2.5 rounded-xl border bg-base text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60"
              :class="{ 'border-destructive': errors.username }" />
            <p v-if="errors.username" class="mt-1 text-xs text-destructive">{{ errors.username }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1.5" style="color: hsl(var(--foreground))">邮箱</label>
            <input v-model="form.email" type="email" placeholder="your@email.com"
              class="w-full px-3.5 py-2.5 rounded-xl border bg-base text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60"
              :class="{ 'border-destructive': errors.email }" />
            <p v-if="errors.email" class="mt-1 text-xs text-destructive">{{ errors.email }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1.5" style="color: hsl(var(--foreground))">密码</label>
            <input v-model="form.password" type="password" placeholder="至少6个字符"
              class="w-full px-3.5 py-2.5 rounded-xl border bg-base text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60"
              :class="{ 'border-destructive': errors.password }" />
            <p v-if="errors.password" class="mt-1 text-xs text-destructive">{{ errors.password }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1.5" style="color: hsl(var(--foreground))">确认密码</label>
            <input v-model="form.confirmPassword" type="password" placeholder="再次输入密码"
              class="w-full px-3.5 py-2.5 rounded-xl border bg-base text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60"
              :class="{ 'border-destructive': errors.confirmPassword }" />
            <p v-if="errors.confirmPassword" class="mt-1 text-xs text-destructive">{{ errors.confirmPassword }}</p>
          </div>

          <button type="submit" :disabled="loading"
            class="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-warm-md disabled:opacity-50 disabled:cursor-not-allowed shadow-warm">
            <span v-if="loading" class="inline-flex items-center gap-2">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              注册中...
            </span>
            <span v-else>注册</span>
          </button>
        </form>

        <div class="mt-6 text-center text-sm">
          <span class="text-muted-foreground">已有账户？</span>
          <router-link to="/login" class="text-primary font-medium hover:text-primary/80 ml-1 transition-colors">返回登录</router-link>
        </div>
      </div>

      <p class="text-center text-xs text-muted-foreground/60 mt-6">
        TSS AI测试平台 v1.0.0
      </p>
    </div>
  </div>
</template>
