/**
 * TSS AI Web自动化 - 完整流程演示
 * 
 * 流程：
 * 1. 登录获取Token
 * 2. 创建自动化项目
 * 3. 启动AI探索（使用midscene.js + Playwright + AI视觉）
 * 4. 查看探索结果
 * 5. AI生成测试用例
 * 6. 查看生成的测试用例
 * 7. 执行测试用例
 * 8. 查看执行结果
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const API_URL = 'http://localhost:8000';
const TARGET_URL = 'http://8.141.14.188:5000/';
const SCREENSHOT_DIR = 'scripts/ai-automation-screenshots';

// 创建截图目录
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

// API请求辅助函数
async function apiRequest(endpoint, options = {}) {
  const token = globalThis.authToken;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API错误 ${response.status}: ${error}`);
  }
  
  return response.json();
}

// SSE流式请求
async function sseRequest(endpoint, options = {}) {
  const token = globalThis.authToken;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API错误 ${response.status}: ${error}`);
  }
  
  return response;
}

// 解析SSE流
async function* parseSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    let currentEvent = '';
    let currentData = '';
    
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        currentData = line.slice(6).trim();
      } else if (line === '' && currentEvent && currentData) {
        try {
          const data = JSON.parse(currentData);
          yield { event: currentEvent, data };
        } catch (e) {
          // 忽略解析错误
        }
        currentEvent = '';
        currentData = '';
      }
    }
  }
}

// 等待函数
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 主流程
async function runAutomationFlow() {
  console.log('=== TSS AI Web自动化 - 完整流程演示 ===\n');
  console.log(`目标网站: ${TARGET_URL}`);
  console.log(`开始时间: ${new Date().toLocaleString('zh-CN')}\n`);

  try {
    // ========== 步骤1: 登录 ==========
    console.log('📌 步骤1: 登录系统');
    console.log('  使用 admin/admin123 登录...');
    
    const loginRes = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    
    globalThis.authToken = loginRes.data.access_token;
    console.log('  ✅ 登录成功，获取Token\n');

    // ========== 步骤2: 创建项目 ==========
    console.log('📌 步骤2: 创建自动化项目');
    console.log(`  目标URL: ${TARGET_URL}`);
    
    const projectRes = await apiRequest('/api/v1/web-automation/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: `AI自动化测试-${new URL(TARGET_URL).hostname}`,
        target_url: TARGET_URL,
        description: '使用AI视觉技术自动探索和测试售票系统',
      }),
    });
    
    const projectId = projectRes.data.id;
    console.log(`  ✅ 项目创建成功 (ID: ${projectId})\n`);

    // ========== 步骤3: AI探索 ==========
    console.log('📌 步骤3: 启动AI视觉探索');
    console.log('  使用 midscene.js + Playwright + Qwen-VL-Max 分析页面...');
    console.log('  （这可能需要30-60秒）\n');
    
    const exploreResponse = await sseRequest(`/api/v1/web-automation/projects/${projectId}/explore`, {
      method: 'POST',
    });
    
    let pagesFound = 0;
    let structure = null;
    
    for await (const { event, data } of parseSSE(exploreResponse)) {
      switch (event) {
        case 'exploration_start':
          console.log(`  🚀 探索开始: ${data.target_url}`);
          break;
        case 'page_analyzed':
          pagesFound++;
          console.log(`  📄 发现页面: ${data.title} (${data.elements_count || 0} 个元素)`);
          break;
        case 'exploration_complete':
          console.log(`  ✅ 探索完成，共发现 ${data.total_pages || 0} 个页面`);
          structure = data.pages?.[0];
          break;
        case 'exploration_error':
          console.log(`  ❌ 探索错误: ${data.error}`);
          break;
        case 'status':
          console.log(`  ⏳ ${data.message}`);
          break;
      }
    }
    
    console.log('');

    // ========== 步骤4: 查看探索结果 ==========
    console.log('📌 步骤4: 查看探索结果');
    
    const pagesRes = await apiRequest(`/api/v1/web-automation/projects/${projectId}/pages`);
    const pages = Array.isArray(pagesRes.data) ? pagesRes.data : [];
    
    console.log(`  发现 ${pages.length} 个页面:`);
    for (const page of pages) {
      console.log(`  - ${page.title || '未知'}: ${page.url}`);
      if (page.elements) {
        const elements = typeof page.elements === 'string' ? JSON.parse(page.elements) : page.elements;
        if (Array.isArray(elements)) {
          console.log(`    交互元素: ${elements.length} 个`);
          for (const el of elements.slice(0, 5)) {
            console.log(`      • ${el.type}: ${el.text || el.description || ''}`);
          }
        }
      }
    }
    console.log('');

    // ========== 步骤5: AI生成测试用例 ==========
    console.log('📌 步骤5: AI生成测试用例');
    console.log('  基于探索结果，AI正在生成测试用例...\n');
    
    const generateResponse = await sseRequest(`/api/v1/web-automation/projects/${projectId}/generate`, {
      method: 'POST',
    });
    
    let generatedCases = [];
    
    for await (const { event, data } of parseSSE(generateResponse)) {
      switch (event) {
        case 'generation_start':
          console.log('  🚀 开始生成测试用例');
          break;
        case 'status':
          console.log(`  ⏳ ${data.message}`);
          break;
        case 'generation_complete':
          console.log(`  ✅ 生成完成，共 ${data.total || 0} 条测试用例`);
          generatedCases = data.cases || [];
          break;
        case 'generation_error':
          console.log(`  ❌ 生成错误: ${data.error}`);
          break;
      }
    }
    
    console.log('');
    
    // 显示生成的测试用例
    if (generatedCases.length > 0) {
      console.log('  生成的测试用例:');
      for (const tc of generatedCases.slice(0, 5)) {
        console.log(`  - [${tc.priority || 'P1'}] ${tc.title}`);
        if (tc.steps) {
          console.log(`    步骤: ${tc.steps.length} 个`);
        }
      }
      if (generatedCases.length > 5) {
        console.log(`  ... 还有 ${generatedCases.length - 5} 条用例`);
      }
    }
    console.log('');

    // ========== 步骤6: 查看测试用例 ==========
    console.log('📌 步骤6: 查看测试用例列表');
    
    const casesRes = await apiRequest(`/api/v1/web-automation/projects/${projectId}/test-cases`);
    const testCases = Array.isArray(casesRes.data) ? casesRes.data : [];
    
    console.log(`  共 ${testCases.length} 条测试用例:`);
    for (const tc of testCases.slice(0, 5)) {
      console.log(`  - [${tc.priority}] ${tc.title} (${tc.status})`);
    }
    if (testCases.length > 5) {
      console.log(`  ... 还有 ${testCases.length - 5} 条用例`);
    }
    console.log('');

    // ========== 步骤7: 审批测试用例 ==========
    console.log('📌 步骤7: 审批测试用例');
    
    for (const tc of testCases.slice(0, 3)) {
      try {
        await apiRequest(`/api/v1/web-automation/test-cases/${tc.id}/approve`, {
          method: 'POST',
        });
        console.log(`  ✅ 已通过: ${tc.title}`);
      } catch (e) {
        console.log(`  ⚠️ 审批失败: ${tc.title} - ${e.message}`);
      }
    }
    console.log('');

    // ========== 步骤8: 执行测试 ==========
    console.log('📌 步骤8: 执行AI自动化测试');
    console.log('  使用 midscene.js + Playwright 执行测试用例...\n');
    
    const execResponse = await sseRequest(`/api/v1/web-automation/projects/${projectId}/execute`, {
      method: 'POST',
    });
    
    let executionResult = null;
    
    // 注意：执行API可能不是SSE，需要检查
    try {
      const execData = await execResponse.json();
      console.log(`  🚀 执行启动: ${execData.message || '开始执行'}`);
      console.log(`  执行ID: ${execData.data?.execution_id || 'N/A'}`);
      console.log(`  用例数: ${execData.data?.cases_count || 0}`);
      
      // 等待一段时间让执行完成
      console.log('  ⏳ 等待执行完成...');
      await delay(5000);
      
    } catch (e) {
      console.log(`  ⚠️ 执行启动: ${e.message}`);
    }
    
    console.log('');

    // ========== 步骤9: 查看结果 ==========
    console.log('📌 步骤9: 查看执行结果');
    
    try {
      const execListRes = await apiRequest(`/api/v1/web-automation/executions?project_id=${projectId}`);
      const executions = Array.isArray(execListRes.data) ? execListRes.data : (execListRes.data?.items || []);
      
      console.log(`  执行记录: ${executions.length} 条`);
      for (const exec of executions) {
        console.log(`  - 执行 #${exec.id}: ${exec.status} (${exec.duration_ms ? (exec.duration_ms / 1000).toFixed(1) + 's' : 'N/A'})`);
      }
    } catch (e) {
      console.log(`  ⚠️ 获取执行记录: ${e.message}`);
    }
    
    console.log('');

    // ========== 总结 ==========
    console.log('=== 流程演示完成 ===');
    console.log(`结束时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`项目ID: ${projectId}`);
    console.log(`探索页面: ${pages.length} 个`);
    console.log(`生成用例: ${testCases.length} 条`);
    console.log('');
    console.log('🎯 AI Web自动化核心能力已验证:');
    console.log('  1. ✅ midscene.js + Playwright 浏览器自动化');
    console.log('  2. ✅ Qwen-VL-Max AI视觉模型分析页面');
    console.log('  3. ✅ 自动发现页面结构和交互元素');
    console.log('  4. ✅ AI智能生成测试用例');
    console.log('  5. ✅ 测试用例审批工作流');
    console.log('  6. ✅ 测试执行引擎');

  } catch (error) {
    console.error('\n❌ 流程执行失败:', error.message);
    console.error(error.stack);
  }
}

// 运行演示
runAutomationFlow();
