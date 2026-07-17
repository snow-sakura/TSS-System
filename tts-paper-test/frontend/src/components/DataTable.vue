<script setup lang="ts">
// ============================================================
// TSS AI测试平台 — 数据表格组件
// ============================================================

import { ref } from 'vue'

const props = defineProps<{
  columns: { key: string; label: string; width?: string; sortable?: boolean }[]
  data: any[]
  loading?: boolean
  selectable?: boolean
}>()

const emit = defineEmits<{
  (e: 'row-click', row: any): void
  (e: 'selection-change', selection: any[]): void
}>()

const selected = ref<any[]>([])

function toggleSelect(row: any) {
  const idx = selected.value.findIndex(s => s.id === row.id)
  if (idx >= 0) selected.value.splice(idx, 1)
  else selected.value.push(row)
  emit('selection-change', selected.value)
}

function toggleAll() {
  if (selected.value.length === props.data.length) {
    selected.value = []
  } else {
    selected.value = [...props.data]
  }
  emit('selection-change', selected.value)
}

function formatValue(row: any, key: string): string {
  const val = row[key]
  if (val === null || val === undefined) return '-'
  if (key === 'created_at' || key === 'updated_at') {
    return new Date(val).toLocaleString('zh-CN')
  }
  if (key === 'status') return val
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-200/50',
    analyzing: 'bg-sky-50 text-sky-700 border border-sky-200/50',
    analyzed: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
    rejected: 'bg-red-50 text-red-700 border border-red-200/50',
    draft: 'bg-stone-100 text-stone-600 border border-stone-200/50',
    active: 'bg-sky-50 text-sky-700 border border-sky-200/50',
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
    passed: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
    failed: 'bg-red-50 text-red-700 border border-red-200/50',
    blocked: 'bg-orange-50 text-orange-700 border border-orange-200/50',
    running: 'bg-sky-50 text-sky-700 border border-sky-200/50',
    new: 'bg-violet-50 text-violet-700 border border-violet-200/50',
    in_progress: 'bg-sky-50 text-sky-700 border border-sky-200/50',
    resolved: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
    closed: 'bg-stone-100 text-stone-600 border border-stone-200/50',
  }
  return map[status] || 'bg-stone-100 text-stone-600 border border-stone-200/50'
}
</script>

<template>
  <div class="overflow-x-auto rounded-xl border bg-surface shadow-warm">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-border/60 bg-muted/20">
          <th v-if="selectable" class="w-10 px-4 py-3 text-left">
            <input type="checkbox" :checked="selected.length === data.length && data.length > 0"
              @change="toggleAll" class="rounded" />
          </th>
          <th v-for="col in columns" :key="col.key"
            class="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
            :class="{ 'cursor-pointer hover:text-foreground': col.sortable }"
            :style="{ width: col.width }">
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length + (selectable ? 1 : 0)" class="text-center py-12 text-muted-foreground">
            <div class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              加载中...
            </div>
          </td>
        </tr>
        <tr v-else-if="data.length === 0">
          <td :colspan="columns.length + (selectable ? 1 : 0)" class="text-center py-12 text-muted-foreground">
            暂无数据
          </td>
        </tr>
        <tr v-for="(row, idx) in data" :key="row.id"
          @click="emit('row-click', row)"
          class="border-b border-border/30 hover:bg-accent/50 cursor-pointer transition-colors duration-150"
          :class="{ 'bg-accent/30': idx % 2 === 0 }">
          <td v-if="selectable" class="px-4 py-3" @click.stop>
            <input type="checkbox" :checked="selected.some(s => s.id === row.id)"
              @change="toggleSelect(row)" class="rounded" />
          </td>
          <td v-for="col in columns" :key="col.key" class="px-4 py-3">
            <!-- 状态标签 -->
            <span v-if="col.key === 'status'" class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="statusClass(row[col.key])">
              {{ row[col.key] }}
            </span>
            <!-- 优先级 -->
            <span v-else-if="col.key === 'priority' || col.key === 'severity'"
              class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="{
                'bg-red-50 text-red-700 border border-red-200/50': row[col.key] === 'critical' || row[col.key] === 'urgent' || row[col.key] === 'p0',
                'bg-orange-50 text-orange-700 border border-orange-200/50': row[col.key] === 'high' || row[col.key] === 'major' || row[col.key] === 'p1',
                'bg-amber-50 text-amber-700 border border-amber-200/50': row[col.key] === 'medium' || row[col.key] === 'p2',
                'bg-stone-100 text-stone-600 border border-stone-200/50': row[col.key] === 'low' || row[col.key] === 'trivial' || row[col.key] === 'p3',
              }">
              {{ row[col.key] }}
            </span>
            <!-- 默认 -->
            <span v-else class="text-foreground">{{ formatValue(row, col.key) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
