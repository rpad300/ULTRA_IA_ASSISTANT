"""
Pytest configuration and fixtures
"""

import pytest
import asyncio
from typing import AsyncGenerator
from fastapi.testclient import TestClient
from httpx import AsyncClient
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app_main import app
from db.supabase_client import get_supabase_client
from config import ENVIRONMENT

# Configure test environment
ENVIRONMENT = "test"

def pytest_configure(config):
    """SOTA: Filter noisy warnings for cleaner test output."""
    import warnings
    warnings.filterwarnings("ignore", message=".*nvidia.*")
    warnings.filterwarnings("ignore", message=".*torchaudio.*")
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    warnings.filterwarnings("ignore", category=UserWarning, module="pydantic") # Common pydantic V2 warnings



@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def client():
    """Create a test client for synchronous tests."""
    return TestClient(app)


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_supabase():
    """Mock Supabase client for testing."""
    # In real tests, you'd use a mock or test database
    return get_supabase_client()


@pytest.fixture(autouse=True)
def cleanup():
    """Cleanup after each test."""
    yield
    # Add cleanup logic here if needed


# Test data factories
class TestDataFactory:
    """Factory for creating test data."""
    
    @staticmethod
    def create_company_data(name: str = "Test Company"):
        return {
            "name": name,
            "description": "Test description",
            "status": "active",
            "industry": "Technology"
        }
    
    @staticmethod
    def create_contact_data(company_id: str, name: str = "Test Contact"):
        return {
            "name": name,
            "email": f"{name.lower().replace(' ', '.')}@test.com",
            "role": "Developer",
            "company_id": company_id
        }
    
    @staticmethod
    def create_project_data(company_id: str, name: str = "Test Project"):
        return {
            "name": name,
            "description": "Test project description",
            "company_id": company_id
        }
    
    @staticmethod
    def create_task_data(company_id: str, description: str = "Test task"):
        return {
            "description": description,
            "status": "open",
            "priority": "medium",
            "company_id": company_id
        }


@pytest.fixture
def test_data_factory():
    """Provide test data factory."""
    return TestDataFactory()





