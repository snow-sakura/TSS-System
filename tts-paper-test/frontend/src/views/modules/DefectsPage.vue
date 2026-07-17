<script setup lang="ts">
// ============================================================
// 缺陷管理模块页面
// ============================================================

import { ref, onMounted, reactive } from 'vue'
import { defectsApi } from '@/api'
import DataTable from '@/components/DataTable.vue'
import Toolbar from '@/components/Toolbar.vue'
import type { Defect } from '@/types'

const loading = ref(false)
const items = ref<Defect[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive<Record<string, string>>({})
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const editingItem = ref<Defect | null>(null)
const form = reactive({ title: '', description: '', severity: 'major', priority: 'medium', test_case_id: '' })

const columns = [
  { key: 'title', label: '缺陷标题' },
  { key: 'severity', label: '严重程度', width: '90px' },
  { key: 'priority', label: '优先级', width: '80px' },
  { key: 'status', label: '状态', width: '90px' },
  { key: 'assigned_to', label: '责任人', width: '100px' },
  { key: 'created_at', label: '创建时间', width: '140px' },
]

async function fetchData() {
  loading.value = true
  try {
    const res = await defectsApi.list({ page: page.value, page_size: pageSize.value, ...filters })
    items.value = res.data.data.items
    total.value = res.data.data.total
  } finally { loading.value = false }
}

function onCreate() { showCreateModal.value = true; form.title = ''; form.description = '' }

async function submitCreate() {
  await defectsApi.create(form)
  showCreateModal.value = false
  await fetchData()
}

function onRowClick(row: Defect) {
  editingItem.value = row
  showDetailModal.value = true
}

onMounted(fetchData)
</script>

<template>
  <div>
    <Toolbar show-search show-status :status-options="[
      { label: '新建', value: 'new' }, { label: '已确认', value: 'confirmed' },
      { label: '处理中', value: 'in_progress' }, { label: '已解决', value: 'resolved' }, { label: '已关闭', value: 'closed' },
    ]" @search="(v: string) => { filters.search = v; fetchData() }"
      @filter-change="(f: any) => { Object.assign(filters, f); fetchData() }"
      @create="onCreate" @refresh="fetchData" />

    <div class="bg-surface border rounded-xl overflow-hidden">
      <DataTable :columns="columns" :data="items" :loading="loading" @row-click="onRowClick" />
    </div>

    <!-- 新建弹窗 -->
    <teleport to="body">
      <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showCreateModal = false">
        <div class="w-full max-w-lg bg-surface rounded-xl shadow-2xl border p-6 m-4">
          <h3 class="text-lg font-semibold mb-4">新建缺陷</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium mb-1">缺陷标题</label>
              <input v-model="form.title" class="w-full px-3 py-2 rounded-lg border bg-base text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">描述</label>
              <textarea v-model="form.description" rows="4" class="w-full px-3 py-2 rounded-lg border bg-base text-sm" />
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="block text-sm font-medium mb-1">严重程度</label>
                <select v-model="form.severity" class="w-full px-3 py-2 rounded-lg border bg-base text-sm">
                  <option value="critical">Critical</option><option value="major">Major</option>
                  <option value="minor">Minor</option><option value="trivial">Trivial</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="block text-sm font-medium mb-1">优先级</label>
                <select v-model="form.priority" class="w-full px-3 py-2 rounded-lg border bg-base text-sm">
                  <option value="urgent">Urgent</option><option value="high">High</option>
                  <option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button @click="showCreateModal = false" class="px-4 py-2 rounded-lg border text-sm">取消</button>
            <button @click="submitCreate" class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">创建</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 详情 -->
    <teleport to="body">
      <div v-if="showDetailModal && editingItem" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showDetailModal = false">
        <div class="w-full max-w-2xl bg-surface rounded-xl shadow-2xl border p-6 m-4">
          <h3 class="text-lg font-semibold mb-2">{{ editingItem.title }}</h3>
          <div class="flex gap-2 mb-3">
            <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">{{ editingItem.severity }}</span>
            <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">{{ editingItem.priority }}</span>
            <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{{ editingItem.status }}</span>
          </div>
          <p class="text-sm text-muted-foreground whitespace-pre-wrap mb-4">{{ editingItem.description || '暂无描述' }}</p>
          <div class="text-xs text-muted-foreground space-y-1">
            <p v-if="editingItem.root_cause">根因: {{ editingItem.root_cause }}</p>
            <p v-if="editingItem.solution">解决方案: {{ editingItem.solution }}</p>
            <p>创建时间: {{ new Date(editingItem.created_at).toLocaleString('zh-CN') }}</p>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>
