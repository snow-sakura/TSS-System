"""
测试基础设施
===========
- 异步内存 SQLite 数据库
- FastAPI TestClient 异步
- Mock 认证用户 (绕过 JWT)
"""
import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from main import app
from api.deps import get_current_user_dep, get_db
from core.security import create_access_token
from models.user import User

# ── 内存数据库引擎 ──
test_engine = create_async_engine(
    "sqlite+aiosqlite://",
    echo=False,
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(scope="session")
async def event_loop():
    """为 async 测试创建事件循环"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """每个测试前重置数据库表"""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """提供测试数据库会话"""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


# ── 测试用户 ──
_test_user_data = {
    "id": 999,
    "username": "testuser",
    "email": "test@example.com",
    "display_name": "Test User",
    "hashed_password": "$2b$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1Qlq5Gz.YtGcVNx7TQ8R3h5m7KXO",  # "password123"
    "is_active": True,
    "is_superuser": True,
}


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """创建并返回测试用户"""
    user = User(**_test_user_data)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_token(test_user: User) -> str:
    """生成认证 JWT Token"""
    return create_access_token(data={"sub": str(test_user.id)})


@pytest_asyncio.fixture
async def auth_headers(auth_token: str) -> dict:
    """认证请求头"""
    return {"Authorization": f"Bearer {auth_token}"}


# ── FastAPI 依赖覆盖 ──
@pytest_asyncio.fixture
async def override_db_dependency(test_user: User, db_session: AsyncSession):
    """覆盖 get_current_user_dep 和 get_db 依赖"""

    async def _override_user():
        return test_user

    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user_dep] = _override_user
    yield
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_client(override_db_dependency) -> AsyncGenerator[AsyncClient, None]:
    """异步测试 HTTP 客户端"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# ── 常用测试数据 ──
@pytest.fixture
def sample_requirement_content() -> str:
    return """用户登录功能：
1. 用户输入用户名和密码进行登录
2. 支持手机号验证码登录
3. 支持微信扫码登录
4. 登录失败超过5次锁定账号30分钟
5. 密码需要符合复杂度要求（8位以上，含大小写字母和数字）"""


@pytest.fixture
def sample_requirement_name() -> str:
    return "用户登录模块需求"
