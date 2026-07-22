import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Edit, Trash2, Clock, User, Tag, FileText, AlertCircle } from "lucide-react"

// 模拟详情数据
const mockDetail: Record<string, any> = {
  "requirements": {
    1: { id: 1, name: "用户登录功能需求", status: "已分析", priority: "P0", created: "2026-07-15 10:30", updated: "2026-07-18 14:20", creator: "张三", desc: "实现用户登录功能，支持用户名+密码登录方式，需要支持记住密码和自动登录功能。需要考虑安全性，包括密码加密存储、登录失败次数限制、验证码机制等。", tags: ["认证", "安全", "核心功能"] },
    2: { id: 2, name: "商品搜索功能需求", status: "草稿", priority: "P1", created: "2026-07-16 09:15", updated: "2026-07-16 09:15", creator: "李四", desc: "实现商品搜索功能，支持关键词搜索、分类筛选、价格区间筛选。搜索结果需要分页展示，支持排序功能。", tags: ["搜索", "商品"] },
    3: { id: 3, name: "购物车管理需求", status: "已评审", priority: "P1", created: "2026-07-16 14:00", updated: "2026-07-17 11:30", creator: "王五", desc: "实现购物车功能，支持添加商品、修改数量、删除商品、清空购物车。需要实时计算总价和优惠信息。", tags: ["购物车", "电商"] },
    4: { id: 4, name: "订单支付流程需求", status: "已分析", priority: "P0", created: "2026-07-17 08:45", updated: "2026-07-18 16:00", creator: "赵六", desc: "实现订单支付流程，支持多种支付方式（支付宝、微信支付、银行卡），需要处理支付回调和订单状态更新。", tags: ["支付", "订单", "核心功能"] },
  },
}

const statusColors: Record<string, string> = {
  "已分析": "bg-pass/10 text-pass border border-pass/20",
  "已评审": "bg-info/10 text-info border border-info/20",
  "已确认": "bg-pass/10 text-pass border border-pass/20",
  "草稿": "bg-cream text-muted border border-border",
}

export default function DetailPage() {
  const { moduleKey, id } = useParams<{ moduleKey: string; id: string }>()
  const navigate = useNavigate()

  // 获取详情数据
  const detail = mockDetail["requirements"]?.[Number(id)] || {
    id: Number(id),
    name: "示例数据",
    status: "草稿",
    priority: "P1",
    created: "2026-07-19 10:00",
    updated: "2026-07-19 10:00",
    creator: "系统",
    desc: "这是一条示例数据的详细描述信息。在实际应用中，这里会显示从数据库查询到的完整数据。",
    tags: ["示例"],
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* 顶部栏 */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/${moduleKey}`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cream border border-border/60 transition-all group">
            <ArrowLeft className="w-4 h-4 text-ink-light group-hover:text-ink transition-colors" />
            <span className="text-xs font-medium text-ink-light group-hover:text-ink transition-colors hidden sm:block">返回列表</span>
          </button>
          <div className="h-8 w-px bg-border/60" />
          <h1 className="text-sm font-bold text-ink" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>详情信息</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 border-border text-ink-light text-sm hover:bg-cream">
            <Edit className="w-4 h-4 mr-1" /> 编辑
          </Button>
          <Button className="h-9 bg-fail text-white text-sm hover:bg-fail/90">
            <Trash2 className="w-4 h-4 mr-1" /> 删除
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 基本信息卡片 */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-ink mb-2" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{detail.name}</h2>
              <div className="flex items-center gap-3 text-sm text-ink-light">
                <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> ID: {detail.id}</span>
                <span className="flex items-center gap-1"><User className="w-4 h-4" /> {detail.creator}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[detail.status] || "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                {detail.status}
              </span>
              <span className={`text-sm font-semibold ${detail.priority === "P0" || detail.priority === "紧急" ? "text-fail" : detail.priority === "P1" || detail.priority === "高" ? "text-amber" : "text-muted"}`}>
                {detail.priority}
              </span>
            </div>
          </div>

          {/* 描述 */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted" /> 详细描述
            </h3>
            <div className="bg-cream/50 rounded-xl p-4 text-sm text-ink-light leading-relaxed">
              {detail.desc}
            </div>
          </div>

          {/* 标签 */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted" /> 标签
            </h3>
            <div className="flex flex-wrap gap-2">
              {detail.tags.map((tag: string) => (
                <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-light text-amber border border-amber/20">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* 时间信息 */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted" />
              <span className="text-ink-light">创建时间：</span>
              <span className="text-ink">{detail.created}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted" />
              <span className="text-ink-light">更新时间：</span>
              <span className="text-ink">{detail.updated}</span>
            </div>
          </div>
        </div>

        {/* 关联信息卡片 */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-6">
          <h3 className="text-base font-semibold text-ink mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-muted" /> 关联信息
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-cream/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-ink">0</p>
              <p className="text-xs text-ink-light mt-1">关联测试点</p>
            </div>
            <div className="bg-cream/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-ink">0</p>
              <p className="text-xs text-ink-light mt-1">关联用例</p>
            </div>
            <div className="bg-cream/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-ink">0</p>
              <p className="text-xs text-ink-light mt-1">关联缺陷</p>
            </div>
            <div className="bg-cream/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-ink">0</p>
              <p className="text-xs text-ink-light mt-1">执行记录</p>
            </div>
          </div>
        </div>

        {/* 返回按钮 */}
        <div className="mt-6">
          <Button variant="outline" onClick={() => navigate(`/${moduleKey}`)} className="border-border text-ink-light hover:bg-cream">
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回列表
          </Button>
        </div>
      </div>
    </div>
  )
}
