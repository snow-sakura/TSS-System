<script setup lang="ts">
// ============================================================
// TSS AI测试平台 — 子功能页Layout
// 布局: 左侧导航菜单(240px) + 面包屑/步骤条 + CRUD内容区
// ============================================================

import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import type { TabModule } from '@/stores/app'
import RequirementsPage from '@/views/modules/RequirementsPage.vue'
import TestPointsPage from '@/views/modules/TestPointsPage.vue'
import TestCasesPage from '@/views/modules/TestCasesPage.vue'
import DefectsPage from '@/views/modules/DefectsPage.vue'
import GenericModulePage from '@/views/modules/GenericModulePage.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const moduleId = computed(() => route.params.module as string)
const category = computed(() => (route.meta.category as string) || 'test-foundation')

const allModules = computed(() => {
  switch (category.value) {
    case 'test-foundation': return appStore.testFoundationModules
    case 'config': return appStore.configModules
    case 'personal': return appStore.personalModules
    default: return []
  }
})

const currentModule = computed<TabModule | undefined>(() =>
  allModules.value.find(m => m.id === moduleId.value)
)

// 动态组件映射 — 有专用页面的模块
const componentMap: Record<string, any> = {
  'requirements': RequirementsPage,
  'test-points': TestPointsPage,
  'test-cases': TestCasesPage,
  'defects': DefectsPage,
}

const currentComponent = computed(() => componentMap[moduleId.value] || GenericModulePage)

watch(moduleId, () => {
  appStore.setTab(category.value)
})

const collapsed = ref(false)

function navigateTo(mod: TabModule) {
  router.push(mod.path)
}
</script>

