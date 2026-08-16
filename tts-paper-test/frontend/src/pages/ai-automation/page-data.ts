/**
 * AI自动化中心 — 页面真实数据源映射
 * 将 page-configs.tsx 中的静态 Mock 数据替换为真实后端 API
 * 每个子菜单对应一个数据源：fetch 拉取行数据，buildStats 计算动态统计卡
 *
 * 接入范围：
 * - api（接口）: /api-test 已接入
 * - app（App）: /app-test 已接入（设备/用例/执行/截图/崩溃）
 * - performance / security / compatibility / regression / exploratory:
 *   /ai-test-tasks 共享任务表（task_type + module 过滤）
 */
import { apiTestApi, appTestApi, testTaskApi } from "@/lib/api"
import type { Column, StatCard } from "./components/GenericTestPage"

export interface PageDataSource {
  /** 拉取数据，返回行数组（已映射为页面展示所需字段） */
  fetch: () => Promise<any[]>
  /** 根据行数据计算动态统计卡片（缺省回退到配置中的静态 stats） */
  buildStats?: (rows: any[]) => StatCard[]
}

/** 后端分页响应的 data 结构：{ items, total, page, ... } */
function unwrapItems(res: any): any[] {
  return res?.data?.items ?? []
}

/** 状态计数统计卡（通用任务行） */
function taskStats(rows: any[]): StatCard[] {
  const done = rows.filter((r) => r.status === "完成" || r.status === "通过").length
  const failed = rows.filter((r) => r.status === "失败").length
  const running = rows.filter((r) => r.status === "执行中").length
  return [
    { label: "任务总数", value: rows.length, color: "text-ink" },
    { label: "完成", value: done, color: "text-pass" },
    { label: "失败", value: failed, color: "text-fail" },
    { label: "执行中", value: running, color: "text-amber" },
  ]
}

/** 拉取某类型某模块的任务列表（供 5 个通用类型复用） */
async function fetchTasks(taskType: string, module: string): Promise<any[]> {
  const res: any = await testTaskApi.list({ task_type: taskType, module, page: 1, page_size: 200 })
  return unwrapItems(res)
}

// ════════════════════════════════════════
// AI 接口自动化
// ════════════════════════════════════════

