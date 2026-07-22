/**
 * 各测试类型的子页面配置
 * 定义每个子页面的表格列、Mock数据、统计卡片、操作按钮
 */
import { CheckCircle, XCircle, Clock, Play, Eye, Edit, Trash2, Download, Pause, AlertTriangle, Shield, Zap, Target, FileText } from "lucide-react"
import type { Column, StatCard, Action } from "./components/GenericTestPage"

// ════════════════════════════════════════
// AI 接口自动化
// ════════════════════════════════════════
export const API_PAGES = {
  "api-list": {
    title: "接口列表",
    subtitle: "管理所有API接口端点",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "接口名称" },
      { key: "method", label: "方法", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v === "GET" ? "bg-pass/10 text-pass" : v === "POST" ? "bg-info/10 text-info" : v === "PUT" ? "bg-amber-light text-amber" : "bg-fail/10 text-fail"}`}>{v}</span>
      )},
      { key: "url", label: "URL", render: (v: string) => <span className="text-[11px] font-mono text-muted">{v}</span> },
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${v === "正常" ? "bg-pass/10 text-pass" : "bg-fail/10 text-fail"}`}>{v === "正常" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}{v}</span>
      )},
      { key: "responseTime", label: "响应时间" },
    ],
    data: [
      { id: 1, name: "用户登录", method: "POST", url: "/api/auth/login", status: "正常", responseTime: "120ms" },
      { id: 2, name: "获取用户列表", method: "GET", url: "/api/users", status: "正常", responseTime: "85ms" },
      { id: 3, name: "创建订单", method: "POST", url: "/api/orders", status: "正常", responseTime: "230ms" },
      { id: 4, name: "更新用户信息", method: "PUT", url: "/api/users/{id}", status: "异常", responseTime: "5200ms" },
      { id: 5, name: "删除订单", method: "DELETE", url: "/api/orders/{id}", status: "正常", responseTime: "95ms" },
    ],
    stats: [
      { label: "接口总数", value: 24, color: "text-ink" },
      { label: "正常", value: 21, color: "text-pass" },
      { label: "异常", value: 3, color: "text-fail" },
      { label: "平均响应", value: "156ms", color: "text-info" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
      { label: "编辑", icon: Edit, onClick: () => {} },
    ],
  },
  "api-config": {
    title: "环境配置",
    subtitle: "配置测试环境变量和连接信息",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "环境名称" },
      { key: "baseUrl", label: "Base URL", render: (v: string) => <span className="text-[11px] font-mono text-muted">{v}</span> },
      { key: "headers", label: "认证方式" },
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "已连接" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{v}</span>
      )},
    ],
    data: [
      { id: 1, name: "开发环境", baseUrl: "http://localhost:8000", headers: "JWT Token", status: "已连接" },
      { id: 2, name: "测试环境", baseUrl: "http://test-api.tss.local", headers: "API Key", status: "已连接" },
      { id: 3, name: "生产环境", baseUrl: "https://api.tss.com", headers: "OAuth2", status: "未连接" },
    ],
    stats: [
      { label: "环境总数", value: 3, color: "text-ink" },
      { label: "已连接", value: 2, color: "text-pass" },
      { label: "未连接", value: 1, color: "text-amber" },
    ],
    actions: [
      { label: "编辑", icon: Edit, onClick: () => {} },
      { label: "测试连接", icon: Play, onClick: () => {} },
    ],
  },
  "api-cases": {
    title: "测试用例",
    subtitle: "AI生成和管理API测试用例",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "用例名称" },
      { key: "endpoint", label: "接口" },
      { key: "priority", label: "优先级", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v === "P0" ? "bg-fail/10 text-fail" : v === "P1" ? "bg-amber-light text-amber" : "bg-info/10 text-info"}`}>{v}</span>
      )},
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "通过" ? "bg-pass/10 text-pass" : v === "失败" ? "bg-fail/10 text-fail" : "bg-cream text-muted"}`}>{v}</span>
      )},
      { key: "source", label: "来源" },
    ],
    data: [
      { id: 1, name: "登录成功验证", endpoint: "POST /api/auth/login", priority: "P0", status: "通过", source: "AI生成" },
      { id: 2, name: "登录失败-密码错误", endpoint: "POST /api/auth/login", priority: "P1", status: "通过", source: "AI生成" },
      { id: 3, name: "用户列表分页", endpoint: "GET /api/users", priority: "P1", status: "失败", source: "AI生成" },
      { id: 4, name: "创建订单-必填校验", endpoint: "POST /api/orders", priority: "P0", status: "通过", source: "手动" },
      { id: 5, name: "删除不存在订单", endpoint: "DELETE /api/orders/999", priority: "P2", status: "待执行", source: "AI生成" },
    ],
    stats: [
      { label: "用例总数", value: 32, color: "text-ink" },
      { label: "通过", value: 24, color: "text-pass" },
      { label: "失败", value: 5, color: "text-fail" },
      { label: "待执行", value: 3, color: "text-amber" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
      { label: "执行", icon: Play, onClick: () => {} },
    ],
  },
  "api-execution": {
    title: "执行测试",
    subtitle: "批量执行API测试用例",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "执行名称" },
      { key: "environment", label: "环境" },
      { key: "casesCount", label: "用例数" },
      { key: "passRate", label: "通过率", render: (v: string) => (
        <span className={`text-xs font-bold ${parseFloat(v) >= 90 ? "text-pass" : parseFloat(v) >= 70 ? "text-amber" : "text-fail"}`}>{v}</span>
      )},
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${v === "完成" ? "bg-pass/10 text-pass" : v === "执行中" ? "bg-amber-light text-amber" : "bg-cream text-muted"}`}>
          {v === "完成" ? <CheckCircle className="w-3 h-3" /> : v === "执行中" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}{v}
        </span>
      )},
      { key: "duration", label: "耗时" },
    ],
    data: [
      { id: 1, name: "回归测试-第5轮", environment: "测试环境", casesCount: 32, passRate: "93.8%", status: "完成", duration: "45s" },
      { id: 2, name: "冒烟测试", environment: "生产环境", casesCount: 10, passRate: "100%", status: "完成", duration: "12s" },
      { id: 3, name: "压力测试", environment: "测试环境", casesCount: 50, passRate: "78.0%", status: "执行中", duration: "-" },
    ],
    stats: [
      { label: "执行总数", value: 15, color: "text-ink" },
      { label: "成功", value: 12, color: "text-pass" },
      { label: "失败", value: 2, color: "text-fail" },
      { label: "执行中", value: 1, color: "text-amber" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
      { label: "停止", icon: Pause, onClick: () => {} },
    ],
  },
  "api-results": {
    title: "测试报告",
    subtitle: "API测试结果分析报告",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "报告名称" },
      { key: "type", label: "类型" },
      { key: "totalCases", label: "总用例" },
      { key: "passRate", label: "通过率", render: (v: string) => (
        <span className={`text-xs font-bold ${parseFloat(v) >= 90 ? "text-pass" : parseFloat(v) >= 70 ? "text-amber" : "text-fail"}`}>{v}</span>
      )},
      { key: "generatedAt", label: "生成时间" },
    ],
    data: [
      { id: 1, name: "API回归测试报告-0722", type: "回归报告", totalCases: 32, passRate: "93.8%", generatedAt: "2026-07-22 10:30" },
      { id: 2, name: "接口性能分析报告", type: "性能报告", totalCases: 15, passRate: "86.7%", generatedAt: "2026-07-21 14:20" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
      { label: "下载", icon: Download, onClick: () => {} },
    ],
  },
}

// ════════════════════════════════════════
// AI App自动化
// ════════════════════════════════════════
export const APP_PAGES = {
  "app-devices": {
    title: "设备管理",
    subtitle: "管理测试设备和模拟器",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "设备名称" },
      { key: "os", label: "操作系统" },
      { key: "version", label: "版本" },
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "在线" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{v}</span>
      )},
    ],
    data: [
      { id: 1, name: "iPhone 15 Pro", os: "iOS", version: "17.5", status: "在线" },
      { id: 2, name: "Pixel 8", os: "Android", version: "14", status: "在线" },
      { id: 3, name: "Samsung S24", os: "Android", version: "14", status: "离线" },
      { id: 4, name: "iPad Air", os: "iPadOS", version: "17.4", status: "在线" },
    ],
    stats: [
      { label: "设备总数", value: 4, color: "text-ink" },
      { label: "在线", value: 3, color: "text-pass" },
      { label: "离线", value: 1, color: "text-amber" },
    ],
    actions: [
      { label: "连接", icon: Play, onClick: () => {} },
      { label: "编辑", icon: Edit, onClick: () => {} },
    ],
  },
  "app-cases": {
    title: "测试用例",
    subtitle: "AI生成的移动端测试用例",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "用例名称" },
      { key: "platform", label: "平台" },
      { key: "priority", label: "优先级", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v === "P0" ? "bg-fail/10 text-fail" : v === "P1" ? "bg-amber-light text-amber" : "bg-info/10 text-info"}`}>{v}</span>
      )},
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "通过" ? "bg-pass/10 text-pass" : v === "失败" ? "bg-fail/10 text-fail" : "bg-cream text-muted"}`}>{v}</span>
      )},
    ],
    data: [
      { id: 1, name: "启动APP验证", platform: "iOS/Android", priority: "P0", status: "通过" },
      { id: 2, name: "登录流程验证", platform: "iOS/Android", priority: "P0", status: "通过" },
      { id: 3, name: "首页加载性能", platform: "Android", priority: "P1", status: "失败" },
      { id: 4, name: "横屏适配验证", platform: "iPad", priority: "P2", status: "待执行" },
    ],
    stats: [
      { label: "用例总数", value: 18, color: "text-ink" },
      { label: "通过", value: 14, color: "text-pass" },
      { label: "失败", value: 2, color: "text-fail" },
    ],
    actions: [
      { label: "执行", icon: Play, onClick: () => {} },
      { label: "查看", icon: Eye, onClick: () => {} },
    ],
  },
  "app-execution": {
    title: "远程执行",
    subtitle: "在远程设备上执行测试",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "device", label: "设备" },
      { key: "casesCount", label: "用例数" },
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "完成" ? "bg-pass/10 text-pass" : v === "执行中" ? "bg-amber-light text-amber" : "bg-cream text-muted"}`}>{v}</span>
      )},
      { key: "duration", label: "耗时" },
    ],
    data: [
      { id: 1, device: "iPhone 15 Pro", casesCount: 8, status: "完成", duration: "2m 30s" },
      { id: 2, device: "Pixel 8", casesCount: 8, status: "执行中", duration: "-" },
    ],
    stats: [
      { label: "执行总数", value: 5, color: "text-ink" },
      { label: "成功", value: 4, color: "text-pass" },
      { label: "执行中", value: 1, color: "text-amber" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
    ],
  },
  "app-screenshots": {
    title: "截图对比",
    subtitle: "AI视觉对比测试截图",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "page", label: "页面" },
      { key: "device", label: "设备" },
      { key: "result", label: "对比结果", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "一致" ? "bg-pass/10 text-pass" : "bg-fail/10 text-fail"}`}>{v}</span>
      )},
      { key: "similarity", label: "相似度" },
    ],
    data: [
      { id: 1, page: "登录页", device: "iPhone 15 Pro", result: "一致", similarity: "99.2%" },
      { id: 2, page: "首页", device: "Pixel 8", result: "不一致", similarity: "87.5%" },
      { id: 3, page: "个人中心", device: "iPhone 15 Pro", result: "一致", similarity: "98.8%" },
    ],
    stats: [
      { label: "截图总数", value: 24, color: "text-ink" },
      { label: "一致", value: 21, color: "text-pass" },
      { label: "不一致", value: 3, color: "text-fail" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
    ],
  },
  "app-crashes": {
    title: "崩溃分析",
    subtitle: "APP崩溃日志分析和定位",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "type", label: "崩溃类型" },
      { key: "device", label: "设备" },
      { key: "count", label: "次数" },
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "已修复" ? "bg-pass/10 text-pass" : v === "待修复" ? "bg-fail/10 text-fail" : "bg-amber-light text-amber"}`}>{v}</span>
      )},
    ],
    data: [
      { id: 1, type: "NullPointerException", device: "Pixel 8", count: 12, status: "已修复" },
      { id: 2, type: "OOM", device: "iPhone 15 Pro", count: 3, status: "待修复" },
      { id: 3, type: "ANR", device: "Samsung S24", count: 5, status: "分析中" },
    ],
    stats: [
      { label: "崩溃总数", value: 8, color: "text-ink" },
      { label: "已修复", value: 5, color: "text-pass" },
      { label: "待修复", value: 3, color: "text-fail" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
      { label: "分析", icon: AlertTriangle, onClick: () => {} },
    ],
  },
}

