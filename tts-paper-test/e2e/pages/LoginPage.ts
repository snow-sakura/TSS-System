import type { Page } from "@playwright/test"

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/login")
    await this.page.waitForLoadState("networkidle")
  }

  async login(username: string, password: string) {
    // 等待登录表单渲染
    await this.page.waitForSelector('input[type="text"], input[name="username"], input[placeholder*="用户"]', {
      timeout: 10_000,
    })

    // 填充用户名
    const usernameInput = this.page.locator(
      'input[type="text"], input[name="username"], input[placeholder*="用户"], input:below(:text("用户名"))',
    ).first()
    await usernameInput.fill(username)

    // 填充密码
    const passwordInput = this.page.locator(
      'input[type="password"], input[name="password"], input[placeholder*="密码"], input:below(:text("密码"))',
    ).first()
    await passwordInput.fill(password)

    // 点击登录按钮
    await this.page.locator('button:has-text("登录"), button[type="submit"]').first().click()

    // 等待登录成功 → 跳转到首页
    await this.page.waitForURL(/\/dashboard|\/home|\//, { timeout: 15_000 })
    await this.page.waitForLoadState("networkidle")
  }

  async isLoggedIn(): Promise<boolean> {
    const token = await this.page.evaluate(() => localStorage.getItem("access_token"))
    return !!token
  }
}
