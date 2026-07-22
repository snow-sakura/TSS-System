/**
 * 模块配置 - 定义所有TAB分组、大卡片、子功能菜单
 *
 * 测试生命周期流程 (8步):
 * 需求分析 → 规划方案 → 提取测试点 → 用例生成 → 用例评审 → 执行测试 → 缺陷管理 → 分析报告
 *
 * 前5阶段合并为「需求测试」一体化流水线卡片，后3阶段保留独立卡片
 */

export interface SubMenuItem {
  label: string
  key: string
}

export interface MenuItem {
  label: string
  key: string
  icon: string
  children: SubMenuItem[]
}

export interface ModuleTab {
  key: string
  label: string
  modules: ModuleCard[]
}

export interface ModuleCard {
  key: string
  title: string
  desc: string
  icon: string
  gradient: string
  menus: MenuItem[]
}

/** 单个生命周期阶段定义 */
export interface LifecycleStage {
  key: string
  label: string
  desc: string
  icon: string
  gradient: string
  order: number
}

/** 全量8个生命周期阶段 */
export const lifecycleStages: LifecycleStage[] = [
  { key: "requirements", label: "需求分析", desc: "AI驱动的需求理解与分析", icon: "FileText", gradient: "from-blue-500 to-indigo-600", order: 1 },
  { key: "test-plans", label: "规划方案", desc: "AI规划测试策略与方案", icon: "ClipboardList", gradient: "from-cyan-500 to-teal-600", order: 2 },
  { key: "test-points", label: "提取测试点", desc: "智能测试点提取与管理", icon: "Target", gradient: "from-violet-500 to-purple-600", order: 3 },
  { key: "test-cases", label: "用例生成", desc: "多Agent协作生成测试用例", icon: "FlaskConical", gradient: "from-emerald-500 to-green-600", order: 4 },
  { key: "test-review", label: "用例评审", desc: "AI辅助测试用例评审与确认", icon: "CheckCircle", gradient: "from-pink-500 to-rose-600", order: 5 },
  { key: "executions", label: "执行测试", desc: "实时执行追踪与结果收集", icon: "Play", gradient: "from-sky-500 to-blue-600", order: 6 },
  { key: "defects", label: "缺陷管理", desc: "AI缺陷分析与根因定位", icon: "Bug", gradient: "from-rose-500 to-red-600", order: 7 },
  { key: "reports", label: "分析报告", desc: "智能质量洞察与报告生成", icon: "BarChart3", gradient: "from-teal-500 to-emerald-600", order: 8 },
]