// ════════════════════════════════════════
// AI 性能测试
// ════════════════════════════════════════
export const PERF_PAGES = {
  "perf-scenarios": {
    title: "压测场景",
    subtitle: "定义和管理性能测试场景",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "场景名称" },
      { key: "target", label: "目标URL" },
      { key: "concurrency", label: "并发数" },
      { key: "duration", label: "持续时间" },
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "就绪" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{v}</span>
      )},
    ],
    data: [
      { id: 1, name: "登录接口压测", target: "/api/auth/login", concurrency: 100, duration: "5min", status: "就绪" },
      { id: 2, name: "首页并发测试", target: "/", concurrency: 500, duration: "10min", status: "就绪" },
      { id: 3, name: "订单创建压测", target: "/api/orders", concurrency: 200, duration: "3min", status: "就绪" },
    ],
    stats: [
      { label: "场景总数", value: 3, color: "text-ink" },
      { label: "就绪", value: 3, color: "text-pass" },
    ],
    actions: [
      { label: "执行", icon: Play, onClick: () => {} },
      { label: "编辑", icon: Edit, onClick: () => {} },
    ],
  },
  "perf-config": {
    title: "压测配置",
    subtitle: "配置压测参数和阈值",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "配置名称" },
      { key: "maxConcurrency", label: "最大并发" },
      { key: "rampUp", label: "递增时间" },
      { key: "threshold", label: "响应阈值" },
    ],
    data: [
      { id: 1, name: "标准压测", maxConcurrency: 500, rampUp: "2min", threshold: "<500ms" },
      { id: 2, name: "峰值压测", maxConcurrency: 1000, rampUp: "5min", threshold: "<1000ms" },
    ],
    stats: [
      { label: "配置数", value: 2, color: "text-ink" },
    ],
    actions: [
      { label: "编辑", icon: Edit, onClick: () => {} },
    ],
  },
  "perf-execution": {
    title: "执行压测",
    subtitle: "执行和监控性能测试",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "scenario", label: "场景" },
      { key: "concurrency", label: "并发数" },
      { key: "rps", label: "RPS" },
      { key: "avgResponse", label: "平均响应" },
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "完成" ? "bg-pass/10 text-pass" : v === "执行中" ? "bg-amber-light text-amber" : "bg-cream text-muted"}`}>{v}</span>
      )},
    ],
    data: [
      { id: 1, scenario: "登录接口压测", concurrency: 100, rps: "1250/s", avgResponse: "85ms", status: "完成" },
      { id: 2, scenario: "首页并发测试", concurrency: 500, rps: "3200/s", avgResponse: "156ms", status: "执行中" },
    ],
    stats: [
      { label: "执行总数", value: 8, color: "text-ink" },
      { label: "成功", value: 6, color: "text-pass" },
      { label: "执行中", value: 1, color: "text-amber" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
    ],
  },
  "perf-monitor": {
    title: "实时监控",
    subtitle: "实时查看压测指标",
    columns: [
      { key: "metric", label: "指标" },
      { key: "current", label: "当前值" },
      { key: "avg", label: "平均值" },
      { key: "p95", label: "P95" },
      { key: "p99", label: "P99" },
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "正常" ? "bg-pass/10 text-pass" : "bg-fail/10 text-fail"}`}>{v}</span>
      )},
    ],
    data: [
      { metric: "响应时间", current: "85ms", avg: "92ms", p95: "230ms", p99: "450ms", status: "正常" },
      { metric: "吞吐量", current: "1250/s", avg: "1180/s", p95: "1400/s", p99: "1500/s", status: "正常" },
      { metric: "错误率", current: "0.2%", avg: "0.3%", p95: "0.5%", p99: "1.2%", status: "正常" },
      { metric: "CPU使用率", current: "45%", avg: "42%", p95: "68%", p99: "82%", status: "正常" },
      { metric: "内存使用率", current: "62%", avg: "58%", p95: "75%", p99: "88%", status: "正常" },
    ],
    stats: [
      { label: "监控指标", value: 5, color: "text-ink" },
      { label: "正常", value: 5, color: "text-pass" },
      { label: "告警", value: 0, color: "text-amber" },
    ],
    actions: [],
  },
  "perf-report": {
    title: "性能报告",
    subtitle: "性能测试结果分析",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "报告名称" },
      { key: "scenario", label: "场景" },
      { key: "maxRps", label: "最大RPS" },
      { key: "avgResponse", label: "平均响应" },
      { key: "generatedAt", label: "生成时间" },
    ],
    data: [
      { id: 1, name: "登录压测报告-0722", scenario: "登录接口压测", maxRps: "1500/s", avgResponse: "85ms", generatedAt: "2026-07-22 11:00" },
      { id: 2, name: "首页压测报告-0721", scenario: "首页并发测试", maxRps: "3500/s", avgResponse: "156ms", generatedAt: "2026-07-21 15:30" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
      { label: "下载", icon: Download, onClick: () => {} },
    ],
  },
}

