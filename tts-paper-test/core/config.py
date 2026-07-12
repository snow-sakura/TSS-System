"""Configuration management for TSS Paper Test"""

import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class LLMConfig(BaseModel):
    """LLM configuration"""
    openai_api_key: Optional[str] = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY"))
    anthropic_api_key: Optional[str] = Field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY"))
    model_name: str = "gpt-4"
    temperature: float = 0.7
    max_tokens: int = 4096


class TSSConfig(BaseModel):
    """TSS System configuration"""
    base_url: str = Field(default_factory=lambda: os.getenv("TSS_BASE_URL", "http://127.0.0.1:5000"))
    api_base: str = Field(default_factory=lambda: os.getenv("TSS_API_BASE", "http://127.0.0.1:5000/api"))
    admin_username: str = Field(default_factory=lambda: os.getenv("TSS_ADMIN_USERNAME", "admin"))
    admin_password: str = Field(default_factory=lambda: os.getenv("TSS_ADMIN_PASSWORD", "admin123"))
    test_username: str = Field(default_factory=lambda: os.getenv("TSS_TEST_USERNAME", "testuser"))
    test_password: str = Field(default_factory=lambda: os.getenv("TSS_TEST_PASSWORD", "test123"))


class VectorDBConfig(BaseModel):
    """Vector database configuration"""
    persist_directory: str = Field(
        default_factory=lambda: os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_db")
    )
    collection_name: str = Field(
        default_factory=lambda: os.getenv("CHROMA_COLLECTION_NAME", "tss_test_knowledge")
    )
    embedding_model: str = Field(
        default_factory=lambda: os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    )


class TestConfig(BaseModel):
    """Test configuration"""
    environment: str = Field(default_factory=lambda: os.getenv("TEST_ENVIRONMENT", "development"))
    timeout: int = Field(default_factory=lambda: int(os.getenv("TEST_TIMEOUT", "30")))
    retry_count: int = Field(default_factory=lambda: int(os.getenv("TEST_RETRY_COUNT", "3")))
    report_directory: str = Field(default_factory=lambda: os.getenv("REPORT_DIRECTORY", "./reports"))
    report_format: str = Field(default_factory=lambda: os.getenv("REPORT_FORMAT", "html"))


class Settings(BaseModel):
    """Main settings container"""
    llm: LLMConfig = Field(default_factory=LLMConfig)
    tss: TSSConfig = Field(default_factory=TSSConfig)
    vector_db: VectorDBConfig = Field(default_factory=VectorDBConfig)
    test: TestConfig = Field(default_factory=TestConfig)
    
    # Project paths
    project_root: Path = Field(default_factory=lambda: Path(__file__).parent.parent)
    knowledge_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent / "knowledge")
    agents_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent / "agents")
    prompts_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent / "prompts")
    tests_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent / "tests")
    reports_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent / "reports")


# Global settings instance
settings = Settings()
