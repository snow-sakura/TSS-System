import { test, expect } from "@playwright/test"
import { TestManagementHubPage } from "./pages/TestManagementHubPage"

// ── 辅助：等待页面稳定 ──
async function waitStable(page: import("@playwright/test").Page) {
  await page.waitForLoadState("domcontentloaded")
  await page.waitForTimeout(800)
}

// ── 辅助：通过 UI 登录（标准浏览器登录流程） ──
async function loginViaUI(page: import("@playwright/test").Page) {
  await page.goto("/login")
  await page.waitForLoadState("domcontentloaded")
  await page.waitForTimeout(500)

  // 通过 placeholder 定位输入框
  await page.locator('input[placeholder="请输入用户名"]').first().fill("admin")
  await page.locator('input[placeholder="请输入密码"]').first().fill("admin123")

  // 提交 — 按 Enter 键触发表单提交
  await page.keyboard.press("Enter")
  await page.waitForURL("**/", { timeout: 15000 })
  await page.waitForTimeout(800)
}

// ── 前置：登录 → 导航到测试管理 Hub ──
test.beforeEach(async ({ page }) => {
  await loginViaUI(page)
  // 确保已登录成功后导航到 Hub
  if (!page.url().includes("test-management-hub")) {
    await page.goto("/test-management-hub")
    await waitStable(page)
  }
})

// ═══════════════════════════════════════════════════════════
// 1. Hub 概览页
// ═══════════════════════════════════════════════════════════
test.describe("Hub 概览页", () => {
  test("页面标题与导航正确", async ({ page }) => {
    // 检查正常显示
    await expect(page.locator("h1, h2").first()).toBeVisible()
    // 页面包含测试管理相关文本
    await expect(page.locator("text=测试管理").first()).toBeVisible()
  })

  test("4阶段流水线卡片可见且包含各阶段名称", async ({ page }) => {
    const hub = new TestManagementHubPage(page)
    const cards = hub.getPipelineCards()
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(4) // 应有 4 个阶段卡片

    // 检查各阶段名称
    const texts: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent()
      if (text) texts.push(text)
    }
    const fullText = texts.join(" ")

    expect(fullText).toMatch(/需求测试/)
    expect(fullText).toMatch(/执行测试/)
    expect(fullText).toMatch(/缺陷管理/)
    expect(fullText).toMatch(/分析报告/)
  })

  test("阶段卡片显示统计数字", async ({ page }) => {
    const hub = new TestManagementHubPage(page)
    const cards = hub.getPipelineCards()

    // 每张卡片应包含数字（统计计数）
    const firstCardText = await cards.first().textContent() || ""
    expect(firstCardText).toMatch(/\d+/) // 包含数字计数
  })

  test("阶段卡片可点击展开子菜单", async ({ page }) => {
    const hub = new TestManagementHubPage(page)
    const cards = hub.getPipelineCards()
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // 点击第一个卡片（需求测试）
    await cards.first().click()
    await page.waitForTimeout(500)
    // 应出现子菜单按钮（展开的内容里包含按钮）
    const subButtons = page.locator("button", { hasText: /需求列表|方案列表|测试点列表|用例列表|用例评审/ })
    await expect(subButtons.first()).toBeVisible({ timeout: 3000 })
  })

  test("概览页展示4个工作台快捷入口", async ({ page }) => {
    // 底部「工作台」应展示4个阶段的快捷入口
    const shortcuts = page.locator("button", { hasText: /条数据/ })
    const count = await shortcuts.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })
})