// ════════════════════════════════════════
// AI 安全测试
// ════════════════════════════════════════
export const SEC_PAGES = {
  "sec-targets": {
    title: "扫描目标",
    subtitle: "配置安全扫描目标",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "目标名称" },
      { key: "url", label: "URL" },
      { key: "type", label: "类型" },
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "已配置" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{v}</span>
      )},
    ],
    data: [
      { id: 1, name: "主站Web应用", url: "https://tss.com", type: "Web应用", status: "已配置" },
      { id: 2, name: "API网关", url: "https://api.tss.com", type: "API接口", status: "已配置" },
      { id: 3, name: "管理后台", url: "https://admin.tss.com", type: "Web应用", status: "已配置" },
    ],
    stats: [
      { label: "目标总数", value: 3, color: "text-ink" },
      { label: "已配置", value: 3, color: "text-pass" },
    ],
    actions: [
      { label: "编辑", icon: Edit, onClick: () => {} },
      { label: "扫描", icon: Play, onClick: () => {} },
    ],
  },
  "sec-rules": {
    title: "安全规则",
    subtitle: "配置安全扫描规则集",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "规则名称" },
      { key: "category", label: "分类" },
      { key: "severity", label: "严重程度", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v === "高危" ? "bg-fail/10 text-fail" : v === "中危" ? "bg-amber-light text-amber" : "bg-info/10 text-info"}`}>{v}</span>
      )},
      { key: "enabled", label: "启用", render: (v: boolean) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{v ? "启用" : "禁用"}</span>
      )},
    ],
    data: [
      { id: 1, name: "SQL注入检测", category: "注入攻击", severity: "高危", enabled: true },
      { id: 2, name: "XSS跨站脚本", category: "XSS", severity: "高危", enabled: true },
      { id: 3, name: "CSRF防护检测", category: "CSRF", severity: "中危", enabled: true },
      { id: 4, name: "敏感信息泄露", category: "信息泄露", severity: "中危", enabled: true },
      { id: 5, name: "弱密码检测", category: "认证安全", severity: "低危", enabled: false },
    ],
    stats: [
      { label: "规则总数", value: 5, color: "text-ink" },
      { label: "已启用", value: 4, color: "text-pass" },
      { label: "高危", value: 2, color: "text-fail" },
    ],
    actions: [
      { label: "编辑", icon: Edit, onClick: () => {} },
    ],
  },
  "sec-scan": {
    title: "漏洞扫描",
    subtitle: "执行安全漏洞扫描",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "target", label: "目标" },
      { key: "rulesCount", label: "规则数" },
      { key: "vulnFound", label: "发现漏洞", render: (v: number) => (
        <span className={`text-xs font-bold ${v > 0 ? "text-fail" : "text-pass"}`}>{v}</span>
      )},
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "完成" ? "bg-pass/10 text-pass" : v === "扫描中" ? "bg-amber-light text-amber" : "bg-cream text-muted"}`}>{v}</span>
      )},
    ],
    data: [
      { id: 1, target: "主站Web应用", rulesCount: 128, vulnFound: 3, status: "完成" },
      { id: 2, target: "API网关", rulesCount: 96, vulnFound: 1, status: "扫描中" },
    ],
    stats: [
      { label: "扫描总数", value: 12, color: "text-ink" },
      { label: "发现漏洞", value: 8, color: "text-fail" },
      { label: "高危漏洞", value: 2, color: "text-fail" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
    ],
  },
  "sec-results": {
    title: "扫描结果",
    subtitle: "漏洞扫描结果详情",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "漏洞名称" },
      { key: "severity", label: "严重程度", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v === "高危" ? "bg-fail/10 text-fail" : v === "中危" ? "bg-amber-light text-amber" : "bg-info/10 text-info"}`}>{v}</span>
      )},
      { key: "category", label: "分类" },
      { key: "status", label: "状态", render: (v: string) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "已修复" ? "bg-pass/10 text-pass" : v === "待修复" ? "bg-fail/10 text-fail" : "bg-amber-light text-amber"}`}>{v}</span>
      )},
    ],
    data: [
      { id: 1, name: "SQL注入-登录接口", severity: "高危", category: "注入攻击", status: "待修复" },
      { id: 2, name: "XSS-搜索框", severity: "高危", category: "XSS", status: "修复中" },
      { id: 3, name: "CSRF-订单接口", severity: "中危", category: "CSRF", status: "已修复" },
      { id: 4, name: "敏感信息-错误页", severity: "中危", category: "信息泄露", status: "待修复" },
    ],
    stats: [
      { label: "漏洞总数", value: 4, color: "text-ink" },
      { label: "已修复", value: 1, color: "text-pass" },
      { label: "待修复", value: 3, color: "text-fail" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
      { label: "修复建议", icon: Shield, onClick: () => {} },
    ],
  },
  "sec-report": {
    title: "安全报告",
    subtitle: "安全测试综合报告",
    columns: [
      { key: "id", label: "ID", width: "60px" },
      { key: "name", label: "报告名称" },
      { key: "score", label: "安全评分", render: (v: string) => (
        <span className={`text-xs font-bold ${parseInt(v) >= 80 ? "text-pass" : parseInt(v) >= 60 ? "text-amber" : "text-fail"}`}>{v}/100</span>
      )},
      { key: "vulnCount", label: "漏洞数" },
      { key: "generatedAt", label: "生成时间" },
    ],
    data: [
      { id: 1, name: "安全评估报告-0722", score: "72", vulnCount: 4, generatedAt: "2026-07-22 12:00" },
    ],
    actions: [
      { label: "查看", icon: Eye, onClick: () => {} },
      { label: "下载", icon: Download, onClick: () => {} },
    ],
  },
}

