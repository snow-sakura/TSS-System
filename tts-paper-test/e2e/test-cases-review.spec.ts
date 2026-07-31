import { test, expect } from "@playwright/test"

// ── 辅助：等待页面稳定 ──
async function waitStable(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(500)
}

// ── 辅助：通过 UI 登录 ──
async function loginViaUI(page: import("@playwright/test").Page) {
  await page.goto("/login")
  await page.waitForLoadState("domcontentloaded")
  await page.locator('input[placeholder="请输入用户名"]').first().fill("admin")
  await page.locator('input[placeholder="请输入密码"]').first().fill("admin123")
  await page.keyboard.press("Enter")
  await page.waitForURL("**/", { timeout: 15000 })
  await waitStable(page)
}

test.describe("测试用例评审页（/test-cases?menu=review）", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page)
    await page.goto("/test-cases?menu=review")
    await waitStable(page)
  })

  test("页面标题与菜单激活状态正确", async ({ page }) => {
    await expect(page.locator("h1, h2").first()).toBeVisible()
    await expect(page.locator("text=测试用例管理").first()).toBeVisible()
    // 「用例评审」菜单为激活状态（PageLayout 侧边栏为 nav button，激活类 bg-amber-50）
    const reviewMenu = page.locator("nav button", { hasText: "用例评审" }).first()
    await expect(reviewMenu).toBeVisible()
    await expect(reviewMenu).toHaveClass(/bg-amber-50/)
  })

  test("评审记录表格渲染（含状态/评分列）", async ({ page }) => {
    const table = page.locator("table")
    await expect(table).toBeVisible({ timeout: 10_000 })
    // 表头包含关键列
    await expect(table.locator("th", { hasText: "评审标题" }).first()).toBeVisible()
    await expect(table.locator("th", { hasText: "状态" }).first()).toBeVisible()
    // 数据行（mock 3 条评审记录）
    const rows = table.locator("tbody tr")
    await expect(rows.first()).toBeVisible()
    const bodyText = await page.locator("body").textContent()
    expect(bodyText).toContain("登录模块用例评审")
    expect(bodyText).toContain("已通过")
  })

  test("搜索框可按标题过滤", async ({ page }) => {
    const search = page.locator('input[placeholder="搜索评审..."]')
    await expect(search).toBeVisible({ timeout: 10_000 })
    await search.fill("支付流程")
    await waitStable(page)
    const rows = page.locator("table tbody tr")
    // 过滤后仅剩 1 条匹配记录
    const bodyText = await page.locator("body").textContent()
    expect(bodyText).toContain("支付流程用例评审")
    expect(bodyText).not.toContain("登录模块用例评审")
    // 行数为 1（搜索后）
    expect(await rows.count()).toBeLessThanOrEqual(1)
  })

  test("预览操作打开评审详情弹窗", async ({ page }) => {
    const table = page.locator("table")
    await expect(table.locator("tbody tr").first()).toBeVisible({ timeout: 10_000 })
    // 点击第一行的预览按钮（眼睛图标）
    const previewBtn = table.locator("tbody tr").first().locator('button[title="预览"], button:has(svg)').first()
    await previewBtn.click()
    // 弹窗包含评审字段内容
    await expect(page.locator("text=评审: ").first()).toBeVisible({ timeout: 5_000 })
    const dialogText = await page.locator("body").textContent()
    expect(dialogText).toContain("评审人")
  })
})
