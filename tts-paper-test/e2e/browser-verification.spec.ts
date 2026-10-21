import { test, expect } from "@playwright/test"

// 浏览器自动化验证脚本
test.describe("浏览器自动化验证", () => {
  test("验证前端应用正常运行", async ({ page }) => {
    // 1. 访问前端应用
    await page.goto("http://localhost:5173")
    
    // 2. 等待页面加载
    await page.waitForLoadState("domcontentloaded")
    
    // 3. 检查页面标题
    const title = await page.title()
    console.log("页面标题:", title)
    
    // 4. 检查页面内容
    const bodyText = await page.textContent("body") || ""
    console.log("页面内容长度:", bodyText.length)
    
    // 5. 截图保存
    await page.screenshot({ path: "test-results/browser-verification.png" })
    
    // 6. 验证页面基本元素
    await expect(page.locator("body")).toBeVisible()
  })
  
  test("验证后端API可访问", async ({ page }) => {
    // 1. 访问后端API文档
    await page.goto("http://localhost:8000/docs")
    
    // 2. 等待Swagger UI加载
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    
    // 3. 检查Swagger UI是否加载
    const swaggerUI = page.locator("#swagger-ui")
    await expect(swaggerUI).toBeVisible({ timeout: 10000 })
    
    // 4. 截图保存
    await page.screenshot({ path: "test-results/api-docs-verification.png" })
    
    console.log("后端API文档验证成功")
  })
  
  test("验证登录页面功能", async ({ page }) => {
    // 1. 访问登录页面
    await page.goto("http://localhost:5173/login")
    
    // 2. 等待页面加载
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(1000)
    
    // 3. 检查登录表单元素
    const usernameInput = page.locator('input[placeholder="请输入用户名"]')
    const passwordInput = page.locator('input[placeholder="请输入密码"]')
    
    // 4. 验证输入框存在
    await expect(usernameInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    
    // 5. 测试登录功能
    await usernameInput.fill("admin")
    await passwordInput.fill("admin123")
    
    // 6. 截图保存
    await page.screenshot({ path: "test-results/login-page-verification.png" })
    
    console.log("登录页面验证成功")
  })
})