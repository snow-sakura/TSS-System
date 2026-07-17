// ============================================================
// TSS AI测试平台 — Vue Router 路由配置
// ============================================================

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/test-foundation/:module',
    component: () => import('@/views/ModulePage.vue'),
    meta: { requiresAuth: true, category: 'test-foundation' },
  },
  {
    path: '/config/:module',
    component: () => import('@/views/ModulePage.vue'),
    meta: { requiresAuth: true, category: 'config' },
  },
  {
    path: '/personal/:module',
    component: () => import('@/views/ModulePage.vue'),
    meta: { requiresAuth: true, category: 'personal' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫 — 认证检查
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if ((to.name === 'Login' || to.name === 'Register') && authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
