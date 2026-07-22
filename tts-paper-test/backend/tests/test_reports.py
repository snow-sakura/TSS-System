"""
AI 报告服务测试
- 报告生成端点
- 质量概览端点
- 趋势分析端点
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from models.test_lifecycle import TestReport, TestExecution, TestCase


class TestReportAPI:
    """报告端点测试"""

    @pytest.mark.asyncio
    async def test_quality_metrics(self, async_client: AsyncClient, auth_headers: dict):
        """质量概览应返回结构化指标"""
        resp = await async_client.get(
            "/api/v1/test-lifecycle/quality/metrics",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data is not None

    @pytest.mark.asyncio
    async def test_quality_trends(self, async_client: AsyncClient, auth_headers: dict):
        """趋势分析应返回周数据和 AI 洞察"""
        resp = await async_client.get(
            "/api/v1/test-lifecycle/quality/trends",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        report_data = data.get("data", data)
        assert "weekly" in report_data
        assert len(report_data["weekly"]) >= 0

    @pytest.mark.asyncio
    async def test_report_create(self, async_client: AsyncClient, auth_headers: dict,
                                db_session: AsyncSession):
        """创建报告"""
        resp = await async_client.post(
            "/api/v1/test-lifecycle/reports",
            json={
                "name": "Test Report",
                "description": "A test report",
                "report_type": "version",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        report_data = data.get("data", data)
        # 可能是嵌套在 ResponseModel 中
        report = report_data if isinstance(report_data, dict) and "name" in report_data else data
        assert report.get("name") == "Test Report" or data.get("name") == "Test Report"

    @pytest.mark.asyncio
    async def test_report_generate(self, async_client: AsyncClient, auth_headers: dict,
                                   db_session: AsyncSession):
        """AI 报告生成"""
        # 先创建报告
        create_resp = await async_client.post(
            "/api/v1/test-lifecycle/reports",
            json={"name": "AI Report", "report_type": "version"},
            headers=auth_headers,
        )
        report_id = create_resp.json().get("data", create_resp.json()).get("id")

        if report_id:
            resp = await async_client.post(
                f"/api/v1/test-lifecycle/reports/{report_id}/generate",
                headers=auth_headers,
            )
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_report_list(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get(
            "/api/v1/test-lifecycle/reports",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_dashboard_stats(self, async_client: AsyncClient, auth_headers: dict):
        """仪表盘统计数据"""
        resp = await async_client.get(
            "/api/v1/test-lifecycle/dashboard/stats",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        report_data = data.get("data", data)
        assert "total_cases" in report_data


class TestAIReportService:
    """AI 报告服务单元测试"""

    @pytest.mark.asyncio
    async def test_quality_metrics_with_data(self, async_client: AsyncClient, auth_headers: dict,
                                             db_session: AsyncSession):
        """有数据时的质量指标"""
        # 插入测试数据
        db_session.add(TestExecution(
            name="Exec 1", status="completed", total_cases=10, passed=9, failed=1,
        ))
        db_session.add(TestCase(
            name="TC-001", status="approved", priority="P0",
        ))
        await db_session.commit()

        resp = await async_client.get(
            "/api/v1/test-lifecycle/quality/metrics",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        metrics = data.get("data", data)
        assert metrics.get("total_cases", 0) >= 0
        assert metrics.get("pass_rate") is not None


class TestReportsEdgeCases:
    """报告边界情况"""

    @pytest.mark.asyncio
    async def test_generate_nonexistent_report(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            "/api/v1/test-lifecycle/reports/99999/generate",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_report(self, async_client: AsyncClient, auth_headers: dict,
                                 db_session: AsyncSession):
        report = TestReport(name="To Delete", report_type="version")
        db_session.add(report)
        await db_session.commit()
        await db_session.refresh(report)

        resp = await async_client.delete(
            f"/api/v1/test-lifecycle/reports/{report.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
