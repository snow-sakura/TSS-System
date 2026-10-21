/**
 * 数据工厂 — 批量生成测试数据
 * 对标竞品 TestHub 的 data factory：选择生成器 → 批量生成 → 预览 → 历史记录
 * 数据来源：后端 /data-factory（11 个真实中文数据生成器，含校验位）
 */
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft, Database, Play, Trash2, RefreshCw, Sparkles,
} from "lucide-react"
import { dataFactoryApi } from "@/lib/api"

interface GeneratorInfo {
  key: string
  name: string
  description: string
  example: string
  fields?: string[]
}

interface LogItem {
  id: number
  generator: string
  generator_name: string
  count: number
  preview: string[]
  created_at: string
}

const MAX_COUNT = 200

function DataFactoryPage() {
  const navigate = useNavigate()
  const [generators, setGenerators] = useState<GeneratorInfo[]>([])
  const [activeKey, setActiveKey] = useState("")
  const [count, setCount] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [rows, setRows] = useState<string[]>([])
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const loadGenerators = useCallback(async () => {
    try {
      const res: any = await dataFactoryApi.listGenerators()
      const list: GeneratorInfo[] = res?.data ?? []
      setGenerators(list)
      if (list.length > 0 && !activeKey) setActiveKey(list[0].key)
    } catch {
      toast.error("加载生成器列表失败")
    }
  }, [activeKey])

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const res: any = await dataFactoryApi.listLogs({ page: 1, page_size: 20 })
      setLogs(res?.data?.items ?? [])
    } catch {
      toast.error("加载生成历史失败")
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  useEffect(() => {
    loadGenerators()
    loadLogs()
  }, [loadGenerators, loadLogs])

  const active = generators.find((g) => g.key === activeKey)

  const handleGenerate = async () => {
    if (!activeKey) {
      toast.warning("请先选择一个生成器")
      return
    }
    setGenerating(true)
    try {
      const res: any = await dataFactoryApi.generate({ generator: activeKey, count })
      setRows((res?.data?.rows ?? []).map((r: { value: string }) => r.value))
      toast.success(res?.message || "生成成功")
      loadLogs()
    } catch {
      toast.error("生成失败，请重试")
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteLog = async (id: number) => {
    try {
      await dataFactoryApi.deleteLog(id)
      toast.success("记录已删除")
      loadLogs()
    } catch {
      toast.error("删除失败")
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center gap-4 shadow-sm sticky top-0 z-10">
        <button
          onClick={() => navigate("/ai-automation")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group"
        >
          <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
          <span className="text-xs font-medium text-ink-light group-hover:text-ink hidden sm:block">返回</span>
        </button>
        <div className="h-8 w-px bg-border/60" />
        <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md">
          <Database className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>数据工厂</h1>
          <p className="text-[11px] text-muted truncate">生成真实的测试数据：姓名 / 手机号 / 身份证 / 银行卡 ...</p>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          {/* ── 左侧：生成器列表 ── */}
          <div className="bg-white rounded-2xl border border-border shadow-card p-4 h-fit">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber" /> 生成器
              </h2>
              <span className="text-[10px] text-muted">{generators.length} 种</span>
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {generators.map((g) => (
                <button
                  key={g.key}
                  onClick={() => {
                    setActiveKey(g.key)
                    setRows([])
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    g.key === activeKey
                      ? "bg-amber-light/40 border-amber shadow-sm"
                      : "bg-cream/50 border-border/60 hover:border-amber/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${g.key === activeKey ? "text-amber" : "text-ink"}`}>{g.name}</span>
                    <span className="text-[10px] text-muted font-mono">{g.key}</span>
                  </div>
                  <p className="text-[11px] text-ink-light mt-1 leading-relaxed">{g.description}</p>
                  <p className="text-[10px] text-muted font-mono mt-1">例：{g.example}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── 右侧：生成面板 + 预览 + 历史 ── */}
          <div className="space-y-4 min-w-0">
            {/* 生成面板 */}
            <div className="bg-white rounded-2xl border border-border shadow-card p-5">
              <h2 className="text-sm font-bold text-ink mb-4">
                批量生成{active ? `「${active.name}」` : ""}
              </h2>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-[11px] text-muted mb-1.5">生成数量（1 ~ {MAX_COUNT}）</label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_COUNT}
                    value={count}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setCount(Number.isNaN(v) ? 1 : Math.max(1, Math.min(MAX_COUNT, v)))
                    }}
                    className="w-32 px-3 py-2 rounded-xl border border-border bg-cream/50 text-sm text-ink focus:outline-none focus:border-amber"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !activeKey}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-amber text-white text-sm font-medium shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {generating ? "生成中..." : "立即生成"}
                </button>
                <button
                  onClick={loadLogs}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs text-ink-light hover:bg-cream transition-colors"
                >
                  刷新历史
                </button>
              </div>

              {/* 预览结果 */}
              {rows.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-ink">生成结果（已生成 {rows.length} 条）</h3>
                    <button
                      onClick={() => setRows([])}
                      className="text-[10px] text-muted hover:text-fail transition-colors"
                    >
                      清空
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rows.slice(0, 60).map((v, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-cream border border-border text-[11px] font-mono text-ink">
                        {v}
                      </span>
                    ))}
                    {rows.length > 60 && (
                      <span className="px-2.5 py-1 rounded-lg text-[11px] text-muted">+{rows.length - 60} 条...</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 历史记录 */}
            <div className="bg-white rounded-2xl border border-border shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-ink">生成历史</h2>
                {loadingLogs && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted" />}
              </div>
              {logs.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center bg-cream/30 rounded-xl">
                  暂无生成记录，选择左侧生成器开始生成吧
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-left">
                    <thead>
                      <tr className="bg-cream/50 border-b border-border/60">
                        <th className="px-3 py-2.5 text-xs font-semibold text-ink w-[150px] whitespace-nowrap">生成器</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-ink w-[80px] text-center whitespace-nowrap">数量</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-ink whitespace-nowrap">预览</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-ink w-[150px] whitespace-nowrap">时间</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-ink text-right w-[60px] whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-border/40 hover:bg-cream/40 transition-colors">
                          <td className="px-3 py-2.5 text-xs font-medium text-ink truncate min-w-0">{log.generator_name}</td>
                          <td className="px-3 py-2.5 text-xs text-muted text-center">{log.count}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1 max-w-[380px]">
                              {(log.preview ?? []).slice(0, 3).map((p, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-cream border border-border/60 text-[10px] font-mono text-muted truncate max-w-[160px]">
                                  {p}
                                </span>
                              ))}
                              {(log.preview ?? []).length > 3 && (
                                <span className="text-[10px] text-muted">+{(log.preview.length - 3)}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted whitespace-nowrap">{log.created_at}</td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              className="p-1.5 rounded-lg text-muted hover:text-fail hover:bg-fail/10 transition-colors"
                              title="删除记录"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DataFactoryPage