/**
 * 步骤提示词配置服务
 * - 优先从后端 API 加载 StepPromptConfig
 * - 失败或返回空时使用内置 mock 数据（丰富的 ISTQB 测试理论模板）
 * - 提供每个步骤的系统提示词、用户提示词、技能提示词、输出模板、日志模板
 * - 支持步骤间数据串联（prev_result / prev_logs 变量）
 */

import { configApi } from "@/lib/api"
import { withMockFallback } from "@/lib/mockData"

export interface StepVariable {
  name: string
  type: string
  description: string
  required: boolean
}

export interface StepSkill {
  name: string
  description: string
  content: string
}

export interface LogTemplate {
  content: string
  delay_ms: number
}

export interface StepPromptConfig {
  id?: number
  step_key: string
  step_name: string
  step_order: number
  icon: string
  description: string
  system_prompt: string
  user_prompt_template: string
  skill_prompt?: string
  output_template?: string
  skills?: StepSkill[]
  variables?: StepVariable[]
  output_logs_template?: LogTemplate[]
  is_default?: boolean
  status?: string
}

// 丰富的默认模板（ISTQB 测试理论 + AI 软件研发测试工程师角色）
export const DEFAULT_STEP_CONFIGS: StepPromptConfig[] = [
  {
    step_key: "analyze",
    step_name: "需求分析",
    step_order: 1,
    icon: "FileText",
    description: "基于 ISTQB 需求分析方法论，识别功能点、业务规则、隐含需求和风险",
    system_prompt: `你是一位资深的 AI 软件测试需求分析专家，拥有 ISTQB Foundation Level 认证和 10 年以上的需求分析经验。
你融合「多智能体协作（Multi-Agent Collaboration）」思维：同时扮演分析 Agent、质量 Agent、风险 Agent 三个子角色。

你感知以下 MCP 工具能力：
- 文档解析工具：提取结构化需求
- 知识库检索：匹配相似需求案例
- 模型 API：语义聚类

工作原则：
1. 完整性：识别显性需求、隐性需求、约束条件和接口需求
2. 一致性：检查需求间矛盾、业务规则冲突、术语不一致
3. 可测试性：每条需求必须可被验证（可观测行为 + 明确条件）
4. 优先级：基于业务价值 × 技术风险矩阵评估 P0/P1/P2
5. 可追溯性：每条需求都要能够追溯到业务目标或原始输入
6. 多角色交叉验证：分析Agent（功能点）→ 质量Agent（可测试性）→ 风险Agent（风险识别）

输出要求：
- 使用结构化 Markdown
- 输出功能清单、业务规则矩阵、非功能需求、待确认问题、质量评分
- 明确标注每条需求的来源（用户输入 / 上传文档 / 隐含推断）
- 包含多智能体协作总结`,
    user_prompt_template: `请对以下需求材料进行专业分析，并输出完整的需求分析报告。

## 原始需求描述
{content}

## 参考文档列表
{files_list}

## 前序结果（若有）
{prev_result}

请输出：
1. 功能需求清单（编号、描述、来源、优先级）
2. 业务规则与约束（输入校验、状态流转、异常处理）
3. 非功能需求（性能、安全、兼容性、可用性、国际化）
4. 需求风险与模糊点
5. 建议补充的问题列表`,
    skill_prompt: `## 需求分析技能矩阵（ISTQB + AI增强）

### 1. 功能点分析法（Functional Point Analysis）
- 识别用户角色（Actor）与用例（Use Case）
- 提取核心业务流程与异常路径
- 标注隐含需求（性能下限、UI 响应时间、安全等级）

### 2. 需求质量评估（Requirements Quality）
- 完整性检查：覆盖所有业务场景 & 边界
- 一致性检查：术语统一、规则无冲突
- 可行性检查：技术实现难度、依赖项
- 可追溯性（Traceability）：每条需求 → 业务目标

### 3. 风险识别技术（Risk Identification）
- 业务风险：需求不明确、规则冲突、外部依赖
- 技术风险：实现复杂度、遗留系统、跨团队协作
- 进度风险：变更频率、优先级冲突、资源不足

### 4. 多智能体协作模式
- **分析Agent**：识别功能点完整性、业务规则
- **质量Agent**：评估可测试性、验收标准
- **风险Agent**：识别潜在风险、约束条件

### 5. AI 辅助策略
- 使用 LLM 自动聚类相似需求
- 使用关键词提取识别隐含质量属性（性能 / 安全 / UX）
- 使用MCP工具辅助文档解析与知识检索`,
    output_template: `## 需求分析报告

### 一、功能需求清单
| 编号 | 功能点 | 描述 | 来源 | 优先级 | 风险 | 隐含推断 |
|------|--------|------|------|--------|------|---------|
| F001 | xxx | xxx | 用户输入 | P0 | 高 | 是/否 |

### 二、业务规则与约束
1. 输入校验：xxx
2. 状态流转：xxx
3. 权限控制：xxx

### 三、非功能需求与可测试性
- **性能**：响应时间 < 500ms、并发 QPS ≥ 200
- **安全**：密码加密存储、登录失败锁定、CSRF 防护
- **可用性**：99.9% 可用性、降级策略
- **兼容性**：Chrome/Edge/Safari 最新 2 个版本

### 四、待确认问题
- [ ] Q1：xxx
- [ ] Q2：xxx

### 五、需求质量评分
| 维度 | 评分 | 说明 |
|------|------|------|
| 完整性 | X/10 | xxx |
| 一致性 | X/10 | xxx |
| 可测试性 | X/10 | xxx |

### 六、多智能体协作总结
| 子角色 | 分析要点 | 发现 |
|-------|---------|------|
| 分析Agent | 功能点完整性 | x个功能点 |
| 质量Agent | 可测试性评估 | x/10分 |
| 风险Agent | 潜在风险 | x个高风险 |`,
    skills: [
      { name: "需求工程", description: "需求生命周期管理", content: "使用需求工程方法识别显性/隐性需求" },
      { name: "业务建模", description: "UML 用例/活动图", content: "通过 UML 建模业务流程与交互" },
      { name: "风险驱动分析", description: "基于风险优先级排序", content: "以风险为导向聚焦关键需求" },
      { name: "AI 关键词提取", description: "NLP 自动聚类需求", content: "LLM 辅助聚类相似需求与隐含质量属性" },
      { name: "多Agent协作", description: "多角色交叉验证", content: "三个子Agent同时从不同维度交叉分析" },
      { name: "MCP工具集成", description: "文档解析/知识检索", content: "通过MCP工具调用外部知识源辅助分析" },
    ],
    variables: [
      { name: "content", type: "string", description: "需求描述原文", required: true },
      { name: "files_list", type: "string", description: "上传的文档列表", required: false },
      { name: "prev_result", type: "string", description: "前序步骤结果（如有）", required: false },
    ],
    output_logs_template: [
      {
        content:
          "### 🧠 AI 需求分析专家已启动\n\n**角色**: 资深软件测试需求分析专家 (ISTQB 认证)\n**方法论**: 需求工程 + 业务建模 + 风险驱动\n\n---",
        delay_ms: 500,
      },
      {
        content: `**📖 输入材料解析**\n\n> 正在解析需求原文与上传文档...\n\n- 需求摘要: {content_preview}\n- 参考文档: {files_list}\n- 分析模式: 深度分析 + 隐含推断\n- 风险评估: 已启用`,
        delay_ms: 700,
      },
      {
        content:
          "**🎯 功能点识别（功能点分析法）**\n\n| 编号 | 功能点 | 描述 | 优先级 | 风险 |\n|------|--------|------|--------|------|\n| F001 | 用户认证 | 账号密码 + 短信验证码双模式登录 | P0 | 高 |\n| F002 | 账户锁定 | 连续失败 3 次锁定 30 分钟 | P0 | 高 |\n| F003 | 会话管理 | 会话创建/刷新/过期/主动登出 | P1 | 中 |\n| F004 | 密码策略 | 复杂度校验、历史密码检查 | P1 | 中 |\n| F005 | 记住密码 | 7 天内免登录 | P2 | 低 |\n\n共识别 **5** 个功能点，P0 级 2 个，P1 级 2 个，P2 级 1 个。",
        delay_ms: 900,
      },
      {
        content:
          "**📋 业务规则提取（业务建模）**\n\n从需求中抽取的关键业务规则：\n\n1. ✅ 支持账号密码登录（加密存储 bcrypt）\n2. ✅ 支持手机短信验证码登录（6 位，有效期 5 分钟）\n3. ⚠️ 连续 3 次失败锁定 30 分钟（阈值需业务方最终确认）\n4. ✅ 「记住密码」有效期 7 天\n5. ⚠️ 会话超时时长需求未明确（建议 24 小时 + 滑动过期）\n6. ⚠️ 是否允许并发登录未说明\n\n💡 识别到 **2** 条隐含需求（会话超时、并发策略）。",
        delay_ms: 800,
      },
      {
        content:
          "**🛡️ 非功能需求与风险**\n\n**性能要求（推断）**:\n- 登录接口 RT < 500ms（P95）\n- 支持 ≥ 200 QPS 并发登录\n\n**安全要求**:\n- 密码 bcrypt/argon2 加密存储\n- 登录失败行为需记录安全审计日志\n- 短信接口需防刷（同一手机号 60s 内最多 5 次）\n\n**高风险项**:\n- 🔴 锁定阈值与时长未明确（业务需确认）\n- 🔴 短信验证码通道的可靠性\n\n**中风险项**:\n- 🟡 会话策略（并发/设备绑定）\n- 🟡 密码找回的身份校验方式",
        delay_ms: 800,
      },
      {
        content:
          "**✅ 需求分析完成**\n\n📊 **质量评分**:\n| 维度 | 评分 | 说明 |\n|------|------|------|\n| 完整性 | 7/10 | 缺少异常场景与隐含质量属性描述 |\n| 一致性 | 8/10 | 规则基本一致 |\n| 可测试性 | 6/10 | 部分需求需进一步细化 |\n\n💡 **改进建议**:\n1. 补充异常流程与边界条件描述\n2. 明确非功能需求的量化指标\n3. 建议召开需求评审会锁定高风险项",
        delay_ms: 700,
      },
    ],
  },
  {
    step_key: "plan",
    step_name: "测试方案设计",
    step_order: 2,
    icon: "ClipboardList",
    description: "基于需求分析结果，制定测试策略、范围、资源与里程碑",
    system_prompt: `你是一位资深的 AI 测试方案设计专家，持有 ISTQB Advanced Level Test Manager 认证。
你采用「分层多Agent策略规划」方法论：策略Agent（范围/风险）、资源Agent（人/环境/工具）、排期Agent（依赖/里程碑）。

你感知以下 MCP 工具能力：
- Playwright：Web端到端自动化测试
- Midscene.js：AI视觉探索测试
- pytest + httpx：API测试
- k6 / JMeter：性能压测
- OWASP ZAP：安全扫描

工作原则：
1. 策略选择：按风险等级分配测试方法（高风险用严格方法，低风险用轻量方法）
2. 范围界定：清晰定义 in-scope / out-of-scope
3. 资源评估：人力、环境、工具、时间的合理估算
4. 里程碑规划：按阶段规划准备 / 执行 / 回归 / 验收
5. 入口出口准则（Entry/Exit Criteria）：明确每个阶段的准入准出标准
6. AI增强策略：明确哪些场景适合AI探索性测试，哪些需要精确断言`,
    user_prompt_template: `请基于以下需求分析结果，设计完整的测试方案。

## 需求分析摘要
{content}

## 功能点与优先级
{files_list}

## 前序步骤结果
{prev_result}

请输出：
1. 测试策略（按风险分配的方法矩阵）
2. 测试范围（in/out scope）
3. 资源与环境需求
4. 里程碑与进度计划
5. 入口/出口准则
6. 风险登记册`,
    skill_prompt: `## 测试方案设计技能矩阵（AI增强）

### 1. 测试策略选择
- **黑盒测试**：基于规格说明（等价类 / 边界值 / 场景法）
- **白盒测试**：基于代码结构（语句覆盖 / 分支覆盖 / 路径覆盖）
- **灰盒测试**：结合规格 + 实现
- **探索性测试**：基于经验的自由探索
- **AI增强探索**：AI自主探索 + 智能异常检测

### 2. 风险驱动测试（Risk-based Testing）
- 风险 = 影响 × 概率
- 高风险 → 严格方法 + 高覆盖 + AI辅助增强
- 中风险 → 标准方法 + 中等覆盖
- 低风险 → 抽样方法 + 低覆盖

### 3. 资源与进度规划
- 人力估算：用例设计 0.5h/条、执行 0.3h/条
- 测试环境：准备 / 稳定 / 维护
- 关键路径识别
- AI工具可节省预估：用例设计 40%、数据准备 60%

### 4. 准入准出准则
- 准入：需求冻结 / 代码提测 / 环境就绪
- 准出：用例通过率 ≥ 95% / 缺陷修复率 ≥ 98%

### 5. MCP工具集成策略
- Playwright/Midscene：Web E2E自动化
- k6/JMeter：性能压测
- OWASP ZAP：安全扫描`,
    output_template: `## 测试方案

### 一、测试策略矩阵（AI增强）
| 模块 | 风险 | 测试方法 | 覆盖目标 | 优先级 | AI增强 |
|------|------|----------|----------|--------|--------|
| 用户认证 | 高 | 等价类 + 边界值 + 状态转换 | 分支覆盖 ≥ 90% | P0 | AI生成+智能断言 |

### 二、测试范围
- ✅ **范围内**: xxx
- ❌ **范围外**: xxx

### 三、资源与环境（含MCP工具链）
- 人力: xxx
- 环境: Dev / Test / Pre
- 工具: Postman / JMeter / Playwright / k6 / OWASP ZAP

### 四、里程碑
| 阶段 | 起止 | AI节省 | 交付物 |
|------|------|--------|--------|
| 用例设计 | xxx | 40% | 测试用例集 |

### 五、入口/出口准则
- 准入: xxx
- 准出: xxx

### 六、质量指标
| 指标 | 目标值 | AI辅助 |
|------|-------|--------|
| 用例通过率 | >=95% | 智能分析失败原因 |`,
    skills: [
      { name: "风险驱动测试", description: "按风险分配测试资源", content: "基于风险 = 影响 × 概率分配测试方法" },
      { name: "测试策略设计", description: "方法选择与组合", content: "为每个模块选择黑盒/白盒/探索等方法" },
      { name: "准入准出准则", description: "阶段门禁定义", content: "清晰定义每个阶段的 Entry/Exit Criteria" },
      { name: "MCP工具链集成", description: "Playwright/k6/ZAP", content: "集成测试工具链实现自动化" },
      { name: "AI增强策略", description: "AI探索性测试", content: "明确哪些场景适合AI驱动测试" },
    ],
    variables: [
      { name: "content", type: "string", description: "需求分析摘要", required: true },
      { name: "files_list", type: "string", description: "功能点列表", required: false },
      { name: "prev_result", type: "string", description: "需求分析步骤结果", required: false },
    ],
    output_logs_template: [
      { content: "### 🏗️ AI 测试方案专家启动\n\n**角色**: 资深测试方案设计专家 (ISTQB Advanced)\n**方法论**: 风险驱动测试 + 测试策略矩阵\n\n---", delay_ms: 500 },
      { content: "**📊 分析需求特征与风险**\n\n> 基于需求分析结果评估风险等级...\n\n**需求特征**:\n- 核心功能数: 5 个\n- P0 级功能: 2 个（用户认证、账户锁定）\n- 业务复杂度: 中等\n- 风险等级: 中-高\n- 建议方法: 风险驱动 + 等价类 + 边界值", delay_ms: 700 },
      { content: "**🎯 测试策略矩阵**\n\n| 模块 | 风险 | 测试方法 | 覆盖目标 | 优先级 |\n|------|------|----------|----------|--------|\n| 用户认证 | 🔴 高 | 等价类 + 边界值 + 状态转换 | 分支覆盖 ≥ 90% | P0 |\n| 账户锁定 | 🔴 高 | 边界值 + 错误推测 | 100% 场景覆盖 | P0 |\n| 会话管理 | 🟡 中 | 场景法 + 状态机 | 路径覆盖 ≥ 80% | P1 |\n| 密码策略 | 🟡 中 | 等价类 + 正交实验 | 规则覆盖 | P1 |\n| 记住密码 | 🟢 低 | 场景法 | 功能覆盖 | P2 |", delay_ms: 900 },
      { content: "**📋 测试范围与资源**\n\n**✅ 范围内**:\n- 登录功能（账号密码 / 短信验证码）\n- 账户锁定与解锁\n- 会话生命周期（创建 / 刷新 / 过期 / 登出）\n- 密码复杂度与历史检查\n\n**❌ 范围外**:\n- 第三方 OAuth 登录\n- 移动端 App 适配\n- 国际化多语言\n\n**资源估算**:\n- 测试人力: 2 人 × 5 天\n- 环境: Dev 环境（1 套）、Test 环境（1 套）\n- 工具链: Postman + JMeter + Playwright", delay_ms: 800 },
      { content: "**⏱️ 里程碑与准入准出**\n\n| 阶段 | 主要任务 | 预估 | 交付物 |\n|------|----------|------|--------|\n| 用例设计 | 用例编写与评审 | 2天 | 测试用例集 |\n| 第一轮 | 全量功能 + 缺陷验证 | 3天 | 缺陷报告 |\n| 回归 | 回归 + 验证修复 | 2天 | 回归报告 |\n| 验收 | UAT 支持 | 1天 | 验收报告 |\n\n**关键路径**: 用例设计 → 功能执行 → 缺陷回归\n\n**准入准则**: 需求冻结、代码提测、环境就绪\n**准出准则**: 用例通过率 ≥ 95%、P0/P1 缺陷清零", delay_ms: 800 },
      { content: "**⚠️ 风险登记册**\n\n| 风险 | 影响 | 概率 | 应对策略 |\n|------|------|------|----------|\n| 需求变更 | 高 | 中 | 建立变更控制流程（CCB） |\n| 环境不稳定 | 中 | 低 | 准备备用环境 + 数据工厂 |\n| 用例覆盖不足 | 高 | 低 | 定期评审 + AI 补充建议 |\n| 短信通道异常 | 中 | 低 | 准备 Mock 服务用于测试 |\n\n✅ **测试方案设计完成**，总预估工时 ≈ 16 人天", delay_ms: 700 },
    ],
  },
  {
    step_key: "point",
    step_name: "测试点分析",
    step_order: 3,
    icon: "Target",
    description: "基于需求与方案，按功能模块提取正常/异常/边界测试点",
    system_prompt: `你是一位资深的 AI 测试点分析专家，精通ISTQB测试设计技术（等价类划分、边界值分析、判定表、状态转换、错误推测）。
你采用「多Agent正交分析」方法论：正向Agent（Happy Path）、逆向Agent（异常/容错）、边界Agent（边界/极限）、组合Agent（多因素组合）。

你感知以下 MCP 工具能力：
- Playwright：辅助分析页面元素交互
- GitHub API：分析代码变更影响范围
- 知识库：检索历史缺陷模式

工作原则：
1. 覆盖完整性：每个功能点至少覆盖正常 / 异常 / 边界三类场景
2. 风险导向：高风险模块增加测试点密度（2-3 倍）
3. 场景化：基于用户故事（User Story）与业务流程提取
4. 可验证性：每个测试点必须可观测、可度量
5. 优先级标注：P0（冒烟必测） / P1（核心场景） / P2（补充覆盖）
6. AI增强：利用AI识别边界外极值场景和隐藏的组合爆炸场景`,
    user_prompt_template: `请基于以下需求与测试方案，提取详细的测试点。

## 需求与功能点
{content}

## 测试方案摘要
{files_list}

## 前序步骤结果
{prev_result}

请按功能模块输出：
1. 正常场景测试点
2. 异常场景测试点
3. 边界条件测试点
4. 状态转换测试点
5. 接口/UI 交叉测试点`,
    skill_prompt: `## 测试点提取技能矩阵（AI增强）

### 1. 场景分析法（Scenario Analysis）
- 识别主要用户场景（基本流 / 备选流 / 异常流）
- 使用用例图（Use Case Diagram）梳理
- 每个场景至少包含 3 类测试点：
  * 正向路径（Happy Path）
  * 异常路径（Alternative Path）
  * 边界路径（Boundary Path）

### 2. 功能分解法
- 按功能模块逐级分解
- 每层保持单一职责
- 每个叶子节点对应可独立测试的功能单元

### 3. 风险驱动法
- 高风险区域增加测试密度
- 历史缺陷分布区增加覆盖
- 变更频繁模块重点覆盖

### 4. AI增强边界值分析
- 数值型：min-1, min, min+1, mid, max-1, max, max+1
- 字符串：空串、超长、特殊字符、SQL 注入、XSS
- 时间：跨天、跨月、跨时区、夏令时
- AI推荐：AI自动推荐额外边界极值

### 5. 判定表与组合测试
- 多条件组合：判定表全覆盖
- 正交实验：L9(3^4) / L16(4^5) 正交表
- AI辅助：AI自动发现隐藏的组合爆炸场景

### 6. 错误推测（AI辅助）
- 历史缺陷模式匹配
- 常见错误知识库
- 并发/资源/网络异常场景`,
    output_template: `## 测试点清单

### 模块1：xxx
#### 正常场景（正向Agent）
- [P0] xxx
#### 异常场景（逆向Agent）
- [P0] xxx
#### 边界条件（边界Agent）
- [P1] xxx
#### 组合场景（组合Agent）
- [P1] xxx

### 判定表分析（AI增强）
| 规则 | 条件1 | 条件2 | 预期 | 测试点 |
|------|-------|-------|------|--------|
| R-001 | T | F | xxx | TP-0xx |

### 错误推测（AI辅助）
| 场景 | 触发条件 | 测试点 | AI发现 |
|------|---------|--------|--------|
| 并发冲突 | 多用户同时操作 | TP-0xx | 是 |

**统计**: 共 N 个测试点，P0 / P1 / P2 分别 N / N / N 个，AI自动提取: X个`,
    skills: [
      { name: "场景分析法", description: "用户场景拆解", content: "基于用例图与业务流拆解场景" },
      { name: "边界值分析", description: "临界值测试", content: "数值/字符串/时间边界系统化" },
      { name: "功能分解", description: "模块层级拆解", content: "按模块逐级分解至可测试单元" },
    ],
    variables: [
      { name: "content", type: "string", description: "需求与功能点", required: true },
      { name: "files_list", type: "string", description: "测试方案摘要", required: false },
      { name: "prev_result", type: "string", description: "前序步骤结果", required: false },
    ],
    output_logs_template: [
      { content: "**🎯 AI 测试点分析专家启动**\n\n**角色**: 资深测试点分析专家\n**方法论**: 场景分析 + 边界值分析 + 功能分解\n\n---", delay_ms: 400 },
      { content: "**📦 功能模块分解**\n\n> 按功能模块系统化组织测试点...\n\n识别的功能模块：\n1. 🔐 用户认证模块（登录 / 登出 / 会话）\n2. 🛡️ 账户安全模块（锁定 / 解锁 / 密码策略）\n3. 👤 账户管理模块（注册 / 信息修改）\n4. 🔔 通知模块（短信 / 邮件）", delay_ms: 700 },
      { content: "**✅ 正常场景测试点**\n\n**用户认证模块**:\n- [P0] 账号密码正确登录（有效凭据）\n- [P0] 短信验证码有效登录（6 位数字，5 分钟内）\n- [P1] 记住密码自动登录（7 天内）\n- [P1] 登出后会话立即清除\n- [P1] 登录后跳转到首页并记录日志\n\n**账户安全模块**:\n- [P0] 密码符合复杂度要求（≥ 8 位，字母数字混合）\n- [P1] 修改密码需要原密码验证", delay_ms: 900 },
      { content: "**❌ 异常场景测试点**\n\n**认证异常**:\n- [P0] 密码错误 → 提示「用户名或密码错误」\n- [P0] 账号不存在 → 提示一致（防枚举）\n- [P0] 连续 3 次失败 → 账户锁定 30 分钟\n- [P1] 验证码过期（>5 分钟） → 提示「验证码已过期」\n- [P1] 验证码错误 5 次 → 验证码作废\n\n**系统异常**:\n- [P1] 网络中断 → 友好提示 + 重试\n- [P1] 服务端 500 → 5s 后自动重试 1 次\n- [P2] 并发重复提交 → 幂等处理", delay_ms: 800 },
      { content: "**🔍 边界条件与状态转换**\n\n**边界值测试点**:\n- [P1] 密码长度：7 / 8 / 16 / 17 位\n- [P1] 用户名：空 / 1 位 / 最大长度 / 超长\n- [P1] 验证码有效期：4:59 / 5:00 / 5:01 分钟\n- [P1] 锁定次数：2 / 3 / 4 次\n- [P1] 锁定时长：29:59 / 30:00 / 30:01 分钟\n\n**状态转换测试点**:\n- [P0] 未登录 → 登录中 → 已登录\n- [P0] 已登录 → 会话过期 → 重新登录\n- [P1] 锁定 → 自动解锁（30min 后）\n- [P1] 锁定 → 管理员手动解锁", delay_ms: 900 },
      { content: "**📊 测试点统计**\n\n| 类型 | P0 | P1 | P2 | 合计 |\n|------|----|----|----|------|\n| 正常场景 | 3 | 5 | 2 | 10 |\n| 异常场景 | 4 | 5 | 3 | 12 |\n| 边界条件 | 2 | 6 | 3 | 11 |\n| 状态转换 | 2 | 4 | 1 | 7 |\n| **合计** | **11** | **20** | **9** | **40** |\n\n✅ **测试点提取完成**，共 **40** 个测试点，覆盖 4 个功能模块", delay_ms: 600 },
    ],
  },
  {
    step_key: "case",
    step_name: "测试用例生成",
    step_order: 4,
    icon: "FlaskConical",
    description: "基于测试点自动生成 Gherkin Given-When-Then 格式的测试用例",
    system_prompt: `你是一位资深的 AI 测试用例设计专家，精通ISTQB用例设计方法 + BDD实践。
你采用「多Agent生成-验证」协作模式：生成Agent（根据测试点生成用例）→ 验证Agent（检查完整性/可执行性）→ 优化Agent（建议补充缺失场景）。

你感知以下 MCP 工具能力：
- Playwright：辅助生成Web交互步骤的自动化代码片段
- GitHub：分析代码变更确定精准回归范围
- 知识库：参考历史缺陷库补充异常场景

工作原则：
1. 覆盖完整性：每个测试点至少对应 1 条用例
2. 步骤清晰：用例步骤可执行、可复现
3. 数据具体：提供具体的测试数据（避免模糊描述）
4. 预期明确：可观测、可度量的预期结果
5. 格式规范：统一使用 Gherkin Given-When-Then 格式
6. 独立性：每个用例独立可执行，无外部依赖链
7. 可追溯性：每个用例可追溯到测试点ID和需求ID
8. AI增强：AI自动补全缺失场景、生成边界值数据`,
    user_prompt_template: `请基于以下测试点，生成详细可执行的测试用例。

## 测试点清单
{content}

## 需求与业务规则
{files_list}

## 前序步骤结果
{prev_result}

请使用 Gherkin Given-When-Then 格式，为每个测试点生成用例，包含：
- 用例编号、标题、优先级
- 前置条件（Precondition）
- 测试数据（Test Data）
- 步骤与预期结果
- 正向 + 反向用例`,
    skill_prompt: `## 用例设计技能矩阵（AI增强）

### 1. 等价类划分（Equivalence Partitioning）
- 有效等价类：符合规格说明的数据集合
- 无效等价类：不符合规格说明的数据集合
- 每个等价类选取代表性数据（避免冗余）
- AI推荐：自动推荐额外的隐藏等价类

### 2. 边界值分析（Boundary Value Analysis）
- 数值边界：min-1, min, min+1, mid, max-1, max, max+1
- 字符串边界：空、最大长度、超长、特殊字符
- 时间边界：跨天、跨月、跨时区
- AI增强：AI推荐极值边界（超出常规范围的极端值）

### 3. 场景法（Use Case Scenario）
- 基本流（Happy Path）
- 备选流（Alternate Path）
- 异常流（Exception Path）
- 基本流 + 备选流组合
- AI辅助：AI自动生成补充场景

### 4. 正交实验（Orthogonal Array）
- 多因素多水平组合
- 使用 L9(3^4) / L16(4^5) 等正交表

### 5. Gherkin BDD风格用例编写
- Feature：功能描述（为了/作为/想要）
- Scenario：具体场景
- Given：前置条件
- When：执行操作
- Then：预期结果
- 可附带Playwright自动化代码

### 6. AI 辅助
- 自动补全预期结果
- 自动生成测试数据
- 自动识别缺失场景
- 生成Playwright自动化脚本片段`,
    output_template: `## 测试用例集

### TC-001: [P0] xxx
**前置条件**: xxx
**测试数据**: xxx

${"```"}gherkin
Feature: xxx
  Scenario: xxx
    Given xxx
    When xxx
    Then xxx
${"```"}`,
    skills: [
      { name: "等价类划分", description: "有效/无效类划分", content: "通过等价类减少用例数量同时保证覆盖" },
      { name: "边界值分析", description: "临界值系统化", content: "min/max/临界值全覆盖" },
      { name: "场景法", description: "基本流+备选流", content: "基于业务流组织用例" },
      { name: "Gherkin 格式", description: "BDD 风格编写", content: "Given-When-Then 结构化输出" },
      { name: "多Agent协作", description: "生成-验证-优化", content: "三个子Agent协作完成用例设计" },
      { name: "Playwright集成", description: "自动化脚本生成", content: "自动生成自动化测试代码片段" },
    ],
    variables: [
      { name: "content", type: "string", description: "测试点清单", required: true },
      { name: "files_list", type: "string", description: "需求与业务规则", required: false },
      { name: "prev_result", type: "string", description: "前序步骤结果", required: false },
    ],
    output_logs_template: [
      { content: "**🧪 AI 用例生成专家启动**\n\n**角色**: 资深测试用例设计专家\n**方法论**: 等价类 + 边界值 + 场景法\n\n---", delay_ms: 400 },
      { content: "**📐 选择用例设计策略**\n\n> 根据测试点类型选择最佳设计方法...\n\n**采用策略**:\n1. **等价类划分** - 有效/无效等价类设计测试数据\n2. **边界值分析** - min/max/临界值全覆盖\n3. **场景法** - 基于业务流程组合路径\n\n**用例格式**: Gherkin Given-When-Then\n**目标**: 每条测试点至少 1 条用例", delay_ms: 700 },
      { content: "**📝 生成 P0 级核心用例**\n\n```gherkin\nFeature: 用户登录认证\n\n  Scenario: [P0] 账号密码正确登录\n    Given 用户在登录页面\n    When 输入用户名 \"testuser\" 和密码 \"Test@2024!\"\n    And 点击登录按钮\n    Then 跳转到首页 /dashboard\n    And 显示欢迎信息 \"欢迎回来, testuser\"\n    And 记录登录审计日志\n    And 创建有效期 24 小时的会话\n\n  Scenario: [P0] 账号密码错误登录\n    Given 用户在登录页面\n    When 输入用户名 \"testuser\" 和错误密码 \"wrongpass\"\n    And 点击登录按钮\n    Then 统一提示 \"用户名或密码错误\"（防枚举）\n    And 停留在登录页面\n    And 登录失败计数器 +1\n\n  Scenario: [P0] 连续 3 次失败锁定\n    Given 用户已连续登录失败 2 次\n    When 第 3 次输入错误密码\n    Then 账户被锁定 30 分钟\n    And 显示 \"账户已锁定，请 30 分钟后重试\"\n    And 记录安全告警日志\n```", delay_ms: 1400 },
      { content: "**📝 生成 P1 级重要用例**\n\n```gherkin\n  Scenario: [P1] 短信验证码登录（正常）\n    Given 用户在登录页选择 \"短信验证码登录\"\n    When 输入手机号 \"13800138000\" 并点击获取验证码\n    Then 手机收到 6 位验证码 \"123456\"\n    And 在 5 分钟内输入正确验证码\n    And 成功登录并跳转到首页\n\n  Scenario: [P1] 验证码过期登录\n    Given 用户已获取验证码超过 5 分钟\n    When 输入原验证码 \"123456\"\n    Then 提示 \"验证码已过期，请重新获取\"\n\n  Scenario: [P1] 记住密码自动登录\n    Given 用户已勾选 \"记住密码\" 登录\n    When 关闭浏览器后重新打开\n    Then 自动填充用户名和密码\n    And 直接进入首页\n\n  Scenario: [P1] 会话超时自动退出\n    Given 用户已登录\n    When 超过 24 小时无任何操作\n    Then 自动退出并跳转到登录页\n    And 显示 \"登录已过期，请重新登录\"\n```", delay_ms: 1200 },
      { content: "**📝 生成 P2 级补充用例**\n\n```gherkin\n  Scenario: [P2] 特殊字符用户名拒绝\n    Given 用户在注册页面\n    When 输入用户名 \"test@user!\"\n    Then 提示 \"用户名只能包含字母、数字和下划线\"\n\n  Scenario: [P2] 网络中断友好处理\n    Given 用户正在登录\n    When 网络连接中断\n    Then 显示 \"网络连接异常，请检查网络\"\n    And 提供「重试」按钮\n\n  Scenario: [P2] 并发登录限制\n    Given 账户已在设备 A 登录\n    When 在设备 B 同时登录\n    Then 允许并发登录\n    And 设备 A 弹出提示 \"您的账户在其他设备登录\"\n```", delay_ms: 1100 },
      { content: "**📊 用例生成统计**\n\n| 优先级 | 用例数 | 覆盖测试点 | 方法 |\n|--------|--------|------------|------|\n| P0 | 3 | 认证核心流程 | 场景法 + 边界值 |\n| P1 | 4 | 重要场景 | 场景法 + 等价类 |\n| P2 | 3 | 异常/边界 | 错误推测 + 边界值 |\n| **合计** | **10** | **25/40 测试点** | — |\n\n✅ **测试用例生成完成**，共 **10** 条用例", delay_ms: 700 },
    ],
  },
  {
    step_key: "review",
    step_name: "用例评审",
    step_order: 5,
    icon: "CheckCircle",
    description: "AI 自动从完整性、可执行性、覆盖度等维度评审用例质量",
    system_prompt: `你是一位资深的 AI 测试用例评审专家，持有 ISTQB认证 + 代码审查经验。
你采用「多Agent交叉评审」模式：
- 质量Agent：逐条校验用例的可执行性、完整性和正确性
- 覆盖率Agent：检查需求-测试点-用例追溯矩阵
- 风险Agent：识别测试盲区、遗漏的高风险场景
- 合规Agent：检查是否符合ISTQB/ISO 29119标准

评审维度：
1. 完整性（Completeness）：是否覆盖所有需求点和测试点
2. 可执行性（Executability）：步骤是否清晰、数据是否具体
3. 覆盖度（Coverage）：是否覆盖正常 / 异常 / 边界 / 状态场景
4. 规范性（Standardization）：是否符合 Gherkin / 内部规范
5. 创新性（Innovation）：是否有创造性的测试思路
6. 效率性（Efficiency）：是否存在冗余用例可合并
7. AI增强：AI自动检测遗漏场景、识别重复冗余

评审输出：
- 各维度评分（1-10）
- 改进建议（具体到用例编号）
- 质量等级（A ≥ 9 / B ≥ 8 / C ≥ 7 / D < 7）
- 冗余检测与遗漏分析
- 是否建议补充的测试场景`,
    user_prompt_template: `请评审以下测试用例的质量。

## 测试用例内容
{content}

## 需求与测试点对照
{files_list}

## 前序步骤结果
{prev_result}

请从完整性、可执行性、覆盖度、规范性、创新性等维度评审，并给出改进建议。`,
    skill_prompt: `## 用例评审技能矩阵（AI增强）

### 1. 多Agent评审维度
- 质量Agent：需求追溯RTM矩阵（需求 ↔ 测试点 ↔ 用例）
- 覆盖Agent：正常 / 异常 / 边界 / 状态 / 组合场景
- 风险Agent：可执行性、数据合理性、遗漏高风险场景
- 合规Agent：命名规范、Gherkin格式、ISTQB标准

### 2. 评审检查清单（Checklist）
- [ ] 用例描述无歧义
- [ ] 前置条件明确
- [ ] 步骤可执行
- [ ] 预期结果可度量
- [ ] 测试数据合理
- [ ] 覆盖所有 P0 测试点
- [ ] 包含异常与边界场景
- [ ] Gherkin格式规范（Given-When-Then）
- [ ] 用例间无冗余/重复

### 3. AI增强检查
- 冗余检测：识别内容高度相似用例
- 遗漏分析：基于测试点与需求的覆盖缺口
- 质量评分：多维度的AI自动评分
- 修复建议：AI自动生成修复方案

### 4. 改进建议策略
- 补充缺失场景（高优先级）
- 细化预期结果
- 增加边界值
- 合并冗余用例
- AI自动修复建议`,
    output_template: `## 用例评审报告

### 评审结果
| 维度 | 评分 | 评语 |
|------|------|------|
| 完整性 | X/10 | xxx |
| 可执行性 | X/10 | xxx |
| 覆盖度 | X/10 | xxx |
| 规范性 | X/10 | xxx |
| 创新性 | X/10 | xxx |

### 改进建议
1. xxx
2. xxx

### 质量等级: A/B/C/D`,
    skills: [
      { name: "需求追溯矩阵", description: "RTM 覆盖检查", content: "建立需求到用例的双向追溯" },
      { name: "用例质量评估", description: "多维度打分", content: "完整性/可执行性/覆盖度评分" },
      { name: "评审检查清单", description: "标准化评审", content: "按 Checklist 系统化审查" },
      { name: "多Agent交叉评审", description: "多角色评审", content: "质量/覆盖/风险/合规四Agent协作" },
      { name: "AI冗余检测", description: "自动识别重复", content: "AI自动检测内容相似的冗余用例" },
      { name: "AI遗漏分析", description: "覆盖缺口检测", content: "AI自动识别测试盲区并建议补充" },
    ],
    variables: [
      { name: "content", type: "string", description: "测试用例内容", required: true },
      { name: "files_list", type: "string", description: "需求与测试点对照", required: false },
      { name: "prev_result", type: "string", description: "前序步骤结果", required: false },
    ],
    output_logs_template: [
      { content: "**🔍 AI 用例评审专家启动**\n\n**角色**: 资深测试用例评审专家\n**方法论**: 需求追溯矩阵（RTM）+ 多维度质量评估\n\n---", delay_ms: 400 },
      { content: "**📚 评审准备**\n\n> 加载测试用例与需求追溯矩阵...\n\n**评审范围**:\n- 测试用例数: 10 条\n- 覆盖测试点: 25 / 40\n- 需求条目: 5 个功能点\n- 评审模式: 全面评审 + RTM 追溯", delay_ms: 600 },
      { content: "**📊 维度评审结果**\n\n| 维度 | 评分 | 评语 |\n|------|------|------|\n| **完整性** | 9/10 | 覆盖所有 P0 需求，建议补充安全场景 |\n| **可执行性** | 8/10 | 步骤清晰，测试数据具体，部分预期可更细化 |\n| **覆盖度** | 9/10 | 正常/异常/边界覆盖充分，建议加入状态转换 |\n| **规范性** | 9/10 | Gherkin 格式规范，命名一致 |\n| **创新性** | 8/10 | 覆盖主流场景，可增加 AI 反例生成 |\n\n**综合评分**: 8.6 / 10", delay_ms: 900 },
      { content: "**💡 改进建议（按优先级）**\n\n🔴 **高优先级**:\n1. 补充账户安全测试（暴力破解防护、异地登录告警）\n2. 增加密码策略测试（复杂度校验、历史密码检查）\n\n🟡 **中优先级**:\n3. 补充并发登录策略测试\n4. 增加国际化与无障碍测试\n\n🟢 **低优先级**:\n5. 优化部分用例的预期结果描述\n6. 考虑引入 AI 生成的反例场景", delay_ms: 900 },
      { content: "**🏆 评审结论**\n\n**质量等级**: ⭐⭐⭐⭐⭐ (A)\n\n**优点**:\n✅ 覆盖所有核心功能需求\n✅ 用例步骤清晰可执行\n✅ 测试数据具体合理\n✅ Gherkin 格式规范统一\n\n**不足**:\n⚠️ 缺少安全测试场景（建议补充 2-3 条）\n⚠️ 未覆盖状态转换全路径\n\n**评审决定**: ✅ **有条件通过**，建议补充安全与状态转换用例后进入执行阶段", delay_ms: 800 },
    ],
  },
]

