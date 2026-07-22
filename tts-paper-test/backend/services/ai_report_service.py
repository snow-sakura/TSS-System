"""
AI 智能报告服务 — LLM 驱动的高质量测试洞察报告生成

功能:
  - 从执行/缺陷/用例数据生成结构化的 AI 分析
  - 多维度质量评估（执行/缺陷/覆盖/自动化）
  - 可操作建议生成
  - 自然语言报告结论
"""

import json
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

REPORT_SYSTEM_PROMPT = """你是一位资深 QA 经理和测试分析专家。请根据提供的测试数据生成结构化报告分析。

输出严格的 JSON 格式（不要包含 markdown 代码块标记）：

{
  "ai_analysis": {
    "execution_analysis": "执行结果分析：分析通过率、失败趋势、主要问题",
    "defect_analysis": "缺陷分析：分析缺陷分布、严重程度、修复进展",
    "quality_summary": "质量总结：整体质量水平评估",
    "risk_warnings": ["风险1", "风险2"],
    "strengths": ["优势1", "优势2"]
  },
  "conclusion": "总体结论描述（Markdown 格式，200-500字）",
  "recommendations": {
    "immediate_actions": ["立即可执行的操作1", "立即可执行的操作2"],
    "improvement_suggestions": ["改进建议1", "改进建议2"],
    "focus_areas": ["重点关注领域1", "重点关注领域2"]
  },
  "quality_score": {
    "overall": 0-100,
    "execution": 0-100,
    "defect_management": 0-100,
    "test_coverage": 0-100,
    "automation_maturity": 0-100
  }
}

请确保分析客观、有数据支撑、可操作。"""

TREND_SYSTEM_PROMPT = """你是一位质量分析专家。分析以下测试执行的周趋势数据，生成趋势洞察。

输出 JSON 格式：
{
  "insights": ["洞察1", "洞察2", "洞察3"],
  "trend_direction": "upward/downward/stable",
  "key_metrics_change": {
    "pass_rate_trend": "提升/下降/稳定",
    "defect_trend": "减少/增加/稳定"
  },
  "prediction": "基于趋势的预测",
  "suggested_actions": ["建议1", "建议2"]
}"""


async def _call_llm(system_prompt: str, user_prompt: str, model: str = "gpt-4o") -> Optional[str]:
    """调用 LLM"""
    try:
        from openai import AsyncOpenAI
        from config import get_settings

        settings = get_settings()
        client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY or "sk-placeholder",
            base_url=settings.OPENAI_BASE_URL,
        )
        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=3000,
        )
        return resp.choices[0].message.content
    except Exception as e:
        logger.warning(f"LLM 调用失败: {e}")
        return None


def _parse_json(text: Optional[str]) -> dict:
    """安全解析 LLM JSON 回复"""
    if not text:
        return _fallback_analysis({})
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except json.JSONDecodeError:
        logger.warning(f"JSON 解析失败，使用兜底分析")
        return _fallback_analysis({})


def _fallback_analysis(data: dict) -> dict:
    """LLM 不可用时的兜底分析"""
    summary = data.get("summary", {})
    pass_rate = summary.get("pass_rate", 0)
    total_defects = summary.get("total_defects", 0)
    open_defects = summary.get("open_defects", 0)

    exec_analysis = f"本次共执行 {summary.get('execution_count', 0)} 次测试，合计 {summary.get('total_cases', 0)} 个用例。"
    exec_analysis += f"通过率 {pass_rate}%"
    if pass_rate >= 90:
        exec_analysis += "，质量良好。"
    elif pass_rate >= 70:
        exec_analysis += "，存在改进空间。"
    else:
        exec_analysis += "，需要重点关注。"

    return {
        "ai_analysis": {
            "execution_analysis": exec_analysis,
            "defect_analysis": f"共发现 {total_defects} 个缺陷，其中 {open_defects} 个未解决。"
                               f"严重缺陷 {summary.get('critical_defects', 0)} 个。",
            "quality_summary": f"整体质量评分为 {pass_rate}/100。",
            "risk_warnings": ["缺陷修复进度需要关注"] if open_defects > 0 else [],
            "strengths": ["测试执行覆盖完整"],
        },
        "conclusion": f"报告基于 {summary.get('execution_count', 0)} 次执行生成。"
                      f"通过率 {pass_rate}%，缺陷总数 {total_defects}。"
                      f"{"请重点关注未解决缺陷。" if open_defects > 0 else "质量状况良好。"}",
        "recommendations": {
            "immediate_actions": ["审查失败用例", "跟踪未解决缺陷"],
            "improvement_suggestions": ["增加自动化覆盖", "完善测试数据"],
            "focus_areas": ["核心功能回归测试"],
        },
        "quality_score": {
            "overall": min(100, int(pass_rate * 0.6 + max(0, 100 - open_defects * 5) * 0.4)),
            "execution": int(pass_rate),
            "defect_management": max(0, min(100, 100 - open_defects * 10)),
            "test_coverage": 70,
            "automation_maturity": summary.get("automation_rate", 30),
        },
    }