const API_DATA_SOURCES: Record<string, PageDataSource> = {
  // 接口列表 → GET /api-test/endpoints
  "api-list": {
    fetch: async () => {
      const res: any = await apiTestApi.listEndpoints({ page: 1, page_size: 200 })
      return unwrapItems(res).map((e) => ({
        id: e.id,
        name: e.name,
        method: e.method,
        url: e.url,
        status: e.status === "正常" ? "正常" : "异常",
        responseTime: e.response_time_ms != null ? `${e.response_time_ms}ms` : "-",
      }))
    },
    buildStats: (rows) => {
      const normal = rows.filter((r) => r.status === "正常").length
      const abnormal = rows.filter((r) => r.status === "异常").length
      const times = rows
        .map((r) => parseInt(r.responseTime))
        .filter((v) => !isNaN(v))
      const avg = times.length
        ? `${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms`
        : "-"
      return [
        { label: "接口总数", value: rows.length, color: "text-ink" },
        { label: "正常", value: normal, color: "text-pass" },
        { label: "异常", value: abnormal, color: "text-fail" },
        { label: "平均响应", value: avg, color: "text-info" },
      ]
    },
  },
  // 环境配置 → GET /api-test/environments
  "api-config": {
    fetch: async () => {
      const res: any = await apiTestApi.listEnvironments({ page: 1, page_size: 200 })
      return unwrapItems(res).map((e) => ({
        id: e.id,
        name: e.name,
        baseUrl: e.base_url,
        headers: e.auth_type || "无",
        status: e.status === "已连接" ? "已连接" : "未连接",
      }))
    },
    buildStats: (rows) => {
      const connected = rows.filter((r) => r.status === "已连接").length
      return [
        { label: "环境总数", value: rows.length, color: "text-ink" },
        { label: "已连接", value: connected, color: "text-pass" },
        { label: "未连接", value: rows.length - connected, color: "text-amber" },
      ]
    },
  },
  // 测试用例 → GET /api-test/test-cases
  "api-cases": {
    fetch: async () => {
      const res: any = await apiTestApi.listTestCases({ page: 1, page_size: 200 })
      return unwrapItems(res).map((c) => ({
        id: c.id,
        name: c.name,
        endpoint: `${c.method} ${c.url}`,
        priority: c.priority,
        status: c.status === "通过" ? "通过" : c.status === "失败" ? "失败" : "待执行",
        source: c.source === "AI生成" ? "AI生成" : "手动",
      }))
    },
    buildStats: (rows) => {
      const passed = rows.filter((r) => r.status === "通过").length
      const failed = rows.filter((r) => r.status === "失败").length
      return [
        { label: "用例总数", value: rows.length, color: "text-ink" },
        { label: "通过", value: passed, color: "text-pass" },
        { label: "失败", value: failed, color: "text-fail" },
        { label: "待执行", value: rows.length - passed - failed, color: "text-amber" },
      ]
    },
  },
  // 执行测试 → GET /api-test/executions
  "api-execution": {
    fetch: async () => {
      const res: any = await apiTestApi.listExecutions({ page: 1, page_size: 200 })
      return unwrapItems(res).map((e) => ({
        id: e.id,
        name: e.name,
        environment: e.project_name || "-",
        casesCount: e.total ?? 0,
        passRate: e.pass_rate != null ? `${e.pass_rate}%` : "-",
        status: e.status === "完成" ? "完成" : e.status === "失败" ? "失败" : "执行中",
        duration: e.duration_ms != null ? `${(e.duration_ms / 1000).toFixed(1)}s` : "-",
      }))
    },
    buildStats: (rows) => {
      const done = rows.filter((r) => r.status === "完成").length
      const failed = rows.filter((r) => r.status === "失败").length
      const running = rows.filter((r) => r.status === "执行中").length
      return [
        { label: "执行总数", value: rows.length, color: "text-ink" },
        { label: "成功", value: done, color: "text-pass" },
        { label: "失败", value: failed, color: "text-fail" },
        { label: "执行中", value: running, color: "text-amber" },
      ]
    },
  },
  // 测试报告 → GET /api-test/reports
  "api-results": {
    fetch: async () => {
      const res: any = await apiTestApi.listReports({ page: 1, page_size: 200 })
      return unwrapItems(res).map((r) => ({
        id: r.id,
        name: r.name,
        type: r.report_type || "回归报告",
        totalCases: r.total_cases ?? 0,
        passRate: r.pass_rate != null ? `${r.pass_rate}%` : "-",
        generatedAt: r.created_at?.replace("T", " ").slice(0, 16) ?? "-",
      }))
    },
    buildStats: (rows) => {
      const avgRate = rows.length
        ? `${Math.round(rows.reduce((a, r) => a + (parseFloat(r.passRate) || 0), 0) / rows.length)}%`
        : "-"
      return [
        { label: "报告总数", value: rows.length, color: "text-ink" },
        { label: "平均通过率", value: avgRate, color: "text-pass" },
      ]
    },
  },
}

// ════════════════════════════════════════
// AI App自动化
// ════════════════════════════════════════

