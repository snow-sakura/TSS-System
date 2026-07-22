/**
 * 操作日志 — 全量操作审计日志
 * 功能：多维度筛选 / 时间倒序 / 详细记录 / 导出 / AI操作追踪
 */
import { useState, useMemo } from "react"
import { Search, Filter, Download, Eye, X, ScrollText, User, Bot, Clock, CheckCircle, AlertTriangle, Info, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { toast } from "sonner"

// 日志级别
const LOG_LEVELS = [
  { key: "INFO", label: "INFO", color: "bg-pass/10 text-pass", icon: Info },
  { key: "WARN", label: "WARN", color: "bg-warn/10 text-warn", icon: AlertTriangle },
  { key: "ERROR", label: "ERROR", color: "bg-fail/10 text-fail", icon: AlertTriangle },
  { key: "DEBUG", label: "DEBUG", color: "bg-muted/10 text-muted", icon: Info },
]

// 操作类型
const ACTION_TYPES = ["登录", "配置修改", "手动触发", "AI推理", "AI工具调用", "用例执行", "缺陷提交", "报告生成", "环境检测", "消息发送"]

// Mock操作日志数据
const mockLogs = [
  { id: 1001, time: "2025-07-21T10:35:12.345Z", operator: "admin", operator_type: "user", action: "配置修改", module: "大模型配置", detail: "启用 DeepSeek-V3 模型，设置路由权重为40", input: '{"model":"deepseek-chat","weight":40}', output: '{"status":"success"}', status: "success", ip: "192.168.1.100", device: "Chrome 125.0 / macOS" },
  { id: 1002, time: "2025-07-21T10:33:45.123Z", operator: "测试用例生成Agent", operator_type: "ai", action: "AI推理", module: "提示词配置", detail: "使用「测试用例生成器」模板生成测试用例，输入需求：用户登录功能", input: '{"prompt":"测试用例生成器","requirement":"用户登录功能"}', output: '{"cases":12,"tokens":1800}', status: "success", ip: "-", device: "AI Agent" },
  { id: 1003, time: "2025-07-21T10:32:18.789Z", operator: "Web自动化Agent", operator_type: "ai", action: "AI工具调用", module: "MCP服务", detail: "调用 Playwright browser_navigate 工具访问 https://test-web.tss.local", input: '{"tool":"browser_navigate","url":"https://test-web.tss.local"}', output: '{"status":"loaded","title":"TSS测试平台"}', status: "success", ip: "-", device: "AI Agent" },
  { id: 1004, time: "2025-07-21T10:30:55.456Z", operator: "admin", operator_type: "user", action: "环境检测", module: "环境配置", detail: "批量健康检测：5个环境，4个在线，1个维护中", input: '{"action":"batch_health_check"}', output: '{"online":4,"offline":1}', status: "success", ip: "192.168.1.100", device: "Chrome 125.0 / macOS" },
  { id: 1005, time: "2025-07-21T10:28:33.234Z", operator: "缺陷分析Agent", operator_type: "ai", action: "AI推理", module: "提示词配置", detail: "使用「缺陷根因分析器」分析缺陷 #DEF-2025-042", input: '{"prompt":"缺陷根因分析器","defect_id":"DEF-2025-042"}', output: '{"root_cause":"空指针异常","confidence":0.92}', status: "success", ip: "-", device: "AI Agent" },
  { id: 1006, time: "2025-07-21T10:25:12.567Z", operator: "admin", operator_type: "user", action: "登录", module: "用户管理", detail: "用户 admin 登录系统", input: '{"username":"admin"}', output: '{"token":"eyJhbG..."}', status: "success", ip: "192.168.1.100", device: "Chrome 125.0 / macOS" },
  { id: 1007, time: "2025-07-21T10:22:45.890Z", operator: "报告生成Agent", operator_type: "ai", action: "AI推理", module: "提示词配置", detail: "使用「测试报告生成器」生成冒烟测试日报", input: '{"prompt":"测试报告生成器","period":"2025-07-21"}', output: '{"report_id":"RPT-2025-0721","pages":5}', status: "success", ip: "-", device: "AI Agent" },
  { id: 1008, time: "2025-07-21T10:20:11.345Z", operator: "Web自动化Agent", operator_type: "ai", action: "用例执行", module: "执行测试", detail: "执行回归测试用例 TC-001 ~ TC-015，通过14，失败1", input: '{"cases":["TC-001","TC-002",...],"env":"web-automation"}', output: '{"passed":14,"failed":1,"duration":"2m30s"}', status: "warning", ip: "-", device: "AI Agent" },
  { id: 1009, time: "2025-07-21T10:18:33.678Z", operator: "admin", operator_type: "user", action: "配置修改", module: "Skills技能", detail: "启用「智能用例生成」技能，版本 2.0.0", input: '{"skill_id":"skill-1","status":"enabled"}', output: '{"status":"success"}', status: "success", ip: "192.168.1.100", device: "Chrome 125.0 / macOS" },
  { id: 1010, time: "2025-07-21T10:15:22.901Z", operator: "测试团队钉钉群", operator_type: "system", action: "消息发送", module: "Hermes配置", detail: "发送测试执行完成通知到钉钉群", input: '{"channel":"hermes-1","template":"执行完成通知"}', output: '{"message_id":"msg-001","latency":"0.8s"}', status: "success", ip: "-", device: "System" },
  { id: 1011, time: "2025-07-21T10:12:11.234Z", operator: "代码审查Agent", operator_type: "ai", action: "AI工具调用", module: "MCP服务", detail: "调用 file_read 读取 src/auth/login.ts 进行代码审查", input: '{"tool":"file_read","path":"src/auth/login.ts"}', output: '{"lines":156,"issues":3}', status: "success", ip: "-", device: "AI Agent" },
  { id: 1012, time: "2025-07-21T10:08:55.567Z", operator: "admin", operator_type: "user", action: "配置修改", module: "环境配置", detail: "更新「Web自动化测试环境」浏览器配置为 Chrome 125.0", input: '{"env_id":"env-1","browser":"Chrome 125.0"}', output: '{"status":"success"}', status: "success", ip: "192.168.1.100", device: "Chrome 125.0 / macOS" },
  { id: 1013, time: "2025-07-21T10:05:33.890Z", operator: "需求分析Agent", operator_type: "ai", action: "AI推理", module: "提示词配置", detail: "使用「需求分析与功能点提取」分析需求文档 REQ-2025-018", input: '{"prompt":"需求分析","doc_id":"REQ-2025-018"}', output: '{"features":8,"risks":2}', status: "success", ip: "-", device: "AI Agent" },
  { id: 1014, time: "2025-07-21T10:02:11.123Z", operator: "接口测试Agent", operator_type: "ai", action: "用例执行", module: "执行测试", detail: "执行API接口测试 /api/v1/users，响应时间超标", input: '{"endpoint":"/api/v1/users","method":"GET"}', output: '{"status":200,"latency":"3.2s","threshold":"2s"}', status: "warning", ip: "-", device: "AI Agent" },
  { id: 1015, time: "2025-07-21T09:58:44.456Z", operator: "admin", operator_type: "user", action: "手动触发", module: "去AI味配置", detail: "测试「测试报告降重策略」效果", input: '{"style_id":"deai-1","text":"值得注意的是..."}', output: '{"output":"本次测试分析显示...","score":92}', status: "success", ip: "192.168.1.100", device: "Chrome 125.0 / macOS" },
]

const PAGE_SIZE = 10

export default function OperationLogs() {
  const [logs] = useState<any[]>(mockLogs)
  const [search, setSearch] = useState("")
  const [filterLevel, setFilterLevel] = useState<string>("all")
  const [filterModule, setFilterModule] = useState<string>("all")
  const [filterOperator, setFilterOperator] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<any>(null)

  // 获取所有模块
  const modules = useMemo(() => [...new Set(logs.map((l) => l.module))], [logs])
  const operators = useMemo(() => [...new Set(logs.map((l) => l.operator))], [logs])

  // 筛选
  const filtered = logs.filter((l) => {
    const matchSearch = !search || l.detail.toLowerCase().includes(search.toLowerCase()) || l.operator.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase())
    const matchLevel = filterLevel === "all" || l.status === filterLevel
    const matchModule = filterModule === "all" || l.module === filterModule
    const matchOperator = filterOperator === "all" || l.operator === filterOperator
    return matchSearch && matchLevel && matchModule && matchOperator
  })

  // 分页
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // 统计
  const infoCount = logs.filter((l) => l.status === "success").length
  const warnCount = logs.filter((l) => l.status === "warning").length
  const errorCount = logs.filter((l) => l.status === "error").length

  const handleExport = () => {
    const csv = filtered.map((l) => `${l.id},${l.time},${l.operator},${l.action},${l.module},${l.detail},${l.status}`).join("\n")
    const blob = new Blob([`ID,时间,操作者,操作类型,模块,详情,状态\n${csv}`], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `operation-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success("日志导出成功")
  }

  const getLevelInfo = (status: string) => {
    if (status === "success") return LOG_LEVELS[0]
    if (status === "warning") return LOG_LEVELS[1]
    if (status === "error") return LOG_LEVELS[2]
    return LOG_LEVELS[3]
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink">操作日志</h2>
        <p className="text-xs text-muted mt-0.5">全量操作审计 · 用户+AI双轨追踪 · 多维度筛选 · 时间倒序</p>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-ink">{logs.length}</p><p className="text-[11px] text-muted">日志总数</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-pass">{infoCount}</p><p className="text-[11px] text-muted">成功</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-warn">{warnCount}</p><p className="text-[11px] text-muted">警告</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-fail">{errorCount}</p><p className="text-[11px] text-muted">错误</p></div>
        <div className="bg-white rounded-xl border border-border shadow-card p-3 text-center"><p className="text-xl font-bold text-info">{logs.filter((l) => l.operator_type === "ai").length}</p><p className="text-[11px] text-muted">AI操作</p></div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center mb-3 gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="搜索详情/操作者/操作类型..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none" />
        </div>
        <select value={filterLevel} onChange={(e) => { setFilterLevel(e.target.value); setPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
          <option value="all">全部状态</option>
          <option value="success">成功</option>
          <option value="warning">警告</option>
          <option value="error">错误</option>
        </select>
        <select value={filterModule} onChange={(e) => { setFilterModule(e.target.value); setPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
          <option value="all">全部模块</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterOperator} onChange={(e) => { setFilterOperator(e.target.value); setPage(1) }} className="h-9 px-3 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none">
          <option value="all">全部操作者</option>
          {operators.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <button onClick={handleExport} className="h-9 px-3 rounded-xl border border-border text-sm text-ink-light hover:bg-cream flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 导出</button>
      </div>

      {/* 日志表格 */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream/30 border-b border-border">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-16">ID</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-40">时间</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-16">状态</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-28">操作者</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-24">操作类型</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-28">模块</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink">详情</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-ink w-12"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted"><ScrollText className="w-8 h-8 mx-auto mb-2 text-muted-light" /><p className="text-sm">暂无日志</p></td></tr>
              ) : paginated.map((l) => {
                const levelInfo = getLevelInfo(l.status)
                const LevelIcon = levelInfo.icon
                return (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-cream/20 transition-colors">
                    <td className="px-4 py-2.5 text-[11px] text-muted font-mono">#{l.id}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink font-mono">{new Date(l.time).toLocaleString("zh-CN")}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${levelInfo.color}`}>
                        <LevelIcon className="w-3 h-3" /> {l.status === "success" ? "成功" : l.status === "warning" ? "警告" : "错误"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1 text-[11px] text-ink">
                        {l.operator_type === "ai" ? <Bot className="w-3 h-3 text-amber" /> : <User className="w-3 h-3 text-muted" />}
                        <span className="truncate max-w-[100px]">{l.operator}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-ink">{l.action}</td>
                    <td className="px-4 py-2.5 text-[11px] text-muted">{l.module}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink-light max-w-[300px] truncate">{l.detail}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => setSelectedLog(l)} className="p-1 rounded hover:bg-cream transition-colors"><Eye className="w-3.5 h-3.5 text-muted" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted">共 {filtered.length} 条记录，第 {page}/{totalPages} 页</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="h-8 px-2 rounded-lg border border-border text-xs text-ink-light hover:bg-cream disabled:opacity-50"><ChevronLeft className="w-3.5 h-3.5" /></button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 rounded-lg text-xs font-medium ${page === p ? "gradient-amber text-white" : "border border-border text-ink-light hover:bg-cream"}`}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="h-8 px-2 rounded-lg border border-border text-xs text-ink-light hover:bg-cream disabled:opacity-50"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[640px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2"><ScrollText className="w-4 h-4 text-amber" /> 日志详情 — #{selectedLog.id}</h3>
              <button onClick={() => setSelectedLog(null)} className="p-1.5 rounded-lg hover:bg-cream"><X className="w-4 h-4 text-muted" /></button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { label: "日志ID", value: `#${selectedLog.id}` },
                    { label: "时间", value: new Date(selectedLog.time).toLocaleString("zh-CN") },
                    { label: "操作者", value: selectedLog.operator },
                    { label: "操作者类型", value: selectedLog.operator_type === "ai" ? "AI Agent" : "用户" },
                    { label: "操作类型", value: selectedLog.action },
                    { label: "模块", value: selectedLog.module },
                    { label: "状态", value: selectedLog.status === "success" ? "成功" : selectedLog.status === "warning" ? "警告" : "错误" },
                    { label: "详情", value: selectedLog.detail },
                    { label: "IP地址", value: selectedLog.ip },
                    { label: "设备信息", value: selectedLog.device },
                    { label: "输入参数", value: selectedLog.input },
                    { label: "输出结果", value: selectedLog.output },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-2.5 text-xs text-muted w-24">{row.label}</td>
                      <td className="py-2.5 text-xs text-ink font-mono break-all">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
