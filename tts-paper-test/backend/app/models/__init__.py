"""
TSS AI测试平台 — 数据库模型
"""
from backend.app.models.models import (
    User, Requirement, TestPoint, TestPlan, TestCase,
    TestExecution, Defect, Report, Environment,
    LLMProvider, MCPService, SystemConfig,
    OperationLog, AIGeneration, PromptTemplate,
)

__all__ = [
    "User", "Requirement", "TestPoint", "TestPlan", "TestCase",
    "TestExecution", "Defect", "Report", "Environment",
    "LLMProvider", "MCPService", "SystemConfig",
    "OperationLog", "AIGeneration", "PromptTemplate",
]