const APP_DATA_SOURCES: Record<string, PageDataSource> = {
  // 设备管理 → GET /app-test/devices
  "app-devices": {
    fetch: async () => {
      const res: any = await appTestApi.listDevices({ page: 1, page_size: 200 })
      return unwrapItems(res).map((d) => ({
        id: d.id,
        name: d.name,
        os: d.os,
        version: d.version ?? "-",
        // 后端状态：空闲/占用/离线 → 前端展示：在线/离线
        status: d.status === "离线" ? "离线" : "在线",
      }))
    },
    buildStats: (rows) => {
      const online = rows.filter((r) => r.status === "在线").length
      return [
        { label: "设备总数", value: rows.length, color: "text-ink" },
        { label: "在线", value: online, color: "text-pass" },
        { label: "离线", value: rows.length - online, color: "text-amber" },
      ]
    },
  },
  // 测试用例 → GET /app-test/test-cases
  "app-cases": {
    fetch: async () => {
      const res: any = await appTestApi.listTestCases({ page: 1, page_size: 200 })
      return unwrapItems(res).map((c) => ({
        id: c.id,
        name: c.name,
        platform: c.platform,
        priority: c.priority,
        status: c.status === "通过" ? "通过" : c.status === "失败" ? "失败" : "待执行",
        source: c.source === "AI生成" ? "AI生成" : "手动",
      }))
    },
    buildStats: (rows) => {
      const passed = rows.filter((r) => r.status === "通过").length
      const failed = rows.filter((r) => r.status === "失败").length
      return [
        { label: "用例总数", value: rows.length, color: "text-ink" },
        { label: "通过", value: passed, color: "text-pass" },
        { label: "失败", value: failed, color: "text-fail" },
        { label: "待执行", value: rows.length - passed - failed, color: "text-amber" },
      ]
    },
  },
  // 远程执行 → GET /app-test/executions
  "app-execution": {
    fetch: async () => {
      const res: any = await appTestApi.listExecutions({ page: 1, page_size: 200 })
      return unwrapItems(res).map((e) => ({
        id: e.id,
        device: e.device || "-",
        casesCount: e.cases_count ?? 0,
        status: e.status === "完成" ? "完成" : e.status === "执行中" ? "执行中" : e.status === "失败" ? "失败" : "待执行",
        duration: e.duration_ms != null ? `${(e.duration_ms / 1000).toFixed(1)}s` : "-",
      }))
    },
    buildStats: (rows) => {
      const done = rows.filter((r) => r.status === "完成").length
      const failed = rows.filter((r) => r.status === "失败").length
      const running = rows.filter((r) => r.status === "执行中").length
      return [
        { label: "执行总数", value: rows.length, color: "text-ink" },
        { label: "成功", value: done, color: "text-pass" },
        { label: "失败", value: failed, color: "text-fail" },
        { label: "执行中", value: running, color: "text-amber" },
      ]
    },
  },
  // 截图对比 → GET /app-test/screenshot-diffs
  "app-screenshots": {
    fetch: async () => {
      const res: any = await appTestApi.listScreenshotDiffs({ page: 1, page_size: 200 })
      return unwrapItems(res).map((s) => ({
        id: s.id,
        page: s.page,
        device: s.device || "-",
        result: s.result === "一致" ? "一致" : "不一致",
        similarity: s.similarity != null ? `${s.similarity}%` : "-",
      }))
    },
    buildStats: (rows) => {
      const ok = rows.filter((r) => r.result === "一致").length
      return [
        { label: "截图总数", value: rows.length, color: "text-ink" },
        { label: "一致", value: ok, color: "text-pass" },
        { label: "不一致", value: rows.length - ok, color: "text-fail" },
      ]
    },
  },
  // 崩溃分析 → GET /app-test/crash-logs
  "app-crashes": {
    fetch: async () => {
      const res: any = await appTestApi.listCrashLogs({ page: 1, page_size: 200 })
      return unwrapItems(res).map((c) => ({
        id: c.id,
        type: c.crash_type,
        device: c.device || "-",
        count: c.count ?? 1,
        status: c.status === "已修复" ? "已修复" : c.status === "待分析" ? "待分析" : "分析中",
      }))
    },
    buildStats: (rows) => {
      const fixed = rows.filter((r) => r.status === "已修复").length
      const pending = rows.filter((r) => r.status === "待分析" || r.status === "分析中").length
      return [
        { label: "崩溃总数", value: rows.length, color: "text-ink" },
        { label: "已修复", value: fixed, color: "text-pass" },
        { label: "待处理", value: pending, color: "text-fail" },
      ]
    },
  },
}

// ════════════════════════════════════════
// AI 性能测试 → /ai-test-tasks (task_type=performance)
// ════════════════════════════════════════

