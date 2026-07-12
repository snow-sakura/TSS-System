"""Report summary prompt templates"""

REPORT_SUMMARY_PROMPT = """
请生成测试报告摘要：

## 测试结果
{test_results}

## 分析数据
{analysis_data}

## 历史对比
{historical_comparison}

## 输出格式
### 执行摘要
[执行摘要]

### 关键指标
- 通过率: [通过率]
- 覆盖率: [覆盖率]
- 执行时间: [执行时间]

### 发现的问题
- [问题1]
- [问题2]

### 建议
- [建议1]
- [建议2]

### 风险评估
[风险评估]

请生成简洁明了的报告摘要。
"""

TREND_ANALYSIS_PROMPT = """
请分析测试趋势：

## 历史数据
{historical_data}

## 当前数据
{current_data}

## 输出要求
1. 识别趋势方向
2. 分析变化原因
3. 预测未来走势
4. 提供改进建议

请提供趋势分析报告。
"""