// ════════════════════════════════════════
// AI 兼容性测试 (简化配置)
// ════════════════════════════════════════
export const COMPAT_PAGES = {
  "compat-matrix": { title: "兼容矩阵", subtitle: "定义测试兼容性矩阵", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "browser", label: "浏览器" }, { key: "os", label: "操作系统" },
    { key: "resolution", label: "分辨率" }, { key: "status", label: "状态", render: (v: string) => <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "支持" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{v}</span> },
  ], data: [
    { id: 1, browser: "Chrome 125", os: "Windows 11", resolution: "1920x1080", status: "支持" },
    { id: 2, browser: "Safari 17", os: "macOS Sonoma", resolution: "2560x1600", status: "支持" },
    { id: 3, browser: "Firefox 126", os: "Ubuntu 22.04", resolution: "1366x768", status: "支持" },
    { id: 4, browser: "Edge 125", os: "Windows 10", resolution: "1920x1080", status: "支持" },
  ], stats: [{ label: "组合数", value: 4, color: "text-ink" }, { label: "支持", value: 4, color: "text-pass" }], actions: [{ label: "编辑", icon: Edit, onClick: () => {} }] },
  "compat-cases": { title: "测试用例", subtitle: "兼容性测试用例", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "用例名称" }, { key: "scope", label: "测试范围" },
    { key: "status", label: "状态", render: (v: string) => <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "通过" ? "bg-pass/10 text-pass" : v === "失败" ? "bg-fail/10 text-fail" : "bg-cream text-muted"}`}>{v}</span> },
  ], data: [
    { id: 1, name: "登录页面兼容性", scope: "全浏览器", status: "通过" },
    { id: 2, name: "响应式布局验证", scope: "多分辨率", status: "通过" },
    { id: 3, name: "JavaScript兼容性", scope: "全浏览器", status: "失败" },
  ], stats: [{ label: "用例数", value: 12, color: "text-ink" }, { label: "通过", value: 10, color: "text-pass" }, { label: "失败", value: 2, color: "text-fail" }], actions: [{ label: "执行", icon: Play, onClick: () => {} }] },
  "compat-execution": { title: "执行测试", subtitle: "多环境并行执行", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "browser", label: "浏览器" }, { key: "passRate", label: "通过率" },
    { key: "status", label: "状态", render: (v: string) => <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "完成" ? "bg-pass/10 text-pass" : "bg-amber-light text-amber"}`}>{v}</span> },
  ], data: [
    { id: 1, browser: "Chrome 125", passRate: "100%", status: "完成" },
    { id: 2, browser: "Safari 17", passRate: "91.7%", status: "完成" },
    { id: 3, browser: "Firefox 126", passRate: "83.3%", status: "完成" },
  ], stats: [{ label: "执行数", value: 4, color: "text-ink" }, { label: "全通过", value: 1, color: "text-pass" }], actions: [{ label: "查看", icon: Eye, onClick: () => {} }] },
  "compat-results": { title: "对比结果", subtitle: "跨平台截图对比", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "page", label: "页面" }, { key: "match", label: "匹配度", render: (v: string) => <span className={`text-xs font-bold ${parseFloat(v) >= 95 ? "text-pass" : "text-amber"}`}>{v}</span> },
  ], data: [
    { id: 1, page: "登录页", match: "99.2%" }, { id: 2, page: "首页", match: "97.8%" }, { id: 3, page: "订单页", match: "94.5%" },
  ], stats: [{ label: "对比数", value: 24, color: "text-ink" }, { label: "一致", value: 20, color: "text-pass" }], actions: [{ label: "查看", icon: Eye, onClick: () => {} }] },
  "compat-report": { title: "兼容报告", subtitle: "兼容性测试报告", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "报告名称" }, { key: "score", label: "兼容评分" },
    { key: "generatedAt", label: "生成时间" },
  ], data: [
    { id: 1, name: "兼容性测试报告-0722", score: "95.8%", generatedAt: "2026-07-22 14:00" },
  ], actions: [{ label: "查看", icon: Eye, onClick: () => {} }, { label: "下载", icon: Download, onClick: () => {} }] },
}

