/**
 * MCP 市场 — 发现、浏览和安装 MCP 服务
 */
import { useState, useEffect, useCallback } from "react"
import { mcpMarketApi } from "@/lib/api"
import {
  Search, Download, Star, Cpu, Globe, Database,
  FileText, GitBranch, MessageSquare, ExternalLink,
  CheckCircle, Loader2, ChevronLeft, X, Zap, Tag
} from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

const ICON_MAP: Record<string, any> = {
  Browser: Globe,
  FileText,
  Database,
  GitBranch,
  Github: Globe,
  MessageSquare,
}

const CATEGORY_COLORS: Record<string, string> = {
  "浏览器自动化": "from-sky-500 to-cyan-600",
  "文件操作": "from-amber-500 to-orange-600",
  "数据存储": "from-violet-500 to-purple-600",
  "开发工具": "from-emerald-500 to-green-600",
  "消息通知": "from-pink-500 to-rose-600",
}

interface MCPService {
  id: string
  name: string
  version: string
  publisher: string
  description: string
  long_description?: string
  category: string
  tags: string[]
  install_url: string
  default_url: string
  transport: string
  icon: string
  install_guide: string
  tools: { name: string; description: string }[]
  downloads: number
  rating: number
}

export default function MCPMarketplacePage() {
  const navigate = useNavigate()
  const [services, setServices] = useState<MCPService[]>([])
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("")
  const [selectedService, setSelectedService] = useState<MCPService | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {}
      if (activeCategory) params.category = activeCategory
      if (search.trim()) params.search = search.trim()

      const res: any = await mcpMarketApi.listServices(params)
      setServices(Array.isArray(res) ? res : res?.data || [])
    } catch (err) {
      console.error("获取市场列表失败:", err)
    } finally {
      setLoading(false)
    }
  }, [activeCategory, search])

  const fetchCategories = useCallback(async () => {
    try {
      const res: any = await mcpMarketApi.listCategories()
      setCategories(Array.isArray(res) ? res : res?.data || [])
    } catch (err) {
      console.error("获取分类失败:", err)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  const handleInstall = async (svc: MCPService) => {
    setInstalling(svc.id)
    try {
      const res: any = await mcpMarketApi.installService({
        marketplace_id: svc.id,
        url: svc.default_url,
      })
      toast.success(res?.message || `「${svc.name}」安装成功`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || "安装失败")
    } finally {
      setInstalling(null)
    }
  }

  const ServiceCard = ({ svc }: { svc: MCPService }) => {
    const IconComp = ICON_MAP[svc.icon] || Cpu
    const catColor = CATEGORY_COLORS[svc.category] || "from-gray-500 to-gray-600"

    return (
      <div
        className="bg-white rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all cursor-pointer group overflow-hidden"
        onClick={() => setSelectedService(svc)}
      >
        {/* 头部 */}
        <div className="p-4 pb-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${catColor} flex items-center justify-center shadow-sm shrink-0`}>
              <IconComp className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink truncate">{svc.name}</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cream text-muted font-mono shrink-0">v{svc.version}</span>
              </div>
              <p className="text-[11px] text-muted">{svc.publisher}</p>
            </div>
          </div>
          <p className="text-xs text-ink/70 mt-2 line-clamp-2">{svc.description}</p>
        </div>

        {/* 底部 */}
        <div className="px-4 py-2.5 border-t border-border/50 bg-cream/30 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {(svc.downloads / 1000).toFixed(1)}k
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber" fill="currentColor" />
              {svc.rating}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleInstall(svc) }}
            disabled={installing === svc.id}
            className="px-3 h-7 rounded-lg text-[11px] font-medium bg-white border border-border text-ink-light hover:bg-amber hover:text-white hover:border-amber transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {installing === svc.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            安装
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* 顶部 */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group">
            <ChevronLeft className="w-4 h-4 text-ink-light group-hover:text-ink" />
            <span className="text-xs font-medium text-ink-light group-hover:text-ink hidden sm:block">返回</span>
          </button>
          <div className="h-8 w-px bg-border/60" />
          <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>MCP 市场</h1>
            <p className="text-[11px] text-muted truncate">发现和安装 AI 工具与服务</p>
          </div>
        </div>
      </div>

      {/* 主体 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          {/* 搜索和分类 */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索 MCP 服务..."
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-border text-sm text-ink bg-white focus:border-amber outline-none"
              />
            </div>
          </div>

          {/* 分类标签 */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveCategory("")}
              className={`px-3 h-8 rounded-xl text-xs font-medium transition-colors ${
                !activeCategory ? "bg-amber text-white shadow-sm" : "bg-white border border-border text-ink-light hover:border-amber"
              }`}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(activeCategory === cat.name ? "" : cat.name)}
                className={`px-3 h-8 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeCategory === cat.name ? "bg-amber text-white shadow-sm" : "bg-white border border-border text-ink-light hover:border-amber"
                }`}
              >
                <Tag className="w-3 h-3" />
                {cat.name}
                <span className="text-[10px] opacity-70">({cat.count})</span>
              </button>
            ))}
          </div>

          {/* 服务列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-amber" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-20">
              <Cpu className="w-12 h-12 mx-auto mb-3 text-muted opacity-50" />
              <p className="text-sm text-muted">暂无匹配的服务</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((svc) => (
                <ServiceCard key={svc.id} svc={svc} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 服务详情弹窗 */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedService(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-[640px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${CATEGORY_COLORS[selectedService.category] || "from-gray-500 to-gray-600"} flex items-center justify-center`}>
                  {(() => { const Icon = ICON_MAP[selectedService.icon] || Cpu; return <Icon className="w-5 h-5 text-white" />; })()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{selectedService.name}</h3>
                  <p className="text-xs text-muted">{selectedService.publisher} · v{selectedService.version}</p>
                </div>
              </div>
              <button onClick={() => setSelectedService(null)} className="p-1.5 rounded-lg hover:bg-cream text-ink-light hover:text-ink"><X className="w-4 h-4" /></button>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* 统计 */}
              <div className="flex gap-4">
                <div className="flex items-center gap-1 text-xs text-muted"><Download className="w-3.5 h-3.5" /> {(selectedService.downloads / 1000).toFixed(1)}k 下载</div>
                <div className="flex items-center gap-1 text-xs text-muted"><Star className="w-3.5 h-3.5 text-amber" fill="currentColor" /> {selectedService.rating} 评分</div>
                <div className="flex items-center gap-1 text-xs text-muted"><Zap className="w-3.5 h-3.5" /> {selectedService.transport.toUpperCase()} 传输</div>
              </div>

              {/* 描述 */}
              <div>
                <h4 className="text-xs font-semibold text-ink mb-1">描述</h4>
                <div className="text-xs text-ink/70 leading-relaxed whitespace-pre-wrap">{selectedService.long_description || selectedService.description}</div>
              </div>

              {/* 标签 */}
              <div className="flex flex-wrap gap-1.5">
                {selectedService.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] rounded bg-cream text-muted">{tag}</span>
                ))}
              </div>

              {/* 工具列表 */}
              <div>
                <h4 className="text-xs font-semibold text-ink mb-2">可用工具 ({selectedService.tools.length})</h4>
                <div className="space-y-1.5">
                  {selectedService.tools.map((tool, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-cream/50">
                      <Zap className="w-3.5 h-3.5 text-amber shrink-0" />
                      <div>
                        <span className="text-[11px] font-mono font-medium text-ink">{tool.name}</span>
                        <p className="text-[10px] text-muted">{tool.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 安装指南 */}
              <div>
                <h4 className="text-xs font-semibold text-ink mb-2">安装指南</h4>
                <div className="bg-[#1a1a2e] rounded-xl p-3">
                  <code className="text-[11px] text-emerald-300 font-mono whitespace-pre-wrap">{selectedService.install_guide}</code>
                </div>
              </div>
            </div>

            {/* 底部操作 */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
              <p className="text-[11px] text-muted">安装后可在 MCP 服务配置中管理</p>
              <div className="flex gap-2">
                <button onClick={() => setSelectedService(null)} className="h-9 px-4 rounded-xl border border-border text-sm text-ink-light hover:bg-cream">取消</button>
                <button
                  onClick={() => { handleInstall(selectedService); setSelectedService(null) }}
                  disabled={installing === selectedService.id}
                  className="h-9 px-5 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {installing === selectedService.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  安装到本机
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