# ──────────────────────────────────────────
# 核心 API
# ──────────────────────────────────────────

async def generate_ai_analysis(summary_data: dict, metrics_data: dict) -> dict:
    """
    从执行摘要和指标生成 AI 分析内容

    参数:
      summary_data: 汇总数据（execution_count, total_cases, passed, failed, defects...）
      metrics_data: 指标数据（pass_rate, defect_fix_rate, automation_rate...）

    返回:
      { ai_analysis, conclusion, recommendations, quality_score }
    """
    context = {
        "report_generated_at": datetime.now().isoformat(),
        "summary": summary_data,
        "metrics": metrics_data,
    }

    llm_result = await _call_llm(
        REPORT_SYSTEM_PROMPT,
        json.dumps(context, ensure_ascii=False, indent=2),
    )

    parsed = _parse_json(llm_result)

    # 确保所有字段都存在
    result = _fallback_analysis(context)

    if "ai_analysis" in parsed:
        result["ai_analysis"].update(parsed["ai_analysis"])
    if "conclusion" in parsed:
        result["conclusion"] = parsed["conclusion"]
    if "recommendations" in parsed:
        result["recommendations"].update(parsed["recommendations"])
    if "quality_score" in parsed:
        result["quality_score"].update(parsed["quality_score"])

    return result


async def analyze_quality_metrics(metrics: dict) -> dict:
    """
    对质量指标进行 AI 解读

    参数:
      metrics: 质量指标数据（pass_rate, defect_density, test_coverage...）

    返回:
      { analysis_text, strengths, risks, score }
    """
    prompt = f"分析以下质量指标数据：\n{json.dumps(metrics, ensure_ascii=False, indent=2)}"
    llm_result = await _call_llm(
        "你是一个质量分析专家。分析质量指标并输出 JSON："
        '{{"analysis": "分析文本", "score": 0-100, "strengths": [], "risks": []}}',
        prompt,
    )
    return _parse_json(llm_result)


async def analyze_trends(weekly_data: list[dict]) -> dict:
    """
    对周趋势数据进行 AI 分析

    参数:
      weekly_data: [{"week": "W30", "pass_rate": 91, "defects": 15, "resolved": 12}, ...]

    返回:
      { insights, trend_direction, key_metrics_change, prediction, suggested_actions }
    """
    if not weekly_data:
        return {
            "insights": ["暂无足够数据进行分析"],
            "trend_direction": "stable",
            "key_metrics_change": {},
            "prediction": "数据不足，无法预测",
            "suggested_actions": ["持续收集数据"],
        }

    llm_result = await _call_llm(
        TREND_SYSTEM_PROMPT,
        json.dumps(weekly_data, ensure_ascii=False, indent=2),
    )

    parsed = _parse_json(llm_result)

    return {
        "insights": parsed.get("insights", ["趋势分析完成"]),
        "trend_direction": parsed.get("trend_direction", "stable"),
        "key_metrics_change": parsed.get("key_metrics_change", {}),
        "prediction": parsed.get("prediction", ""),
        "suggested_actions": parsed.get("suggested_actions", []),
    }
