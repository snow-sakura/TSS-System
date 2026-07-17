<script setup lang="ts">
// ============================================================
// TSS AI测试平台 — 根组件（默认亮色拍立得暖调）
// ============================================================

import { onMounted } from 'vue'

onMounted(() => {
  // 亮色主题（默认）
  document.documentElement.classList.remove('dark')
})
</script>

<template>
  <div class="app-wrapper">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style>
/* 全局应用容器 — 确保所有页面有边界感 */
.app-wrapper {
  min-height: 100vh;
  background-color: hsl(var(--background));
  background-image:
    radial-gradient(ellipse at 15% 20%, rgba(196, 132, 92, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 85% 80%, rgba(212, 165, 116, 0.04) 0%, transparent 50%);
}
</style>
