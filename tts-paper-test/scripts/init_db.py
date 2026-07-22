"""数据库初始化脚本"""

import asyncio
import sys
from pathlib import Path

# 添加backend到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from database import engine, Base
from models import *  # noqa: F403 - 确保所有模型被导入


async def init():
    """初始化数据库"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 数据库表创建完成")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init())
