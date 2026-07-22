"""
MCP 市场 API 测试
- 内置服务模板列表
- 模板分类
- 安装流程（正向/负向）
- 已安装服务 CRUD
"""
import pytest
from httpx import AsyncClient


class TestMCPMarketplaceAPI:
    """MCP 市场端点测试"""

    @pytest.mark.asyncio
    async def test_list_templates(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get("/api/v1/mcp-marketplace/templates", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "templates" in data
        assert len(data["templates"]) >= 6  # 6 个内置服务

    @pytest.mark.asyncio
    async def test_template_has_required_fields(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get("/api/v1/mcp-marketplace/templates", headers=auth_headers)
        data = resp.json()
        for t in data["templates"]:
            assert t.get("id"), f"Template missing id: {t}"
            assert t.get("name"), f"Template missing name: {t}"
            assert t.get("description"), f"Template missing description: {t}"
            assert t.get("category"), f"Template missing category: {t}"
            assert t.get("command"), f"Template missing command: {t}"

    @pytest.mark.asyncio
    async def test_list_templates_with_category(self, async_client: AsyncClient, auth_headers: dict):
        """指定分类筛选"""
        resp = await async_client.get(
            "/api/v1/mcp-marketplace/templates?category=browser",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        for t in data["templates"]:
            assert t["category"] == "browser"

    @pytest.mark.asyncio
    async def test_list_categories(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get("/api/v1/mcp-marketplace/categories", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "categories" in data
        categories = data["categories"]
        assert any(c["id"] == "all" for c in categories)
        assert any(c["id"] == "browser" for c in categories)

    @pytest.mark.asyncio
    async def test_install_template(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            "/api/v1/mcp-marketplace/install",
            json={"template_id": "playwright"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("id") is not None
        assert data.get("name") == "Playwright"

    @pytest.mark.asyncio
    async def test_install_invalid_template(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            "/api/v1/mcp-marketplace/install",
            json={"template_id": "nonexistent_template"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_install_with_custom_name(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            "/api/v1/mcp-marketplace/install",
            json={"template_id": "filesystem", "name": "我的文件服务"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "我的文件服务"

    @pytest.mark.asyncio
    async def test_install_all_templates(self, async_client: AsyncClient, auth_headers: dict):
        """逐一安装所有 6 个模板"""
        templates = ["playwright", "filesystem", "database", "git", "github", "slack"]
        for tid in templates:
            resp = await async_client.post(
                "/api/v1/mcp-marketplace/install",
                json={"template_id": tid},
                headers=auth_headers,
            )
            assert resp.status_code == 200, f"Failed to install {tid}: {resp.text}"

    @pytest.mark.asyncio
    async def test_list_installed_services(self, async_client: AsyncClient, auth_headers: dict):
        # 先安装一个
        await async_client.post(
            "/api/v1/mcp-marketplace/install",
            json={"template_id": "playwright"},
            headers=auth_headers,
        )
        resp = await async_client.get("/api/v1/mcp-services", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        items = data if isinstance(data, list) else data.get("items", [])
        assert len(items) >= 1
        assert any(s["name"] == "Playwright" for s in items)
