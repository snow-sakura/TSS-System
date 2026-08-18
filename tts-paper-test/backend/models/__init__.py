from .base import Base
from .user import User, Role, UserRole
from .operation_log import OperationLog
from .device import UserDevice
from .web_automation import (
    WebAutomationProject,
    WebPage,
    WebTestCase,
    WebTestExecution,
    AIDraft,
)
from .api_test import (
    ApiTestProject,
    ApiEnvironment,
    ApiEndpoint,
    ApiTestCase,
    ApiExecution,
    ApiTestReport,
)
from .test_lifecycle import (
    Requirement,
    TestPlan,
    TestPoint,
    TestCase as LifecycleTestCase,
    TestExecution as LifecycleTestExecution,
    Defect,
    TestReport,
    PipelineRecord,
    Review,
    Schedule,
)
from .config import (
    Environment,
    LLMProvider,
    PromptTemplate,
    DeAIStyle,
    MCPService,
    Skill,
    HermesChannel,
    StepPromptConfig,
)
from .workflow import (
    Workflow,
    WorkflowNode,
    WorkflowEdge,
    WorkflowExecution,
    WorkflowNodeExecution,
)
from .project import (
    Project,
    Version,
)
from .app_automation import (
    AppDevice,
    AppTestCase,
    AppExecution,
    AppScreenshotDiff,
    AppCrashLog,
)
from .ai_test_task import TestTask
from .data_factory import DataFactoryLog

__all__ = [
    "Base",
    "User",
    "Role",
    "UserRole",
    "UserDevice",
    "OperationLog",
    "WebAutomationProject",
    "WebPage",
    "WebTestCase",
    "WebTestExecution",
    "AIDraft",
    "ApiTestProject",
    "ApiEnvironment",
    "ApiEndpoint",
    "ApiTestCase",
    "ApiExecution",
    "ApiTestReport",
    "Requirement",
    "TestPlan",
    "TestPoint",
    "LifecycleTestCase",
    "LifecycleTestExecution",
    "Defect",
    "TestReport",
    "PipelineRecord",
    "Review",
    "Schedule",
    "Environment",
    "LLMProvider",
    "PromptTemplate",
    "DeAIStyle",
    "MCPService",
    "Skill",
    "HermesChannel",
    "StepPromptConfig",
    "Workflow",
    "WorkflowNode",
    "WorkflowEdge",
    "WorkflowExecution",
    "WorkflowNodeExecution",
    "Project",
    "Version",
    "AppDevice",
    "AppTestCase",
    "AppExecution",
    "AppScreenshotDiff",
    "AppCrashLog",
    "TestTask",
    "DataFactoryLog",
]
