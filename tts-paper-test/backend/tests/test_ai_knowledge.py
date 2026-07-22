"""
AI 知识增强服务测试
- 执行记录 → 知识提取逻辑
- 知识搜索 (RAG + AI)
- 模式建议
- Bug 自动创建
"""
import pytest
from httpx import AsyncClient


class TestKnowledgeAIAPI:
    """知识库 AI 增强端点"""

    @pytest.mark.asyncio
    async def test_ai_search_no_query(self, async_client: AsyncClient, auth_headers: dict):
        """搜索查询为空应返回 422"""
        resp = await async_client.post(
            "/api/v1/knowledge/ai/search",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_ai_search_basic(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            "/api/v1/knowledge/ai/search",
            json={"query": "登录功能测试要点", "top_k": 5},
            headers=auth_headers,
        )
        # 即使知识库为空，AI 搜索也应返回结构化结果
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data or data.get("data") is not None

    @pytest.mark.asyncio
    async def test_suggest_patterns(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            "/api/v1/knowledge/ai/suggest-patterns",
            json={"text": "登录功能反复出现元素定位失败的缺陷", "context": "web自动化测试"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data is not None

    @pytest.mark.asyncio
    async def test_create_bug_from_failure_no_data(self, async_client: AsyncClient, auth_headers: dict):
        """缺少必要字段应返回 422"""
        resp = await async_client.post(
            "/api/v1/knowledge/ai/create-bug-from-failure",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_bug_nonexistent_execution(self, async_client: AsyncClient, auth_headers: dict):
        """不存在的执行记录"""
        resp = await async_client.post(
            "/api/v1/knowledge/ai/create-bug-from-failure",
            json={"execution_id": 99999, "node_execution_id": 99999},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 404)  # 可能兜底返回

    @pytest.mark.asyncio
    async def test_extract_from_execution_no_id(self, async_client: AsyncClient, auth_headers: dict):
        """不存在的执行记录应返回 404"""
        resp = await async_client.post(
            "/api/v1/knowledge/ai/extract-from-execution",
            json={"execution_id": 99999},
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestKnowledgeAIEndpointAvailability:
    """知识库 AI 端点可达性测试"""

    @pytest.mark.asyncio
    async def test_all_ai_endpoints_exist(self, async_client: AsyncClient, auth_headers: dict):
        """验证所有 4 个 AI 端点都可达"""
        # 1. AI 搜索
        resp = await async_client.post(
            "/api/v1/knowledge/ai/search",
            json={"query": "test"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 422), f"AI search: {resp.status_code}"

        # 2. 建议模式
        resp = await async_client.post(
            "/api/v1/knowledge/ai/suggest-patterns",
            json={"text": "test pattern"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 422), f"Suggest patterns: {resp.status_code}"

        # 3. 创建 Bug（需要 failure 字段）
        resp = await async_client.post(
            "/api/v1/knowledge/ai/create-bug-from-failure",
            json={"failure": "登录测试失败: Unable to locate element"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 422), f"Create bug: {resp.status_code}"

        # 4. 从执行提取（需要有效 execution_id）
        resp = await async_client.post(
            "/api/v1/knowledge/ai/extract-from-execution",
            json={"execution_id": 0},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 404, 422), f"Extract: {resp.status_code}"
