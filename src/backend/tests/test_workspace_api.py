"""
Integration tests for workspace API endpoints
"""

import pytest
from httpx import AsyncClient
from tests.conftest import TestDataFactory


@pytest.mark.asyncio
async def test_get_companies(async_client: AsyncClient, test_data_factory: TestDataFactory):
    """Test GET /api/companies with pagination."""
    response = await async_client.get("/api/companies?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_create_company(async_client: AsyncClient, test_data_factory: TestDataFactory):
    """Test POST /api/companies."""
    company_data = test_data_factory.create_company_data("New Test Company")
    response = await async_client.post("/api/companies", json=company_data)
    assert response.status_code in [200, 201]
    data = response.json()
    assert data["name"] == company_data["name"]
    assert "id" in data


@pytest.mark.asyncio
async def test_get_company_by_id(async_client: AsyncClient):
    """Test GET /api/companies/{company_id}."""
    # First, get a list to find an existing company
    list_response = await async_client.get("/api/companies?page=1&page_size=1")
    if list_response.status_code == 200:
        companies = list_response.json().get("items", [])
        if companies:
            company_id = companies[0]["id"]
            response = await async_client.get(f"/api/companies/{company_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == company_id


@pytest.mark.asyncio
async def test_get_contacts(async_client: AsyncClient):
    """Test GET /api/contacts with pagination."""
    response = await async_client.get("/api/contacts?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_create_contact(async_client: AsyncClient, test_data_factory: TestDataFactory):
    """Test POST /api/contacts."""
    # First, get or create a company
    companies_response = await async_client.get("/api/companies?page=1&page_size=1")
    if companies_response.status_code == 200:
        companies = companies_response.json().get("items", [])
        if companies:
            company_id = companies[0]["id"]
            contact_data = test_data_factory.create_contact_data(company_id)
            response = await async_client.post("/api/contacts", json=contact_data)
            assert response.status_code in [200, 201]
            data = response.json()
            assert data["name"] == contact_data["name"]


@pytest.mark.asyncio
async def test_validation_errors(async_client: AsyncClient):
    """Test validation errors."""
    # Test invalid email
    invalid_contact = {
        "name": "Test",
        "email": "invalid-email",
        "company_id": "00000000-0000-0000-0000-000000000000"
    }
    response = await async_client.post("/api/contacts", json=invalid_contact)
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_pagination(async_client: AsyncClient):
    """Test pagination parameters."""
    # Test page 1
    response1 = await async_client.get("/api/companies?page=1&page_size=5")
    assert response1.status_code == 200
    data1 = response1.json()
    assert data1["page"] == 1
    assert data1["page_size"] == 5
    
    # Test page 2
    response2 = await async_client.get("/api/companies?page=2&page_size=5")
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["page"] == 2





