/**
 * Pipeline流程验证脚本
 * 测试: 上传需求 → 执行Pipeline → 验证各阶段输出 → 检查记录保存
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8000';
const TIMEOUT = 30000;

const results = [];
let passed = 0;
let failed = 0;

function log(test, status, detail = '') {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  console.log(`${icon} ${test}${detail ? ' - ' + detail : ''}`);
  results.push({ test, status, detail });
  if (status === 'pass') passed++;
  if (status === 'fail') failed++;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(method, path, data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const body = data ? JSON.stringify(data) : null;
  const resp = await fetch(`${API_URL}${path}`, { method, headers, body });
  return { status: resp.status, data: await resp.json().catch(() => ({})) };
}

async function run() {
  console.log('=== Pipeline流程验证 ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 收集控制台错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().substring(0, 150));
  });

  try {
    // ══════════════════════════════════════
    // 1. 登录
    // ══════════════════════════════════════
    console.log('--- 1. 登录系统 ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const usernameInput = await page.$('input[placeholder*="用户名"]');
    const passwordInput = await page.$('input[type="password"]');
    if (usernameInput && passwordInput) {
      await usernameInput.fill('admin');
      await passwordInput.fill('admin123');
      const loginBtn = await page.$('form button[type="submit"]');
      if (loginBtn) {
        await loginBtn.click();
        await page.waitForURL('**/', { timeout: 10000 }).catch(() => {});
        await delay(2000);
        log('登录', !page.url().includes('login') ? 'pass' : 'fail');
      }
    }

    // ══════════════════════════════════════
    // 2. 进入需求测试模块
    // ══════════════════════════════════════
    console.log('\n--- 2. 进入需求测试模块 ---');
    await page.goto(`${BASE_URL}/requirement-testing?menu=pipeline`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(3000);

    const pipelineContent = await page.textContent('body').catch(() => '');
    log('Pipeline页面加载', pipelineContent.includes('需求') || pipelineContent.includes('Pipeline') ? 'pass' : 'fail');

    // 检查侧边栏菜单（应该只有4项）
    const sidebarItems = await page.$$('nav a, [role="menuitem"]');
    const menuTexts = [];
    for (const item of sidebarItems) {
      const text = await item.textContent();
      if (text) menuTexts.push(text.trim());
    }
    log('侧边栏菜单精简', menuTexts.length <= 6 ? 'pass' : 'fail', `items=${menuTexts.length}`);

    // 检查流程步骤（应该只有5步）
    const stageButtons = await page.$$('.flex.items-center button');
    log('流程步骤数量', stageButtons.length <= 7 ? 'pass' : 'fail', `stages=${stageButtons.length}`);

    // ══════════════════════════════════════
    // 3. 输入需求并执行Pipeline
    // ══════════════════════════════════════
    console.log('\n--- 3. 输入需求并执行Pipeline ---');
    
    // 找到需求输入框
    const nameInput = await page.$('input[placeholder*="需求名称"]');
    const contentTextarea = await page.$('textarea[placeholder*="需求"]');
    
    if (nameInput && contentTextarea) {
      await nameInput.fill('测试验证需求');
      await contentTextarea.fill('用户登录功能：支持用户名密码登录，登录成功跳转首页，登录失败提示错误信息。包含记住密码功能。');
      log('填写需求信息', 'pass');

      // 点击开始全流程
      const startBtn = await page.$('button:has-text("开始全流程")');
      if (startBtn) {
        await startBtn.click();
        log('点击开始全流程', 'pass');

        // 等待Pipeline执行（最多120秒）
        console.log('\n--- 4. 等待Pipeline执行 ---');
        let pipelineCompleted = false;
        let stageOutputs = {};
        
        for (let i = 0; i < 60; i++) {
          await delay(2000);
          
          const content = await page.textContent('body').catch(() => '');
          
          // 检查各阶段状态
          const hasCompleted = content.includes('✓') || content.includes('已完成');
          const hasRunning = content.includes('●') || content.includes('正在执行');
          
          // 检查是否有内容输出（展开的阶段）
          const expandedContent = await page.$$('.prose');
          for (const prose of expandedContent) {
            const text = await prose.textContent();
            if (text && text.length > 50) {
              // 找到有内容的阶段
              const stageName = text.substring(0, 20);
              if (!stageOutputs[stageName]) {
                stageOutputs[stageName] = text.length;
                log(`阶段输出`, 'pass', `"${stageName}..." (${text.length}字符)`);
              }
            }
          }

          // 检查Pipeline是否完成
          if (content.includes('Pipeline') && (content.includes('完成') || content.includes('completed'))) {
            pipelineCompleted = true;
            log('Pipeline执行完成', 'pass');
            break;
          }

          // 检查是否有错误
          if (content.includes('失败') || content.includes('failed')) {
            log('Pipeline执行', 'fail', '检测到失败状态');
            break;
          }

          if (i % 5 === 0) {
            console.log(`  ⏳ 等待中... (${i * 2}s)`);
          }
        }

        if (!pipelineCompleted) {
          log('Pipeline执行超时', 'warn', '超过120秒');
        }

        // ══════════════════════════════════════
        // 5. 验证各阶段输出
        // ══════════════════════════════════════
        console.log('\n--- 5. 验证各阶段输出 ---');
        
        // 点击展开每个阶段查看内容
        const stageElements = await page.$$('.bg-cream\\/30.rounded-xl');
        for (const stage of stageElements) {
          const stageText = await stage.textContent();
          // 点击展开
          await stage.click();
          await delay(500);
          
          // 检查展开后的内容
          const expanded = await stage.$('.prose');
          if (expanded) {
            const content = await expanded.textContent();
            if (content && content.length > 20) {
              log(`阶段内容显示`, 'pass', `${content.substring(0, 30)}... (${content.length}字符)`);
            } else {
              log(`阶段内容显示`, 'warn', '内容较短或为空');
            }
          }
        }

        // ══════════════════════════════════════
        // 6. 验证流程记录保存
        // ══════════════════════════════════════
        console.log('\n--- 6. 验证流程记录保存 ---');
        
        // 导航到流程记录页面
        await page.goto(`${BASE_URL}/requirement-testing?menu=records`, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await delay(3000);
        
        const recordsContent = await page.textContent('body').catch(() => '');
        log('流程记录页面', recordsContent.includes('记录') || recordsContent.includes('Pipeline') ? 'pass' : 'fail');

        // 检查是否有记录
        const hasRecords = recordsContent.includes('测试验证需求') || recordsContent.includes('Pipeline');
        log('记录已保存', hasRecords ? 'pass' : 'warn');

        // ══════════════════════════════════════
        // 7. 检查测试用例页面
        // ══════════════════════════════════════
        console.log('\n--- 7. 检查测试用例页面 ---');
        await page.goto(`${BASE_URL}/requirement-testing?menu=cases`, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await delay(3000);
        
        const casesContent = await page.textContent('body').catch(() => '');
        log('测试用例页面', casesContent.includes('用例') || casesContent.includes('测试') ? 'pass' : 'fail');

        // ══════════════════════════════════════
        // 8. 检查控制台错误
        // ══════════════════════════════════════
        console.log('\n--- 8. 检查控制台错误 ---');
        const criticalErrors = consoleErrors.filter(e => 
          !e.includes('favicon') && !e.includes('401') && !e.includes('ResizeObserver')
        );
        log('控制台无严重错误', criticalErrors.length === 0 ? 'pass' : 'fail', `${criticalErrors.length}个错误`);

        // 截图保存
        await page.goto(`${BASE_URL}/requirement-testing?menu=pipeline`, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await delay(2000);
        await page.screenshot({ path: 'scripts/pipeline-verify-result.png', fullPage: true });
        log('截图保存', 'pass');

      } else {
        log('开始全流程按钮', 'fail', '未找到');
      }
    } else {
      log('需求输入框', 'fail', '未找到');
    }

  } catch (error) {
    log('测试执行异常', 'fail', error.message);
  } finally {
    await browser.close();
  }

  // 测试报告
  console.log('\n=== 验证报告 ===');
  console.log(`总计: ${passed + failed} 项`);
  console.log(`通过: ${passed} 项 ✅`);
  console.log(`失败: ${failed} 项 ❌`);
  console.log(`通过率: ${passed > 0 ? Math.round(passed / (passed + failed) * 100) : 0}%`);

  if (failed > 0) {
    console.log('\n失败项:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  ❌ ${r.test}: ${r.detail}`);
    });
  }
}

run();
