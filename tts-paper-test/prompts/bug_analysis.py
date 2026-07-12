"""Bug analysis prompt templates"""

BUG_ANALYSIS_PROMPT = """
你是一个Bug分析专家。请分析以下测试失败：

## 失败信息
{failure_info}

## 相关代码
{related_code}

## 历史相似Bug
{similar_bugs}

## 分析要求
1. 识别根本原因
2. 分析影响范围
3. 评估严重程度
4. 提供修复建议
5. 建议预防措施

## 输出格式
### 根本原因
[根本原因分析]

### 影响范围
[影响范围评估]

### 严重程度
[严重程度评估]

### 修复建议
[修复建议]

### 预防措施
[预防措施建议]

请提供详细的分析报告。
"""

ROOT_CAUSE_PROMPT = """
请分析以下问题的根本原因：

## 问题描述
{problem_description}

## 相关日志
{logs}

## 系统状态
{system_state}

## 输出要求
1. 识别直接原因
2. 分析根本原因
3. 追溯问题源头
4. 评估系统性问题

请提供根本原因分析。
"""