// ════════════════════════════════════════
// AI 回归测试 (简化配置)
// ════════════════════════════════════════
export const REG_PAGES = {
  "reg-changes": { title: "变更分析", subtitle: "分析代码变更影响", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "file", label: "文件" }, { key: "changeType", label: "变更类型" },
    { key: "impact", label: "影响范围", render: (v: string) => <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "高" ? "bg-fail/10 text-fail" : v === "中" ? "bg-amber-light text-amber" : "bg-pass/10 text-pass"}`}>{v}</span> },
  ], data: [
    { id: 1, file: "src/auth/login.ts", changeType: "修改", impact: "高" },
    { id: 2, file: "src/order/create.ts", changeType: "新增", impact: "中" },
    { id: 3, file: "src/utils/helper.ts", changeType: "修改", impact: "低" },
  ], stats: [{ label: "变更文件", value: 3, color: "text-ink" }, { label: "高影响", value: 1, color: "text-fail" }], actions: [{ label: "查看", icon: Eye, onClick: () => {} }] },
  "reg-scope": { title: "影响范围", subtitle: "AI识别的影响模块", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "module", label: "模块" }, { key: "riskLevel", label: "风险等级" },
    { key: "relatedCases", label: "关联用例" },
  ], data: [
    { id: 1, module: "认证模块", riskLevel: "高", relatedCases: 12 },
    { id: 2, module: "订单模块", riskLevel: "中", relatedCases: 8 },
    { id: 3, module: "工具库", riskLevel: "低", relatedCases: 3 },
  ], stats: [{ label: "影响模块", value: 3, color: "text-ink" }, { label: "关联用例", value: 23, color: "text-info" }], actions: [] },
  "reg-cases": { title: "回归用例", subtitle: "AI选择的回归用例", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "用例名称" }, { key: "module", label: "模块" },
    { key: "reason", label: "选择原因" },
  ], data: [
    { id: 1, name: "登录成功验证", module: "认证模块", reason: "代码变更直接关联" },
    { id: 2, name: "订单创建验证", module: "订单模块", reason: "依赖变更模块" },
    { id: 3, name: "工具函数测试", module: "工具库", reason: "被多模块引用" },
  ], stats: [{ label: "回归用例", value: 23, color: "text-ink" }, { label: "AI选择", value: 18, color: "text-info" }], actions: [{ label: "执行", icon: Play, onClick: () => {} }] },
  "reg-execution": { title: "执行回归", subtitle: "执行回归测试", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "执行名称" }, { key: "passRate", label: "通过率" },
    { key: "status", label: "状态", render: (v: string) => <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "通过" ? "bg-pass/10 text-pass" : "bg-fail/10 text-fail"}`}>{v}</span> },
  ], data: [
    { id: 1, name: "回归测试-20260722", passRate: "95.7%", status: "通过" },
  ], stats: [{ label: "执行数", value: 5, color: "text-ink" }, { label: "通过", value: 4, color: "text-pass" }], actions: [{ label: "查看", icon: Eye, onClick: () => {} }] },
  "reg-report": { title: "回归报告", subtitle: "回归测试报告", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "报告名称" }, { key: "generatedAt", label: "生成时间" },
  ], data: [
    { id: 1, name: "回归测试报告-0722", generatedAt: "2026-07-22 16:00" },
  ], actions: [{ label: "查看", icon: Eye, onClick: () => {} }, { label: "下载", icon: Download, onClick: () => {} }] },
}

