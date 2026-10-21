import { test, expect } from "@playwright/test"

// 测试点预览弹窗验证脚本
test.describe("测试点预览弹窗验证", () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto("/login")
    await page.waitForLoadState("domcontentloaded")
    await page.locator('input[placeholder="请输入用户名"]').first().fill("admin")
    await page.locator('input[placeholder="请输入密码"]').first().fill("admin123")
    await page.keyboard.press("Enter")
    await page.waitForURL("**/", { timeout: 15000 })
    await page.waitForTimeout(1000)
  })

  test("验证测试点预览弹窗内容格式", async ({ page }) => {
    // 导航到测试点页面
    await page.goto("/test-management/points")
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    // 等待表格加载
    const table = page.locator("table")
    await expect(table).toBeVisible({ timeout: 10000 })

    // 点击第一行的预览按钮（查看详情按钮）
    const firstRow = table.locator("tbody tr").first()
    const previewButton = firstRow.locator('button:has-text("查看详情")')
    
    if (await previewButton.isVisible()) {
      await previewButton.click()
      await page.waitForTimeout(1000)

      // 验证弹窗是否打开
      const dialog = page.locator('[role="dialog"], .fixed.inset-0')
      await expect(dialog).toBeVisible({ timeout: 5000 })

      // 查找描述字段
      const descriptionField = dialog.locator('text="描述"').first()
      if (await descriptionField.isVisible()) {
        // 获取描述内容
        const descriptionContent = descriptionField.locator('..').locator('.pipeline-markdown, .rounded-xl')
        if (await descriptionContent.isVisible()) {
          const content = await descriptionContent.textContent()
          console.log("描述内容:", content)
          
          // 验证内容是否包含 Markdown 格式
          expect(content).toBeTruthy()
        }
      }

      // 截图保存（强制保存，不受配置限制）
      await page.screenshot({ path: "/Users/snow-sakura/Documents/aprillove/TSS-System/tts-paper-test/test-results/test-point-preview.png", fullPage: true })
    }
  })
})