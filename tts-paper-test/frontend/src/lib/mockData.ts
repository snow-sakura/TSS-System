/**
 * Mock数据 - 后端未运行时的降级数据
 */

export const mockRequirements = [
  {
    id: 1,
    title: "用户登录模块",
    content: "支持多种登录方式（账号密码、短信验证码、第三方OAuth）",
    status: "approved",
    priority: "P0",
    deadline: "2026-08-01",
    test_points_count: 12,
    created_at: "2026-07-20T10:00:00Z",
  },
  {
    id: 2,
    title: "支付接口bug修复",
    content: "修复支付接口在高并发下的订单状态不一致问题",
    status: "analyzing",
    priority: "P1",
    deadline: "2026-07-30",
    test_points_count: 8,
    created_at: "2026-07-25T14:30:00Z",
  },
  {
    id: 3,
    title: "订单列表页面",
    content: "实现订单的分页查询、筛选、导出功能",
    status: "draft",
    priority: "P2",
    deadline: "2026-08-15",
    test_points_count: 0,
    created_at: "2026-07-27T09:00:00Z",
  },
  {
    id: 4,
    title: "消息通知系统",
    content: "支持站内信、邮件、短信三种通知渠道",
    status: "analyzed",
    priority: "P2",
    deadline: "2026-08-20",
    test_points_count: 15,
    created_at: "2026-07-22T16:00:00Z",
  },
  {
    id: 5,
    title: "数据导出功能",
    content: "支持Excel、CSV、PDF三种格式导出",
    status: "approved",
    priority: "P3",
    deadline: "2026-08-30",
    test_points_count: 6,
    created_at: "2026-07-18T11:00:00Z",
  },
]

export const mockPlans = [
  {
    id: 1,
    title: "用户登录模块测试方案",
    description: "覆盖登录、注册、密码找回等核心场景",
    status: "active",
    requirement_id: 1,
    created_at: "2026-07-20T10:30:00Z",
  },
  {
    id: 2,
    title: "支付接口修复验证方案",
    description: "验证高并发场景下的订单一致性",
    status: "draft",
    requirement_id: 2,
    created_at: "2026-07-25T15:00:00Z",
  },
  {
    id: 3,
    title: "订单列表测试方案",
    description: "覆盖分页、筛选、导出功能",
    status: "completed",
    requirement_id: 3,
    created_at: "2026-07-22T09:00:00Z",
  },
]

export const mockPoints = [
  {
    id: 1,
    title: "账号密码登录验证",
    requirement_id: 1,
    priority: "P0",
    category: "功能测试",
    created_at: "2026-07-20T11:00:00Z",
  },
  {
    id: 2,
    title: "短信验证码登录",
    requirement_id: 1,
    priority: "P1",
    category: "功能测试",
    created_at: "2026-07-20T11:30:00Z",
  },
  {
    id: 3,
    title: "第三方OAuth登录",
    requirement_id: 1,
    priority: "P1",
    category: "功能测试",
    created_at: "2026-07-20T12:00:00Z",
  },
  {
    id: 4,
    title: "高并发订单状态一致性",
    requirement_id: 2,
    priority: "P0",
    category: "性能测试",
    created_at: "2026-07-25T16:00:00Z",
  },
]

export const mockCases = [
  {
    id: 1,
    title: "验证正确账号密码登录成功",
    plan_id: 1,
    requirement_id: 1,
    status: "approved",
    priority: "P0",
    type: "正向用例",
    created_at: "2026-07-20T14:00:00Z",
  },
  {
    id: 2,
    title: "验证错误密码登录失败",
    plan_id: 1,
    requirement_id: 1,
    status: "approved",
    priority: "P0",
    type: "异常用例",
    created_at: "2026-07-20T14:30:00Z",
  },
  {
    id: 3,
    title: "验证连续5次错误密码锁定账户",
    plan_id: 1,
    requirement_id: 1,
    status: "draft",
    priority: "P1",
    type: "边界用例",
    created_at: "2026-07-20T15:00:00Z",
  },
  {
    id: 4,
    title: "验证手机号格式校验",
    plan_id: 1,
    requirement_id: 1,
    status: "analyzing",
    priority: "P1",
    type: "异常用例",
    created_at: "2026-07-21T09:00:00Z",
  },
]

