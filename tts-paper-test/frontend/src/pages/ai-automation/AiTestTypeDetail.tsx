/**
 * AI测试类型详情页 — 通用组件
 * 根据URL参数加载对应的测试类型配置，渲染侧边栏和内容区
 */
import { useMemo, memo } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeft, Zap, Smartphone, Gauge, Shield, Layers, RefreshCw, Compass, Globe,
  Settings, Play, BarChart3, FileText, FlaskConical, Target, List, Image,
  AlertTriangle, Search, Bot, Activity, ShieldCheck, Scan, Bug, Grid3X3,
  GitCompare, GitBranch, FolderOpen
} from "lucide-react"
import { TEST_TYPES, type TestType } from "./test-types"
import { ALL_PAGE_CONFIGS } from "./page-configs"
import Sidebar from "../requirement-testing/components/Sidebar"
import type { SidebarItem } from "../requirement-testing/components/Sidebar"
import GenericTestPage from "./components/GenericTestPage"

const iconMap: Record<string, any> = {
  Zap, Smartphone, Gauge, Shield, Layers, RefreshCw, Compass, Globe,
  Settings, Play, BarChart3, FileText, FlaskConical, Target, List, Image,
  AlertTriangle, Search, Bot, Activity, ShieldCheck, Scan, Bug, Grid3X3,
  GitCompare, GitBranch, FolderOpen,
}

function TypeWelcome({ testType }: { testType: TestType }) {
  const Icon = iconMap[testType.icon] || Zap
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${testType.gradient} flex items-center justify-center shadow-lg mb-4`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-lg font-bold text-ink mb-2" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{testType.name}</h2>
      <p className="text-sm text-ink-light max-w-md mb-6">{testType.description}</p>
      <div className="w-full max-w-2xl">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">测试流程</h3>
        <div className="flex items-center justify-center gap-1 flex-wrap">
          {testType.workflow.map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="px-3 py-1.5 rounded-lg bg-cream border border-border text-xs text-ink font-medium">{step}</div>
              {i < testType.workflow.length - 1 && <span className="text-muted text-xs">→</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-6">
        {testType.tags.map((tag) => (
          <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-cream border border-border text-ink-light">{tag}</span>
        ))}
      </div>
    </div>
  )
}

function AiTestTypeDetail() {
  const navigate = useNavigate()
  const { typeId } = useParams<{ typeId: string }>()
  const [searchParams] = useSearchParams()
  const activeMenu = searchParams.get("menu") || ""

  const testType = useMemo(() => TEST_TYPES.find((t) => t.id === typeId), [typeId])

  const pageConfig = useMemo(() => {
    if (!typeId || !activeMenu) return null
    const typeConfigs = ALL_PAGE_CONFIGS[typeId]
    if (!typeConfigs) return null
    return typeConfigs[activeMenu] || null
  }, [typeId, activeMenu])

  if (!testType) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted mb-4">未找到该测试类型</p>
          <button onClick={() => navigate("/ai-automation")} className="px-4 py-2 rounded-xl gradient-amber text-white text-sm">返回测试中心</button>
        </div>
      </div>
    )
  }

  const Icon = iconMap[testType.icon] || Zap
  const sidebarItems: SidebarItem[] = testType.menuItems.map((m) => ({
    key: m.key, label: m.label, icon: "requirements",
  }))

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center gap-4 shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate("/ai-automation")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group">
          <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
          <span className="text-xs font-medium text-ink-light group-hover:text-ink hidden sm:block">返回</span>
        </button>
        <div className="h-8 w-px bg-border/60" />
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${testType.gradient} flex items-center justify-center shadow-md`}>
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{testType.name}</h1>
          <p className="text-[11px] text-muted truncate">{testType.subtitle}</p>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40">
          <Sidebar items={sidebarItems} activeKey={activeMenu || testType.menuItems[0]?.key || ""}
            onSelect={(key) => navigate(`/ai-automation/${typeId}?menu=${key}`)} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 bg-cream/30">
          {pageConfig ? (
            <GenericTestPage title={pageConfig.title} subtitle={pageConfig.subtitle}
              columns={pageConfig.columns} data={pageConfig.data} stats={pageConfig.stats}
              actions={pageConfig.actions} searchPlaceholder={`搜索${pageConfig.title}...`} />
          ) : (
            <TypeWelcome testType={testType} />
          )}
        </main>
      </div>
    </div>
  )
}

export default memo(AiTestTypeDetail)