// ════════════════════════════════════════
// AI 探索性测试 (简化配置)
// ════════════════════════════════════════
export const EXP_PAGES = {
  "exp-target": { title: "探索目标", subtitle: "配置AI探索目标", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "目标名称" }, { key: "url", label: "URL" },
    { key: "status", label: "状态", render: (v: string) => <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "已配置" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{v}</span> },
  ], data: [
    { id: 1, name: "TSS售票系统", url: "http://8.141.14.188:5000", status: "已配置" },
  ], stats: [{ label: "目标数", value: 1, color: "text-ink" }], actions: [{ label: "编辑", icon: Edit, onClick: () => {} }, { label: "探索", icon: Play, onClick: () => {} }] },
  "exp-config": { title: "探索策略", subtitle: "配置AI探索策略", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "策略名称" }, { key: "depth", label: "探索深度" },
    { key: "focus", label: "关注点" },
  ], data: [
    { id: 1, name: "全面探索", depth: "深度", focus: "所有页面和交互元素" },
    { id: 2, name: "登录流程探索", depth: "中度", focus: "认证相关页面" },
  ], stats: [{ label: "策略数", value: 2, color: "text-ink" }], actions: [{ label: "编辑", icon: Edit, onClick: () => {} }] },
  "exp-execution": { title: "AI探索", subtitle: "执行AI自主探索", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "target", label: "目标" }, { key: "pagesFound", label: "发现页面" },
    { key: "status", label: "状态", render: (v: string) => <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "完成" ? "bg-pass/10 text-pass" : v === "探索中" ? "bg-amber-light text-amber" : "bg-cream text-muted"}`}>{v}</span> },
  ], data: [
    { id: 1, target: "TSS售票系统", pagesFound: 5, status: "完成" },
  ], stats: [{ label: "探索数", value: 3, color: "text-ink" }, { label: "发现页面", value: 12, color: "text-info" }], actions: [{ label: "查看", icon: Eye, onClick: () => {} }] },
  "exp-findings": { title: "发现结果", subtitle: "AI探索发现的问题", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "title", label: "问题标题" }, { key: "severity", label: "严重程度" },
    { key: "status", label: "状态", render: (v: string) => <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "已确认" ? "bg-pass/10 text-pass" : "bg-amber-light text-amber"}`}>{v}</span> },
  ], data: [
    { id: 1, title: "注册页面404", severity: "中", status: "已确认" },
    { id: 2, title: "搜索无结果提示不友好", severity: "低", status: "待确认" },
  ], stats: [{ label: "发现数", value: 2, color: "text-ink" }, { label: "已确认", value: 1, color: "text-pass" }], actions: [{ label: "查看", icon: Eye, onClick: () => {} }] },
  "exp-report": { title: "探索报告", subtitle: "AI探索报告", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "报告名称" }, { key: "generatedAt", label: "生成时间" },
  ], data: [
    { id: 1, name: "探索性测试报告-0722", generatedAt: "2026-07-22 15:00" },
  ], actions: [{ label: "查看", icon: Eye, onClick: () => {} }, { label: "下载", icon: Download, onClick: () => {} }] },
}

