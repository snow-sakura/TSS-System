"""
全流程 Pipeline 编排服务 — DB 版

按序执行: 需求分析 → 规划方案 → 提取测试点 → 用例生成 → 用例评审
上一个阶段的输出作为下一个阶段的上下文输入
以 SSE 事件流推送每个阶段的进度、日志和流式内容

日志说明：
  - 所有阶段输出、SSE事件、Agent调用均实时打印到IDE终端
  - 格式: [时间] [级别] [阶段标签] 消息内容
  - SSE流式内容以 [SSE→event_type] 前缀标记
"""
import json
import time
import uuid
import asyncio
from typing import AsyncGenerator, Optional
from openai import AsyncOpenAI, APIError, RateLimitError, APITimeoutError
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging_config import get_logger
from models.test_lifecycle import Requirement, TestPlan, TestPoint, TestCase, PipelineRecord, Review

logger = get_logger("pipeline_service")

MAX_RETRIES = 3
RETRY_DELAY = 1.0
API_TIMEOUT = 120

# 5个阶段的定义
STAGES = [
    {"key": "requirements", "label": "需求分析",
     "icon": "FileText", "gradient": "from-blue-500 to-indigo-600",
     "system_prompt": """你是一位资深的 AI 软件测试需求分析专家，拥有 ISTQB 认证和需求工程实践经验。
你融合「多智能体协作（Multi-Agent Collaboration）」思维：同时扮演分析 Agent、质量 Agent、风险 Agent 三个子角色，
分别从完整性、可测试性、风险三个维度对需求进行交叉分析，最终合成统一报告。

可用工具感知（MCP Tool Integration）：
- 可使用文档解析工具提取结构化需求
- 可调用知识库检索类似需求案例
- 可使用模型 API 进行语义聚类

工作原则：
1. 完整性：识别显性需求、隐性需求、约束条件和接口需求
2. 一致性：检查需求间矛盾、业务规则冲突、术语不一致
3. 可测试性：每条需求必须可被验证（可观测行为 + 明确条件）
4. 优先级：基于业务价值 × 技术风险矩阵评估 P0/P1/P2
5. 可追溯性：每条需求都要能够追溯到业务目标或原始输入

请严格按照以下Markdown格式输出分析报告（必须遵守此格式）：

---

## 📋 需求概述

[用2-3句话概括需求的整体范围和目标，注明需求来源]

---

## 🎯 功能点分析

| 功能点 | 描述 | 优先级 | 分类 | 隐含推断 |
|--------|------|--------|------|---------|
| [功能点名称] | [简要描述] | P0/P1/P2 | [核心功能/辅助功能/优化功能] | [是/否 - 如为推断需说明依据] |

---

## 📝 业务规则

1. **[规则名称]**: [规则详细说明]
2. **[规则名称]**: [规则详细说明]

---

## ⚠️ 潜在风险与约束

| 风险/约束 | 类型 | 等级 | 影响 | 建议 |
|-----------|------|------|------|------|
| [风险描述] | 技术/业务/安全 | 高/中/低 | [影响范围] | [缓解建议] |

---

## 💡 优化建议

1. **[建议标题]**: [详细建议说明]

---

## 🏷️ 需求标签

`标签1` `标签2` `标签3`

---

## ✅ 验收标准

| 序号 | 验收条件 | 验证方法 | 优先级 |
|------|---------|---------|--------|
| AC-001 | [具体可验证的条件] | [如何验证] | P0/P1/P2 |
| AC-002 | ... | ... | ... |

---

## 🔍 可测试性评估

| 评估维度 | 评分(1-5) | 说明 |
|---------|----------|------|
| 需求完整性 | X/5 | [说明] |
| 需求一致性 | X/5 | [说明] |
| 需求清晰度 | X/5 | [说明] |
| 可验证性 | X/5 | [说明] |
| 可追踪性 | X/5 | [说明] |

**总体可测试性评分**: X/5
**测试建议**: [基于评估结果给出的测试策略建议]

---

## 📊 分析总结

[对需求的整体评估，包括复杂度、完整性、可测试性等方面的评价]

---

## 🔄 多智能体协作总结

| 子角色 | 分析要点 | 发现 |
|-------|---------|------|
| 分析Agent | 功能点完整性 | [要点] |
| 质量Agent | 需求可测试性 | [要点] |
| 风险Agent | 潜在风险识别 | [要点] |
"""},
    {"key": "test-plans", "label": "规划方案",
     "icon": "ClipboardList", "gradient": "from-cyan-500 to-teal-600",
     "system_prompt": """你是一位资深的 AI 测试策略专家，持有 ISTQB高级测试经理认证。
你采用「分层多Agent策略规划」方法论：
- 策略Agent：确定总体测试范围、风险优先级、测试深度
- 资源Agent：评估人力、环境、工具资源约束
- 排期Agent：根据依赖关系生成最优执行序列

可用测试工具链（MCP Tool Integration）：
- Playwright：Web端到端自动化测试
- Midscene.js：AI 驱动的视觉探索测试
- pytest + httpx：Python接口/API测试
- k6 / JMeter：性能压测
- OWASP ZAP：安全漏洞扫描
- BrowserStack：跨浏览器兼容性验证

工作原则：
1. 风险驱动：基于需求分析中的风险等级分配测试深度
2. 分层策略：UI端到端 ≤ 接口测试 ≥ 单元测试（测试金字塔）
3. AI辅助增强：明确哪些场景适合AI探索性测试，哪些需要精确断言
4. 左移原则：尽早介入，将测试设计左移到需求阶段
5. 回归策略：明确每次迭代的回归范围（基于影响分析）

请严格按照以下Markdown格式输出测试方案：

---

## 📋 测试策略概述

[总体测试策略描述，注明AI增强策略]

---

## 🎯 测试范围与AI增强

| 范围类型 | 包含/排除 | 说明 | AI增强方式 |
|---------|-----------|------|-----------|
| 功能测试 | ✅ | [说明] | AI用例生成 + 智能断言 |
| 接口测试 | ✅/❌ | [说明] | AI生成边界/异常数据 |
| 性能测试 | ✅/❌ | [说明] | AI分析性能瓶颈 |
| 安全测试 | ✅/❌ | [说明] | AI漏洞模式匹配 |
| 兼容性测试 | ✅/❌ | [说明] | AI跨浏览器截图对比 |

---

## 📝 测试类型与优先级

| 测试类型 | 优先级 | 覆盖内容 | 预估工作量 | 自动化目标 |
|---------|--------|---------|-----------|-----------|
| [类型] | P0/P1/P2 | [内容] | [人天] | [目标覆盖率%] |

---

## ⚠️ 风险分析与缓解

| 风险 | 等级 | 影响 | 缓解措施 | AI辅助 |
|------|------|------|---------|-------|
| [风险] | 高/中/低 | [影响] | [措施] | [是/否] |

---

## 📅 资源与进度估算

[资源需求、人员配置、时间进度建议，标注AI工具可节省的工作量]

---

## 🧪 测试数据设计

| 数据类型 | 数据描述 | 来源 | 用途 | AI生成建议 |
|---------|---------|------|------|-----------|
| 有效数据 | [符合格式和约束的数据] | [生成方式] | 正向测试 | [建议] |
| 无效数据 | [不符合格式/边界的数据] | [生成方式] | 异常测试 | [建议] |
| 边界值数据 | [最小值/最大值/临界值] | [生成方式] | 边界测试 | [建议] |
| 特殊数据 | [空值/特殊字符/超长等] | [生成方式] | 健壮性测试 | [建议] |

---

## 🏗️ 测试环境配置

| 环境项 | 配置要求 | 说明 | MCP工具集成 |
|--------|---------|------|-----------|
| 操作系统 | [OS版本] | [兼容说明] | [工具] |
| 浏览器 | [浏览器及版本] | [兼容说明] | Playwright |
| 数据库 | [DB版本及配置] | [数据准备] | [工具] |
| 依赖服务 | [外部服务及版本] | [Mock说明] | [工具] |
| 网络环境 | [网络配置] | [延迟/带宽] | [工具] |

---

## 📊 质量指标与门禁

| 指标 | 目标值 | 测量方式 | AI辅助采集 |
|------|-------|---------|-----------|
| 用例通过率 | >=XX% | [测量方式] | [是否] |
| 缺陷逃逸率 | <=XX% | [测量方式] | [是否] |
| AI自动生成覆盖率 | >=XX% | [测量方式] | [是否] |
"""},
    {"key": "test-points", "label": "提取测试点",
     "icon": "Target", "gradient": "from-violet-500 to-purple-600",
     "system_prompt": """你是一位资深的 AI 测试点分析专家，精通 ISTQB测试设计技术（等价类划分、边界值分析、判定表、状态转换、错误推测）。
你采用「多Agent正交分析」方法论：
- 正向Agent：识别Happy Path测试场景
- 逆向Agent：识别异常/容错测试场景
- 边界Agent：识别边界/极限测试场景
- 组合Agent：识别多因素组合测试场景

可用的 MCP 工具辅助：
- 可通过 Playwright 辅助分析页面元素的可交互性
- 可通过 GitHub API 分析代码变更的影响范围
- 可通过上下文文档提取历史缺陷模式

工作原则：
1. 等价类划分：每个输入域至少包含有效 + 无效两类
2. 边界值分析：min-1, min, min+1, max-1, max, max+1
3. 判定表覆盖：条件组合的逻辑全覆盖
4. 状态转换：每个状态跳转至少验证一次
5. 错误推测：基于常见错误模式（空值/超长/特殊字符/并发/超时）
6. AI增强：利用 AI 识别边界外极值场景和隐藏的组合爆炸场景

请严格按照以下Markdown格式输出测试点清单：

---

## 📋 测试点总览

[总体说明，包含测试点数量和覆盖范围，注明AI辅助提取的比例]

---

## 🔍 功能测试点

| 编号 | 测试点 | 对应功能 | 优先级 | 测试类型 | 设计技术 | AI增强 |
|------|--------|---------|--------|---------|---------|--------|
| TP-001 | [测试点名称] | [功能模块] | P0/P1/P2 | 功能/UI/边界 | 等价类/边界值 | [自动/半自动] |
| TP-002 | ... | ... | ... | ... | ... | ... |

---

## 🔄 流程测试点

| 编号 | 测试点 | 涉及流程 | 优先级 | 测试类型 | 状态转换 |
|------|--------|---------|--------|---------|---------|
| TP-00x | [测试点] | [流程名称] | P0/P1/P2 | 正向/异常 | [起始→结束状态] |

---

## ⚡ 性能测试点

| 编号 | 测试点 | 指标 | 阈值 | 优先级 | 工具 |
|------|--------|------|------|--------|------|
| TP-00x | [测试点] | [指标] | [阈值] | P0-P2 | k6/JMeter |

---

## 🔐 安全测试点

| 编号 | 测试点 | 安全类型 | 测试方法 | 优先级 | 工具 |
|------|--------|---------|---------|--------|------|
| TP-00x | [测试点] | XSS/SQL注入/CSRF/越权 | [方法] | P0-P2 | OWASP ZAP |

---

## 🎨 AI增强测试设计技术应用

### 边界值分析（AI增强）
| 测试对象 | 最小值 | 正常值 | 最大值 | AI推荐极值 |
|---------|--------|--------|--------|-----------|
| [输入字段] | [min值] | [normal值] | [max值] | [AI推荐的异常边界值] |

### 等价类划分（AI增强）
| 等价类类型 | 等价类描述 | 测试数据示例 | AI推荐的其它等价类 |
|-----------|-----------|-------------|------------------|
| 有效等价类 | [符合规则的数据] | [示例] | [建议] |
| 无效等价类1 | [不符合规则-类型错误] | [示例] | [建议] |
| 无效等价类2 | [不符合规则-范围错误] | [示例] | [建议] |

### 判定表（条件组合测试）
| 规则 | 条件1 | 条件2 | 条件3 | 预期结果 | 测试点 |
|------|-------|-------|-------|---------|--------|
| R-001 | T | T | T | [结果] | TP-0xx |

### 错误推测（AI辅助）
| 潜在错误场景 | 触发条件 | 测试点 | AI发现 | 历史依据 |
|-------------|---------|--------|-------|---------|
| [并发冲突] | [多用户同时操作] | [测试点] | [是/否] | [历史缺陷参考] |
| [资源耗尽] | [存储空间不足] | [测试点] | [是/否] | [历史缺陷参考] |
| [网络异常] | [超时/断网] | [测试点] | [是/否] | [历史缺陷参考] |
| [状态不一致] | [脏读/幽灵读] | [测试点] | [是/否] | [历史缺陷参考] |

---

## 📊 测试点统计

总测试点: X | P0: X | P1: X | P2: X | AI自动提取: X | 人工建议: X
"""},
    {"key": "test-cases", "label": "用例生成",
     "icon": "TestTubes", "gradient": "from-emerald-500 to-green-600",
     "system_prompt": """你是一位资深的 AI 测试用例设计专家，精通 ISTQB 用例设计方法。
你采用「多Agent生成-验证」协作模式：
- 生成Agent：根据测试点生成结构化测试用例
- 验证Agent：检查用例的完整性、可执行性
- 优化Agent：建议补充缺失的边界/异常场景

设计原则：
1. 结构化输出：每条用例包含编号、标题、优先级、前置条件、操作步骤、预期结果
2. 完整性检查：覆盖正向、异常、边界场景
3. 独立性原则：每个用例独立可执行
4. 可追溯性：追溯到需求ID和测试点ID
5. 中文输出：所有内容使用中文

请严格按照以下Markdown格式输出测试用例：

---

## 📊 用例汇总表

| 编号 | 用例标题 | 优先级 | 测试类型 | 对应测试点 | 前置条件 | 操作步骤 | 预期结果 |
|------|---------|--------|---------|-----------|---------|---------|---------|
| TC-001 | [标题] | P0 | 功能 | TP-001 | [前置条件] | 1. [步骤1] 2. [步骤2] | [预期结果] |
| TC-002 | [标题] | P1 | 异常 | TP-002 | [前置条件] | 1. [步骤1] 2. [步骤2] | [预期结果] |

---

## 📋 用例详情

### TC-001: [用例标题]

- **优先级**: P0
- **测试类型**: 功能测试
- **设计技术**: 等价类划分
- **对应需求**: REQ-00x
- **对应测试点**: TP-00x
- **前置条件**: [清晰描述前置条件]
- **操作步骤**:
  1. [步骤1：用户操作]
  2. [步骤2：用户操作]
  3. [步骤3：系统响应]
- **预期结果**: [明确的预期验证点]

### TC-002: [用例标题]

- **优先级**: P1
- **测试类型**: 异常测试
- **设计技术**: 边界值分析
- **对应需求**: REQ-00x
- **对应测试点**: TP-00x
- **前置条件**: [清晰描述前置条件]
- **操作步骤**:
  1. [步骤1]
  2. [步骤2]
- **预期结果**: [预期结果]

---

## 📈 统计信息

- **总用例数**: X 条
- **P0**: X 条 | **P1**: X 条 | **P2**: X 条
- **覆盖测试点**: X / X
- **AI生成**: X 条 | **AI辅助**: X 条
- **可自动化**: X 条
"""},
    {"key": "test-review", "label": "用例评审",
     "icon": "CheckCircle", "gradient": "from-pink-500 to-rose-600",
     "system_prompt": """你是一位资深的 AI 测试用例评审专家，持有 ISTQB认证 + 代码审查经验。
你采用「多Agent交叉评审」模式：
- 质量Agent：逐条校验用例的可执行性、完整性和正确性
- 覆盖率Agent：检查需求-测试点-用例的追溯矩阵完整性
- 风险Agent：识别测试盲区、遗漏的高风险场景
- 合规Agent：检查是否符合 ISTQB / ISO 29119 标准

评审原则：
1. 完整性：每条需求/测试点是否被至少一个用例覆盖
2. 正确性：前置条件、操作步骤、预期结果是否逻辑一致
3. 可执行性：步骤是否无歧义、数据是否可准备
4. 独立性：用例之间是否无依赖耦合
5. 规范性：Gherkin格式是否符合BDD标准
6. 效率性：是否存在冗余用例可合并
7. AI增强：AI自动检测遗漏场景、建议补充用例、识别重复冗余

请严格按照以下Markdown格式输出评审报告：

---

## 📋 评审概述

[总体评价，包含评审范围、方法、AI辅助评审占比]

---

## ✅ 质量检查

| 检查项 | 结果 | 说明 | AI检测 |
|--------|------|------|--------|
| 用例完整性 | ✅/⚠️/❌ | [说明] | [是/否] |
| 步骤清晰度 | ✅/⚠️/❌ | [说明] | [是/否] |
| 预期结果明确性 | ✅/⚠️/❌ | [说明] | [是/否] |
| 测试数据充分性 | ✅/⚠️/❌ | [说明] | [是/否] |
| Gherkin格式规范 | ✅/⚠️/❌ | [Given-When-Then结构是否正确] | [是/否] |
| BDD规范性 | ✅/⚠️/❌ | [面向行为的场景描述] | [是/否] |

---

## 📊 覆盖率检查

### 需求-测试点-用例追溯矩阵
| 需求ID | 需求描述 | 对应测试点 | 对应用例 | 覆盖状态 | 质量评分 |
|--------|---------|-----------|---------|---------|---------|
| REQ-001 | [需求] | TP-001, TP-002 | TC-001, TC-002 | ✅ 已覆盖 | ⭐⭐⭐⭐ |
| REQ-002 | [需求] | TP-003 | TC-003 | ⚠️ 部分覆盖 | ⭐⭐⭐ |

### 覆盖统计
- **需求覆盖率**: X/X (XX%)
- **测试点覆盖率**: X/X (XX%)
- **P0需求覆盖**: ✅/⚠️/❌
- **P1需求覆盖**: ✅/⚠️/❌
- **P2需求覆盖**: ✅/⚠️/❌
- **未覆盖需求**: [列出未覆盖的需求点]
- **建议补充**: [需要补充的测试点/用例]

---

## 📊 用例质量评估

| 用例编号 | 质量评分 | 评审意见 | AI建议 |
|---------|---------|---------|--------|
| TC-001 | ⭐⭐⭐⭐⭐ | [评价] | [建议] |
| TC-002 | ⭐⭐⭐⭐ | [评价] | [建议] |

评分标准：⭐⭐⭐⭐⭐（优秀，可直接执行）/ ⭐⭐⭐⭐（良好，小幅修改）/ ⭐⭐⭐（一般，需修改）/ ⭐⭐（较差，大幅修改）/ ⭐（不合格，重写）

---

## 🔄 关联性分析

### 冗余检测
| 冗余用例组 | 冗余度 | 建议 |
|-----------|--------|------|
| TC-00x ↔ TC-00y | 高/中/低 | [合并/保留其一] |

### 依赖关系
| 用例 | 前置依赖 | 是否合理 |
|------|---------|---------|
| TC-00x | TC-00y执行结果 | ✅/⚠️ |

### AI检测的遗漏场景
| 遗漏类型 | 描述 | 建议新增用例 |
|---------|------|-------------|
| 边界场景 | [描述] | TC-0xx |
| 异常场景 | [描述] | TC-0xx |
| 组合场景 | [描述] | TC-0xx |

---

## ⚠️ 问题与建议

| 问题类型 | 涉及用例 | 严重程度 | 改进建议 | AI自动修复 |
|---------|---------|---------|---------|-----------|
| [缺失/冗余/错误/不规范] | TC-00x | 高/中/低 | [建议] | [可自动修复/需人工] |

---

## 📊 评审总结

总体质量评分: X/10
通过用例: X | 需修改: X | 不通过: X
AI自动评审项: X项 | AI发现的问题: X个 | AI建议采纳率: X%
建议: [总体改进建议]
"""},
]


