<script setup lang="ts">
// ============================================================
// 需求管理模块页面
// ============================================================

import { ref, onMounted, reactive } from 'vue'
import { requirementsApi } from '@/api'
import DataTable from '@/components/DataTable.vue'
import Toolbar from '@/components/Toolbar.vue'
import type { Requirement } from '@/types'

const loading = ref(false)
const requirements = ref<Requirement[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive<Record<string, string>>({})
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const editingItem = ref<Requirement | null>(null)
const form = reactive({ title: '', content: '', doc_type: 'text' })

const columns = [
  { key: 'title', label: '需求标题' },
  { key: 'doc_type', label: '类型', width: '80px' },
  { key: 'status', label: '状态', width: '100px' },
  { key: 'version', label: '版本', width: '60px' },
  { key: 'test_points_count', label: '测试点', width: '60px' },
  { key: 'created_at', label: '创建时间', width: '160px' },
]

const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '分析中', value: 'analyzing' },
  { label: '已分析', value: 'analyzed' },
  { label: '已批准', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
]

async function fetchData() {
  loading.value = true
  try {
    const res = await requirementsApi.list({ page: page.value, page_size: pageSize.value, ...filters })
    requirements.value = res.data.data.items
    total.value = res.data.data.total
  } catch (err) {
    console.error('获取需求列表失败:', err)
  } finally {
    loading.value = false
  }
}

function onCreate() {
  form.title = ''
  form.content = ''
  form.doc_type = 'text'
  showCreateModal.value = true
}

async function submitCreate() {
  try {
    await requirementsApi.create(form)
    showCreateModal.value = false
    await fetchData()
  } catch (err) {
    console.error('创建需求失败:', err)
  }
}

function onRowClick(row: Requirement) {
  editingItem.value = row
  showDetailModal.value = true
}

async function onAnalyze() {
  if (!editingItem.value) return
  try {
    await requirementsApi.analyze(editingItem.value.id)
    await fetchData()
  } catch (err) {
    console.error('AI分析失败:', err)
  }
}

async function onApprove() {
  if (!editingItem.value) return
  try {
    await requirementsApi.approve(editingItem.value.id)
    await fetchData()
    showDetailModal.value = false
  } catch (err) {
    console.error('审批失败:', err)
  }
}

async function onDelete(id: string) {
  if (!confirm('确认删除此需求？')) return
  try {
    await requirementsApi.delete(id)
    await fetchData()
  } catch (err) {
    console.error('删除失败:', err)
  }
}

onMounted(fetchData)
</script>

<template>
  <div>
    <Toolbar
      show-search show-status :status-options="statusOptions"
      @search="(v: string) => { filters.search = v; fetchData() }"
      @filter-change="(f: any) => { Object.assign(filters, f); fetchData() }"
      @create="onCreate"
      @refresh="fetchData" />

    <div class="bg-surface border rounded-xl overflow-hidden">
      <DataTable
        :columns="columns"
        :data="requirements"
        :loading="loading"
        @row-click="onRowClick"
      />
      <!-- 分页 -->
      <div v-if="total > pageSize" class="flex items-center justify-between px-4 py-3 border-t border-muted">
        <span class="text-sm text-muted-foreground">共 {{ total }} 条</span>
        <div class="flex gap-2">
          <button :disabled="page <= 1" @click="page--; fetchData()"
            class="px-3 py-1 rounded border text-sm disabled:opacity-50 hover:bg-muted">上一页</button>
          <button :disabled="page * pageSize >= total" @click="page++; fetchData()"
            class="px-3 py-1 rounded border text-sm disabled:opacity-50 hover:bg-muted">下一页</button>
        </div>
      </div>
    </div>

    <!-- 新建弹窗 (简化版) -->
    <teleport to="body">
      <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showCreateModal = false">
        <div class="w-full max-w-lg bg-surface rounded-xl shadow-2xl border p-6 m-4">
          <h3 class="text-lg font-semibold mb-4">新建需求</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">需求标题</label>
              <input v-model="form.title" class="w-full px-3 py-2 rounded-lg border bg-base text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">需求内容</label>
              <textarea v-model="form.content" rows="6" class="w-full px-3 py-2 rounded-lg border bg-base text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button @click="showCreateModal = false" class="px-4 py-2 rounded-lg border text-sm hover:bg-muted">取消</button>
            <button @click="submitCreate" class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90">创建</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 详情弹窗 -->
    <teleport to="body">
      <div v-if="showDetailModal && editingItem" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showDetailModal = false">
        <div class="w-full max-w-2xl bg-surface rounded-xl shadow-2xl border p-6 m-4 max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">需求详情</h3>
            <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
              :class="{
                'bg-yellow-100 text-yellow-800': editingItem.status === 'pending',
                'bg-blue-100 text-blue-800': editingItem.status === 'analyzing',
                'bg-green-100 text-green-800': editingItem.status === 'analyzed' || editingItem.status === 'approved',
                'bg-red-100 text-red-800': editingItem.status === 'rejected',
              }">{{ editingItem.status }}</span>
          </div>
          <h4 class="text-base font-medium mb-2">{{ editingItem.title }}</h4>
          <p class="text-sm text-muted-foreground whitespace-pre-wrap mb-4">{{ editingItem.content || '暂无内容' }}</p>
          <div class="flex items-center gap-4 text-xs text-muted-foreground mb-4">
            <span>版本: {{ editingItem.version }}</span>
            <span>测试点: {{ editingItem.test_points_count }}</span>
            <span>创建: {{ new Date(editingItem.created_at).toLocaleString('zh-CN') }}</span>
          </div>
          <!-- AI分析结果 -->
          <div v-if="editingItem.ai_analysis" class="p-3 rounded-lg bg-primary/5 border border-primary/10 mb-4">
            <p class="text-xs font-medium text-primary mb-1">AI分析结果</p>
            <pre class="text-xs text-muted-foreground">{{ JSON.stringify(editingItem.ai_analysis, null, 2) }}</pre>
          </div>
          <div class="flex justify-between">
            <div class="flex gap-2">
              <button @click="onAnalyze" class="px-3 py-1.5 rounded-lg border text-xs hover:bg-muted">AI分析</button>
              <button @click="onApprove" v-if="editingItem.status === 'analyzed'"
                class="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs hover:bg-green-700">审批通过</button>
            </div>
            <button @click="onDelete(editingItem.id)" class="px-3 py-1.5 rounded-lg border text-red-500 text-xs hover:bg-red-50">删除</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>
