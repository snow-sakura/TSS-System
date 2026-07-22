"""
Pipeline 服务测试
- DB 模型操作 (Requirement, PipelineRecord)
- API 端点列表/详情
- 服务初始化
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from models.test_lifecycle import Requirement, PipelineRecord


class TestPipelineModels:
    """Pipeline 相关 DB 模型"""

    @pytest.mark.asyncio
    async def test_create_requirement_with_pipeline_id(self, db_session: AsyncSession):
        req = Requirement(
            name="Test Req",
            description="Test content",
            source="manual",
            status="draft",
            pipeline_id="abc123",
        )
        db_session.add(req)
        await db_session.commit()
        await db_session.refresh(req)

        assert req.id is not None
        assert req.pipeline_id == "abc123"
        assert req.name == "Test Req"
        assert req.status == "draft"

    @pytest.mark.asyncio
    async def test_create_pipeline_record(self, db_session: AsyncSession):
        record = PipelineRecord(
            name="Pipeline Test",
            status="completed",
            pipeline_id="pipe_001",
            requirement_name="Login Module",
            requirement_content="User login test",
            total_duration=12.5,
            stage_count=5,
            stage_results=[
                {"key": "requirements", "content": "# Analysis", "duration": 3.2},
                {"key": "test-plans", "content": "# Plans", "duration": 4.1},
            ],
        )
        db_session.add(record)
        await db_session.commit()
        await db_session.refresh(record)

        assert record.id is not None
        assert record.pipeline_id == "pipe_001"
        assert record.stage_count == 5
        assert len(record.stage_results) == 2

    @pytest.mark.asyncio
    async def test_multiple_pipeline_records(self, db_session: AsyncSession):
        records = [
            PipelineRecord(name="Pipe 1", pipeline_id="p1", stage_count=3, status="completed"),
            PipelineRecord(name="Pipe 2", pipeline_id="p2", stage_count=5, status="failed"),
            PipelineRecord(name="Pipe 3", pipeline_id="p3", stage_count=2, status="running"),
        ]
        for r in records:
            db_session.add(r)
        await db_session.commit()

        # 验证查询
        from sqlalchemy import select
        result = await db_session.execute(
            select(PipelineRecord).order_by(PipelineRecord.created_at.desc())
        )
        all_records = result.scalars().all()
        assert len(all_records) == 3


class TestPipelineAPI:
    """Pipeline API 端点测试"""

    @pytest.mark.asyncio
    async def test_list_pipeline_records_empty(self, async_client: AsyncClient, auth_headers: dict):
        """空表应返回空列表"""
        resp = await async_client.get(
            "/api/v1/test-lifecycle/pipeline-records",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_pipeline_records_with_search(
        self, async_client: AsyncClient, auth_headers: dict,
        db_session: AsyncSession,
    ):
        # 先插入数据
        record = PipelineRecord(
            name="Searchable Pipeline",
            pipeline_id="search_001",
            requirement_name="Login Module",
            stage_count=5,
            status="completed",
        )
        db_session.add(record)
        await db_session.commit()

        resp = await async_client.get(
            "/api/v1/test-lifecycle/pipeline-records?search=Login",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert data["items"][0]["pipeline_id"] == "search_001"

    @pytest.mark.asyncio
    async def test_get_pipeline_record_detail(
        self, async_client: AsyncClient, auth_headers: dict,
        db_session: AsyncSession,
    ):
        record = PipelineRecord(
            name="Detail Test",
            pipeline_id="detail_001",
            requirement_name="Test",
            requirement_content="Content",
            stage_count=3,
            status="completed",
            stage_results=[
                {"key": "req", "content": "# Req", "duration": 1.0},
                {"key": "plan", "content": "# Plan", "duration": 2.0},
            ],
        )
        db_session.add(record)
        await db_session.commit()
        await db_session.refresh(record)

        resp = await async_client.get(
            f"/api/v1/test-lifecycle/pipeline-records/{record.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["pipeline_id"] == "detail_001"
        assert data["stage_count"] == 3
        assert len(data["stage_results"]) == 2

    @pytest.mark.asyncio
    async def test_get_pipeline_record_not_found(
        self, async_client: AsyncClient, auth_headers: dict,
    ):
        resp = await async_client.get(
            "/api/v1/test-lifecycle/pipeline-records/99999",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_list_pipeline_records_pagination(
        self, async_client: AsyncClient, auth_headers: dict,
        db_session: AsyncSession,
    ):
        # 插入 3 条记录
        for i in range(3):
            db_session.add(PipelineRecord(
                name=f"Pipe {i}",
                pipeline_id=f"p_{i}",
                stage_count=1,
                status="completed",
            ))
        await db_session.commit()

        # 每页 2 条
        resp = await async_client.get(
            "/api/v1/test-lifecycle/pipeline-records?page=1&page_size=2",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) <= 2
        assert data["total"] == 3
        assert data["total_pages"] == 2

    @pytest.mark.asyncio
    async def test_list_stage_results_not_returned_in_list(
        self, async_client: AsyncClient, auth_headers: dict,
        db_session: AsyncSession,
    ):
        """列表接口不应返回 stage_results 详情"""
        record = PipelineRecord(
            name="No content in list",
            pipeline_id="no_content",
            stage_count=1,
            status="completed",
            stage_results=[{"key": "req", "content": "SECRET_CONTENT"}],
        )
        db_session.add(record)
        await db_session.commit()

        resp = await async_client.get(
            "/api/v1/test-lifecycle/pipeline-records",
            headers=auth_headers,
        )
        data = resp.json()
        item = data["items"][0]
        assert "stage_results" not in item
        assert "requirement_content" not in item
