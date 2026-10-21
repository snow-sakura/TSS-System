#!/usr/bin/env python3
"""GitHub Pages Demo 数据构建脚本。

从开发数据库导出【脱敏后】的执行记录与序列调度统计数据，
并拷贝文档截图，使 demo/ 目录完全自包含，可直接作为 GitHub Pages Site 发布。

用法（在 backend 目录下，使用其虚拟环境）：
    .venv/bin/python ../demo/build_data.py
或任意 python3（仅依赖标准库）：
    python3 demo/build_data.py

输出：
    demo/data/records.json        脱敏执行/调度数据
    demo/assets/screenshots/*.png 功能截图
"""

from __future__ import annotations

import ast
import datetime as _dt
import json
import re
import shutil
import sqlite3
from pathlib import Path

DEMO_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = DEMO_DIR.parent
DB_CANDIDATES = [
    PROJECT_ROOT / "backend" / "tss_dev.db",
    PROJECT_ROOT / "backend" / "data" / "tss.db",
]
SCREENSHOTS_SRC = PROJECT_ROOT / "docs" / "screenshots"

REDACT_KEYS = {"api_key", "apikey", "token", "secret", "password", "base_url"}
SK_PATTERN = re.compile(r"sk-[A-Za-z0-9]{10,}")


def scrub(obj):
    """递归脱敏：移除密钥类字段并掩码 sk- 令牌。"""
    if isinstance(obj, dict):
        return {k: scrub(v) for k, v in obj.items() if k.lower() not in REDACT_KEYS}
    if isinstance(obj, list):
        return [scrub(x) for x in obj]
    if isinstance(obj, str):
        return SK_PATTERN.sub("sk-***REDACTED***", obj)
    return obj


def slim_stage(st: dict) -> dict:
    item = {
        k: st.get(k) for k in ("key", "label", "status", "duration", "error") if k in st
    }
    out = st.get("output") or st.get("content") or ""
    if isinstance(string_or(out := out, str), str) and out:
        item["preview"] = out[:280]
        item["output_chars"] = len(out)
    if "error" in item and item["error"]:
        item["error"] = str(item["error"])[:200]
    elif "error" in item:
        item.pop("error")
    return item


def string_or(value, _type):
    return value if isinstance(value, _type) else value


def parse_json_field(raw, default):
    if raw is None:
        return default
    if isinstance(raw, (list, dict)):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        try:  # 兼容 Python repr 字符串
            parsed = ast.literal_eval(raw)
            return parsed if isinstance(parsed, (list, dict)) else default
        except Exception:
            return default


def main() -> None:
    db_path = next((p for p in DB_CANDIDATES if p.exists()), None)
    if db_path is None:
        raise SystemExit(f"未找到数据库，查找过: {[str(p) for p in DB_CANDIDATES]}")

    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row

    # ── 流水线执行记录 ────────────────────────────────────────────
    records = []
    for row in db.execute(
        "SELECT * FROM pipeline_records ORDER BY created_at DESC LIMIT 50"
    ):
        d = dict(row)
        stages = parse_json_field(d.get("stage_results"), [])
        if isinstance(stages, dict):
            stages = [{"key": k, **v} for k, v in stages.items() if isinstance(v, dict)]
        d["stage_results"] = [slim_stage(s) for s in stages if isinstance(s, dict)]
        d.pop("requirement_content", None)  # 需求正文可能含内部信息，demo 不发布
        records.append(scrub(d))

    # ── 序列调度组 ───────────────────────────────────────────────
    groups = []
    for row in db.execute("SELECT * FROM sequence_groups ORDER BY id DESC LIMIT 30"):
        g = dict(row)
        tasks = parse_json_field(g.get("tasks"), [])
        for t in tasks if isinstance(tasks, list) else []:
            if isinstance(t, dict) and isinstance(t.get("stages"), str):
                t["stages"] = [
                    slim_stage(s)
                    for s in parse_json_field(t["stages"], [])
                    if isinstance(s, dict)
                ]
            if isinstance(t, dict):
                t.pop("content", None)
        g["tasks"] = tasks
        g.pop("requirement_content", None)
        groups.append(scrub(g))

    # ── 模型配置（本就不含密钥，双保险 scrub）────────────────────
    providers = [
        scrub(dict(r))
        for r in db.execute(
            "SELECT id,name,type,model,tier,max_concurrency,status,created_at "
            "FROM llm_providers"
        )
    ]

    total = len(records)
    completed = sum(1 for r in records if r["status"] == "completed")
    payload = {
        "exported_at": _dt.datetime.now().isoformat(timespec="seconds"),
        "db_file": db_path.name,
        "note": "TSS AI测试平台 · 真实执行记录快照（已脱敏，需求正文与密钥已移除）",
        "stats": {
            "pipeline_total": total,
            "pipeline_completed": completed,
            "pipeline_failed": sum(1 for r in records if r["status"] == "failed"),
            "sequence_groups": len(groups),
            "sequence_tasks": sum(len(g.get("tasks") or []) for g in groups),
            "providers": len(providers),
        },
        "pipeline_records": records,
        "sequence_groups": groups,
        "llm_providers": providers,
    }

    out_dir = DEMO_DIR / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "records.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=1, default=str), encoding="utf-8"
    )

    # ── 截图拷贝（Pages 发布根不可逃逸上级目录，demo 需自包含）───
    if SCREENSHOTS_SRC.is_dir():
        dst = DEMO_DIR / "assets" / "screenshots"
        dst.mkdir(parents=True, exist_ok=True)
        copied = 0
        for png in sorted(SCREENSHOTS_SRC.glob("*.png")):
            shutil.copy2(png, dst / png.name)
            copied += 1
        print(f"screenshots: {copied}")

    print(
        f"db={db_path.name} records={total} groups={len(groups)} providers={len(providers)}"
    )
    print(f"written: {out_dir / 'records.json'}")


if __name__ == "__main__":
    main()
