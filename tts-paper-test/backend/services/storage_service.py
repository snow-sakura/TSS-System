"""
JSON文件存储服务
为需求管理/方案管理/用例管理/评审管理提供CRUD + 分页 + 筛选 + 排序
"""
from __future__ import annotations
import json
import os
import uuid
from datetime import datetime
from typing import Any, Optional
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def _ts() -> str:
    return datetime.now().isoformat()


class CollectionStore:
    """单个集合的 JSON 文件存储"""

    def __init__(self, name: str):
        self.path = DATA_DIR / f"{name}.json"
        if not self.path.exists():
            self.path.write_text("[]", encoding="utf-8")

    def _load(self) -> list[dict]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save(self, data: list[dict]):
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    # ---- CRUD ----

    def list(self, page: int = 1, page_size: int = 20,
             search: str = "", sort_by: str = "created_at",
             sort_order: str = "desc",
             filters: Optional[dict[str, Any]] = None) -> dict:
        """分页列表查询，支持搜索和筛选"""
        items = self._load()
        filters = filters or {}

        # 搜索
        if search:
            q = search.lower()
            items = [i for i in items if q in json.dumps(i, ensure_ascii=False).lower()]

        # 筛选
        for key, val in filters.items():
            if val is not None and val != "":
                items = [i for i in items if str(i.get(key, "")).lower() == str(val).lower()]

        # 排序
        reverse = sort_order.lower() == "desc"
        items.sort(key=lambda i: str(i.get(sort_by, "")), reverse=reverse)

        total = len(items)
        total_pages = max(1, (total + page_size - 1) // page_size)
        page = max(1, min(page, total_pages))
        start = (page - 1) * page_size
        end = start + page_size
        page_items = items[start:end]

        return {
            "items": page_items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

    def get(self, item_id: str) -> Optional[dict]:
        for i in self._load():
            if i.get("id") == item_id:
                return i
        return None

    def create(self, data: dict) -> dict:
        items = self._load()
        now = _ts()
        record = {
            "id": str(uuid.uuid4())[:12],
            "created_at": now,
            "updated_at": now,
            **data,
        }
        items.insert(0, record)
        self._save(items)
        return record

    def update(self, item_id: str, data: dict) -> Optional[dict]:
        items = self._load()
        for i, item in enumerate(items):
            if item.get("id") == item_id:
                item.update({k: v for k, v in data.items() if k != "id"})
                item["updated_at"] = _ts()
                items[i] = item
                self._save(items)
                return item
        return None

    def delete(self, item_id: str) -> bool:
        items = self._load()
        new_items = [i for i in items if i.get("id") != item_id]
        if len(new_items) == len(items):
            return False
        self._save(new_items)
        return True

    def delete_many(self, item_ids: list[str]) -> int:
        items = self._load()
        id_set = set(item_ids)
        new_items = [i for i in items if i.get("id") not in id_set]
        removed = len(items) - len(new_items)
        self._save(new_items)
        return removed

    def bulk_create(self, records: list[dict]) -> list[dict]:
        """批量创建（例如从AI流水线同步）"""
        items = self._load()
        now = _ts()
        created = []
        for r in records:
            record = {
                "id": str(uuid.uuid4())[:12],
                "created_at": now,
                "updated_at": now,
                **r,
            }
            created.append(record)
        items = created + items
        self._save(items)
        return created


# ---- 全局单例 ----
stores = {
    "requirements": CollectionStore("requirements"),
    "plans": CollectionStore("plans"),
    "cases": CollectionStore("cases"),
    "reviews": CollectionStore("reviews"),
    "pipeline_records": CollectionStore("pipeline_records"),
}


def get_store(name: str) -> CollectionStore:
    return stores[name]