<template>
  <div class="min-h-screen flex bg-base">
    <!-- 左侧导航菜单 -->
    <aside class="border-r bg-surface flex flex-col transition-all duration-200" :class="collapsed ? 'w-16' : 'w-60'">
      <!-- Logo区 -->
      <div class="h-14 border-b flex items-center px-4 gap-3 flex-shrink-0">
        <router-link to="/" class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span v-show="!collapsed" class="font-semibold text-sm truncate">TSS</span>
        </router-link>
        <button @click="collapsed = !collapsed" class="ml-auto p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path v-if="!collapsed" d="M15 18l-6-6 6-6" />
            <path v-else d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
      <!-- 导航菜单 -->
      <nav class="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        <div v-for="mod in allModules" :key="mod.id"
          @click="navigateTo(mod)"
          class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors"
          :class="mod.id === moduleId
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'">
          <div class="w-4 h-4 flex-shrink-0 flex items-center justify-center">
            <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path v-if="mod.icon === 'file-text'" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path v-if="mod.icon === 'file-text'" d="M14 2v6h6" />
              <path v-if="mod.icon === 'target'" d="M12 2a10 10 0 1010 10M12 6a6 6 0 106 6" /><path v-if="mod.icon === 'target'" d="M12 10a2 2 0 102 2" />
              <rect v-if="mod.icon === 'layout-dashboard'" x="3" y="3" width="7" height="7" rx="1" /><rect v-if="mod.icon === 'layout-dashboard'" x="14" y="3" width="7" height="7" rx="1" /><rect v-if="mod.icon === 'layout-dashboard'" x="3" y="14" width="7" height="7" rx="1" /><rect v-if="mod.icon === 'layout-dashboard'" x="14" y="14" width="7" height="7" rx="1" />
              <path v-if="mod.icon === 'file-check'" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              <polygon v-if="mod.icon === 'play-circle'" points="5 3 19 12 5 21 5 3" />
              <path v-if="mod.icon === 'bug'" d="M8 2l1.88 1.88M16 2l-1.88 1.88M12 8v4m0 4h.01" /><path v-if="mod.icon === 'bug'" d="M12 20a8 8 0 100-16 8 8 0 000 16z" />
              <path v-if="mod.icon === 'bar-chart-3'" d="M18 20V10M12 20V4M6 20v-6" />
              <path v-if="mod.icon === 'server'" d="M4 4h16v4H4zM4 14h16v4H4z" /><path v-if="mod.icon === 'server'" d="M4 10h16" />
              <ellipse v-if="mod.icon === 'database'" cx="12" cy="5" rx="9" ry="3" /><path v-if="mod.icon === 'database'" d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path v-if="mod.icon === 'database'" d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              <path v-if="mod.icon === 'library'" d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path v-if="mod.icon === 'library'" d="M4 4.5A2.5 2.5 0 016.5 2H20" /><path v-if="mod.icon === 'library'" d="M4 14.5A2.5 2.5 0 016.5 12H20" />
              <path v-if="mod.icon === 'settings-2'" d="M20 7h-4" /><path v-if="mod.icon === 'settings-2'" d="M4 7h4" /><circle v-if="mod.icon === 'settings-2'" cx="12" cy="7" r="2" />
              <path v-if="mod.icon === 'brain'" d="M12 2a8 8 0 00-4 14.9V20a2 2 0 002 2h4a2 2 0 002-2v-3.1A8 8 0 0012 2z" />
              <path v-if="mod.icon === 'message-square'" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              <path v-if="mod.icon === 'sparkles'" d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z" />
              <path v-if="mod.icon === 'plug'" d="M10 3v4" /><path v-if="mod.icon === 'plug'" d="M14 3v4" /><path v-if="mod.icon === 'plug'" d="M5 11h14" />
              <path v-if="mod.icon === 'zap'" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              <path v-if="mod.icon === 'message-circle'" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              <path v-if="mod.icon === 'hard-drive'" d="M22 12H2" /><path v-if="mod.icon === 'hard-drive'" d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
              <path v-if="mod.icon === 'folder'" d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              <path v-if="mod.icon === 'cog'" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
              <path v-if="mod.icon === 'users'" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle v-if="mod.icon === 'users'" cx="9" cy="7" r="4" />
              <path v-if="mod.icon === 'shield'" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path v-if="mod.icon === 'user-circle'" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle v-if="mod.icon === 'user-circle'" cx="12" cy="7" r="4" />
              <path v-if="mod.icon === 'scroll-text'" d="M8 21h12a2 2 0 002-2V5a2 2 0 00-2-2H8" /><rect v-if="mod.icon === 'scroll-text'" x="2" y="3" width="6" height="18" rx="1" />
            </svg>
          </div>
          <span v-show="!collapsed" class="truncate">{{ mod.name }}</span>
        </div>
      </nav>
    </aside>

    <!-- 右侧内容区 -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-14 border-b bg-surface/80 backdrop-blur-md flex items-center px-4 gap-3 flex-shrink-0">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <router-link to="/" class="text-sm text-muted-foreground hover:text-foreground transition-colors">首页</router-link>
          <svg class="w-3 h-3 text-muted-foreground flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span class="text-sm font-medium truncate">{{ currentModule?.name || '模块' }}</span>
        </div>
        <!-- 用户菜单 -->
        <div class="flex items-center gap-2">
          <button @click="appStore.toggleTheme" class="p-2 rounded-lg hover:bg-muted transition-colors">
            <svg v-if="appStore.theme === 'dark'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
          <span class="text-sm text-muted-foreground">{{ authStore.username }}</span>
        </div>
      </header>

      <!-- 页面内容区 -->
      <div class="flex-1 overflow-auto py-5 px-6">
        <!-- 模块标题 -->
        <div class="mb-5">
          <h1 class="text-lg font-semibold tracking-tight">{{ currentModule?.name || '模块' }}</h1>
          <p class="text-sm text-muted-foreground mt-0.5">{{ currentModule?.description }}</p>
        </div>
        <!-- 动态组件 -->
        <component :is="currentComponent" :key="moduleId" />
      </div>
    </div>
  </div>
</template>
