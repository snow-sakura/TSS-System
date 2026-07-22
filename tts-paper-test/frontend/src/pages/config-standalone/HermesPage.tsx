/**
 * Hermes配置 - 独立页面
 */
import { memo } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Key } from "lucide-react"
import HermesConfigContent from "../system-management/pages/HermesConfig"

function HermesPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group"><ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" /><span className="text-xs font-medium text-ink-light group-hover:text-ink transition-colors hidden sm:block">返回</span></button>
          <div className="h-8 w-px bg-border/60" />
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md flex-shrink-0"><Key className="w-4.5 h-4.5 text-white" /></div>
          <div className="min-w-0"><h1 className="text-sm font-bold text-ink truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Hermes配置</h1><p className="text-[11px] text-muted truncate">多平台消息网关</p></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-cream/30"><HermesConfigContent /></div>
    </div>
  )
}
export default memo(HermesPage)