const PERF_DATA_SOURCES: Record<string, PageDataSource> = {
  // 压测场景
  "perf-scenarios": {
    fetch: async () =>
      (await fetchTasks("performance", "perf-scenario")).map((t) => ({
        id: t.id,
        name: t.name,
        target: t.config?.url || "-",
        concurrency: t.config?.concurrency ?? "-",
        duration: t.config?.duration || "-",
        status: t.status,
      })),
    buildStats: taskStats,
  },
  // 压测配置
  "perf-config": {
    fetch: async () =>
      (await fetchTasks("performance", "perf-config")).map((t) => ({
        id: t.id,
        name: t.name,
        maxConcurrency: t.config?.max_concurrency ?? "-",
        rampUp: t.config?.ramp_up || "-",
        threshold: t.config?.threshold || "-",
      })),
    buildStats: taskStats,
  },
  // 执行压测
  "perf-execution": {
    fetch: async () =>
      (await fetchTasks("performance", "perf-execution")).map((t) => ({
        id: t.id,
        scenario: t.name,
        concurrency: t.config?.concurrency ?? "-",
        rps: t.result?.summary?.rps != null ? `${t.result.summary.rps}/s` : "-",
        avgResponse: t.result?.summary?.avg_ms != null ? `${t.result.summary.avg_ms}ms` : "-",
        status: t.status,
      })),
    buildStats: taskStats,
  },
  // 实时监控：把已完成任务的指标展开成指标行
  "perf-monitor": {
    fetch: async () => {
      const tasks = await fetchTasks("performance", "perf-execution")
      const rows: any[] = []
      tasks.forEach((t) => {
        const s = t.result?.summary
        if (!s) return
        rows.push({
          metric: `${t.name}·响应时间`,
          current: `${s.avg_ms}ms`,
          avg: s.p95_ms != null ? `${s.p95_ms}ms` : "-",
          p95: s.p95_ms != null ? `${s.p95_ms}ms` : "-",
          p99: s.p99_ms != null ? `${s.p99_ms}ms` : "-",
          status: "正常",
        })
        rows.push({
          metric: `${t.name}·吞吐量`,
          current: `${s.rps}/s`,
          avg: "-",
          p95: "-",
          p99: "-",
          status: "正常",
        })
        rows.push({
          metric: `${t.name}·错误率`,
          current: s.error_rate || "-",
          avg: "-",
          p95: "-",
          p99: "-",
          status: s.success && s.requests && s.success / s.requests >= 0.95 ? "正常" : "告警",
        })
      })
      return rows
    },
    buildStats: (rows) => [
      { label: "监控指标", value: rows.length, color: "text-ink" },
      { label: "正常", value: rows.filter((r) => r.status === "正常").length, color: "text-pass" },
      { label: "告警", value: rows.filter((r) => r.status === "告警").length, color: "text-amber" },
    ],
  },
  // 性能报告
  "perf-report": {
    fetch: async () =>
      (await fetchTasks("performance", "perf-execution")).map((t) => ({
        id: t.id,
        name: `${t.name}报告`,
        scenario: t.name,
        maxRps: t.result?.summary?.rps != null ? `${t.result.summary.rps}/s` : "-",
        avgResponse: t.result?.summary?.avg_ms != null ? `${t.result.summary.avg_ms}ms` : "-",
        generatedAt: t.created_at || "-",
      })),
    buildStats: (rows) => [
      { label: "报告总数", value: rows.length, color: "text-ink" },
      { label: "已执行", value: rows.filter((r) => r.maxRps !== "-").length, color: "text-pass" },
    ],
  },
}

// ════════════════════════════════════════
// AI 安全测试 → /ai-test-tasks (task_type=security)
// ════════════════════════════════════════

