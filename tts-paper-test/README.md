# TSS Paper Test - AI原生测试系统

## 概述

TSS Paper Test 是一个基于AI Agent的智能测试系统，用于测试TSS（纸质车票销售系统）。该系统采用多Agent协作、向量知识库、RAG技术等现代AI技术，实现智能化的测试生成、执行和分析。

## 核心特性

- **AI原生架构**：测试完全由AI Agent驱动
- **多Agent协作**：5个专业Agent分工协作
- **知识增强**：向量知识库+RAG智能检索
- **Skills系统**：通过Slash命令触发专业工作流
- **自学习**：从历史结果中学习优化

## 技术栈

- **Agent框架**：CrewAI
- **LLM应用**：LangChain + LangGraph
- **向量知识库**：ChromaDB
- **测试框架**：pytest + Hypothesis
- **配置管理**：pydantic + python-dotenv

## 项目结构

```
tts-paper-test/
├── .mimocode/skills/     # Skills配置
├── knowledge/            # 知识库
├── agents/               # AI Agent
├── prompts/              # Prompt模板
├── core/                 # 核心模块
├── tests/                # 测试代码
├── reports/              # 测试报告
└── scripts/              # 脚本
```

## 快速开始

### 1. 安装依赖

```bash
cd tts-paper-test
pip install -e .
```

### 2. 配置环境

```bash
cp .env.example .env
# 编辑 .env 文件，填入API密钥等配置
```

### 3. 初始化知识库

```bash
python scripts/setup_knowledge.py
```

### 4. 使用Skills

在MiMoCode中使用以下命令：

- `/test-generation` - 生成测试用例
- `/test-execution` - 执行测试
- `/test-analysis` - 分析测试结果
- `/knowledge-update` - 更新知识库
- `/full-test-cycle` - 完整测试周期

## Agent角色

1. **规划Agent** - 分析系统，制定测试策略
2. **生成Agent** - 生成高质量测试代码
3. **执行Agent** - 运行测试，收集结果
4. **评审Agent** - 评审测试质量
5. **分析Agent** - 分析结果，更新知识

## 知识库

- **测试模式**：存储常见测试模式和最佳实践
- **Bug知识**：存储历史Bug和解决方案
- **测试结果**：存储历史测试结果

## 开发

### 添加新的测试模式

编辑 `knowledge/test_patterns/` 目录下的文件。

### 添加新的Bug知识

编辑 `knowledge/bug_knowledge/known_bugs.json` 文件。

### 创建新的Skill

使用 `/skill-creator` 命令创建新的Skill。

## 许可证

MIT License