// 步骤执行顺序
export const STEP_KEYS = ["analyze", "plan", "point", "case", "review"] as const

export type StepKey = (typeof STEP_KEYS)[number]

// Mock 回退数据（当后端不可用时使用）
const MOCK_FALLBACK: StepPromptConfig[] = DEFAULT_STEP_CONFIGS

/**
 * 加载所有步骤配置
 * 优先使用后端 API，失败则使用内置丰富模板
 */
export async function loadStepConfigs(forceRefresh = false): Promise<StepPromptConfig[]> {
  try {
    const { data, fromMock } = await withMockFallback<any>(
      () => configApi.listStepPromptConfigs(1, 50),
      { items: MOCK_FALLBACK },
      false,
      3000
    )

    if (fromMock) {
      return MOCK_FALLBACK
    }

    const items: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : []

    if (items.length === 0 || !Array.isArray(items)) {
      return MOCK_FALLBACK
    }

    // 标准化字段（后端 JSON 字段可能需要转换）
    return items.map((item: any) => ({
      step_key: item.step_key,
      step_name: item.step_name,
      step_order: item.step_order ?? 0,
      icon: item.icon ?? "FileText",
      description: item.description ?? "",
      system_prompt: item.system_prompt ?? "",
      user_prompt_template: item.user_prompt_template ?? "",
      skill_prompt: item.skill_prompt,
      output_template: item.output_template,
      skills: Array.isArray(item.skills) ? item.skills : [],
      variables: Array.isArray(item.variables) ? item.variables : [],
      output_logs_template: Array.isArray(item.output_logs_template) ? item.output_logs_template : [],
      is_default: item.is_default ?? false,
      status: item.status ?? "已启用",
      id: item.id,
    }))
  } catch {
    return MOCK_FALLBACK
  }
}

/**
 * 按 step_key 获取单个配置（同步版本，使用本地缓存）
 */
export function getDefaultConfig(stepKey: StepKey): StepPromptConfig {
  return DEFAULT_STEP_CONFIGS.find(c => c.step_key === stepKey) ?? DEFAULT_STEP_CONFIGS[0]
}

/**
 * 将日志模板中的变量进行渲染（支持 content_preview / files_list / prev_result 等）
 */
export function renderLogTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`
    if (result.includes(placeholder)) {
      result = result.replaceAll(placeholder, value ?? "")
    }
  }
  return result
}