const SEC_DATA_SOURCES: Record<string, PageDataSource> = {
  // 扫描目标
  "sec-targets": {
    fetch: async () =>
      (await fetchTasks("security", "sec-targets")).map((t) => ({
        id: t.id,
        name: t.name,
        url: t.config?.url || "-",
        type: t.config?.type || "Web应用",
        status: t.config?.url ? "已配置" : "未配置",
      })),
    buildStats: (rows) => [
      { label: "目标总数", value: rows.length, color: "text-ink" },
      { label: "已配置", value: rows.filter((r) => r.status === "已配置").length, color: "text-pass" },
    ],
  },
  // 安全规则
  "sec-rules": {
    fetch: async () =>
      (await fetchTasks("security", "sec-rules")).map((t) => ({
        id: t.id,
        name: t.name,
        category: t.config?.category || "安全规则",
        severity: t.config?.severity || "中危",
        enabled: t.config?.enabled !== false,
      })),
    buildStats: (rows) => {
      const enabled = rows.filter((r) => r.enabled).length
      const high = rows.filter((r) => r.severity === "高危").length
      return [
        { label: "规则总数", value: rows.length, color: "text-ink" },
        { label: "已启用", value: enabled, color: "text-pass" },
        { label: "高危", value: high, color: "text-fail" },
      ]
    },
  },
  // 漏洞扫描
  "sec-scan": {
    fetch: async () =>
      (await fetchTasks("security", "sec-scan")).map((t) => ({
        id: t.id,
        target: t.name,
        rulesCount: t.config?.rules?.length ?? "-",
        vulnFound: t.result?.summary?.vuln_found ?? 0,
        status: t.status,
      })),
    buildStats: (rows) => {
      const vulns = rows.reduce((a, r) => a + (Number(r.vulnFound) || 0), 0)
      return [
        { label: "扫描总数", value: rows.length, color: "text-ink" },
        { label: "发现漏洞", value: vulns, color: "text-fail" },
      ]
    },
  },
  // 扫描结果：展开已完成任务的漏洞明细
  "sec-results": {
    fetch: async () => {
      const tasks = await fetchTasks("security", "sec-scan")
      const rows: any[] = []
      tasks.forEach((t) => {
        ;(t.result?.items ?? []).forEach((v: any, i: number) => {
          rows.push({
            id: `${t.id}-${i}`,
            name: v.name,
            severity: v.severity ?? "中危",
            category: v.category ?? "安全配置",
            status: v.status ?? "待修复",
          })
        })
      })
      return rows
    },
    buildStats: (rows) => {
      const fixed = rows.filter((r) => r.status === "已修复").length
      const high = rows.filter((r) => r.severity === "高危").length
      return [
        { label: "漏洞总数", value: rows.length, color: "text-ink" },
        { label: "高危", value: high, color: "text-fail" },
        { label: "已修复", value: fixed, color: "text-pass" },
        { label: "待修复", value: rows.length - fixed, color: "text-amber" },
      ]
    },
  },
  // 安全报告
  "sec-report": {
    fetch: async () =>
      (await fetchTasks("security", "sec-scan")).map((t) => ({
        id: t.id,
        name: `${t.name}报告`,
        score: t.result?.summary?.score ?? "-",
        vulnCount: t.result?.summary?.vuln_found ?? 0,
        generatedAt: t.created_at || "-",
      })),
    buildStats: (rows) => [
      { label: "报告总数", value: rows.length, color: "text-ink" },
      { label: "已扫描", value: rows.filter((r) => r.score !== "-").length, color: "text-pass" },
    ],
  },
}

// ════════════════════════════════════════
// AI 兼容性测试 → /ai-test-tasks (task_type=compatibility)
// ════════════════════════════════════════

const COMPAT_DATA_SOURCES: Record<string, PageDataSource> = {
  // 兼容矩阵
  "compat-matrix": {
    fetch: async () =>
      (await fetchTasks("compatibility", "compat-matrix")).map((t) => ({
        id: t.id,
        browser: t.name,
        os: t.config?.os || "-",
        resolution: t.config?.resolution || "-",
        status: t.config?.url ? "支持" : "待验证",
      })),
    buildStats: (rows) => [
      { label: "组合数", value: rows.length, color: "text-ink" },
      { label: "支持", value: rows.filter((r) => r.status === "支持").length, color: "text-pass" },
    ],
  },
  // 测试用例
  "compat-cases": {
    fetch: async () =>
      (await fetchTasks("compatibility", "compat-cases")).map((t) => ({
        id: t.id,
        name: t.name,
        scope: t.config?.scope || "全浏览器",
        status: t.status,
      })),
    buildStats: taskStats,
  },
  // 执行测试：展开已完成任务的浏览器执行行
  "compat-execution": {
    fetch: async () => {
      const tasks = await fetchTasks("compatibility", "compat-cases")
      const rows: any[] = []
      tasks.forEach((t) => {
        ;(t.result?.items ?? []).forEach((b: any, i: number) => {
          rows.push({
            id: `${t.id}-${i}`,
            browser: b.browser,
            passRate: b.pass_rate ?? "-",
            status: b.status ?? "完成",
          })
        })
      })
      return rows
    },
    buildStats: (rows) => [
      { label: "执行数", value: rows.length, color: "text-ink" },
      { label: "完成", value: rows.filter((r) => r.status === "完成").length, color: "text-pass" },
      { label: "异常", value: rows.filter((r) => r.status === "异常").length, color: "text-fail" },
    ],
  },
  // 对比结果：浏览器 × 通过率
  "compat-results": {
    fetch: async () => {
      const tasks = await fetchTasks("compatibility", "compat-cases")
      const rows: any[] = []
      tasks.forEach((t) => {
        ;(t.result?.items ?? []).forEach((b: any, i: number) => {
          rows.push({
            id: `${t.id}-${i}`,
            page: b.browser,
            match: b.pass_rate ?? "-",
          })
        })
      })
      return rows
    },
    buildStats: (rows) => {
      const ok = rows.filter((r) => parseFloat(r.match) >= 95).length
      return [
        { label: "对比数", value: rows.length, color: "text-ink" },
        { label: "一致", value: ok, color: "text-pass" },
      ]
    },
  },
  // 兼容报告
  "compat-report": {
    fetch: async () =>
      (await fetchTasks("compatibility", "compat-cases")).map((t) => ({
        id: t.id,
        name: `${t.name}兼容报告`,
        score: t.result?.summary?.match_rate != null ? `${t.result.summary.match_rate}%` : "-",
        generatedAt: t.created_at || "-",
      })),
    buildStats: (rows) => [
      { label: "报告总数", value: rows.length, color: "text-ink" },
      { label: "平均评分", value: rows.length
          ? `${Math.round(rows.reduce((a, r) => a + (parseFloat(r.score) || 0), 0) / rows.length)}%`
          : "-", color: "text-pass" },
    ],
  },
}