// ════════════════════════════════════════
// AI Web自动化 (已有独立模块，这里提供简化配置)
// ════════════════════════════════════════
export const WEB_PAGES = {
  "wa-projects": { title: "项目管理", subtitle: "管理Web自动化测试项目", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "项目名称" }, { key: "url", label: "目标URL" },
    { key: "status", label: "状态", render: (v: string) => <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "已探索" ? "bg-pass/10 text-pass" : "bg-cream text-muted"}`}>{v}</span> },
  ], data: [
    { id: 1, name: "TSS售票系统", url: "http://8.141.14.188:5000", status: "已探索" },
  ], stats: [{ label: "项目数", value: 1, color: "text-ink" }], actions: [{ label: "查看", icon: Eye, onClick: () => {} }, { label: "探索", icon: Play, onClick: () => {} }] },
  "wa-explore": { title: "AI探索", subtitle: "AI视觉探索Web页面", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "title", label: "页面标题" }, { key: "url", label: "URL" },
    { key: "elements", label: "元素数" },
  ], data: [
    { id: 1, title: "登录页", url: "/login", elements: 4 },
    { id: 2, title: "首页", url: "/", elements: 12 },
  ], stats: [{ label: "页面数", value: 2, color: "text-ink" }, { label: "元素总数", value: 16, color: "text-info" }], actions: [{ label: "查看", icon: Eye, onClick: () => {} }] },
  "wa-cases": { title: "测试用例", subtitle: "AI生成的Web测试用例", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "title", label: "用例名称" }, { key: "priority", label: "优先级" },
    { key: "status", label: "状态", render: (v: string) => <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${v === "已通过" ? "bg-pass/10 text-pass" : v === "已驳回" ? "bg-fail/10 text-fail" : "bg-cream text-muted"}`}>{v}</span> },
  ], data: [
    { id: 1, title: "登录成功验证", priority: "P0", status: "已通过" },
    { id: 2, title: "登录失败提示", priority: "P1", status: "已通过" },
    { id: 3, title: "注册链接跳转", priority: "P1", status: "已通过" },
  ], stats: [{ label: "用例数", value: 11, color: "text-ink" }, { label: "已通过", value: 11, color: "text-pass" }], actions: [{ label: "查看", icon: Eye, onClick: () => {} }] },
  "wa-execution": { title: "测试执行", subtitle: "执行Web自动化测试", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "执行名称" }, { key: "status", label: "状态" },
    { key: "duration", label: "耗时" },
  ], data: [
    { id: 1, name: "Web自动化执行-0722", status: "完成", duration: "45s" },
  ], stats: [{ label: "执行数", value: 1, color: "text-ink" }], actions: [{ label: "查看", icon: Eye, onClick: () => {} }] },
  "wa-results": { title: "执行报告", subtitle: "Web测试执行报告", columns: [
    { key: "id", label: "ID", width: "60px" }, { key: "name", label: "报告名称" }, { key: "generatedAt", label: "生成时间" },
  ], data: [
    { id: 1, name: "Web测试报告-0722", generatedAt: "2026-07-22 16:30" },
  ], actions: [{ label: "查看", icon: Eye, onClick: () => {} }, { label: "下载", icon: Download, onClick: () => {} }] },
}

// ════════════════════════════════════════
// 导出所有配置的映射
// ════════════════════════════════════════
export const ALL_PAGE_CONFIGS: Record<string, Record<string, any>> = {
  api: API_PAGES,
  app: APP_PAGES,
  performance: PERF_PAGES,
  security: SEC_PAGES,
  compatibility: COMPAT_PAGES,
  regression: REG_PAGES,
  exploratory: EXP_PAGES,
  "ai-web": WEB_PAGES,
}
