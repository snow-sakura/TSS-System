"""Custom exceptions for TSS Paper Test"""


class TTSTestError(Exception):
    """Base exception for TSS Test system"""
    pass


class ConfigurationError(TTSTestError):
    """Configuration error"""
    pass


class APIConnectionError(TTSTestError):
    """API connection error"""
    pass


class TestExecutionError(TTSTestError):
    """Test execution error"""
    pass


class KnowledgeBaseError(TTSTestError):
    """Knowledge base error"""
    pass


class AgentError(TTSTestError):
    """Agent error"""
    pass


class SkillError(TTSTestError):
    """Skill error"""
    pass


class ValidationError(TTSTestError):
    """Validation error"""
    pass
