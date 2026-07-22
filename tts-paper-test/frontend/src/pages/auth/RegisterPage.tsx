import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { authApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FlaskConical, Loader2 } from "lucide-react"

export default function RegisterPage() {
  const [form, setForm] = useState({ username: "", email: "", display_name: "", password: "", confirm_password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm_password) { setError("两次密码输入不一致"); return }
    setLoading(true); setError("")
    try { await authApi.register(form); navigate("/login") }
    catch (err: any) { setError(err.detail || "注册失败") }
    finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[55%] gradient-brand relative overflow-hidden">
        <div className="absolute inset-0"><div className="absolute top-20 left-20 w-72 h-72 bg-amber/15 rounded-full blur-3xl" /><div className="absolute bottom-32 right-16 w-96 h-96 bg-amber/10 rounded-full blur-3xl" /></div>
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center shadow-lg"><FlaskConical className="w-5 h-5 text-white" /></div><span className="text-white font-semibold text-lg tracking-wide">TSS AI测试平台</span></div>
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <h1 className="text-5xl font-bold text-white leading-tight mb-6" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>加入<br /><span className="text-amber">AI测试</span><br />新时代</h1>
            <p className="text-lg text-white/60 leading-relaxed">注册账号即可体验基于多智能体的AI软件测试平台。</p>
          </div>
          <div className="text-sm text-white/30">© 2026 TSS AI测试平台</div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8 bg-paper">
        <div className="w-full max-w-[400px] animate-fade-in-up">
          <div className="lg:hidden flex items-center gap-3 mb-10"><div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center shadow-lg"><FlaskConical className="w-5 h-5 text-white" /></div><span className="text-ink font-semibold text-lg">TSS AI测试平台</span></div>
          <div className="mb-8"><h2 className="text-2xl font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>注册</h2><p className="text-sm text-ink-light mt-1.5">创建你的账号</p></div>
          {error && <div className="mb-4 rounded-lg bg-fail-light border border-fail/20 px-4 py-2.5 text-sm text-fail">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><label className="text-sm font-medium text-ink">用户名</label><Input placeholder="请输入用户名" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required className="h-11 bg-white border-border focus:border-amber" /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium text-ink">邮箱</label><Input type="email" placeholder="请输入邮箱" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="h-11 bg-white border-border focus:border-amber" /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium text-ink">显示名称 <span className="text-muted font-normal">(可选)</span></label><Input placeholder="您的昵称" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="h-11 bg-white border-border focus:border-amber" /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium text-ink">密码</label><Input type="password" placeholder="至少6位" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="h-11 bg-white border-border focus:border-amber" /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium text-ink">确认密码</label><Input type="password" placeholder="再次输入密码" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} required className="h-11 bg-white border-border focus:border-amber" /></div>
            <Button type="submit" className="w-full h-12 gradient-amber text-white font-medium hover:opacity-90 shadow-lg shadow-amber/25" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "注 册"}</Button>
          </form>
          <div className="mt-6 text-center"><span className="text-sm text-ink-light">已有账号?</span><Link to="/login" className="text-sm font-medium text-amber hover:text-amber-hover ml-1">立即登录</Link></div>
        </div>
      </div>
    </div>
  )
}
