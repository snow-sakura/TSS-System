import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { authApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FlaskConical, Loader2, Eye, EyeOff, User, Lock } from "lucide-react"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res: any = await authApi.login({ username, password })
      login(res.data.user, res.data.access_token, res.data.refresh_token)
      navigate("/")
    } catch (err: any) {
      setError(err.detail || "登录失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-dvh bg-paper flex items-center justify-center px-4 overflow-auto">
      <div className="w-full max-w-[400px] py-8">
        {/* 品牌头部 */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl gradient-amber flex items-center justify-center shadow-lg shadow-amber/25 shrink-0">
            <FlaskConical className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1
              className="text-xl font-bold text-ink leading-tight"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              TSS AI测试平台
            </h1>
            <p className="text-xs text-ink-light">基于多智能体的软件测试解决方案</p>
          </div>
        </div>

        {/* 登录卡片 */}
        <div className="bg-white rounded-2xl border border-border shadow-lg p-6 animate-fade-in-up">
          {error && (
            <div className="mb-4 rounded-lg bg-fail-light border border-fail/20 px-4 py-2.5 text-sm text-fail">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-11 pl-10 bg-white border-border focus:border-amber focus:ring-amber/20"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 pl-10 pr-10 bg-white border-border focus:border-amber focus:ring-amber/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink-light"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border text-amber focus:ring-amber"
                defaultChecked
              />
              <span className="text-sm text-ink-light">
                我已阅读并同意{" "}
                <a href="#" className="text-amber hover:text-amber-hover font-medium">
                  《用户隐私协议》
                </a>
              </span>
            </div>

            <Button
              type="submit"
              className="w-full h-11 gradient-amber text-white font-medium text-sm hover:opacity-90 shadow-lg shadow-amber/25"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 登录中...
                </span>
              ) : (
                "登 录"
              )}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <span className="text-sm text-ink-light">没有账号?</span>
            <Link to="/register" className="text-sm font-medium text-amber hover:text-amber-hover ml-1">
              立即注册
            </Link>
          </div>
        </div>

        <div className="text-center text-xs text-muted mt-6">© 2026 TSS AI测试平台</div>
      </div>
    </div>
  )
}
