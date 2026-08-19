import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { authApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FlaskConical, Loader2, Eye, EyeOff } from "lucide-react"

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
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        {/* 品牌头部 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-amber flex items-center justify-center shadow-lg shadow-amber/25 mb-4">
            <FlaskConical className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>TSS AI测试平台</h1>
          <p className="text-sm text-ink-light mt-1.5">基于多智能体的软件测试解决方案</p>
        </div>

        {/* 登录卡片 */}
        <div className="bg-white rounded-2xl border border-border shadow-lg p-8 animate-fade-in-up">
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

        <div className="text-center text-sm text-muted mt-8">© 2026 TSS AI测试平台 · 基于多智能体的软件测试解决方案</div>
      </div>
    </div>
  )
}