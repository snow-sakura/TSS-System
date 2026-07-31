"""
MCP 市场 API 测试
- 内置服务列表
- 服务分类
- 安装流程（正向/负向）
- 已安装服务 CRUD
"""
import pytest
from httpx import AsyncClient


class TestMCPMarketplaceAPI:
    """MCP 市场端点测试"""

    @pytest.mark.asyncio
    async def test_list_services(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get("/api/v1/mcp-marketplace/services", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 6  # 6 个内置服务

    @pytest.mark.asyncio
    async def test_service_has_required_fields(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get("/api/v1/mcp-marketplace/services", headers=auth_headers)
        data = resp.json()
        for svc in data:
            assert svc.get("id"), f"Service missing id: {svc}"
            assert svc.get("name"), f"Service missing name: {svc}"
            assert svc.get("description"), f"Service missing description: {svc}"
            assert svc.get("category"), f"Service missing category: {svc}"
            assert svc.get("tools"), f"Service missing tools: {svc}"

    @pytest.mark.asyncio
    async def test_list_services_with_category(self, async_client: AsyncClient, auth_headers: dict):
        """指定分类筛选"""
        resp = await async_client.get(
            "/api/v1/mcp-marketplace/services?category=浏览器自动化",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        for svc in data:
            assert svc["category"] == "浏览器自动化"

    @pytest.mark.asyncio
    async def test_list_categories(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get("/api/v1/mcp-marketplace/categories", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert any(c["name"] == "浏览器自动化" for c in data)

    @pytest.mark.asyncio
    async def test_get_service_detail(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get("/api/v1/mcp-marketplace/services/playwright-mcp", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "playwright-mcp"
        assert data["name"] == "Playwright MCP"

    @pytest.mark.asyncio
    async def test_get_service_not_found(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get("/api/v1/mcp-marketplace/services/nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_install_service(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            "/api/v1/mcp-marketplace/install",
            json={"marketplace_id": "playwright-mcp"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True
        assert data["service"]["name"] == "Playwright MCP"

    @pytest.mark.asyncio
    async def test_install_invalid_service(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            "/api/v1/mcp-marketplace/install",
            json={"marketplace_id": "nonexistent_service"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_install_with_custom_name(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            "/api/v1/mcp-marketplace/install",
            json={"marketplace_id": "file-system", "name": "我的文件服务"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["service"]["name"] == "我的文件服务"

    @pytest.mark.asyncio
    async def test_install_all_services(self, async_client: AsyncClient, auth_headers: dict):
        """逐一安装所有内置服务"""
        services = ["playwright-mcp", "file-system", "database", "git", "github-mcp", "slack"]
        for sid in services:
            resp = await async_client.post(
                "/api/v1/mcp-marketplace/install",
                json={"marketplace_id": sid},
                headers=auth_headers,
            )
            assert resp.status_code == 200, f"Failed to install {sid}: {resp.text}"

    @pytest.mark.asyncio
    async def test_list_installed_services(self, async_client: AsyncClient, auth_headers: dict):
        # 先安装一个
        await async_client.post(
            "/api/v1/mcp-marketplace/install",
            json={"marketplace_id": "playwright-mcp"},
            headers=auth_headers,
        )
        resp = await async_client.get("/api/v1/config/mcp-services", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        body = data.get("data", data) if isinstance(data, dict) else data
        items = body if isinstance(body, list) else body.get("items", [])
        assert len(items) >= 1
        assert any(s["name"] == "Playwright MCP" for s in items)
