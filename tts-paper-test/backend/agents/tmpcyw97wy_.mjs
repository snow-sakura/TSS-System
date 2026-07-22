import { chromium } from 'playwright';
import { PlaywrightAgent } from '@midscene/web/playwright';

const startTime = Date.now();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const sendProgress = (msg) => {
    process.stdout.write(JSON.stringify(msg) + '\n');
};

try {
    sendProgress({ type: 'status', message: '正在访问目标页面...' });
    await page.goto('http://8.141.14.188:5000/', { waitUntil: 'networkidle', timeout: 30000 });

    const agent = new PlaywrightAgent(page, {
        modelConfig: {
            MIDSCENE_MODEL_NAME: 'qwen-vl-max',
            MIDSCENE_MODEL_API_KEY: 'sk-ws-H.EHLMMDM.squ1.MEUCIDxyE0j3GN62MI6URysSadxBSGPNQKQHRWvapBrhHOHSAiEAsNdjUXa2FlQ3iCJVu2AJSKvKwqtbNpNKSJHncLd4bxU',
            MIDSCENE_MODEL_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            MIDSCENE_MODEL_FAMILY: 'qwen3-vl'
        },
        generateReport: false,
    });

    sendProgress({ type: 'status', message: '开始执行测试步骤...' });

    // 执行测试步骤
        sendProgress({ type: 'step', step: 1, action: 'tap', target: '确认购买按钮', status: 'running' });
        await agent.aiTap('确认购买按钮');
        sendProgress({ type: 'step', step: 1, action: 'tap', target: '确认购买按钮', status: 'passed' });
        sendProgress({ type: 'step', step: 2, action: 'assert', target: '页面应提示\'请至少选择一个座位\'', status: 'running' });
        await agent.aiAssert('页面应提示\'请至少选择一个座位\'');
        sendProgress({ type: 'step', step: 2, action: 'assert', target: '页面应提示\'请至少选择一个座位\'', status: 'passed' });

    // 截图保存最终状态
    const screenshotPath = `/tmp/tss_exec_${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const duration = Date.now() - startTime;
    sendProgress({
        type: 'result',
        data: {
            status: 'passed',
            duration_ms: duration,
            screenshot: screenshotPath,
            steps_total: 2,
            message: '测试执行成功'
        }
    });

} catch (error) {
    const duration = Date.now() - startTime;
    let screenshotPath = '';
    try {
        screenshotPath = `/tmp/tss_exec_error_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });
    } catch (e) {}

    process.stdout.write(JSON.stringify({
        type: 'result',
        data: {
            status: 'failed',
            duration_ms: duration,
            screenshot: screenshotPath,
            error: error.message,
            message: `测试执行失败: ${error.message}`
        }
    }) + '\n');
} finally {
    await browser.close();
}
