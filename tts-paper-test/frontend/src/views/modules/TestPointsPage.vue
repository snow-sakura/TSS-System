<script setup lang="ts">
// ============================================================
// 测试点管理模块页面
// ============================================================

import { ref, onMounted, reactive } from 'vue'
import { testPointsApi, requirementsApi } from '@/api'
import DataTable from '@/components/DataTable.vue'
import Toolbar from '@/components/Toolbar.vue'
import type { TestPoint, Requirement } from '@/types'

const loading = ref(false)
const items = ref<TestPoint[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive<Record<string, string>>({})
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const editingItem = ref<TestPoint | null>(null)
const requirements = ref<Requirement[]>([])
const form = reactive({ requirement_id: '', title: '', description: '', type: 'functional', priority: 'medium', category: '' })

const columns = [
  { key: 'title', label: '测试点名称' },
  { key: 'type', label: '类型', width: '80px' },
  { key: 'priority', label: '优先级', width: '80px' },
  { key: 'status', label: '状态', width: '80px' },
  { key: 'ai_generated', label: 'AI生成', width: '60px' },
  { key: 'created_at', label: '创建时间', width: '140px' },
]

async function fetchData() {
  loading.value = true
  try {
    const res = await testPointsApi.list({ page: page.value, page_size: pageSize.value, ...filters })
    items.value = res.data.data.items
    total.value = res.data.data.total
  } catch (err) {
    console.error('获取测试点列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function loadRequirements() {
  try {
    const res = await requirementsApi.list({ page_size: 100 })
    requirements.value = res.data.data.items
  } catch {}
}

function onCreate() {
  form.requirement_id = ''
  form.title = ''
  form.description = ''
  form.type = 'functional'
  form.priority = 'medium'
  showCreateModal.value = true
}

async function submitCreate() {
  try {
    await testPointsApi.create(form)
    showCreateModal.value = false
    await fetchData()
  } catch (err) {
    console.error('创建测试点失败:', err)
  }
}

function onRowClick(row: TestPoint) {
  editingItem.value = row
  showDetailModal.value = true
}

async function onAIExtract() {
  try {
    // 提取最新需求的测试点
    const req = requirements.value[0]
    if (req) {
      await testPointsApi.aiExtract(req.id)
      await fetchData()
    }
  } catch {}
}

onMounted(() => { fetchData(); loadRequirements() })
</script>

<template>
  <div>
    <Toolbar show-search show-status :status-options="[
      { label: '草稿', value: 'draft' }, { label: '活跃', value: 'active' },
      { label: '已覆盖', value: 'covered' }, { label: '废弃', value: 'obsolete' },
    ]" @search="(v: string) => { filters.search = v; fetchData() }"
      @filter-change="(f: any) => { Object.assign(filters, f); fetchData() }"
      @create="onCreate" @refresh="fetchData" @ai-action="onAIExtract" :show-type="true" />

    <div class="bg-surface border rounded-xl overflow-hidden">
      <DataTable :columns="columns" :data="items" :loading="loading" @row-click="onRowClick" />
      <div v-if="total > pageSize" class="flex items-center justify-between px-4 py-3 border-t">
        <span class="text-sm text-muted-foreground">共 {{ total }} 条</span>
        <div class="flex gap-2">
          <button :disabled="page <= 1" @click="page--; fetchData()" class="px-3 py-1 rounded border text-sm disabled:opacity-50">上一页</button>
          <button :disabled="page * pageSize >= total" @click="page++; fetchData()" class="px-3 py-1 rounded border text-sm disabled:opacity-50">下一页</button>
        </div>
      </div>
    </div>

    <!-- 新建弹窗 -->
    <teleport to="body">
      <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showCreateModal = false">
        <div class="w-full max-w-lg bg-surface rounded-xl shadow-2xl border p-6 m-4">
          <h3 class="text-lg font-semibold mb-4">新建测试点</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium mb-1">关联需求</label>
              <select v-model="form.requirement_id" class="w-full px-3 py-2 rounded-lg border bg-base text-sm">
                <option value="">请选择</option>
                <option v-for="r in requirements" :key="r.id" :value="r.id">{{ r.title }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">测试点名称</label>
              <input v-model="form.title" class="w-full px-3 py-2 rounded-lg border bg-base text-sm" />
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="block text-sm font-medium mb-1">类型</label>
                <select v-model="form.type" class="w-full px-3 py-2 rounded-lg border bg-base text-sm">
                  <option value="functional">功能</option><option value="performance">性能</option>
                  <option value="security">安全</option><option value="ui">UI</option><option value="api">API</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="block text-sm font-medium mb-1">优先级</label>
                <select v-model="form.priority" class="w-full px-3 py-2 rounded-lg border bg-base text-sm">
                  <option value="critical">Critical</option><option value="high">High</option>
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
  </div>
</template>