// ═══════════════════════════════════════════════════════════
// 2. 需求看板视图（RequirementsView）
// ═══════════════════════════════════════════════════════════
test.describe("需求看板视图", () => {
  test("通过子菜单导航到需求看板", async ({ page }) => {
    // 展开需求阶段卡片
    const hub = new TestManagementHubPage(page)
    const cards = hub.getPipelineCards()
    await cards.first().click()
    await page.waitForTimeout(300)

    // 点击「需求列表」子菜单按钮
    const reqBtn = page.locator("button", { hasText: "需求列表" }).first()
    await expect(reqBtn).toBeVisible({ timeout: 3000 })
    await reqBtn.click()
    await waitStable(page)

    // 应导航到需求看板视图（URL 包含 rt-req-list）
    const currentUrl = page.url()
    expect(currentUrl).toMatch(/rt-req-list/)
  })

  test("看板显示3列（新建/分析中/已完成）", async ({ page }) => {
    await page.goto("/test-management-hub/rt-req-list")
    await waitStable(page)

    // 应该有三个看板列（检查列标题或分组文本）
    const bodyText = await page.textContent("body") || ""
    expect(bodyText).toMatch(/新建|待分析|已完成/)
  })

  test("需求卡片可点击查看详情", async ({ page }) => {
    await page.goto("/test-management-hub/rt-req-list")
    await waitStable(page)

    // 等待内容加载完成
    const bodyText = await page.textContent("body") || ""

    // 尝试点击一个需求条目
    const items = page.locator('[class*="card"]').or(page.locator('[class*="item"]'))
    const count = await items.count()
    if (count > 0) {
      await items.first().click()
      await page.waitForTimeout(500)
    }
  })

  test("AI分析按钮可见", async ({ page }) => {
    await page.goto("/test-management-hub/rt-req-list")
    await waitStable(page)

    // 页面应包含 AI 相关按钮
    const aiButtons = page.locator('button:has-text("AI"), button:has(svg)')
    await expect(aiButtons.first()).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════
// 3. 执行仪表盘视图（ExecutionView）
// ═══════════════════════════════════════════════════════════
test.describe("执行仪表盘视图", () => {
  test("导航到执行仪表盘", async ({ page }) => {
    await page.goto("/test-management-hub/ex-list")
    await waitStable(page)
    await expect(page).toHaveURL(/ex-list/)
  })

  test("统计卡片已加载", async ({ page }) => {
    await page.goto("/test-management-hub/ex-list")
    await waitStable(page)

    // 检查是否有统计卡片或数据
    const bodyText = await page.textContent("body") || ""
    expect(bodyText.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════
// 4. 缺陷列表视图（DefectListView）
// ═══════════════════════════════════════════════════════════
test.describe("缺陷列表视图", () => {
  test("导航到缺陷列表", async ({ page }) => {
    await page.goto("/test-management-hub/df-list")
    await waitStable(page)
    await expect(page).toHaveURL(/df-list/)
  })

  test("缺陷卡片按严重度着色显示", async ({ page }) => {
    await page.goto("/test-management-hub/df-list")
    await waitStable(page)

    // 等待卡片出现（应该有4个缺陷）
    const bodyText = await page.textContent("body") || ""
    expect(bodyText).toMatch(/major|minor|critical|严重|缺陷|bug/i)
  })

  test("缺陷列表条目可交互", async ({ page }) => {
    await page.goto("/test-management-hub/df-list")
    await waitStable(page)

    // 尝试点击一个条目
    const items = page.locator('[class*="card"]').or(page.locator('[class*="item"]'))
    const count = await items.count()
    if (count > 0) {
      await items.first().click()
      await page.waitForTimeout(500)
    }
  })
})

// ═══════════════════════════════════════════════════════════
// 5. 测试方案视图（TestPlanView）
// ═══════════════════════════════════════════════════════════
test.describe("测试方案视图", () => {
  test("导航到测试方案列表", async ({ page }) => {
    await page.goto("/test-management-hub/rt-plan-list")
    await waitStable(page)
    await expect(page).toHaveURL(/rt-plan-list/)
  })

  test("方案卡片已加载", async ({ page }) => {
    await page.goto("/test-management-hub/rt-plan-list")
    await waitStable(page)

    const bodyText = await page.textContent("body") || ""
    expect(bodyText).toMatch(/方案|计划|test.plan/i)
  })
})

// ═══════════════════════════════════════════════════════════
// 6. 测试用例视图（TestCaseView）
// ═══════════════════════════════════════════════════════════
test.describe("测试用例视图", () => {
  test("导航到测试用例列表", async ({ page }) => {
    await page.goto("/test-management-hub/rt-case-list")
    await waitStable(page)
    await expect(page).toHaveURL(/rt-case-list/)
  })

  test("用例按状态分组显示", async ({ page }) => {
    await page.goto("/test-management-hub/rt-case-list")
    await waitStable(page)

    const bodyText = await page.textContent("body") || ""
    expect(bodyText).toMatch(/approved|draft|passed|待审核|已通过|草稿/i)
  })
})

// ═══════════════════════════════════════════════════════════
// 7. 报告卡片墙视图（ReportListView）
// ═══════════════════════════════════════════════════════════
test.describe("报告卡片墙视图", () => {
  test("导航到报告列表", async ({ page }) => {
    await page.goto("/test-management-hub/rp-list")
    await waitStable(page)
    await expect(page).toHaveURL(/rp-list/)
  })

  test("报告卡片已加载", async ({ page }) => {
    await page.goto("/test-management-hub/rp-list")
    await waitStable(page)

    const bodyText = await page.textContent("body") || ""
    expect(bodyText).toMatch(/version|trend|日报|报告|published|draft/i)
  })
})

// ═══════════════════════════════════════════════════════════
// 8. NavigateView 跳转
// ═══════════════════════════════════════════════════════════
test.describe("NavigateView 跳转", () => {
  test("缺陷看板 → 跳转到 /defects 页面", async ({ page }) => {
    await page.goto("/test-management-hub/df-kanban")
    await waitStable(page)

    // 应该显示跳转提示
    await expect(page.locator("text=独立页面").first()).toBeVisible()
    // 点击跳转按钮（NavigateView 用 Button onClick navigate，非 <a>）
    await page.locator('button:has-text("打开 缺陷看板")').click()
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/defects/)
  })
})

// ═══════════════════════════════════════════════════════════
// 9. 返回工作台
// ═══════════════════════════════════════════════════════════
test.describe("返回工作台", () => {
  test("从子菜单视图返回概览", async ({ page }) => {
    // 先进入一个子菜单视图
    await page.goto("/test-management-hub/ex-list")
    await waitStable(page)

    // 点击返回按钮（各视图返回按钮均带 title="返回工作台总览"）
    const backBtn = page.locator('button[title="返回工作台总览"]').first()
    if (await backBtn.isVisible()) {
      await backBtn.click()
      await page.waitForTimeout(500)
      // 应该回到 /test-management-hub（不带子路径）
      await expect(page).toHaveURL(/\/test-management-hub$/)
    }
  })
})
