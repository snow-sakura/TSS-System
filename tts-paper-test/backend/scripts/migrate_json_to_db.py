"""
JSON → DB 数据迁移脚本
将 data/ 目录下的 JSON 文件数据迁移到数据库
运行: python -m backend.scripts.migrate_json_to_db
"""
import asyncio
import json
from pathlib import Path
from datetime import datetime

# 确保能找到 backend 包
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import AsyncSessionLocal, engine, Base
from models.test_lifecycle import Requirement, TestPlan, TestPoint, TestCase, Review, PipelineRecord
from models.user import User
from sqlalchemy import select, func

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# 字段映射: JSON字段 → DB模型字段
COLLECTION_MAP = {
    "requirements": {
        "model": Requirement,
        "fields": {
            "title": "name",           # JSON.title → DB.name
            "content": "description",  # JSON.content → DB.description
            "status": "status",
            "source": "source",
            "created_at": None,        # 自动生成
            "updated_at": None,        # 自动生成
            "id": None,                # 自动生成（int自增）
        },
        "extra_fields": {},            # 额外固定字段
    },
    "plans": {
        "model": TestPlan,
        "fields": {
            "title": "name",
            "content": "description",
            "status": "status",
            "source": "source",
            "created_at": None,
            "updated_at": None,
            "id": None,
        },
        "extra_fields": {},
    },
    "cases": {
        "model": TestCase,
        "fields": {
            "title": "name",
            "content": "description",
            "status": "status",
            "source": "source",
            "created_at": None,
            "updated_at": None,
            "id": None,
        },
        "extra_fields": {},
    },
    "reviews": {
        "model": Review,
        "fields": {
            "title": "title",
            "content": "content",
            "status": "status",
            "source": "source",
            "pipeline_id": "pipeline_id",
            "stage_key": "stage_key",
            "created_at": None,
            "updated_at": None,
            "id": None,
        },
        "extra_fields": {},
    },
    "pipeline_records": {
        "model": PipelineRecord,
        "fields": {
            "requirement_content": "requirement_content",
            "requirement_name": "requirement_name",
            "status": "status",
            "total_duration": "total_duration",
            "stage_count": "stage_count",
            "stage_results": "stage_results",
            "created_at": None,
            "updated_at": None,
            "id": None,
        },
        "extra_fields": {},
    },
}


def parse_timestamp(ts_str: str | None) -> datetime | None:
    """解析 ISO 时间字符串"""
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str)
    except (ValueError, TypeError):
        return None


def load_json(collection: str) -> list[dict]:
    """加载 JSON 文件"""
    path = DATA_DIR / f"{collection}.json"
    if not path.exists():
        print(f"  ⚠️  {collection}.json 不存在，跳过")
        return []
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, Exception) as e:
        print(f"  ❌ 读取 {collection}.json 失败: {e}")
        return []


async def migrate_collection(collection: str, config: dict, default_user_id: int | None):
    """迁移单个集合"""
    records = load_json(collection)
    if not records:
        return 0, 0

    model = config["model"]
    field_map = config["fields"]
    extra = config["extra_fields"]

    created = 0
    skipped = 0

    async with AsyncSessionLocal() as db:
        for record in records:
            # 跳过空记录
            if not record:
                skipped += 1
                continue

            # 构建DB字段
            db_data = {**extra}
            for json_key, db_key in field_map.items():
                if db_key is None:
                    continue  # 跳过自动字段
                val = record.get(json_key)
                if val is not None:
                    db_data[db_key] = val

            # 用户关联
            if "created_by" not in db_data and default_user_id:
                db_data["created_by"] = default_user_id

            # 处理时间戳
            created_at = parse_timestamp(record.get("created_at"))
            updated_at = parse_timestamp(record.get("updated_at"))

            try:
                instance = model(**db_data)
                db.add(instance)
                await db.flush()

                # 设置时间戳（模型可能自动处理）
                if created_at and hasattr(instance, "created_at") and instance.created_at is None:
                    instance.created_at = created_at
                if updated_at and hasattr(instance, "updated_at") and instance.updated_at is None:
                    instance.updated_at = updated_at

                created += 1
            except Exception as e:
                print(f"  ⚠️  跳过记录 {record.get('title', record.get('name', 'unknown'))}: {e}")
                skipped += 1

        await db.commit()

    return created, skipped


async def main():
    """主迁移流程"""
    print("=" * 60)
    print("📦 JSON → DB 数据迁移工具")
    print("=" * 60)

    # 确保数据库表存在
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 数据库表已就绪")

    # 查找默认用户（admin）
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        admin = result.scalar_one_or_none()
        default_user_id = admin.id if admin else None
    if default_user_id:
        print(f"✅ 使用默认用户 admin (id={default_user_id})")
    else:
        print("⚠️  未找到 admin 用户，记录将没有创建者")

    # 备份 JSON 文件
    backup_dir = DATA_DIR.parent / "data_backup"
    backup_dir.mkdir(exist_ok=True)
    for f in DATA_DIR.glob("*.json"):
        import shutil
        shutil.copy2(f, backup_dir / f.name)
    print(f"✅ JSON 文件已备份到 {backup_dir}")

    # 逐集合迁移
    total_created = 0
    total_skipped = 0
    for collection, config in COLLECTION_MAP.items():
        print(f"\n📋 迁移 {collection}...")
        created, skipped = await migrate_collection(collection, config, default_user_id)
        total_created += created
        total_skipped += skipped
        print(f"  ✅ 创建 {created} 条，跳过 {skipped} 条")

    print("\n" + "=" * 60)
    print(f"🏁 迁移完成: 共创建 {total_created} 条，跳过 {total_skipped} 条")
    print(f"   JSON 文件已备份至: {backup_dir}")
    print("   可以安全删除 data/ 目录下的原始 JSON 文件")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
