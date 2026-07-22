import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { authApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FlaskConical, Loader2, Eye, EyeOff, Zap, Bot, Shield, Clock } from "lucide-react"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loginMode, setLoginMode] = useState<"password" | "sms">("password")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      const res: any = await authApi.login({ username, password })
      login(res.data.user, res.data.access_token, res.data.refresh_token)
      navigate("/")
    } catch (err: any) { setError(err.detail || "登录失败，请稍后重试") }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex">
      {/* 左侧品牌展示 */}
      <div className="hidden lg:flex lg:w-[55%] gradient-brand relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-amber/15 rounded-full blur-3xl" />
          <div className="absolute bottom-32 right-16 w-96 h-96 bg-amber/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center shadow-lg">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg tracking-wide">TSS AI测试平台</span>
          </div>
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <h1 className="text-5xl font-bold text-white leading-tight mb-6" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              AI 驱动的<br /><span className="text-amber">智能测试</span><br />新范式
            </h1>
            <p className="text-lg text-white/60 leading-relaxed mb-10">
              一站式搞定：AI 需求分析、用例生成与评审、Web自动化、缺陷管理与质量报告。
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Bot, title: "AI用例生成", desc: "自动解析需求，生成结构化用例" },
                { icon: Zap, title: "全栈自动化", desc: "API + Web UI 一体化管理" },
                { icon: Shield, title: "企业级安全", desc: "JWT双Token、权限控制" },
                { icon: Clock, title: "实时追踪", desc: "执行进度、缺陷趋势一目了然" },
              ].map((f) => (
                <div key={f.title} className="p-4 rounded-xl bg-white/8 border border-white/10 hover:bg-white/12 transition-colors backdrop-blur-sm">
                  <f.icon className="w-5 h-5 text-amber mb-2" />
                  <p className="text-sm font-medium text-white">{f.title}</p>
                  <p className="text-xs text-white/50 mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="text-sm text-white/30">© 2026 TSS AI测试平台 · 基于多智能体的软件测试解决方案</div>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="flex-1 flex items-center justify-center p-8 bg-paper">
        <div className="w-full max-w-[400px] animate-fade-in-up">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center shadow-lg">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <span className="text-ink font-semibold text-lg">TSS AI测试平台</span>
          </div>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>登录 TSS</h2>
            <p className="text-sm text-ink-light mt-1.5">登录以解锁完整内容</p>
          </div>
          <div className="flex bg-cream rounded-xl p-1 mb-6">
            {(["password", "sms"] as const).map((mode) => (
              <button key={mode} onClick={() => setLoginMode(mode)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  loginMode === mode ? "bg-white text-amber shadow-sm" : "text-ink-light hover:text-ink"
                }`}>
                {mode === "password" ? "密码登录" : "验证码登录"}
              </button>
            ))}
          </div>
          {error && <div className="mb-4 rounded-lg bg-fail-light border border-fail/20 px-4 py-2.5 text-sm text-fail">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                <Input placeholder="请输入用户名" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-12 pl-10 bg-white border-border focus:border-amber focus:ring-amber/20" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
                <Input type={showPassword ? "text" : "password"} placeholder="请输入密码" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 pl-10 pr-10 bg-white border-border focus:border-amber focus:ring-amber/20" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink-light">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded border-border text-amber focus:ring-amber" defaultChecked />
              <span className="text-sm text-ink-light">我已阅读并同意 <a href="#" className="text-amber hover:text-amber-hover font-medium">《用户隐私协议》</a></span>
            </div>
            <Button type="submit" className="w-full h-12 gradient-amber text-white font-medium text-base hover:opacity-90 shadow-lg shadow-amber/25" disabled={loading}>
              {loading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 登录中...</span> : "登 录"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <span className="text-sm text-ink-light">没有账号?</span>
            <Link to="/register" className="text-sm font-medium text-amber hover:text-amber-hover ml-1">立即注册</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
