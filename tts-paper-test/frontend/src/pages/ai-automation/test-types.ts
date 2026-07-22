/**
 * AI自动化测试类型定义
 * 每种测试类型有独立的卡片展示、详情页菜单和流程
 */

export interface TestType {
  id: string
  name: string
  subtitle: string
  description: string
  icon: string
  gradient: string
  color: string
  tags: string[]
  menuItems: { key: string; label: string; icon: string }[]
  workflow: string[]
}

export const TEST_TYPES: TestType[] = [
  {
    id: "api",
    name: "AI 接口自动化",
    subtitle: "API Testing",
    description: "智能API测试：自动发现接口、生成测试用例、验证响应、检测性能瓶颈",
    icon: "Zap",
    gradient: "from-blue-500 to-indigo-600",
    color: "#6366f1",
    tags: ["REST", "GraphQL", "WebSocket", "gRPC"],
    menuItems: [
      { key: "api-list", label: "接口列表", icon: "List" },
      { key: "api-config", label: "环境配置", icon: "Settings" },
      { key: "api-cases", label: "测试用例", icon: "FlaskConical" },
      { key: "api-execution", label: "执行测试", icon: "Play" },
      { key: "api-results", label: "测试报告", icon: "BarChart3" },
    ],
    workflow: ["导入接口文档", "配置环境变量", "AI生成测试用例", "批量执行测试", "分析响应结果", "生成测试报告"],
  },
  {
    id: "app",
    name: "AI App自动化",
    subtitle: "Mobile Testing",
    description: "移动端AI视觉测试：支持iOS/Android，自动遍历页面、截图对比、崩溃检测",
    icon: "Smartphone",
    gradient: "from-emerald-500 to-teal-600",
    color: "#10b981",
    tags: ["iOS", "Android", "Flutter", "React Native"],
    menuItems: [
      { key: "app-devices", label: "设备管理", icon: "Smartphone" },
      { key: "app-cases", label: "测试用例", icon: "FlaskConical" },
      { key: "app-execution", label: "远程执行", icon: "Play" },
      { key: "app-screenshots", label: "截图对比", icon: "Image" },
      { key: "app-crashes", label: "崩溃分析", icon: "AlertTriangle" },
    ],
    workflow: ["连接设备/模拟器", "AI探索APP页面", "生成测试用例", "远程执行测试", "截图视觉对比", "崩溃日志分析"],
  },
  {
    id: "performance",
    name: "AI 性能测试",
    subtitle: "Performance Testing",
    description: "智能性能压测：AI分析瓶颈、自动调参、生成性能报告、预测容量",
    icon: "Gauge",
    gradient: "from-orange-500 to-red-600",
    color: "#f97316",
    tags: ["压测", "负载", "压力", "容量"],
    menuItems: [
      { key: "perf-scenarios", label: "压测场景", icon: "Target" },
      { key: "perf-config", label: "压测配置", icon: "Settings" },
      { key: "perf-execution", label: "执行压测", icon: "Play" },
      { key: "perf-monitor", label: "实时监控", icon: "Activity" },
      { key: "perf-report", label: "性能报告", icon: "BarChart3" },
    ],
    workflow: ["定义压测场景", "配置并发/梯度", "AI智能调参", "执行压测", "实时监控指标", "生成性能报告"],
  },
  {
    id: "security",
    name: "AI 安全测试",
    subtitle: "Security Testing",
    description: "AI驱动安全扫描：漏洞检测、渗透测试、SQL注入、XSS、CSRF全方位防护",
    icon: "Shield",
    gradient: "from-rose-500 to-pink-600",
    color: "#f43f5e",
    tags: ["渗透", "漏洞", "SQL注入", "XSS"],
    menuItems: [
      { key: "sec-targets", label: "扫描目标", icon: "Crosshair" },
      { key: "sec-rules", label: "安全规则", icon: "ShieldCheck" },
      { key: "sec-scan", label: "漏洞扫描", icon: "Scan" },
      { key: "sec-results", label: "扫描结果", icon: "Bug" },
      { key: "sec-report", label: "安全报告", icon: "FileText" },
    ],
    workflow: ["配置扫描目标", "选择安全规则", "AI智能扫描", "漏洞分类定级", "生成修复建议", "安全报告输出"],
  },
  {
    id: "compatibility",
    name: "AI 兼容性测试",
    subtitle: "Compatibility Testing",
    description: "跨平台兼容性：浏览器/操作系统/设备多维度兼容性自动验证",
    icon: "Layers",
    gradient: "from-violet-500 to-purple-600",
    color: "#8b5cf6",
    tags: ["浏览器", "OS", "分辨率", "多端"],
    menuItems: [
      { key: "compat-matrix", label: "兼容矩阵", icon: "Grid3X3" },
      { key: "compat-cases", label: "测试用例", icon: "FlaskConical" },
      { key: "compat-execution", label: "执行测试", icon: "Play" },
      { key: "compat-results", label: "对比结果", icon: "GitCompare" },
      { key: "compat-report", label: "兼容报告", icon: "FileText" },
    ],
    workflow: ["定义兼容矩阵", "配置测试环境", "AI生成用例", "多环境并行执行", "截图视觉对比", "兼容性报告"],
  },
  {
    id: "regression",
    name: "AI 回归测试",
    subtitle: "Regression Testing",
    description: "智能回归分析：AI识别变更影响范围、自动选择回归用例、增量测试",
    icon: "RefreshCw",
    gradient: "from-cyan-500 to-blue-600",
    color: "#06b6d4",
    tags: ["变更影响", "增量测试", "冒烟测试"],
    menuItems: [
      { key: "reg-changes", label: "变更分析", icon: "GitBranch" },
      { key: "reg-scope", label: "影响范围", icon: "Target" },
      { key: "reg-cases", label: "回归用例", icon: "FlaskConical" },
      { key: "reg-execution", label: "执行回归", icon: "Play" },
      { key: "reg-report", label: "回归报告", icon: "FileText" },
    ],
    workflow: ["分析代码变更", "AI识别影响范围", "自动选择回归用例", "执行回归测试", "对比历史结果", "生成回归报告"],
  },
  {
    id: "exploratory",
    name: "AI 探索性测试",
    subtitle: "Exploratory Testing",
    description: "AI自主探索：像真实用户一样探索应用，发现隐藏缺陷和异常路径",
    icon: "Compass",
    gradient: "from-amber to-orange-500",
    color: "#f59e0b",
    tags: ["自主探索", "异常路径", "边界发现"],
    menuItems: [
      { key: "exp-target", label: "探索目标", icon: "Globe" },
      { key: "exp-config", label: "探索策略", icon: "Settings" },
      { key: "exp-execution", label: "AI探索", icon: "Bot" },
      { key: "exp-findings", label: "发现结果", icon: "Search" },
      { key: "exp-report", label: "探索报告", icon: "FileText" },
    ],
    workflow: ["配置探索目标", "设置探索策略", "AI自主探索应用", "记录发现的问题", "分析异常路径", "生成探索报告"],
  },
  {
    id: "ai-web",
    name: "AI Web自动化",
    subtitle: "Web UI Testing",
    description: "视觉驱动Web测试：AI理解页面语义、自动操作元素、截图验证、全流程自动化",
    icon: "Globe",
    gradient: "from-sky-500 to-blue-600",
    color: "#0ea5e9",
    tags: ["Playwright", "midscene.js", "视觉AI"],
    menuItems: [
      { key: "wa-projects", label: "项目管理", icon: "FolderOpen" },
      { key: "wa-explore", label: "AI探索", icon: "Bot" },
      { key: "wa-cases", label: "测试用例", icon: "FlaskConical" },
      { key: "wa-execution", label: "测试执行", icon: "Play" },
      { key: "wa-results", label: "执行报告", icon: "BarChart3" },
    ],
    workflow: ["创建测试项目", "AI视觉探索页面", "生成测试用例", "审批用例", "执行自动化测试", "查看执行报告"],
  },
]