// ════════════════════════════════════════
// AI 回归测试 → /ai-test-tasks (task_type=regression)
// ════════════════════════════════════════

const REG_DATA_SOURCES: Record<string, PageDataSource> = {
  // 变更分析：展开回归用例明细
  "reg-changes": {
    fetch: async () => {
      const tasks = await fetchTasks("regression", "reg-execution")
      const rows: any[] = []
      tasks.forEach((t) => {
        ;(t.result?.items ?? []).forEach((c: any, i: number) => {
          rows.push({
            id: `${t.id}-${i}`,
            file: c.name ?? "变更文件",
            changeType: c.status === "通过" ? "修改" : "新增",
            impact: c.status === "失败" ? "高" : "中",
          })
        })
      })
      return rows
    },
    buildStats: (rows) => {
      const high = rows.filter((r) => r.impact === "高").length
      return [
        { label: "变更文件", value: rows.length, color: "text-ink" },
        { label: "高影响", value: high, color: "text-fail" },
      ]
    },
  },
  // 影响范围：按模块聚合回归用例
  "reg-scope": {
    fetch: async () => {
      const tasks = await fetchTasks("regression", "reg-execution")
      const moduleMap = new Map<string, number>()
      tasks.forEach((t) => {
        ;(t.result?.items ?? []).forEach((c: any) => {
          const m = c.module ?? "未分类"
          moduleMap.set(m, (moduleMap.get(m) ?? 0) + 1)
        })
      })
      return Array.from(moduleMap.entries()).map(([module, count], i) => ({
        id: i + 1,
        module,
        riskLevel: count >= 10 ? "高" : count >= 5 ? "中" : "低",
        relatedCases: count,
      }))
    },
    buildStats: (rows) => [
      { label: "影响模块", value: rows.length, color: "text-ink" },
      { label: "关联用例", value: rows.reduce((a, r) => a + (r.relatedCases ?? 0), 0), color: "text-info" },
    ],
  },
  // 回归用例
  "reg-cases": {
    fetch: async () => {
      const tasks = await fetchTasks("regression", "reg-execution")
      const rows: any[] = []
      tasks.forEach((t) => {
        ;(t.result?.items ?? []).forEach((c: any, i: number) => {
          rows.push({
            id: `${t.id}-${i}`,
            name: c.name,
            module: c.module ?? "-",
            reason: c.reason ?? "代码变更直接关联",
          })
        })
      })
      return rows
    },
    buildStats: (rows) => [
      { label: "回归用例", value: rows.length, color: "text-ink" },
      { label: "AI选择", value: rows.length, color: "text-info" },
    ],
  },
  // 执行回归
  "reg-execution": {
    fetch: async () =>
      (await fetchTasks("regression", "reg-execution")).map((t) => ({
        id: t.id,
        name: t.name,
        passRate: t.result?.summary?.pass_rate != null ? `${t.result.summary.pass_rate}%` : "-",
        status: t.status === "完成" ? "通过" : t.status === "失败" ? "失败" : "待执行",
      })),
    buildStats: (rows) => [
      { label: "执行数", value: rows.length, color: "text-ink" },
      { label: "通过", value: rows.filter((r) => r.status === "通过").length, color: "text-pass" },
    ],
  },
  // 回归报告
  "reg-report": {
    fetch: async () =>
      (await fetchTasks("regression", "reg-execution")).map((t) => ({
        id: t.id,
        name: `${t.name}报告`,
        generatedAt: t.created_at || "-",
      })),
    buildStats: (rows) => [
      { label: "报告总数", value: rows.length, color: "text-ink" },
    ],
  },
}

