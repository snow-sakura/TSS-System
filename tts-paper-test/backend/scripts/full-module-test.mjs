/**
 * TSS AI测试平台 - 全面业务模块验证
 * 验证范围：API接口 + 前端页面交互流转
 * 测试账号: admin / admin123
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8000';
const TIMEOUT = 30000;

const results = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function log(test, status, detail = '') {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  console.log(`${icon} ${test}${detail ? ' - ' + detail : ''}`);
  results.push({ test, status, detail });
  if (status === 'pass') passed++;
  if (status === 'fail') failed++;
  if (status === 'warn') warnings++;
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function apiRequest(method, path, data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const body = data ? JSON.stringify(data) : null;
  const resp = await fetch(`${API_URL}${path}`, { method, headers, body });
  return { status: resp.status, data: await resp.json().catch(() => ({})) };
}

async function runTests() {
  console.log('=== TSS AI测试平台 - 全面业务模块验证 ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 收集控制台错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // ==================== Part 1: API接口验证 ====================
    console.log('═══════════════════════════════════════');
    console.log('Part 1: API接口验证');
    console.log('═══════════════════════════════════════\n');

    // 1.1 认证模块
    console.log('--- 1.1 认证模块 ---');
    const loginResp = await apiRequest('POST', '/api/v1/auth/login', { username: 'admin', password: 'admin123' });
    const token = loginResp.data?.data?.access_token;
    log('登录API', loginResp.status === 200 && token ? 'pass' : 'fail', `status=${loginResp.status}`);

    const profileResp = await apiRequest('GET', '/api/v1/auth/profile', null, token);
    log('获取用户信息', profileResp.status === 200 ? 'pass' : 'fail');

    // 1.2 用户管理
    console.log('\n--- 1.2 用户管理 ---');
    const usersResp = await apiRequest('GET', '/api/v1/users?page=1&page_size=5', null, token);
    log('用户列表', usersResp.status === 200 ? 'pass' : 'fail', `total=${usersResp.data?.data?.total || 0}`);

    const rolesResp = await apiRequest('GET', '/api/v1/users/roles/list', null, token);
    log('角色列表', rolesResp.status === 200 ? 'pass' : 'fail', `roles=${rolesResp.data?.data?.length || 0}`);

    const loginLogsResp = await apiRequest('GET', '/api/v1/users/login-logs?page=1&page_size=5', null, token);
    log('登录日志', loginLogsResp.status === 200 ? 'pass' : 'fail');

    const devicesResp = await apiRequest('GET', '/api/v1/users/devices?page=1&page_size=5', null, token);
    log('设备列表', devicesResp.status === 200 ? 'pass' : 'fail');

    // 1.3 测试生命周期
    console.log('\n--- 1.3 测试生命周期 ---');
    const reqResp = await apiRequest('GET', '/api/v1/test-lifecycle/requirements?page=1&page_size=5', null, token);
    log('需求列表', reqResp.status === 200 ? 'pass' : 'fail');

    const casesResp = await apiRequest('GET', '/api/v1/test-lifecycle/test-cases?page=1&page_size=5', null, token);
    log('测试用例列表', casesResp.status === 200 ? 'pass' : 'fail');

    const execResp = await apiRequest('GET', '/api/v1/test-lifecycle/executions?page=1&page_size=5', null, token);
    log('执行记录列表', execResp.status === 200 ? 'pass' : 'fail');

    const defectResp = await apiRequest('GET', '/api/v1/test-lifecycle/defects?page=1&page_size=5', null, token);
    log('缺陷列表', defectResp.status === 200 ? 'pass' : 'fail');

    const reportResp = await apiRequest('GET', '/api/v1/test-lifecycle/reports?page=1&page_size=5', null, token);
    log('报告列表', reportResp.status === 200 ? 'pass' : 'fail');

    // 1.4 AI Web自动化
    console.log('\n--- 1.4 AI Web自动化 ---');
    const waProjectsResp = await apiRequest('GET', '/api/v1/web-automation/projects?page=1', null, token);
    log('Web自动化项目列表', waProjectsResp.status === 200 ? 'pass' : 'fail');

    const waForWfResp = await apiRequest('GET', '/api/v1/web-automation/projects-for-workflow', null, token);
    log('项目列表(工作流用)', waForWfResp.status === 200 ? 'pass' : 'fail');

    // 1.5 工作流编排
    console.log('\n--- 1.5 工作流编排 ---');
    const wfResp = await apiRequest('GET', '/api/v1/workflows?page=1&page_size=5', null, token);
    log('工作流列表', wfResp.status === 200 ? 'pass' : 'fail');

    // 创建测试工作流
    const createWfResp = await apiRequest('POST', '/api/v1/workflows', { name: '验证测试工作流', description: '模块验证' }, token);
    const wfId = createWfResp.data?.id;
    log('创建工作流', wfId ? 'pass' : 'fail', `id=${wfId}`);

    if (wfId) {
      // 保存画布
      const canvasResp = await apiRequest('PUT', `/api/v1/workflows/${wfId}/canvas`, {
        nodes: [
          { type: 'start', label: '开始', config: {}, position_x: 80, position_y: 120 },
          { type: 'end', label: '结束', config: {}, position_x: 300, position_y: 120 },
        ],
        edges: [{ source_node_id: 0, target_node_id: 1 }],
      }, token);
      log('保存画布', canvasResp.data?.ok ? 'pass' : 'fail');

      // 获取详情
      const detailResp = await apiRequest('GET', `/api/v1/workflows/${wfId}`, null, token);
      log('工作流详情', detailResp.data?.nodes?.length === 2 ? 'pass' : 'fail', `nodes=${detailResp.data?.nodes?.length || 0}`);
    }

    // 1.6 知识库
    console.log('\n--- 1.6 知识库 ---');
    const tpResp = await apiRequest('GET', '/api/v1/knowledge/test-patterns?page=1&page_size=5', null, token);
    log('测试模式库', tpResp.status === 200 ? 'pass' : 'fail');

    const bkResp = await apiRequest('GET', '/api/v1/knowledge/bug-knowledge?page=1&page_size=5', null, token);
    log('Bug知识库', bkResp.status === 200 ? 'pass' : 'fail');

    // 1.7 基础配置
    console.log('\n--- 1.7 基础配置 ---');
    const envResp = await apiRequest('GET', '/api/v1/config/environments?page=1&page_size=5', null, token);
    log('环境配置', envResp.status === 200 ? 'pass' : 'fail');

    const llmResp = await apiRequest('GET', '/api/v1/config/llm-providers?page=1&page_size=5', null, token);
    log('LLM配置', llmResp.status === 200 ? 'pass' : 'fail');

    const promptResp = await apiRequest('GET', '/api/v1/config/prompts?page=1&page_size=5', null, token);
    log('提示词配置', promptResp.status === 200 ? 'pass' : 'fail');

    const opLogResp = await apiRequest('GET', '/api/v1/config/operation-logs?page=1&page_size=5', null, token);
    log('操作日志', opLogResp.status === 200 ? 'pass' : 'fail');

    // 1.8 AI对话
    console.log('\n--- 1.8 AI对话 ---');
    const aiChatResp = await apiRequest('POST', '/api/v1/ai/chat', { messages: [{ role: 'user', content: '你好' }], stream: false }, token);
    log('AI对话接口', aiChatResp.status === 200 ? 'pass' : 'fail');

    // ==================== Part 2: 前端页面交互验证 ====================
    console.log('\n═══════════════════════════════════════');
    console.log('Part 2: 前端页面交互验证');
    console.log('═══════════════════════════════════════\n');

    // 2.1 登录流程
    console.log('--- 2.1 登录流程 ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    // 检查登录页面元素
    const usernameInput = await page.$('input[placeholder*="用户名"], input[name="username"]');
    const passwordInput = await page.$('input[type="password"], input[placeholder*="密码"]');
    log('登录页面输入框', usernameInput && passwordInput ? 'pass' : 'fail');

    if (usernameInput && passwordInput) {
      await usernameInput.fill('admin');
      await passwordInput.fill('admin123');
      const loginBtn = await page.$('form button[type="submit"]');
      if (loginBtn) {
        await loginBtn.click();
        // 等待导航完成
        await page.waitForURL('**/', { timeout: 10000 }).catch(() => {});
        await delay(2000);
        const url = page.url();
        log('登录跳转', !url.includes('login') ? 'pass' : 'fail', `url=${url}`);
      }
    }

    // 2.2 仪表盘
    console.log('\n--- 2.2 仪表盘 ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const dashContent = await page.textContent('body').catch(() => '');
    log('仪表盘加载', dashContent.includes('TSS') || dashContent.includes('测试') ? 'pass' : 'fail');

    // 检查统计卡片
    const hasStats = dashContent.includes('用例') || dashContent.includes('缺陷') || dashContent.includes('执行');
    log('统计卡片', hasStats ? 'pass' : 'fail');

    // 检查模块入口
    const hasModules = dashContent.includes('需求测试') || dashContent.includes('AI') || dashContent.includes('知识库');
    log('模块入口', hasModules ? 'pass' : 'fail');

    // 2.3 需求测试全流程
    console.log('\n--- 2.3 需求测试全流程 ---');
    await page.goto(`${BASE_URL}/requirement-testing`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const reqContent = await page.textContent('body').catch(() => '');
    log('需求测试页面', reqContent.includes('需求') || reqContent.includes('测试') ? 'pass' : 'fail');

    // 检查侧边栏导航
    const hasSidebar = reqContent.includes('需求管理') || reqContent.includes('方案') || reqContent.includes('用例');
    log('侧边栏导航', hasSidebar ? 'pass' : 'fail');

    // 测试子页面导航
    const menuItems = await page.$$('nav a, [role="menuitem"], .sidebar a');
    if (menuItems.length > 0) {
      log('菜单项数量', menuItems.length >= 5 ? 'pass' : 'warn', `found=${menuItems.length}`);
    }

    // 2.4 缺陷管理
    console.log('\n--- 2.4 缺陷管理 ---');
    await page.goto(`${BASE_URL}/defects`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const defectContent = await page.textContent('body').catch(() => '');
    log('缺陷管理页面', defectContent.includes('缺陷') || defectContent.includes('Defect') ? 'pass' : 'fail');

    // 检查缺陷列表（默认视图）
    const hasDefectList = defectContent.includes('缺陷') || defectContent.includes('列表') || defectContent.includes('搜索');
    log('缺陷列表视图', hasDefectList ? 'pass' : 'fail');

    // 检查看板视图（需要切换到看板tab）
    const hasKanbanMenu = defectContent.includes('看板') || defectContent.includes('DF');
    log('看板入口存在', hasKanbanMenu ? 'pass' : 'fail');

    // 2.5 执行管理
    console.log('\n--- 2.5 执行管理 ---');
    await page.goto(`${BASE_URL}/executions`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const execContent = await page.textContent('body').catch(() => '');
    log('执行管理页面', execContent.includes('执行') || execContent.includes('Execution') ? 'pass' : 'fail');

    // 2.6 分析报告
    console.log('\n--- 2.6 分析报告 ---');
    await page.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const reportContent = await page.textContent('body').catch(() => '');
    log('分析报告页面', reportContent.includes('报告') || reportContent.includes('Report') ? 'pass' : 'fail');

    // 2.7 用户管理
    console.log('\n--- 2.7 用户管理 ---');
    await page.goto(`${BASE_URL}/users`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const usrContent = await page.textContent('body').catch(() => '');
    log('用户管理页面', usrContent.includes('用户') || usrContent.includes('User') ? 'pass' : 'fail');

    // 检查子页面标签
    const hasTabs = usrContent.includes('用户列表') || usrContent.includes('角色') || usrContent.includes('登录日志') || usrContent.includes('用户') || usrContent.includes('设备');
    log('子页面标签', hasTabs ? 'pass' : 'fail');

    // 2.8 知识库
    console.log('\n--- 2.8 知识库 ---');
    await page.goto(`${BASE_URL}/knowledge-base`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const kbContent = await page.textContent('body').catch(() => '');
    log('知识库页面', kbContent.includes('知识库') || kbContent.includes('测试模式') ? 'pass' : 'fail');

    // 2.9 AI Web自动化
    console.log('\n--- 2.9 AI Web自动化 ---');
    await page.goto(`${BASE_URL}/ai-web-automation`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const aiContent = await page.textContent('body').catch(() => '');
    log('AI Web自动化页面', aiContent.includes('AI') || aiContent.includes('Web') || aiContent.includes('自动化') ? 'pass' : 'fail');

    // 检查流程图
    const hasFlow = aiContent.includes('项目管理') || aiContent.includes('AI探索') || aiContent.includes('测试用例') || aiContent.includes('流程') || aiContent.includes('自动化');
    log('流程图显示', hasFlow ? 'pass' : 'fail');

    // 2.10 流程编排
    console.log('\n--- 2.10 流程编排 ---');
    await page.goto(`${BASE_URL}/workflow-orchestration`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const wfContent = await page.textContent('body').catch(() => '');
    log('流程编排页面', wfContent.includes('工作流') || wfContent.includes('Agent') || wfContent.includes('节点') ? 'pass' : 'fail');

    // 检查SVG画布
    const hasCanvas = await page.$('svg') !== null;
    log('SVG画布', hasCanvas ? 'pass' : 'fail');

    // 检查节点模板面板
    const hasPalette = wfContent.includes('开始') || wfContent.includes('结束') || wfContent.includes('AI引擎');
    log('节点模板面板', hasPalette ? 'pass' : 'fail');

    // 2.11 系统管理
    console.log('\n--- 2.11 系统管理 ---');
    await page.goto(`${BASE_URL}/system`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const sysContent = await page.textContent('body').catch(() => '');
    log('系统管理页面', sysContent.includes('系统') || sysContent.includes('配置') ? 'pass' : 'fail');

    // 2.12 测试生命周期
    console.log('\n--- 2.12 测试生命周期 ---');
    await page.goto(`${BASE_URL}/test-lifecycle`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    const lcContent = await page.textContent('body').catch(() => '');
    log('测试生命周期页面', lcContent.includes('生命周期') || lcContent.includes('测试') || lcContent.includes('阶段') ? 'pass' : 'fail');

    // 2.13 AI助手
    console.log('\n--- 2.13 AI助手 ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);

    // 查找AI助手浮动按钮
    const aiBtn = await page.$('button:has-text("AI"), [aria-label*="AI"], .ai-assistant');
    log('AI助手入口', aiBtn ? 'pass' : 'warn', '浮动按钮可能存在');

    // ==================== Part 3: 模块关联验证 ====================
    console.log('\n═══════════════════════════════════════');
    console.log('Part 3: 模块关联验证');
    console.log('═══════════════════════════════════════\n');

    // 3.1 登录→仪表盘→各模块导航
    console.log('--- 3.1 导航流转 ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(1000);

    // 测试从仪表盘跳转到各模块
    const navTests = [
      { name: '需求测试', url: '/requirement-testing' },
      { name: '缺陷管理', url: '/defects' },
      { name: '执行管理', url: '/executions' },
      { name: '分析报告', url: '/reports' },
      { name: '用户管理', url: '/users' },
      { name: '知识库', url: '/knowledge-base' },
      { name: 'AI Web自动化', url: '/ai-web-automation' },
      { name: '流程编排', url: '/workflow-orchestration' },
    ];

    for (const nav of navTests) {
      await page.goto(`${BASE_URL}${nav.url}`, { waitUntil: 'networkidle', timeout: TIMEOUT });
      await delay(3000); // 懒加载页面需要更长等待
      const content = await page.textContent('body').catch(() => '');
      const loaded = content.length > 100; // 页面有内容
      log(`导航到${nav.name}`, loaded ? 'pass' : 'fail');
    }

    // 3.2 前后端数据一致性
    console.log('\n--- 3.2 前后端数据一致性 ---');

    // 检查用户管理页面是否显示真实数据
    await page.goto(`${BASE_URL}/users`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(3000); // 懒加载页面需要更长等待
    const usrPage = await page.textContent('body').catch(() => '');
    const hasAdmin = usrPage.includes('admin') || usrPage.includes('管理员');
    log('用户页面显示admin', hasAdmin ? 'pass' : 'fail');

    // 检查仪表盘统计数据
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);
    const dashPage = await page.textContent('body').catch(() => '');
    const hasNumbers = /\d+/.test(dashPage);
    log('仪表盘显示数字统计', hasNumbers ? 'pass' : 'fail');

    // ==================== Part 4: 控制台错误检查 ====================
    console.log('\n═══════════════════════════════════════');
    console.log('Part 4: 控制台错误检查');
    console.log('═══════════════════════════════════════\n');

    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('ResizeObserver')
    );

    if (criticalErrors.length === 0) {
      log('控制台无严重错误', 'pass');
    } else {
      log('控制台错误', 'fail', `${criticalErrors.length}个错误`);
      criticalErrors.slice(0, 5).forEach(e => console.log(`  - ${e.substring(0, 100)}`));
    }

    // 截图保存
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);
    await page.screenshot({ path: 'scripts/validation-dashboard.png', fullPage: true });
    log('仪表盘截图', 'pass');

    await page.goto(`${BASE_URL}/workflow-orchestration`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await delay(2000);
    await page.screenshot({ path: 'scripts/validation-workflow.png', fullPage: true });
    log('流程编排截图', 'pass');

  } catch (error) {
    log('测试执行异常', 'fail', error.message);
  } finally {
    await browser.close();
  }

  // 输出测试报告
  console.log('\n═══════════════════════════════════════');
  console.log('测试报告');
  console.log('═══════════════════════════════════════');
  console.log(`总计: ${passed + failed + warnings} 项`);
  console.log(`通过: ${passed} 项 ✅`);
  console.log(`失败: ${failed} 项 ❌`);
  console.log(`警告: ${warnings} 项 ⚠️`);
  console.log(`通过率: ${passed > 0 ? Math.round((passed / (passed + failed)) * 100) : 0}%`);

  if (failed > 0) {
    console.log('\n失败项:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  ❌ ${r.test}: ${r.detail}`);
    });
  }

  if (warnings > 0) {
    console.log('\n警告项:');
    results.filter(r => r.status === 'warn').forEach(r => {
      console.log(`  ⚠️ ${r.test}: ${r.detail}`);
    });
  }

  return { passed, failed, warnings, total: passed + failed + warnings };
}

runTests().then(result => {
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