export const moduleTabs: ModuleTab[] = [
  {
    key: "test-management",
    label: "测试管理",
    modules: [
      {
        key: "requirement-testing",
        title: "需求测试",
        desc: "全流程自动化：需求分析 → 规划方案 → 提取测试点 → 用例生成 → 用例评审",
        icon: "Sparkles",
        gradient: "from-amber to-orange-500",
        menus: [
          { label: "全流程执行", key: "rt-pipeline", icon: "Play", children: [
            { label: "执行流水线", key: "rt-run" },
            { label: "执行历史", key: "rt-history" },
          ]},
          { label: "流程记录", key: "rt-process-records", icon: "ScrollText", children: [
            { label: "流程记录列表", key: "rt-records-list" },
          ]},
          { label: "需求分析", key: "rt-requirements", icon: "FileText", children: [
            { label: "需求列表", key: "rt-req-list" },
            { label: "上传文档", key: "rt-req-upload" },
          ]},
          { label: "测试方案", key: "rt-plans", icon: "ClipboardList", children: [
            { label: "方案列表", key: "rt-plan-list" },
          ]},
          { label: "测试点", key: "rt-points", icon: "Target", children: [
            { label: "测试点列表", key: "rt-point-list" },
          ]},
          { label: "用例管理", key: "rt-cases", icon: "FlaskConical", children: [
            { label: "用例列表", key: "rt-case-list" },
            { label: "用例评审", key: "rt-case-review" },
          ]},
        ],
      },
      {
        key: "executions",
        title: "执行测试",
        desc: "实时执行追踪与结果收集，支持调度与CI触发",
        icon: "Play",
        gradient: "from-sky-500 to-blue-600",
        menus: [
          { label: "执行列表", key: "ex-list", icon: "Play", children: [] },
          { label: "执行详情", key: "ex-detail", icon: "Eye", children: [] },
          { label: "调度配置", key: "ex-schedule", icon: "Calendar", children: [] },
        ],
      },
      {
        key: "defects",
        title: "缺陷管理",
        desc: "AI缺陷分析与根因定位，看板视图与趋势追踪",
        icon: "Bug",
        gradient: "from-rose-500 to-red-600",
        menus: [
          { label: "缺陷列表", key: "df-list", icon: "Bug", children: [] },
          { label: "看板视图", key: "df-kanban", icon: "Columns2", children: [] },
          { label: "AI根因分析", key: "df-root-cause", icon: "Search", children: [] },
          { label: "趋势分析", key: "df-trend", icon: "TrendingUp", children: [] },
        ],
      },
      {
        key: "reports",
        title: "分析报告",
        desc: "智能质量洞察与报告生成，支持自动汇总与图表",
        icon: "BarChart3",
        gradient: "from-teal-500 to-emerald-600",
        menus: [
          { label: "报告列表", key: "rp-list", icon: "BarChart3", children: [] },
          { label: "AI生成报告", key: "rp-generate", icon: "Sparkles", children: [] },
          { label: "质量概览", key: "rp-overview", icon: "Eye", children: [] },
          { label: "趋势图表", key: "rp-trends", icon: "LineChart", children: [] },
        ],
      },
    ],
  },
  {
    key: "ai-automation",
    label: "AI自动化",
    modules: [
      {
        key: "web-automation",
        title: "AI Web自动化",
        desc: "视觉驱动的网页自动化测试",
        icon: "Globe",
        gradient: "from-amber to-orange-500",
        menus: [
          { label: "项目管理", key: "wa-project", icon: "Globe", children: [
            { label: "项目列表", key: "wa-list" },
            { label: "新建项目", key: "wa-create" },
          ]},
          { label: "AI探索", key: "wa-explore", icon: "Sparkles", children: [
            { label: "探索任务", key: "wa-explore-list" },
            { label: "页面地图", key: "wa-pages" },
          ]},
          { label: "测试执行", key: "wa-exec", icon: "Play", children: [
            { label: "执行记录", key: "wa-exec-list" },
            { label: "执行配置", key: "wa-exec-config" },
          ]},
        ],
      },
      {
        key: "knowledge",
        title: "知识库",
        desc: "测试模式与Bug知识库",
        icon: "BookOpen",
        gradient: "from-indigo-500 to-violet-600",
        menus: [
          { label: "测试模式", key: "kb-patterns", icon: "BookOpen", children: [
            { label: "模式列表", key: "kb-patterns-list" },
            { label: "添加模式", key: "kb-patterns-add" },
          ]},
          { label: "Bug知识", key: "kb-bugs", icon: "Bug", children: [
            { label: "知识列表", key: "kb-bugs-list" },
            { label: "RAG检索", key: "kb-search" },
          ]},
        ],
      },
      {
        key: "workflow-orchestration",
        title: "流程编排",
        desc: "可视化测试流程设计与执行",
        icon: "GitBranch",
        gradient: "from-violet-500 to-purple-600",
        menus: [
          { label: "流程设计", key: "wf-design", icon: "GitBranch", children: [
            { label: "流程列表", key: "wf-list" },
            { label: "新建流程", key: "wf-create" },
          ]},
          { label: "执行历史", key: "wf-exec", icon: "Clock", children: [
            { label: "执行记录", key: "wf-exec-list" },
          ]},
        ],
      },
    ],
  },
  {
    key: "config",
    label: "基础配置",
    modules: [
      {
        key: "environments",
        title: "环境配置",
        desc: "多环境管理与健康检测",
        icon: "Server",
        gradient: "from-slate-500 to-gray-600",
        menus: [
          { label: "环境管理", key: "env-mgmt", icon: "Server", children: [
            { label: "环境列表", key: "env-list" },
            { label: "新建环境", key: "env-create" },
            { label: "健康检测", key: "env-health" },
          ]},
          { label: "变量配置", key: "env-var", icon: "Key", children: [
            { label: "变量列表", key: "env-var-list" },
            { label: "环境快照", key: "env-snapshot" },
          ]},
        ],
      },
      {
        key: "llm",
        title: "大模型配置",
        desc: "多提供商模型管理",
        icon: "Brain",
        gradient: "from-indigo-500 to-blue-600",
        menus: [
          { label: "提供商管理", key: "llm-provider", icon: "Brain", children: [
            { label: "提供商列表", key: "llm-list" },
            { label: "添加提供商", key: "llm-create" },
            { label: "连接测试", key: "llm-test" },
          ]},
          { label: "模型参数", key: "llm-params", icon: "Settings", children: [
            { label: "参数配置", key: "llm-param-config" },
            { label: "成本统计", key: "llm-cost" },
          ]},
        ],
      },
      {
        key: "prompts",
        title: "提示词配置",
        desc: "AI提示词模板管理",
        icon: "MessageSquare",
        gradient: "from-pink-500 to-rose-600",
        menus: [
          { label: "模板管理", key: "pr-mgmt", icon: "MessageSquare", children: [
            { label: "模板列表", key: "pr-list" },
            { label: "创建模板", key: "pr-create" },
            { label: "版本管理", key: "pr-version" },
          ]},
          { label: "效果测试", key: "pr-test", icon: "TestTube", children: [
            { label: "预览测试", key: "pr-preview" },
            { label: "A/B对比", key: "pr-ab" },
          ]},
        ],
      },
      {
        key: "de-ai",
        title: "去AI味配置",
        desc: "AI内容风格优化策略",
        icon: "Wand2",
        gradient: "from-orange-500 to-amber-600",
        menus: [
          { label: "策略管理", key: "deai-mgmt", icon: "Wand2", children: [
            { label: "策略列表", key: "deai-list" },
            { label: "创建策略", key: "deai-create" },
            { label: "效果测试", key: "deai-test" },
          ]},
        ],
      },
      {
        key: "mcp",
        title: "MCP服务",
        desc: "外部工具协议注册",
        icon: "Webhook",
        gradient: "from-sky-500 to-cyan-600",
        menus: [
          { label: "服务管理", key: "mcp-mgmt", icon: "Webhook", children: [
            { label: "服务列表", key: "mcp-list" },
            { label: "添加服务", key: "mcp-create" },
            { label: "连通测试", key: "mcp-test" },
          ]},
          { label: "监控日志", key: "mcp-monitor", icon: "Activity", children: [
            { label: "状态监控", key: "mcp-status" },
            { label: "运行日志", key: "mcp-logs" },
          ]},
        ],
      },
      {
        key: "skills",
        title: "Skills技能",
        desc: "AI技能定义与版本管理",
        icon: "Puzzle",
        gradient: "from-amber to-yellow-500",
        menus: [
          { label: "技能管理", key: "sk-mgmt", icon: "Puzzle", children: [
            { label: "技能列表", key: "sk-list" },
            { label: "创建技能", key: "sk-create" },
            { label: "导入导出", key: "sk-imp-exp" },
          ]},
        ],
      },
      {
        key: "hermes",
        title: "Hermes配置",
        desc: "多平台消息网关",
        icon: "Key",
        gradient: "from-emerald-500 to-green-600",
        menus: [
          { label: "渠道管理", key: "hm-channel", icon: "Key", children: [
            { label: "渠道列表", key: "hm-list" },
            { label: "添加渠道", key: "hm-create" },
            { label: "消息模板", key: "hm-template" },
          ]},
        ],
      },
      {
        key: "operation-logs",
        title: "操作日志",
        desc: "全量操作审计日志",
        icon: "ScrollText",
        gradient: "from-stone-500 to-zinc-600",
        menus: [
          { label: "日志查询", key: "log-query", icon: "ScrollText", children: [
            { label: "日志列表", key: "log-list" },
            { label: "日志导出", key: "log-export" },
            { label: "异常告警", key: "log-alert" },
          ]},
        ],
      },
    ],
  },
  {
    key: "personal",
    label: "个人中心",
    modules: [
      {
        key: "users",
        title: "用户管理",
        desc: "系统用户CRUD与状态管理",
        icon: "Users",
        gradient: "from-blue-500 to-indigo-600",
        menus: [
          { label: "用户管理", key: "usr-mgmt", icon: "Users", children: [
            { label: "用户列表", key: "usr-list" },
            { label: "创建用户", key: "usr-create" },
            { label: "用户状态", key: "usr-status" },
          ]},
          { label: "登录日志", key: "usr-log", icon: "ScrollText", children: [
            { label: "登录记录", key: "usr-login-log" },
            { label: "设备管理", key: "usr-device" },
          ]},
        ],
      },
      {
        key: "roles",
        title: "角色管理",
        desc: "RBAC角色权限配置",
        icon: "Shield",
        gradient: "from-violet-500 to-purple-600",
        menus: [
          { label: "角色管理", key: "role-mgmt", icon: "Shield", children: [
            { label: "角色列表", key: "role-list" },
            { label: "创建角色", key: "role-create" },
            { label: "权限配置", key: "role-perm" },
          ]},
        ],
      },
      {
        key: "profile",
        title: "个人设置",
        desc: "个人信息与偏好设置",
        icon: "User",
        gradient: "from-slate-500 to-gray-600",
        menus: [
          { label: "基本信息", key: "pf-info", icon: "User", children: [
            { label: "个人资料", key: "pf-profile" },
            { label: "修改密码", key: "pf-password" },
          ]},
          { label: "偏好设置", key: "pf-pref", icon: "Settings", children: [
            { label: "主题切换", key: "pf-theme" },
            { label: "通知设置", key: "pf-notify" },
          ]},
        ],
      },
    ],
  },
]

// 根据key查找模块
export function findModule(moduleKey: string): ModuleCard | undefined {
  for (const tab of moduleTabs) {
    const found = tab.modules.find((m) => m.key === moduleKey)
    if (found) return found
  }
  return undefined
}

// 根据tab key获取模块列表
export function findTab(tabKey: string): ModuleTab | undefined {
  return moduleTabs.find((t) => t.key === tabKey)
}
