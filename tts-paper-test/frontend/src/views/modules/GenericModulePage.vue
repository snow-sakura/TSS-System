<script setup lang="ts">
// ============================================================
// 测试方案 / 测试执行 / 测试报告 / 用户管理 / 操作日志 页面
// ============================================================

import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { testPlansApi, reportsApi, usersApi, operationLogsApi } from '@/api'
import DataTable from '@/components/DataTable.vue'
import Toolbar from '@/components/Toolbar.vue'

const route = useRoute()
const moduleId = route.params.module as string

const loading = ref(false)
const items = ref<any[]>([])
const total = ref(0)

const columnsMap: Record<string, any[]> = {
  'test-plans': [
    { key: 'title', label: '方案名称' },
    { key: 'status', label: '状态', width: '100px' },
    { key: 'created_at', label: '创建时间', width: '160px' },
  ],
  'executions': [
    { key: 'name', label: '执行名称' },
    { key: 'status', label: '状态', width: '100px' },
    { key: 'total_cases', label: '用例数', width: '70px' },
    { key: 'passed_cases', label: '通过', width: '70px' },
    { key: 'failed_cases', label: '失败', width: '70px' },
    { key: 'created_at', label: '创建时间', width: '160px' },
  ],
  'reports': [
    { key: 'title', label: '报告名称' },
    { key: 'report_type', label: '类型', width: '80px' },
    { key: 'status', label: '状态', width: '80px' },
    { key: 'ai_generated', label: 'AI生成', width: '70px' },
    { key: 'created_at', label: '创建时间', width: '160px' },
  ],
  'users': [
    { key: 'username', label: '用户名' },
    { key: 'email', label: '邮箱' },
    { key: 'role', label: '角色', width: '100px' },
    { key: 'status', label: '状态', width: '80px' },
    { key: 'created_at', label: '创建时间', width: '160px' },
  ],
  'logs': [
    { key: 'action', label: '操作' },
    { key: 'resource_type', label: '资源类型', width: '100px' },
    { key: 'username', label: '操作人', width: '80px' },
    { key: 'status', label: '结果', width: '70px' },
    { key: 'created_at', label: '操作时间', width: '160px' },
  ],
}

const apiMap: Record<string, Function> = {
  'test-plans': (params: any) => testPlansApi.list(params).then(r => r.data),
  'executions': () => Promise.resolve({ data: { items: [], total: 0 } }),
  'reports': (params: any) => reportsApi.list(params).then(r => r.data),
  'users': (params: any) => usersApi.list(params).then(r => r.data),
  'logs': (params: any) => operationLogsApi.list(params).then(r => r.data),
}

const columns = columnsMap[moduleId] || []
const fetchApi = apiMap[moduleId]

async function fetchData() {
  if (!fetchApi) return
  loading.value = true
  try {
    const res = await fetchApi({ page: 1, page_size: 50 })
    items.value = res.data.items || []
    total.value = res.data.total || 0
  } finally { loading.value = false }
}

onMounted(fetchData)
</script>

<template>
  <div>
    <Toolbar v-if="moduleId !== 'logs'" show-search @refresh="fetchData" />
    <div class="bg-surface border rounded-xl overflow-hidden">
      <DataTable :columns="columns" :data="items" :loading="loading" @row-click="() => {}" />
    </div>
  </div>
</template>
