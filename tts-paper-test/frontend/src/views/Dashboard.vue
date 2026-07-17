<script setup lang="ts">
// ============================================================
// TSS AI测试平台 — 首页仪表盘
// 布局: 顶栏(48px) + 居中Tab + 3列卡片网格 + 状态栏
// ============================================================

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore, type TabModule } from '@/stores/app'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const time = ref(new Date())

const tabs = [
  { id: 'test-foundation', name: '测试基础' },
  { id: 'config', name: '基础配置' },
  { id: 'personal', name: '个人中心' },
]

const currentModules = computed(() => appStore.currentModules)

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => { time.value = new Date() }, 1000)
  appStore.setTab('test-foundation')
})
onUnmounted(() => clearInterval(timer))

function onTabClick(tabId: string) {
  appStore.setTab(tabId)
}

function onCardClick(module: TabModule) {
  router.push(module.path)
}

const showUserMenu = ref(false)
function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-base">
    <!-- 顶栏 TopBar 48px -->
    <header class="sticky top-0 z-50 h-12 border-b bg-white/90 backdrop-blur-md">
      <div class="h-full px-8 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span class="text-sm font-semibold tracking-tight">TSS AI测试平台</span>
        </div>

        <div class="flex items-center gap-3">
          <button @click="appStore.toggleTheme"
            class="p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
            :title="appStore.theme === 'dark' ? '切换亮色' : '切换暗色'">
            <svg v-if="appStore.theme === 'dark'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>

          <div class="relative">
            <button @click="showUserMenu = !showUserMenu"
              class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 transition-colors">
              <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-medium">
                {{ authStore.username?.charAt(0).toUpperCase() || 'U' }}
              </div>
              <span class="text-sm">{{ authStore.username }}</span>
              <svg class="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <transition name="fade">
              <div v-if="showUserMenu" @click.outside="showUserMenu = false"
                class="absolute right-0 top-full mt-1.5 w-40 bg-white border rounded-lg shadow-lg py-1 z-50">
                <router-link to="/personal/profile" class="block px-3.5 py-1.5 text-sm hover:bg-muted/60"
                  @click="showUserMenu = false">个人资料</router-link>
                <router-link to="/personal/roles" class="block px-3.5 py-1.5 text-sm hover:bg-muted/60"
                  @click="showUserMenu = false">角色权限</router-link>
                <hr class="my-1 border-border/50" />
                <button @click="handleLogout" class="w-full text-left px-3.5 py-1.5 text-sm text-destructive hover:bg-destructive/5">退出登录</button>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </header>

    <!-- Tab导航（居中） -->
    <nav class="border-b bg-muted/20">
      <div class="flex justify-center px-8">
        <div class="flex gap-2">
          <button v-for="tab in tabs" :key="tab.id"
            @click="onTabClick(tab.id)"
            class="relative px-5 py-2.5 text-sm font-medium transition-colors"
            :class="appStore.currentTab === tab.id
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'">
            {{ tab.name }}
            <span v-if="appStore.currentTab === tab.id"
              class="absolute bottom-0 left-5 right-5 h-0.5 bg-primary rounded-full" />
          </button>
        </div>
      </div>
    </nav>

    <!-- 主体: 3列卡片网格 -->
    <main class="flex-1 py-6 px-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="mod in currentModules" :key="mod.id"
          @click="onCardClick(mod)"
          class="bg-white border border-border/60 rounded-lg p-5 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5">
          <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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
          <h3 class="text-sm font-medium mb-1">{{ mod.name }}</h3>
          <p class="text-xs text-muted-foreground leading-relaxed line-clamp-2">{{ mod.description }}</p>
          <div v-if="mod.count !== undefined && mod.count > 0" class="mt-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
              {{ mod.count }} 项
            </span>
          </div>
        </div>
      </div>
    </main>

    <!-- 状态栏 -->
    <footer class="h-7 border-t bg-muted/20 text-[11px] text-muted-foreground flex items-center px-8">
      <div class="flex items-center gap-4 w-full">
        <span class="flex items-center gap-1"><span class="status-dot status-passed" />MCP {{ appStore.systemStatus.mcp.online }}/{{ appStore.systemStatus.mcp.total }}</span>
        <span class="flex items-center gap-1"><span class="status-dot status-active" />Skills {{ appStore.systemStatus.skills.active }}/{{ appStore.systemStatus.skills.total }}</span>
        <span class="flex items-center gap-1"><span class="status-dot status-passed" />LLM {{ appStore.systemStatus.llm.connected }}/{{ appStore.systemStatus.llm.total }}</span>
        <span class="ml-auto">{{ time.toLocaleTimeString('zh-CN', { hour12: false }) }}</span>
      </div>
    </footer>
  </div>
</template>