// ════════════════════════════════════════
// AI 探索性测试 → /ai-test-tasks (task_type=exploratory)
// ════════════════════════════════════════

const EXP_DATA_SOURCES: Record<string, PageDataSource> = {
  // 探索目标
  "exp-target": {
    fetch: async () =>
      (await fetchTasks("exploratory", "exp-target")).map((t) => ({
        id: t.id,
        name: t.name,
        url: t.config?.url || "-",
        status: t.config?.url ? "已配置" : "未配置",
      })),
    buildStats: (rows) => [
      { label: "目标数", value: rows.length, color: "text-ink" },
      { label: "已配置", value: rows.filter((r) => r.status === "已配置").length, color: "text-pass" },
    ],
  },
  // 探索策略
  "exp-config": {
    fetch: async () =>
      (await fetchTasks("exploratory", "exp-config")).map((t) => ({
        id: t.id,
        name: t.name,
        depth: t.config?.depth || "深度",
        focus: t.config?.focus || "所有页面和交互元素",
      })),
    buildStats: taskStats,
  },
  // AI探索执行
  "exp-execution": {
    fetch: async () =>
      (await fetchTasks("exploratory", "exp-execution")).map((t) => ({
        id: t.id,
        target: t.name,
        pagesFound: t.result?.summary?.pages_found ?? "-",
        status: t.status,
      })),
    buildStats: taskStats,
  },
  // 发现结果：展开探索发现的明细
  "exp-findings": {
    fetch: async () => {
      const tasks = await fetchTasks("exploratory", "exp-execution")
      const rows: any[] = []
      tasks.forEach((t) => {
        ;(t.result?.items ?? []).forEach((f: any, i: number) => {
          rows.push({
            id: `${t.id}-${i}`,
            title: f.title,
            severity: f.severity ?? "低",
            status: f.status ?? "待确认",
          })
        })
      })
      return rows
    },
    buildStats: (rows) => {
      const confirmed = rows.filter((r) => r.status === "已确认").length
      const high = rows.filter((r) => r.severity === "高").length
      return [
        { label: "发现数", value: rows.length, color: "text-ink" },
        { label: "已确认", value: confirmed, color: "text-pass" },
        { label: "高危", value: high, color: "text-fail" },
      ]
    },
  },
  // 探索报告
  "exp-report": {
    fetch: async () =>
      (await fetchTasks("exploratory", "exp-execution")).map((t) => ({
        id: t.id,
        name: `${t.name}探索报告`,
        generatedAt: t.created_at || "-",
      })),
    buildStats: (rows) => [
      { label: "报告总数", value: rows.length, color: "text-ink" },
    ],
  },
}

// ════════════════════════════════════════
// 全局映射：typeId → menuKey → 数据源
// ════════════════════════════════════════

export const PAGE_DATA_SOURCES: Record<string, Record<string, PageDataSource>> = {
  api: API_DATA_SOURCES,
  app: APP_DATA_SOURCES,
  performance: PERF_DATA_SOURCES,
  security: SEC_DATA_SOURCES,
  compatibility: COMPAT_DATA_SOURCES,
  regression: REG_DATA_SOURCES,
  exploratory: EXP_DATA_SOURCES,
}

/** 判断某个子页面是否已有真实数据源（无则回退 Mock 配置） */
export function hasDataSource(typeId: string, menuKey: string): boolean {
  return Boolean(PAGE_DATA_SOURCES[typeId]?.[menuKey])
}