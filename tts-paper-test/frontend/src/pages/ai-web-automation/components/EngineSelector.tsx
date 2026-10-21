/**
 * EngineSelector — AI 测试引擎选择器
 *
 * 显示当前引擎、可用引擎列表，支持切换引擎类型。
 * 提供健康检查状态指示和详细说明。
 * 支持 5 种引擎：Mock / Midscene.js / Playwright MCP / Browser Use / UI-TARS
 */
import { useState, useEffect, useCallback } from "react"
import { lifecycleApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Cpu, CheckCircle, XCircle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Sparkles, Bot, Globe, Monitor, Beaker,
} from "lucide-react"
import { toast } from "sonner"

interface EngineInfo {
  type: string
  available: boolean
  is_default: boolean
  error?: string
}

const ENGINE_META: Record<string, { label: string; desc: string; icon: any; color: string; badge: string }> = {
  midscene: {
    label: "Midscene.js",
    desc: "纯视觉 AI 引擎，基于截图驱动。支持 Web/移动端/PC，无需 DOM 选择器，自然语言交互。开源 MIT 许可。",
    icon: Sparkles,
    color: "from-violet-500 to-purple-600",
    badge: "视觉驱动",
  },
  playwright_mcp: {
    label: "Playwright MCP",
    desc: "Accessibility Tree 引擎，微软官方 MCP 协议。结构化语义交互，Token 高效，确定性强，适合 CI/CD。",
    icon: Bot,
    color: "from-green-500 to-emerald-600",
    badge: "树结构",
  },
  browser_use: {
    label: "Browser Use",
    desc: "Python AI Agent 引擎，Odysseys 榜一（87.4%）。AI 像人一样用浏览器，支持复杂长任务。开源 MIT。",
    icon: Globe,
    color: "from-sky-500 to-blue-600",
    badge: "Python Agent",
  },
  ui_tars: {
    label: "UI-TARS",
    desc: "字节跳动开源多模态 GUI Agent。支持本地桌面操作，VLM 驱动，隐私安全。Apache 2.0 许可。",
    icon: Monitor,
    color: "from-rose-500 to-pink-600",
    badge: "桌面 Agent",
  },
  mock: {
    label: "模拟引擎",
    desc: "随机通过/失败，用于开发测试和 UI 验证。不依赖任何外部服务。",
    icon: Beaker,
    color: "from-gray-400 to-gray-500",
    badge: "测试用",
  },
}

export default function EngineSelector() {
  const [engines, setEngines] = useState<EngineInfo[]>([])
  const [current, setCurrent] = useState<string>("mock")
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const fetchEngines = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await lifecycleApi.getEngineList()
      const list: EngineInfo[] = Array.isArray(res) ? res : (res?.data || [])
      setEngines(list)
      const currentEngine = list.find((e) => e.is_default)
      if (currentEngine) setCurrent(currentEngine.type)
    } catch {
      toast.error("无法获取引擎列表，请检查服务端连接")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEngines() }, [fetchEngines])

  const handleSwitch = async (type: string) => {
    setSwitching(type)
    try {
      const res: any = await lifecycleApi.switchEngine(type)
      const label = ENGINE_META[type]?.label || type
      toast.success(`已切换到 ${label}`)
      setCurrent(type)
      await fetchEngines()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || "切换失败")
    } finally {
      setSwitching(null)
    }
  }

  const currentEngine = engines.find((e) => e.type === current)
  const currentMeta = ENGINE_META[current]
  const CurrentIcon = currentMeta?.icon || Cpu

  return (
    <div className="relative h-[52px] bg-white rounded-2xl border border-border shadow-card flex items-center px-3 gap-2 cursor-pointer hover:bg-cream/40 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      {/* 当前引擎胶囊 */}
      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${currentMeta?.color || "from-gray-400 to-gray-500"} flex items-center justify-center shadow-sm flex-shrink-0`}>
        <CurrentIcon className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-muted leading-none">引擎</span>
          <span className="text-xs font-semibold text-amber truncate max-w-[92px] leading-none">{currentMeta?.label || current}</span>
        </div>
        <p className="text-[9px] text-muted/70 mt-0.5 leading-none">
          {currentEngine?.available ? "可用" : "不可用"} · 点击切换
        </p>
      </div>
      <div className="flex items-center gap-1 ml-auto flex-shrink-0">
        {currentEngine?.available
          ? <span className="w-2 h-2 rounded-full bg-pass" title="引擎可用" />
          : <span className="w-2 h-2 rounded-full bg-fail" title="引擎不可用" />
        }
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-muted" />}
      </div>

      {/* 弹出层 */}
      {expanded && (
        <div className="absolute right-0 top-[54px] w-[300px] bg-white rounded-2xl border border-border shadow-elevated z-50 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]"
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-amber" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted font-medium">可用引擎 ({engines.length})</span>
                <button onClick={fetchEngines} className="p-1.5 rounded-lg hover:bg-cream transition-colors" title="刷新">
                  <RefreshCw className="w-3.5 h-3.5 text-muted" />
                </button>
              </div>
              <div className="space-y-2">
                {engines.map((engine) => {
                  const meta = ENGINE_META[engine.type]
                  const Icon = meta?.icon || Cpu
                  const isCurrent = engine.type === current

                  return (
                    <div
                      key={engine.type}
                      className={`rounded-xl border p-2.5 transition-all ${
                        isCurrent
                          ? "border-amber bg-amber/5 shadow-sm ring-1 ring-amber/20"
                          : "border-border hover:border-amber/40 hover:bg-cream/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${meta?.color || "from-gray-400 to-gray-500"} flex items-center justify-center shadow-sm flex-shrink-0`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-ink">{meta?.label || engine.type}</span>
                            {meta?.badge && (
                              <span className="px-1.5 py-0.5 text-[9px] font-medium bg-cream text-muted rounded-full">{meta.badge}</span>
                            )}
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 text-[9px] font-medium bg-amber text-white rounded-full">当前</span>
                            )}
                          </div>
                          {meta?.desc && (
                            <p className="text-[10px] text-muted mt-0.5 leading-relaxed line-clamp-2">{meta.desc}</p>
                          )}
                          {engine.error && (
                            <p className="text-[10px] text-fail mt-1 bg-fail/5 px-1.5 py-0.5 rounded-md line-clamp-1">{engine.error}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          {engine.available
                            ? <CheckCircle className="w-3.5 h-3.5 text-pass" aria-label="可用" />
                            : <XCircle className="w-3.5 h-3.5 text-fail" aria-label="不可用" />
                          }
                          {!isCurrent && (
                            <Button
                              onClick={() => handleSwitch(engine.type)}
                              disabled={switching === engine.type || !engine.available}
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                            >
                              {switching === engine.type ? (
                                <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
                              ) : null}
                              切换
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {engines.length === 0 && (
                <div className="p-4 text-center text-sm text-muted">
                  <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  暂无可用引擎
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
