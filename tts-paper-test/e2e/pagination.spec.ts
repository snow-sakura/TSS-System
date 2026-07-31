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

// 分页指示器（x/y页）
function pageIndicator(page: import("@playwright/test").Page) {
  return page.locator("span", { hasText: /^\d+\/\d+页$/ })
}

// 分页区内的数字按钮
function pageNumberButtons(page: import("@playwright/test").Page) {
  return page.locator('button[class*="px-1.5"], button[class*="px-2"]')
}

// 每页条数 select（含 10/20/50 选项）
function pageSizeSelect(page: import("@playwright/test").Page) {
  return page.locator("select:has(option[value='10'])")
}

// 表格数据行
function dataRows(page: import("@playwright/test").Page) {
  return page.locator("table tbody tr")
}

test.describe("通用模块服务端分页（/operation-logs）", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page)
    await page.goto("/operation-logs")
    await waitStable(page)
  })

  test("显示分页指示器与每页条数选择器", async ({ page }) => {
    // 数据表格存在
    await expect(dataRows(page).first()).toBeVisible({ timeout: 10_000 })
    // 分页指示 x/y页
    await expect(pageIndicator(page)).toBeVisible()
    const indicator = (await pageIndicator(page).textContent()) || ""
    expect(indicator).toMatch(/^\d+\/\d+页$/)
    // 每页条数 select 存在且默认 20
    await expect(pageSizeSelect(page)).toHaveValue("20")
  })

  test("当前页数据行数不超过每页条数", async ({ page }) => {
    await expect(dataRows(page).first()).toBeVisible({ timeout: 10_000 })
    const rowCount = await dataRows(page).count()
    expect(rowCount).toBeLessThanOrEqual(20)
  })

  test("切换每页条数 10 → 50 生效", async ({ page }) => {
    await expect(dataRows(page).first()).toBeVisible({ timeout: 10_000 })
    await pageSizeSelect(page).selectOption("10")
    await waitStable(page)
    await expect(pageSizeSelect(page)).toHaveValue("10")
    const rows10 = await dataRows(page).count()
    expect(rows10).toBeLessThanOrEqual(10)

    await pageSizeSelect(page).selectOption("50")
    await waitStable(page)
    await expect(pageSizeSelect(page)).toHaveValue("50")
    const rows50 = await dataRows(page).count()
    expect(rows50).toBeLessThanOrEqual(50)
  })

  test("多页时翻页与跳页正常", async ({ page }) => {
    await expect(dataRows(page).first()).toBeVisible({ timeout: 10_000 })
    const indicator = (await pageIndicator(page).textContent()) || ""
    const [, totalStr] = indicator.match(/^(\d+)\/(\d+)页$/) || ["", "1", "1"]
    const totalPages = parseInt(totalStr)

    if (totalPages <= 1) {
      // 单页：禁用首/末/上/下页按钮
      const firstBtn = pageNumberButtons(page).filter({ hasText: "«" })
      const prevBtn = pageNumberButtons(page).filter({ hasText: "‹" })
      await expect(firstBtn).toBeDisabled()
      await expect(prevBtn).toBeDisabled()
      return
    }

    // 点击数字页 2（若存在）或下一页
    const nextBtn = pageNumberButtons(page).filter({ hasText: "›" })
    await nextBtn.click()
    await waitStable(page)
    const indicator2 = (await pageIndicator(page).textContent()) || ""
    expect(indicator2).toMatch(/^2\//)

    // 上一页回到第 1 页
    const prevBtn = pageNumberButtons(page).filter({ hasText: "‹" })
    await prevBtn.click()
    await waitStable(page)
    const indicator1 = (await pageIndicator(page).textContent()) || ""
    expect(indicator1).toMatch(/^1\//)

    // 跳至末页（»）
    const lastBtn = pageNumberButtons(page).filter({ hasText: "»" })
    await lastBtn.click()
    await waitStable(page)
    const indicatorLast = (await pageIndicator(page).textContent()) || ""
    expect(indicatorLast).toBe(`${totalPages}/${totalPages}页`)
  })
})