class PipelineService:
    """全流程编排器：按序执行5个Agent，SSE流式推送，DB持久化"""

    def __init__(self, db: Optional[AsyncSession] = None):
        from config import get_settings
        settings = get_settings()
        self.api_key = settings.OPENAI_API_KEY
        self.base_url = settings.OPENAI_BASE_URL
        self.model = settings.DEFAULT_LLM_MODEL
        self.db = db

    async def _call_llm_with_retry(self, client: AsyncOpenAI, messages: list, 
                                    temperature: float = 0.7, max_tokens: int = 8192) -> AsyncGenerator:
        """带重试的LLM调用"""
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                stream = await client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True,
                    timeout=API_TIMEOUT,
                )
                return stream
            except RateLimitError as e:
                last_error = e
                wait_time = RETRY_DELAY * (2 ** attempt)
                logger.warning(f"速率限制，等待 {wait_time}s 后重试 (attempt {attempt + 1}/{MAX_RETRIES})")
                await asyncio.sleep(wait_time)
            except APITimeoutError as e:
                last_error = e
                logger.warning(f"API超时，重试 (attempt {attempt + 1}/{MAX_RETRIES})")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAY)
            except APIError as e:
                last_error = e
                if e.status_code and e.status_code >= 500:
                    logger.warning(f"API服务错误，重试 (attempt {attempt + 1}/{MAX_RETRIES})")
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(RETRY_DELAY * (attempt + 1))
                else:
                    raise
        raise last_error

    async def run_pipeline(self, requirement_content: str, requirement_name: str = "",
                           project_id: Optional[int] = None, version_id: Optional[int] = None,
                           resume_from: Optional[str] = None,
                           record_id: Optional[int] = None,
                           db: Optional[AsyncSession] = None) -> AsyncGenerator[str, None]:
        """
        执行全流程，SSE事件流：
          pipeline_start
          stage_start / stage_output* / stage_log* / stage_complete
          pipeline_complete

        所有阶段输出和SSE事件均实时打印到IDE终端。
        """
        pipeline_id = str(uuid.uuid4())[:8]
        total_start = time.time()

        session = db if db is not None else self.db

        logger.info(f"")
        logger.info(f"{'='*60}")
        logger.info(f"  🚀 Pipeline [{pipeline_id}] 启动全流程 (DB版)")
        logger.info(f"  📄 需求: {requirement_name or '(未命名)'}")
        logger.info(f"  🤖 模型: {self.model}")
        logger.info(f"  📐 内容长度: {len(requirement_content)} 字符")
        logger.info(f"{'='*60}")

        # pipeline_start
        yield self._event("pipeline_start", {
            "pipeline_id": pipeline_id,
            "total_stages": len(STAGES),
            "requirement_name": requirement_name,
        })
        logger.info(f"📡 [SSE→pipeline_start] pipeline_id={pipeline_id}, stages={len(STAGES)}")

        previous_output = requirement_content
        stage_results = []
        has_failure = False  # 追踪是否有阶段失败

        # ── 继续执行模式：计算 resume 起始索引，加载已完成阶段 ──
        resume_index = 0
        existing_record = None
        if resume_from:
            resume_index = next((i for i, s in enumerate(STAGES) if s["key"] == resume_from), 0)
            logger.info(f"  ↻ 继续执行: 从阶段 {resume_index+1}/{len(STAGES)} ({resume_from}) 开始")

        if record_id and session is not None:
            existing_record = await session.get(PipelineRecord, record_id)
            if existing_record and existing_record.stage_results:
                completed_stages = existing_record.stage_results[:resume_index]
                for prev in completed_stages:
                    stage_results.append({
                        "key": prev["key"],
                        "content": prev.get("content", ""),
                        "duration": prev.get("duration", 0),
                    })
                    if prev.get("content"):
                        previous_output = prev["content"]
                    # 推送已跳过事件给前端（让前端回显状态）
                    yield self._event("stage_complete", {
                        "stage": prev["key"],
                        "status": "completed",
                        "duration": prev.get("duration", 0),
                        "skipped": True,
                    })
                    logger.info(f"  ⏭ 跳过已完成阶段: {prev['key']}")
                logger.info(f"  ↻ 已加载 {len(completed_stages)} 个已完成阶段作为上下文")

        # ── 保存原始需求到 DB（仅新建模式；继续执行模式不重复保存） ──
        if not existing_record and requirement_content.strip() and session is not None:
            try:
                req = Requirement(
                    name=requirement_name or "未命名需求",
                    description=requirement_content,
                    source="manual",
                    status="draft",
                    pipeline_id=pipeline_id,
                    project_id=project_id,
                    version_id=version_id,
                )
                session.add(req)
                await session.commit()
                await session.refresh(req)
                logger.info(f"💾 [DB→requirements] 原始需求已保存 ID={req.id}")
            except Exception as e:
                logger.error(f"❌ [DB→requirements] 保存失败: {e}")
                await session.rollback()

        for stage_info in STAGES[resume_index:]:
            stage_key = stage_info["key"]
            stage_label = stage_info["label"]
            order = STAGES.index(stage_info) + 1

            # stage_start
            stage_start_time = time.time()
            logger.info(f"")
            logger.info(f"  ┌─{'─'*56}┐")
            logger.info(f"  │  ▶ 阶段 {order}/5: {stage_label}  ")
            logger.info(f"  └─{'─'*56}┘")

            yield self._event("stage_start", {
                "stage": stage_key,
                "label": stage_label,
                "order": order,
                "icon": stage_info["icon"],
                "gradient": stage_info["gradient"],
            })
            logger.info(f"📡 [SSE→stage_start] stage={stage_key}, label={stage_label}")

            yield self._event("stage_log", {
                "stage": stage_key,
                "level": "AGENT",
                "message": f"🚀 启动{stage_label}Agent",
            })
            logger.info(f"🤖 [Agent] 启动 {stage_label} - 正在调用 API {self.model} ...")

            # 执行流式分析
            full_content = ""
            try:
                client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

                # 构建当前阶段提示 — 包含完整上下文 + 多Agent协作指令
                stage_index = STAGES.index(stage_info) + 1
                total_stages = len(STAGES)
                prompt = f"""# AI全流程测试 — 阶段 {stage_index}/{total_stages}：{stage_label}

## 📌 阶段角色
{stage_info['system_prompt'][:200].strip()}
...

## 📄 原始需求
```text
{requirement_content[:3000]}{'...' if len(requirement_content) > 3000 else ''}
```

## 📋 上阶段输出上下文
```markdown
{previous_output[:5000]}{'...' if len(previous_output) > 5000 else ''}
```

## 🎯 当前任务
请严格按照上述 system_prompt 中规定的格式输出「{stage_label}」结果。
注意：输出必须结构完整、内容详实、数据充分。使用中文输出，遵从给定的 Markdown 模板结构。
若上阶段内容为空（执行失败），请根据原始需求独立完成本阶段。

## 🤖 多智能体协作提示
在分析过程中，请内部分别从以下视角审视：
1. 业务视角：关注业务正确性和用户价值
2. 技术视角：关注技术可行性和实现约束
3. 质量视角：关注可测试性和质量标准
最后将三者交叉验证后形成最终输出。"""

                messages = [
                    {"role": "system", "content": stage_info["system_prompt"]},
                    {"role": "user", "content": prompt},
                ]

                logger.info(f"📤 [API→{self.model}] {stage_label} 发送请求 (prompt≈{len(prompt)}字符)")
                # 输出 prompt 内容预览（前300字符）
                prompt_preview = prompt[:300].replace("\n", "\n    ").strip()
                logger.info(f"📝 [Prompt预览→{stage_key}] \n    {prompt_preview}{'...' if len(prompt) > 300 else ''}")
                stream = await self._call_llm_with_retry(
                    client=client,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=8192,
                )

                chunk_count = 0
                async for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta
                        if delta and delta.content:
                            full_content += delta.content
                            chunk_count += 1
                            yield self._event("stage_output", {
                                "stage": stage_key,
                                "content": delta.content,
                            })
                            # 输出实际内容片段（每50个chunk输出最近的内容）
                            if chunk_count % 50 == 0:
                                recent = full_content[-200:].replace("\n", " ").strip()
                                logger.info(f"📡 [SSE→{stage_key}] 内容片段: ...{recent}...")

                logger.info(f"📥 [API←] {stage_label} 完成: 共 {len(full_content)} 字符")
                # 输出完整内容预览（前500字符）
                preview = full_content[:500].replace("\n", "\n    ").strip()
                logger.info(f"📄 [内容预览→{stage_key}] \n    {preview}{'...' if len(full_content) > 500 else ''}")

                duration_ms = int((time.time() - stage_start_time) * 1000)
                stage_results.append({"key": stage_key, "content": full_content, "duration_ms": duration_ms})

                yield self._event("stage_log", {
                    "stage": stage_key,
                    "level": "INFO",
                    "message": f"✅ {stage_label}完成，耗时 {duration_ms}ms",
                })
                logger.info(f"✅ [完成] {stage_label} - 耗时 {duration_ms}ms, 共 {len(full_content)} 字符, {chunk_count} chunks")

                yield self._event("stage_complete", {
                    "stage": stage_key,
                    "status": "completed",
                    "duration": duration_ms,
                })
                logger.info(f"📡 [SSE→stage_complete] {stage_key} → completed ({duration_ms}ms)")

                # 将阶段结果持久化到对应业务模块
                if session is not None:
                    try:
                        await self._persist_stage_to_module(
                            stage_key, stage_label,
                            full_content, session,
                            project_id=project_id, version_id=version_id,
                            requirement_name=requirement_name,
                        )
                    except Exception as e:
                        logger.error(f"❌ [DB→{stage_key}] 持久化到业务模块失败: {e}")
                        await session.rollback()

                # 将本阶段输出作为下一阶段的输入上下文
                previous_output = full_content

            except Exception as e:
                duration_ms = int((time.time() - stage_start_time) * 1000)
                error_msg = str(e)
                logger.error(f"❌ [失败] {stage_label}: {error_msg}")
                import traceback
                logger.error(f"   └─ traceback: {traceback.format_exc()}")

                has_failure = True  # 标记有失败

                yield self._event("stage_log", {
                    "stage": stage_key,
                    "level": "ERROR",
                    "message": f"❌ {stage_label} 执行失败: {error_msg}",
                })
                logger.info(f"📡 [SSE→stage_log] {stage_key} → ERROR: {error_msg[:200]}")

                yield self._event("stage_error", {
                    "stage": stage_key,
                    "error": error_msg,
                    "duration": duration,
                })
                logger.info(f"📡 [SSE→stage_error] {stage_key} → duration={duration}s")

                # 即使失败也继续下一个阶段（用空上下文）
                stage_results.append({"key": stage_key, "content": "", "duration": duration})
                previous_output = f"【{stage_label}执行失败】{error_msg}"

        # pipeline_complete
        total_duration = round(time.time() - total_start, 1)
        final_status = "failed" if has_failure else "completed"
        yield self._event("pipeline_complete", {
            "pipeline_id": pipeline_id,
            "status": final_status,
            "total_duration": total_duration,
            "stage_results": [
                {"key": r["key"], "duration": r["duration"]}
                for r in stage_results
            ],
        })
        logger.info(f"📡 [SSE→pipeline_complete] {final_status}, total_duration={total_duration}s")

        # ── 保存流程记录到 DB（继续执行模式更新原记录，否则新建） ──
        if session is not None:
            try:
                stage_results_for_db = [
                    {"key": r["key"],
                     "label": next((s["label"] for s in STAGES if s["key"] == r["key"]), r["key"]),
                     "content": r["content"], "duration": r["duration"]}
                    for r in stage_results
                ]
                if existing_record:
                    # 继续执行模式：更新原记录（追加新完成的阶段，不新建）
                    existing_record.stage_results = stage_results_for_db
                    existing_record.status = final_status
                    # 累加总耗时（原记录耗时 + 本次续跑耗时）
                    existing_record.total_duration = (
                        (existing_record.total_duration or 0) + total_duration
                    )
                    await session.commit()
                    logger.info(f"💾 [DB→pipeline_records] 原记录已更新 ID={existing_record.id} (status={final_status})")
                else:
                    # 新建模式：创建新记录
                    record = PipelineRecord(
                        name=f"Pipeline - {requirement_name or '未命名需求'}",
                        status=final_status,
                        pipeline_id=pipeline_id,
                        requirement_content=requirement_content,
                        requirement_name=requirement_name or "未命名需求",
                        total_duration=total_duration,
                        stage_count=len(STAGES),
                        project_id=project_id,
                        version_id=version_id,
                        stage_results=stage_results_for_db,
                    )
                    session.add(record)
                    await session.commit()
                    await session.refresh(record)
                    logger.info(f"💾 [DB→pipeline_records] 流程记录已保存 ID={record.id}")
            except Exception as e:
                logger.error(f"❌ [DB→pipeline_records] 保存失败: {e}")
                await session.rollback()

        logger.info(f"")
        logger.info(f"{'='*60}")
        logger.info(f"  ✅ Pipeline [{pipeline_id}] 全流程完成!")
        logger.info(f"  ⏱  总耗时: {total_duration}s")
        stage_summary = " → ".join([f"{r['key']}({r['duration']}s)" for r in stage_results])
        logger.info(f"  📊 各阶段: {stage_summary}")
        logger.info(f"  📝 结果已保存到 DB")
        logger.info(f"{'='*60}")
        logger.info(f"")

    def _parse_cases_from_markdown(self, content: str) -> list:
        """从 markdown 解析多条测试用例（完整字段解析）
        匹配模式：### TC-001: 标题
        返回 [{title, description, priority, test_type, preconditions, steps, expected_result, test_point_ref}, ...]
        """
        import re
        if not content:
            return [{"title": "AI生成-测试用例", "description": "", "steps": []}]
        # 匹配 ### TC-001: 标题（支持中英文冒号、空格）
        pattern = re.compile(r'^###\s+(TC[-_]?\d+)\s*[:：\-—]?\s*(.*)$', re.MULTILINE)
        matches = list(pattern.finditer(content))
        if not matches:
            logger.info(f"  📝 [parse_cases] 未匹配到 TC-xxx 模式，fallback 单条")
            return [{"title": "AI生成-测试用例", "description": content[:5000], "steps": []}]

        cases = []
        for i, m in enumerate(matches):
            case_id = m.group(1).upper()
            case_title = m.group(2).strip() or f"测试用例 {case_id}"
            # 截取该用例段落
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
            section = content[start:end].strip()

            # 解析优先级
            priority = "P2"
            pri_match = re.search(r'\*\*优先级\*\*\s*[:：]\s*(P[012])', section)
            if pri_match:
                priority = pri_match.group(1)

            # 解析测试类型
            test_type = None
            type_match = re.search(r'\*\*测试类型\*\*\s*[:：]\s*(.+)', section)
            if type_match:
                test_type = type_match.group(1).strip()

            # 解析前置条件
            preconditions = None
            pre_match = re.search(r'\*\*前置条件\*\*\s*[:：]\s*(.+)', section)
            if pre_match:
                preconditions = pre_match.group(1).strip()

            # 解析操作步骤（编号列表）
            steps = []
            steps_match = re.search(r'\*\*操作步骤\*\*\s*[:：]?\s*\n((?:\s*\d+\..+\n?)+)', section)
            if steps_match:
                step_lines = re.findall(r'\d+\.\s*(.+)', steps_match.group(1))
                steps = [{"action": s.strip()} for s in step_lines if s.strip()]

            # 解析预期结果
            expected_result = ""
            exp_match = re.search(r'\*\*预期结果\*\*\s*[:：]\s*(.+)', section)
            if exp_match:
                expected_result = exp_match.group(1).strip()

            # 解析对应测试点
            test_point_ref = None
            tp_match = re.search(r'\*\*对应测试点\*\*\s*[:：]\s*(TP[-_]?\d+)', section)
            if tp_match:
                test_point_ref = tp_match.group(1).upper()

            # 限制 description 长度
            desc = section[:3000]
            if len(section) > 3000:
                desc = section[:3000] + "\n...（内容过长已截断）"

            cases.append({
                "title": f"{case_id}: {case_title}",
                "description": desc,
                "priority": priority,
                "test_type": test_type,
                "preconditions": preconditions,
                "steps": steps,
                "expected_result": expected_result,
                "test_point_ref": test_point_ref,
            })
        logger.info(f"  📝 [parse_cases] 解析出 {len(cases)} 条测试用例 (含完整字段)")
        return cases

    def _parse_supplemented_cases(self, content: str) -> list:
        """从用例评审 markdown 解析「补充用例」部分
        识别：### TC-xxx (补充) / 补充了X条 后的 TC-xxx / 建议新增用例表格行
        返回 [{title, description}, ...]
        未识别到补充用例时返回 []
        """
        import re
        if not content:
            return []

        # 策略1：匹配带「补充」「新增」「追加」标记的 TC-xxx 标题
        # 如 ### TC-006 (补充): xxx / ### TC-006 补充 xxx
        sup_pattern = re.compile(
            r'^###\s+(TC[-_]?\d+)\s*[\(（]?(?:补充|新增|追加)[\)）]?\s*[:：\-—]?\s*(.*)$',
            re.MULTILINE
        )
        matches = list(sup_pattern.finditer(content))

        # 策略2：匹配「建议新增用例」表格行 | TC-006 | xxx |
        if not matches:
            # 查找"建议新增""遗漏场景""补充用例"等关键字所在区域后的 TC-xxx
            keyword_pattern = re.compile(
                r'(?:建议新增|遗漏场景|补充用例|新增用例|建议补充)[^\n]*\n',
                re.IGNORECASE
            )
            kw_matches = list(keyword_pattern.finditer(content))
            if kw_matches:
                # 在关键字之后查找 TC-xxx 表格行
                for kw in kw_matches:
                    search_start = kw.end()
                    # 查找后续 500 字符内的 TC-xxx
                    region = content[search_start:search_start + 2000]
                    table_pattern = re.compile(r'\|\s*(TC[-_]?\d+)\s*\|\s*([^\|]+)\s*\|')
                    for tm in table_pattern.finditer(region):
                        matches.append(tm)

        if not matches:
            logger.info(f"  📝 [parse_supplemented] 未识别到补充用例")
            return []

        supplemented = []
        seen_ids = set()
        for m in matches:
            case_id = m.group(1).upper()
            if case_id in seen_ids:
                continue
            seen_ids.add(case_id)
            case_title = m.group(2).strip() if m.lastindex >= 2 else ""
            # 截取该用例段落用于解析完整字段
            start = m.end()
            end = matches[matches.index(m) + 1].start() if matches.index(m) + 1 < len(matches) else len(content)
            section = content[start:end].strip()

            # 解析优先级
            priority = "P2"
            pri_match = re.search(r'\*\*优先级\*\*\s*[:：]\s*(P[012])', section)
            if pri_match:
                priority = pri_match.group(1)

            # 解析测试类型
            test_type = None
            type_match = re.search(r'\*\*测试类型\*\*\s*[:：]\s*(.+)', section)
            if type_match:
                test_type = type_match.group(1).strip()

            # 解析前置条件
            preconditions = None
            pre_match = re.search(r'\*\*前置条件\*\*\s*[:：]\s*(.+)', section)
            if pre_match:
                preconditions = pre_match.group(1).strip()

            # 解析操作步骤
            steps = []
            steps_match = re.search(r'\*\*操作步骤\*\*\s*[:：]?\s*\n((?:\s*\d+\..+\n?)+)', section)
            if steps_match:
                step_lines = re.findall(r'\d+\.\s*(.+)', steps_match.group(1))
                steps = [{"action": s.strip()} for s in step_lines if s.strip()]

            # 解析预期结果
            expected_result = ""
            exp_match = re.search(r'\*\*预期结果\*\*\s*[:：]\s*(.+)', section)
            if exp_match:
                expected_result = exp_match.group(1).strip()

            supplemented.append({
                "title": f"{case_id}(补充): {case_title}" if case_title else f"{case_id}(补充)",
                "description": section[:3000] if section else f"[AI评审补充] {case_title}",
                "priority": priority,
                "test_type": test_type,
                "preconditions": preconditions,
                "steps": steps,
                "expected_result": expected_result,
            })
        logger.info(f"  📝 [parse_supplemented] 识别到 {len(supplemented)} 条补充用例 (含完整字段)")
        return supplemented

    def _parse_points_from_markdown(self, content: str) -> list:
        """从 markdown 解析多条测试点
        匹配模式：### TP-001 / | TP-001 | ... |
        返回 [{title, description}, ...]
        解析失败时 fallback 返回单条
        """
        import re
        if not content:
            return [{"title": "AI生成-测试点", "description": ""}]
        # 策略1：### TP-001 标题
        pattern = re.compile(r'^###\s+(TP[-_]?\d+)\s*[:：\-—]?\s*(.*)$', re.MULTILINE)
        matches = list(pattern.finditer(content))

        # 策略2：表格行 | TP-001 | 测试点 | ... |
        if not matches:
            table_pattern = re.compile(r'^\|\s*(TP[-_]?\d+)\s*\|\s*([^\|]+)\s*\|', re.MULTILINE)
            matches = list(table_pattern.finditer(content))

        if not matches:
            logger.info(f"  📝 [parse_points] 未匹配到 TP-xxx 模式，fallback 单条")
            return [{"title": "AI生成-测试点", "description": content[:5000]}]

        points = []
        seen_ids = set()
        for i, m in enumerate(matches):
            point_id = m.group(1).upper()
            if point_id in seen_ids:
                continue
            seen_ids.add(point_id)
            point_title = m.group(2).strip() if m.lastindex >= 2 else ""
            # 截取该测试点段落
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
            section = content[start:end].strip()
            if len(section) > 3000:
                section = section[:3000] + "\n...（内容过长已截断）"
            points.append({
                "title": f"{point_id}: {point_title}" if point_title else f"测试点 {point_id}",
                "description": section,
            })
        logger.info(f"  📝 [parse_points] 解析出 {len(points)} 条测试点")
        return points

    async def _persist_stage_to_module(self, stage_key: str, stage_label: str,
                                       content: str, db: AsyncSession,
                                       project_id: Optional[int] = None,
                                       version_id: Optional[int] = None,
                                       requirement_name: str = ""):
        """将阶段结果持久化到对应的业务模块
        - test-cases: 按 TC-xxx 拆分多条 TestCase
        - test-points: 按 TP-xxx 拆分多条 TestPoint
        - test-review: 整体存 Review + 补充用例存为多条 TestCase
        - requirements / test-plans: 单条存储
        """
        try:
            if stage_key == "requirements":
                req = Requirement(
                    name=requirement_name or f"AI生成-{stage_label}",
                    description=content[:5000],
                    status="analyzed",
                    source="ai_generated",
                    ai_analysis_md=content,
                    project_id=project_id,
                    version_id=version_id,
                )
                db.add(req)
                await db.commit()
                await db.refresh(req)
                logger.info(f"💾 [DB→requirements] 需求分析结果已保存 ID={req.id}")

            elif stage_key == "test-plans":
                plan = TestPlan(
                    name=requirement_name or f"AI生成-测试方案",
                    description=content[:5000],
                    status="draft",
                    source="ai_generated",
                    project_id=project_id,
                    version_id=version_id,
                )
                db.add(plan)
                await db.commit()
                await db.refresh(plan)
                logger.info(f"💾 [DB→test_plans] 测试方案已保存 ID={plan.id}")

            elif stage_key == "test-points":
                # 按 TP-xxx 拆分多条 TestPoint
                points = self._parse_points_from_markdown(content)
                saved_ids = []
                for p in points:
                    point = TestPoint(
                        name=p["title"][:500],
                        description=p["description"],
                        status="draft",
                        priority="P2",
                        project_id=project_id,
                        version_id=version_id,
                        ai_extracted=True,
                    )
                    db.add(point)
                    await db.flush()  # 获取 id
                    saved_ids.append(point.id)
                await db.commit()
                logger.info(f"💾 [DB→test_points] 测试点已保存 {len(saved_ids)} 条 IDs={saved_ids}")

            elif stage_key == "test-cases":
                # 按 TC-xxx 拆分多条 TestCase（含完整字段）
                cases = self._parse_cases_from_markdown(content)
                saved_ids = []
                for c in cases:
                    case = TestCase(
                        name=c["title"][:500],
                        description=c["description"],
                        preconditions=c.get("preconditions"),
                        steps=c.get("steps") or [],
                        expected_result=c.get("expected_result") or "",
                        status="draft",
                        priority=c.get("priority") or "P2",
                        test_type=c.get("test_type"),
                        ai_generated=True,
                        ai_model=self.model,
                        project_id=project_id,
                        version_id=version_id,
                    )
                    db.add(case)
                    await db.flush()
                    saved_ids.append(case.id)
                await db.commit()
                logger.info(f"💾 [DB→lifecycle_test_cases] 测试用例已保存 {len(saved_ids)} 条 IDs={saved_ids} (含完整字段)")

            elif stage_key == "test-review":
                # 1. 整体评审内容存入 Review 表
                review = Review(
                    title=requirement_name or "AI生成-用例评审",
                    content=content[:5000],
                    status="completed",
                    source="ai",
                    project_id=project_id,
                    version_id=version_id,
                )
                db.add(review)
                await db.commit()
                await db.refresh(review)
                logger.info(f"💾 [DB→test_reviews] 用例评审已保存 ID={review.id}")

                # 2. 解析补充用例，存为多条 TestCase（含完整字段）
                supplemented = self._parse_supplemented_cases(content)
                if supplemented:
                    sup_ids = []
                    for c in supplemented:
                        case = TestCase(
                            name=c["title"][:500],
                            description=c["description"],
                            preconditions=c.get("preconditions"),
                            steps=c.get("steps") or [],
                            expected_result=c.get("expected_result") or "",
                            status="draft",
                            priority=c.get("priority") or "P2",
                            test_type=c.get("test_type"),
                            ai_generated=True,
                            ai_model=self.model,
                            project_id=project_id,
                            version_id=version_id,
                        )
                        db.add(case)
                        await db.flush()
                        sup_ids.append(case.id)
                    await db.commit()
                    logger.info(f"💾 [DB→lifecycle_test_cases] 评审补充用例已保存 {len(sup_ids)} 条 IDs={sup_ids}")

            else:
                logger.warning(f"⚠️ [DB] 未知阶段类型: {stage_key}，跳过业务模块持久化")

        except Exception as e:
            logger.error(f"❌ [DB→{stage_key}] 持久化到业务模块失败: {e}")
            raise

    def _event(self, event_type: str, data: dict) -> str:
        """格式化 SSE 事件"""
        return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
