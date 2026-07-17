<script setup lang="ts">
// ============================================================
// 测试用例模块页面
// ============================================================

import { ref, onMounted, reactive } from 'vue'
import { testCasesApi } from '@/api'
import DataTable from '@/components/DataTable.vue'
import Toolbar from '@/components/Toolbar.vue'
import type { TestCase } from '@/types'

const loading = ref(false)
const items = ref<TestCase[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive<Record<string, string>>({})
const showCreateModal = ref(false)
const editingItem = ref<TestCase | null>(null)
const showStepEditor = ref(false)
const form = reactive({
  title: '', plan_id: '', test_point_id: '', precondition: '',
  steps: [{ step: 1, action: '', expected: '' }],
  expected_result: '', priority: 'p2', type: 'functional',
})

const columns = [
  { key: 'title', label: '用例标题' },
  { key: 'priority', label: '优先级', width: '70px' },
  { key: 'type', label: '类型', width: '70px' },
  { key: 'status', label: '状态', width: '80px' },
  { key: 'ai_generated', label: 'AI', width: '50px' },
  { key: 'created_at', label: '创建时间', width: '140px' },
]

async function fetchData() {
  loading.value = true
  try {
    const res = await testCasesApi.list({ page: page.value, page_size: pageSize.value, ...filters })
    items.value = res.data.data.items
    total.value = res.data.data.total
  } catch (err) {
    console.error('获取用例列表失败:', err)
  } finally {
    loading.value = false
  }
}

function onCreate() {
  form.title = ''
  form.steps = [{ step: 1, action: '', expected: '' }]
  form.precondition = ''
  form.priority = 'p2'
  showCreateModal.value = true
}

function addStep() {
  form.steps.push({ step: form.steps.length + 1, action: '', expected: '' })
}

function removeStep(idx: number) {
  if (form.steps.length > 1) form.steps.splice(idx, 1)
}

async function submitCreate() {
  try {
    await testCasesApi.create({ ...form, steps: form.steps.map((s, i) => ({ ...s, step: i + 1 })) })
    showCreateModal.value = false
    await fetchData()
  } catch (err) {
    console.error('创建用例失败:', err)
  }
}

function onRowClick(row: TestCase) {
  editingItem.value = row
  showStepEditor.value = true
}

onMounted(fetchData)
</script>

<template>
  <div>
    <Toolbar show-search show-status show-priority :status-options="[
      { label: '草稿', value: 'draft' }, { label: '已审批', value: 'approved' },
      { label: '通过', value: 'passed' }, { label: '失败', value: 'failed' }, { label: '阻塞', value: 'blocked' },
    ]" :priority-options="[
      { label: 'P0', value: 'p0' }, { label: 'P1', value: 'p1' }, { label: 'P2', value: 'p2' }, { label: 'P3', value: 'p3' },
    ]" @search="(v: string) => { filters.search = v; fetchData() }"
      @filter-change="(f: any) => { Object.assign(filters, f); fetchData() }"
      @create="onCreate" @refresh="fetchData" :show-type="true" />

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
      <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-10" @click.self="showCreateModal = false">
        <div class="w-full max-w-2xl bg-surface rounded-xl shadow-2xl border p-6 m-4">
          <h3 class="text-lg font-semibold mb-4">新建测试用例</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium mb-1">用例标题</label>
              <input v-model="form.title" class="w-full px-3 py-2 rounded-lg border bg-base text-sm" />
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="block text-sm font-medium mb-1">优先级</label>
                <select v-model="form.priority" class="w-full px-3 py-2 rounded-lg border bg-base text-sm">
                  <option value="p0">P0-关键</option><option value="p1">P1-高</option>
                  <option value="p2">P2-中</option><option value="p3">P3-低</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="block text-sm font-medium mb-1">类型</label>
                <select v-model="form.type" class="w-full px-3 py-2 rounded-lg border bg-base text-sm">
                  <option value="functional">功能测试</option><option value="performance">性能测试</option>
                  <option value="security">安全测试</option><option value="ui">UI测试</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">前置条件</label>
              <textarea v-model="form.precondition" rows="2" class="w-full px-3 py-2 rounded-lg border bg-base text-sm" />
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-sm font-medium">测试步骤</label>
                <button @click="addStep" class="text-xs text-primary hover:underline">+ 添加步骤</button>
              </div>
              <div v-for="(step, idx) in form.steps" :key="idx" class="flex gap-2 mb-2">
                <span class="w-6 h-9 flex items-center justify-center text-xs text-muted-foreground">{{ idx + 1 }}</span>
                <input v-model="step.action" placeholder="操作步骤" class="flex-1 px-3 py-2 rounded-lg border bg-base text-sm" />
                <input v-model="step.expected" placeholder="预期结果" class="flex-1 px-3 py-2 rounded-lg border bg-base text-sm" />
                <button @click="removeStep(idx)" class="px-2 text-red-400 hover:text-red-600 text-sm">✕</button>
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

    <!-- 详情查看 -->
    <teleport to="body">
      <div v-if="showStepEditor && editingItem" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showStepEditor = false">
        <div class="w-full max-w-2xl bg-surface rounded-xl shadow-2xl border p-6 m-4 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-semibold mb-4">{{ editingItem.title }}</h3>
          <p v-if="editingItem.precondition" class="text-sm mb-2"><strong>前置条件:</strong> {{ editingItem.precondition }}</p>
          <div v-if="editingItem.steps?.length" class="mb-4">
            <p class="text-sm font-medium mb-2">测试步骤:</p>
            <div v-for="(step, idx) in editingItem.steps" :key="idx" class="flex gap-2 mb-1 text-sm">
              <span class="text-muted-foreground">{{ step.step }}.</span>
              <span class="flex-1">{{ step.action }}</span>
              <span class="flex-1 text-muted-foreground">→ {{ step.expected }}</span>
            </div>
          </div>
          <div class="flex gap-4 text-sm text-muted-foreground">
            <span>优先级: {{ editingItem.priority }}</span>
            <span>状态: {{ editingItem.status }}</span>
            <span>AI生成: {{ editingItem.ai_generated ? '是' : '否' }}</span>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>
