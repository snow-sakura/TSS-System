"""Test generation prompt templates"""

TEST_GENERATION_PROMPT = """
你是一个专业的测试工程师AI。根据以下信息生成测试用例：

## 被测系统信息
{system_info}

## 测试计划
{test_plan}

## 历史测试模式
{similar_patterns}

## 已知Bug
{known_bugs}

## 要求
1. 生成pytest格式的测试代码
2. 使用Hypothesis进行属性测试（如适用）
3. 覆盖正常流程和异常流程
4. 包含清晰的测试描述
5. 使用适当的fixtures
6. 每个测试函数只测试一个场景
7. 使用有意义的测试函数名

## 输出格式
```python
import pytest
from hypothesis import given, strategies as st

def test_<功能>_<场景>():
    '''测试描述'''
    # 测试代码
    pass
```

请生成高质量的测试代码。
"""

TEST_PLAN_PROMPT = """
你是一个测试规划专家。请为以下系统制定测试计划：

## 系统信息
{system_info}

## 功能模块
{modules}

## 历史测试数据
{historical_data}

## 要求
1. 识别关键业务流程
2. 确定测试优先级
3. 规划测试覆盖范围
4. 估算测试工作量
5. 识别风险点

请输出详细的测试计划。
"""
