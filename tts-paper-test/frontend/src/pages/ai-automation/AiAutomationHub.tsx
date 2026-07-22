/**
 * AI自动化测试中心 — 卡片式入口
 * 展示8种测试类型，点击进入对应详情页
 */
import { memo } from "react"
import { useNavigate } from "react-router-dom"
import {
  Zap, Smartphone, Gauge, Shield, Layers, RefreshCw, Compass, Globe,
  ArrowLeft, Sparkles, ArrowRight
} from "lucide-react"
import { TEST_TYPES } from "./test-types"

const iconMap: Record<string, any> = {
  Zap, Smartphone, Gauge, Shield, Layers, RefreshCw, Compass, Globe,
}

function AiAutomationHub() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-paper">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center gap-4 shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group">
          <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
          <span className="text-xs font-medium text-ink-light group-hover:text-ink hidden sm:block">返回</span>
        </button>
        <div className="h-8 w-px bg-border/60" />
        <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center shadow-md">
          <Sparkles className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>AI 自动化测试中心</h1>
          <p className="text-[11px] text-muted">选择测试类型，AI智能驱动全流程自动化</p>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* 概览统计 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "测试类型", value: TEST_TYPES.length, color: "text-ink" },
            { label: "AI驱动", value: "100%", color: "text-pass" },
            { label: "自动化率", value: "95%", color: "text-info" },
            { label: "支持平台", value: "全端", color: "text-amber" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-border shadow-card p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 测试类型卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEST_TYPES.map((type) => {
            const Icon = iconMap[type.icon] || Zap
            return (
              <div
                key={type.id}
                onClick={() => navigate(`/ai-automation/${type.id}`)}
                className="bg-white rounded-2xl border border-border shadow-card hover:shadow-card-hover transition-all cursor-pointer group overflow-hidden"
              >
                {/* 顶部渐变条 */}
                <div className={`h-1.5 bg-gradient-to-r ${type.gradient}`} />

                <div className="p-5">
                  {/* 图标 + 标题 */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${type.gradient} flex items-center justify-center shadow-md flex-shrink-0 group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-ink group-hover:text-amber transition-colors">{type.name}</h3>
                      <p className="text-[10px] text-muted font-mono">{type.subtitle}</p>
                    </div>
                  </div>

                  {/* 描述 */}
                  <p className="text-xs text-ink-light leading-relaxed mb-3 line-clamp-2">{type.description}</p>

                  {/* 标签 */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {type.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-cream text-muted">{tag}</span>
                    ))}
                  </div>

                  {/* 流程预览 */}
                  <div className="flex items-center gap-1 text-[10px] text-muted overflow-hidden">
                    {type.workflow.slice(0, 3).map((step, i) => (
                      <span key={i} className="flex items-center gap-1 whitespace-nowrap">
                        {i > 0 && <span className="text-border">→</span>}
                        <span>{step}</span>
                      </span>
                    ))}
                    {type.workflow.length > 3 && <span className="text-muted-light">+{type.workflow.length - 3}</span>}
                  </div>
                </div>

                {/* 底部进入按钮 */}
                <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                  <span className="text-[10px] text-muted">{type.menuItems.length} 个功能模块</span>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-amber opacity-0 group-hover:opacity-100 transition-opacity">
                    进入 <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default memo(AiAutomationHub)
