"""全流程 Pipeline API — DB 版"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.pipeline_service import PipelineService
from core.logging_config import get_logger

logger = get_logger("pipeline_api")
router = APIRouter(prefix="/api/v1/pipeline", tags=["全流程Pipeline"])


class PipelineStartRequest(BaseModel):
    """启动全流程请求"""
    requirement_content: str = Field(..., description="需求文档内容/手动输入文本", min_length=1, max_length=100000)
    requirement_name: str = Field(default="", description="需求名称")
    project_id: Optional[int] = Field(default=None, description="项目ID")
    version_id: Optional[int] = Field(default=None, description="版本ID")
    resume_from: Optional[str] = Field(default=None, description="从指定阶段继续执行（阶段key）")
    record_id: Optional[int] = Field(default=None, description="追加到原记录ID（继续执行模式）")


@router.post("/start")
async def start_pipeline(body: PipelineStartRequest, db: AsyncSession = Depends(get_db)):
    """
    启动全流程Pipeline（需求分析 → 规划方案 → 提取测试点 → 用例生成 → 用例评审）
    返回 SSE 事件流，结果持久化到 DB

    支持继续执行模式：
      - 传入 resume_from + record_id 时，从指定阶段继续执行
      - 已完成阶段推送 stage_complete(skipped) 事件，不重复持久化
      - 完成后更新原 PipelineRecord，不新建记录
    """
    if not body.requirement_content.strip():
        raise HTTPException(status_code=400, detail="需求内容不能为空")

    logger.info(f"🚀 启动全流程Pipeline (DB版): {body.requirement_name or '未命名'}")
    if body.resume_from and body.record_id:
        logger.info(f"  ↻ 继续执行模式: record_id={body.record_id}, resume_from={body.resume_from}")

    service = PipelineService(db=db)

    return StreamingResponse(
        service.run_pipeline(
            requirement_content=body.requirement_content,
            requirement_name=body.requirement_name,
            project_id=body.project_id,
            version_id=body.version_id,
            resume_from=body.resume_from,
            record_id=body.record_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
