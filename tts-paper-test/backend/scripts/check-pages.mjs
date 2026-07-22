/**
 * 检查页面内容 - 正确登录
 */
import { chromium } from 'playwright';

async function checkPages() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 登录
    console.log('登录中...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 查找输入框并填写
    const usernameInput = page.locator('input[placeholder*="用户名"]');
    const passwordInput = page.locator('input[placeholder*="密码"]');

    if (await usernameInput.count() > 0 && await passwordInput.count() > 0) {
      await usernameInput.fill('admin');
      await passwordInput.fill('admin123');
      console.log('已填写用户名和密码');

      // 点击提交按钮（在form内的按钮）
      const submitBtn = page.locator('form button[type="submit"], form button:has-text("登")');
      if (await submitBtn.count() > 0) {
        console.log('点击登录按钮');
        await submitBtn.click();
        await page.waitForTimeout(3000);
      } else {
        // 尝试按Enter键
        console.log('按Enter键登录');
        await passwordInput.press('Enter');
        await page.waitForTimeout(3000);
      }
    }

    // 检查当前URL
    console.log(`当前URL: ${page.url()}`);

    // 如果登录成功，检查页面
    if (!page.url().includes('login')) {
      console.log('登录成功！');

      // 检查系统管理页面
      console.log('\n=== 检查系统管理页面 ===');
      await page.goto('http://localhost:5173/system', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const sysContent = await page.textContent('body');
      console.log(`系统管理内容: ${sysContent.substring(0, 300)}`);

      // 检查所有主要页面
      console.log('\n=== 检查所有主要页面 ===');
      const routes = [
        { path: '/', name: '首页' },
        { path: '/requirement-testing', name: '需求测试' },
        { path: '/ai-web-automation', name: 'AI Web自动化' },
        { path: '/defects', name: '缺陷管理' },
        { path: '/executions', name: '执行管理' },
        { path: '/reports', name: '分析报告' },
        { path: '/users', name: '用户管理' },
        { path: '/system', name: '系统管理' },
        { path: '/knowledge-base', name: '知识库' },
      ];

      for (const route of routes) {
        await page.goto(`http://localhost:5173${route.path}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        const content = await page.textContent('body');
        const hasContent = content.length > 100 && !content.includes('登录');
        console.log(`${hasContent ? '✅' : '❌'} ${route.name} (${route.path})`);
      }

      // 截图首页
      await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'scripts/final-home.png', fullPage: true });
      console.log('\n✅ 首页截图已保存: scripts/final-home.png');

    } else {
      console.log('登录失败，仍在登录页面');
      await page.screenshot({ path: 'scripts/debug-login-failed.png' });
    }

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await browser.close();
  }
}

checkPages();
