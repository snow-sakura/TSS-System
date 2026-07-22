/**
 * EngineSelector — AI 测试引擎选择器
 *
 * 显示当前引擎、可用引擎列表，支持切换引擎类型。
 * 提供健康检查状态指示。
 */
import { useState, useEffect, useCallback } from "react"
import { lifecycleApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Cpu, CheckCircle, XCircle, Loader2, RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

interface EngineInfo {
  type: string
  available: boolean
  is_default: boolean
  error?: string
}

const ENGINE_LABELS: Record<string, string> = {
  mock: "模拟引擎",
  midscene: "Midscene.js",
  playwright_mcp: "Playwright MCP",
  browser_use: "Browser Use",
  ui_tars: "UI-TARS",
}

const ENGINE_DESCS: Record<string, string> = {
  mock: "随机通过/失败，用于开发测试",
  midscene: "视觉 AI 引擎，基于 @midscene/web",
  playwright_mcp: "MCP 协议引擎，浏览器自动化",
}

export default function EngineSelector() {
  const [engines, setEngines] = useState<EngineInfo[]>([])
  const [current, setCurrent] = useState<string>("mock")
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)

  const fetchEngines = useCallback(async () => {
    setLoading(true)
    try {
      const res = await lifecycleApi.getEngineList()
      const list: EngineInfo[] = Array.isArray(res) ? res : []
      setEngines(list)

      const currentEngine = list.find((e) => e.is_default)
      if (currentEngine) setCurrent(currentEngine.type)
    } catch (err) {
      console.error("获取引擎列表失败:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEngines()
  }, [fetchEngines])

  const handleSwitch = async (type: string) => {
    setSwitching(type)
    try {
      const res = await lifecycleApi.switchEngine(type)
      setCurrent(type)
      toast.success(`已切换到 ${ENGINE_LABELS[type] || type}`)
      await fetchEngines()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || "切换失败")
    } finally {
      setSwitching(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-border shadow-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载引擎列表...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-border shadow-card">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-ink-light" />
          <h3 className="text-sm font-semibold text-ink">AI 测试引擎</h3>
        </div>
        <button
          onClick={fetchEngines}
          className="p-1.5 rounded-lg hover:bg-cream transition-colors"
          title="刷新"
        >
          <RefreshCw className="w-3.5 h-3.5 text-muted" />
        </button>
      </div>

      {/* 引擎列表 */}
      <div className="p-3 space-y-2">
        {engines.map((engine) => {
          const isCurrent = engine.type === current
          const label = ENGINE_LABELS[engine.type] || engine.type
          const desc = ENGINE_DESCS[engine.type] || ""

          return (
            <div
              key={engine.type}
              className={`relative rounded-xl border p-3 transition-all ${
                isCurrent
                  ? "border-amber bg-amber/5 shadow-sm"
                  : "border-border hover:border-amber/40 hover:bg-cream/30"
              }`}
            >
              {/* 状态指示器 */}
              <div className="absolute top-3 right-3">
                {engine.available ? (
                  <CheckCircle className="w-4 h-4 text-pass" />
                ) : (
                  <XCircle className="w-4 h-4 text-fail" />
                )}
              </div>

              {/* 引擎信息 */}
              <div className="pr-8">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{label}</span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber text-white rounded-full">
                      当前
                    </span>
                  )}
                </div>
                {desc && (
                  <p className="text-xs text-muted mt-0.5">{desc}</p>
                )}
                {engine.error && (
                  <p className="text-[11px] text-fail mt-1">{engine.error}</p>
                )}
              </div>

              {/* 切换按钮 */}
              {!isCurrent && (
                <Button
                  onClick={() => handleSwitch(engine.type)}
                  disabled={switching === engine.type}
                  className="mt-2 h-7 px-3 text-[11px] bg-white border border-border text-ink hover:bg-cream hover:border-amber/50"
                >
                  {switching === engine.type ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : null}
                  切换
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {engines.length === 0 && (
        <div className="p-6 text-center text-sm text-muted">
          <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
          暂无可用引擎
        </div>
      )}
    </div>
  )
}
