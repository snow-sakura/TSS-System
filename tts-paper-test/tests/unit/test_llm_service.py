"""LLM服务模块单元测试"""

import pytest
import asyncio
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from web.services.llm_service import LLMService, llm_service


@pytest.fixture
def llm():
    """创建LLM服务实例"""
    return LLMService()


def test_llm_service_init(llm):
    """测试LLM服务初始化"""
    assert llm is not None
    assert isinstance(llm.providers, dict)


def test_generate_mock_analysis(llm):
    """测试生成模拟分析结果"""
    content = "这是一个测试需求"
    result = llm._generate_mock_analysis(content)
    
    assert "summary" in result
    assert "test_points" in result
    assert "risk_areas" in result
    assert len(result["test_points"]) > 0


def test_generate_mock_test_plan(llm):
    """测试生成模拟测试方案"""
    result = llm._generate_mock_test_plan()
    
    assert "test_strategy" in result
    assert "test_scope" in result
    assert "test_environment" in result
    assert "test_schedule" in result


def test_generate_mock_test_cases(llm):
    """测试生成模拟测试用例"""
    cases = llm._generate_mock_test_cases(3)
    
    assert len(cases) == 3
    assert all("title" in c for c in cases)
    assert all("steps" in c for c in cases)
    assert all("expected_result" in c for c in cases)


def test_generate_mock_test_cases_limit(llm):
    """测试限制生成数量"""
    cases = llm._generate_mock_test_cases(2)
    
    assert len(cases) == 2


@pytest.mark.asyncio
async def test_generate_test_analysis(llm):
    """测试AI生成需求分析"""
    content = "用户登录功能需求"
    
    try:
        # 由于没有真实的LLM API，这会使用模拟数据
        result = await llm.generate_test_analysis(content)
        
        assert "summary" in result
        assert "test_points" in result
    except Exception as e:
        # 如果httpx未安装，跳过测试
        if "httpx" in str(e):
            pytest.skip("httpx未安装")
        else:
            raise


@pytest.mark.asyncio
async def test_generate_test_plan(llm):
    """测试AI生成测试方案"""
    test_points = [
        {"title": "登录测试", "type": "功能测试", "priority": "高"}
    ]
    
    try:
        result = await llm.generate_test_plan(test_points)
        
        assert "test_strategy" in result
        assert "test_scope" in result
    except Exception as e:
        if "httpx" in str(e):
            pytest.skip("httpx未安装")
        else:
            raise


@pytest.mark.asyncio
async def test_generate_test_cases(llm):
    """测试AI生成测试用例"""
    test_points = [
        {"title": "登录测试", "type": "功能测试", "priority": "高"}
    ]
    
    try:
        cases = await llm.generate_test_cases(test_points, count=2)
        
        assert len(cases) == 2
        assert all("title" in c for c in cases)
    except Exception as e:
        if "httpx" in str(e):
            pytest.skip("httpx未安装")
        else:
            raise


def test_llm_service_reload(llm):
    """测试重新加载提供商配置"""
    llm.reload_providers()
    assert isinstance(llm.providers, dict)