export const mockReviews = [
  {
    id: 1,
    title: "用户登录模块用例评审",
    case_id: 1,
    reviewer: "张测试",
    status: "approved",
    created_at: "2026-07-21T10:00:00Z",
  },
  {
    id: 2,
    title: "支付接口用例评审",
    case_id: 4,
    reviewer: "李测试",
    status: "pending",
    created_at: "2026-07-26T14:00:00Z",
  },
]

export const mockDefects = [
  {
    id: 1,
    title: "登录页验证码刷新后旧验证码仍可使用",
    status: "new",
    severity: "medium",
    priority: "P1",
    assignee: "王开发",
    created_at: "2026-07-25T10:00:00Z",
  },
  {
    id: 2,
    title: "支付金额超过1000元时订单状态不更新",
    status: "confirmed",
    severity: "critical",
    priority: "P0",
    assignee: "李开发",
    created_at: "2026-07-26T14:30:00Z",
  },
  {
    id: 3,
    title: "订单列表导出Excel时中文乱码",
    status: "fixing",
    severity: "low",
    priority: "P2",
    assignee: "赵开发",
    created_at: "2026-07-24T09:00:00Z",
  },
  {
    id: 4,
    title: "消息通知邮件发送延迟超过5分钟",
    status: "fixed",
    severity: "medium",
    priority: "P2",
    assignee: "王开发",
    created_at: "2026-07-23T16:00:00Z",
  },
  {
    id: 5,
    title: "数据导出PDF格式异常",
    status: "closed",
    severity: "low",
    priority: "P3",
    assignee: "赵开发",
    created_at: "2026-07-20T11:00:00Z",
  },
]

export const mockExecutions = [
  {
    id: 1,
    name: "登录模块冒烟测试",
    status: "completed",
    case_count: 20,
    passed: 18,
    failed: 2,
    start_time: "2026-07-28T10:00:00Z",
    end_time: "2026-07-28T10:30:00Z",
  },
  {
    id: 2,
    name: "支付接口回归测试",
    status: "running",
    case_count: 15,
    passed: 10,
    failed: 0,
    start_time: "2026-07-28T11:00:00Z",
    end_time: null,
  },
  {
    id: 3,
    name: "订单列表功能测试",
    status: "pending",
    case_count: 8,
    passed: 0,
    failed: 0,
    start_time: null,
    end_time: null,
  },
]

export const mockReports = [
  {
    id: 1,
    title: "2026年7月第4周测试报告",
    type: "weekly",
    status: "published",
    creator: "张测试",
    created_at: "2026-07-27T18:00:00Z",
  },
  {
    id: 2,
    title: "登录模块专项测试报告",
    type: "module",
    status: "draft",
    creator: "李测试",
    created_at: "2026-07-26T14:00:00Z",
  },
]

/**
 * 带mock降级的API调用包装器
 * 当API调用失败或返回无效数据时自动返回mock数据
 */
export async function withMockFallback<T>(
  apiCall: () => Promise<any>,
  mockData: T,
  showError = true,
  timeoutMs = 2000
): Promise<{ data: T; fromMock: boolean }> {
  try {
    const res = await Promise.race([
      apiCall(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      )
    ])
    
    // 验证返回的数据是否有效
    let data: any = null
    if (Array.isArray(res)) {
      data = res
    } else if (Array.isArray(res?.data)) {
      data = res.data
    } else if (Array.isArray(res?.data?.data)) {
      data = res.data.data
    } else if (Array.isArray(res?.items)) {
      data = res.items
    }
    
    // 如果数据无效（不是数组且不是预期的对象），使用mock
    if (data === null || data === undefined || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)) {
      if (showError) {
        console.warn("[Mock Fallback] API返回数据无效，使用mock数据")
      }
      return { data: mockData, fromMock: true }
    }
    
    return { data: data as T, fromMock: false }
  } catch (error) {
    if (showError) {
      console.warn("[Mock Fallback] API请求失败，使用mock数据:", error instanceof Error ? error.message : error)
    }
    return { data: mockData, fromMock: true }
  }
}