<script setup lang="ts">
// ============================================================
// TSS AI测试平台 — 搜索工具栏组件
// ============================================================

import { computed } from 'vue'

defineProps<{
  showSearch?: boolean
  showStatus?: boolean
  showPriority?: boolean
  showType?: boolean
  statusOptions?: { label: string; value: string }[]
  priorityOptions?: { label: string; value: string }[]
  typeOptions?: { label: string; value: string }[]
}>()

const emit = defineEmits<{
  search: [keyword: string]
  'filter-change': [filters: Record<string, string>]
  create: []
  'ai-action': []
  refresh: []
}>()

const filters = defineModel<Record<string, string>>('filters', { default: () => ({}) })
const f = computed(() => filters.value || {})

function onSearch(val: string) {
  emit('search', val)
}

function onFilterChange(key: string, value: string) {
  const newFilters = { ...f.value, [key]: value }
  emit('filter-change', newFilters)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 mb-4">
    <!-- 搜索框 -->
    <div v-if="showSearch" class="relative flex-1 min-w-[200px] max-w-sm">
      <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        :value="f.search || ''"
        @input="onSearch(($event.target as HTMLInputElement).value)"
        placeholder="搜索..."
        class="w-full pl-9 pr-3.5 py-2 rounded-xl border bg-base text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
      />
    </div>

    <!-- 筛选下拉 -->
    <select v-if="showStatus"
      :value="f.status || ''"
      @change="onFilterChange('status', ($event.target as HTMLSelectElement).value)"
      class="px-3 py-2 rounded-xl border bg-base text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200">
      <option value="">全部状态</option>
      <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>

    <select v-if="showPriority"
      :value="f.priority || ''"
      @change="onFilterChange('priority', ($event.target as HTMLSelectElement).value)"
      class="px-3 py-2 rounded-xl border bg-base text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200">
      <option value="">全部优先级</option>
      <option v-for="opt in priorityOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>

    <select v-if="showType"
      :value="f.type || ''"
      @change="onFilterChange('type', ($event.target as HTMLSelectElement).value)"
      class="px-3 py-2 rounded-xl border bg-base text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200">
      <option value="">全部类型</option>
      <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>

    <!-- 操作按钮 -->
    <div class="flex gap-2 ml-auto">
      <button @click="emit('refresh')"
        class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm hover:bg-muted transition-all duration-200 shadow-warm">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 119 9M21 12a9 9 0 00-9-9" /><path d="M3 12h4m14 0h-4" />
        </svg>
        刷新
      </button>
      <button @click="emit('ai-action')" v-if="$props.showType"
        class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-all duration-200 shadow-warm">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z" />
        </svg>
        AI生成
      </button>
      <button @click="emit('create')"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/85 transition-all duration-200 shadow-warm hover:shadow-warm-md">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14m-7-7h14" />
        </svg>
        新建
      </button>
    </div>
  </div>
</template>
