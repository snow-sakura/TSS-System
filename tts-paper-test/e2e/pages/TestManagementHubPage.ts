import type { Page, Locator } from "@playwright/test"

export class TestManagementHubPage {
  readonly page: Page

  // 导航
  readonly navItem: Locator
  readonly goBackButton: Locator

  constructor(page: Page) {
    this.page = page

    // 侧边导航中的「测试管理」菜单项
    this.navItem = page.locator('nav a:has-text("测试管理"), aside a:has-text("测试管理"), [data-menu="test-management"]')
    this.goBackButton = page.locator('button:has-text("返回工作台")')
  }

  /** 通过左侧导航进入测试管理 Hub */
  async gotoViaNav() {
    await this.navItem.first().click()
    await this.page.waitForURL(/\/test-management-hub/, { timeout: 10_000 })
    await this.page.waitForLoadState("networkidle")
  }

  /** 直接导航到测试管理 Hub */
  async goto() {
    await this.page.goto("/test-management-hub")
    await this.page.waitForLoadState("networkidle")
  }

  // ── 概览页操作 ──

  /** 获取流水线阶段卡片 — 4个主阶段卡片（需求测试/执行测试/缺陷管理/分析报告） */
  getPipelineCards() {
    return this.page.locator('.rounded-2xl.border-2:has(h3)')
  }

  /** 获取阶段卡片上的统计数字 */
  async getStageStat(cardIndex: number): Promise<{ label: string; total: number; done: number } | null> {
    const cards = this.getPipelineCards()
    const count = await cards.count()
    if (cardIndex >= count) return null

    const card = cards.nth(cardIndex)
    const text = await card.textContent() || ""
    const totalMatch = text.match(/(\d+)\s*总/)
    const doneMatch = text.match(/(\d+)\s*已完成/)
    const label = (await card.locator("h3").first().textContent()) || ""
    return {
      label,
      total: totalMatch ? parseInt(totalMatch[1]) : 0,
      done: doneMatch ? parseInt(doneMatch[1]) : 0,
    }
  }

  /** 获取统计卡片（概览页顶部指标卡） */
  getStatCards() {
    return this.page.locator('[class*="stat"]:has(span)').or(this.page.locator('[class*="metric"]:has(span)'))
  }

  /** 展开阶段子菜单 */
  async expandStageSubMenus(stageIndex: number) {
    const cards = this.getPipelineCards()
    const card = cards.nth(stageIndex)
    await card.click()
    // 等待子菜单出现
    await this.page.waitForTimeout(300)
  }

  /** 点击子菜单项（在 Hub 概览页点击子菜单链接） */
  async clickSubMenu(subMenuKey: string) {
    await this.page.locator(`a[href*="${subMenuKey}"], [data-submenu="${subMenuKey}"]`).first().click()
    await this.page.waitForTimeout(500)
  }

  // ── 子菜单视图通用 ──

  /** 获取当前视图标题 */
  getViewTitle() {
    return this.page.locator("h2").first()
  }

  /** 返回工作台概览 */
  async goToOverview() {
    // 点击返回箭头
    const backBtn = this.page.locator('button:has(svg), button:has-text("返回")').first()
    if (await backBtn.isVisible()) {
      await backBtn.click()
      await this.page.waitForTimeout(300)
    }
  }

  /** 获取页面中可见的数据行/卡片数量 */
  async getVisibleItemCount(): Promise<number> {
    // 尝试多种选择器
    const cards = this.page.locator('[class*="card"],[class*="Card"]').filter({ has: this.page.locator("text=") })
    const cardCount = await cards.count()
    if (cardCount > 0) return cardCount

    // 表格行
    const rows = this.page.locator("table tbody tr, [class*=row]")
    const rowCount = await rows.count()
    return rowCount
  }

  // ── 特定视图断言 ──

  /** 检查是否在需求看板视图 */
  async isRequirementsView(): Promise<boolean> {
    await this.page.waitForURL(/rt-req-list/, { timeout: 5_000 }).catch(() => {})
    return this.page.url().includes("rt-req-list")
  }

  /** 检查是否在执行仪表盘视图 */
  async isExecutionView(): Promise<boolean> {
    await this.page.waitForURL(/ex-list/, { timeout: 5_000 }).catch(() => {})
    return this.page.url().includes("ex-list")
  }

  /** 等待 API 数据加载完成（网络空闲） */
  async waitForData() {
    await this.page.waitForLoadState("networkidle")
    await this.page.waitForTimeout(500)
  }
}
