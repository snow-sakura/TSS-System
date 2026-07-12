"""Pytest configuration and fixtures"""

import sys
from pathlib import Path

import pytest

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.config import settings
from agents.tools.api_client import api_client_tool


@pytest.fixture(scope="session")
def api_client():
    """API client fixture"""
    return api_client_tool


@pytest.fixture(scope="session")
def check_server():
    """Check if TSS server is running"""
    return api_client_tool.check_health()


@pytest.fixture(scope="session")
def setup_test_data(api_client, check_server):
    """Setup test data if server is running"""
    if not check_server:
        pytest.skip("TSS server is not running")
    
    # Authenticate
    api_client.authenticate()
    
    yield
    
    # Cleanup if needed


@pytest.fixture
def test_config():
    """Test configuration fixture"""
    return settings
