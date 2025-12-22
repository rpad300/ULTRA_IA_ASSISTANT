"""
Integration tests for chat API endpoints
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_threads(async_client: AsyncClient):
    """Test GET /api/projects/{project_id}/threads."""
    # First, get a project ID
    companies_response = await async_client.get("/api/companies?page=1&page_size=1")
    if companies_response.status_code == 200:
        companies = companies_response.json().get("items", [])
        if companies:
            company_id = companies[0]["id"]
            projects_response = await async_client.get(f"/api/companies/{company_id}/projects")
            if projects_response.status_code == 200:
                projects = projects_response.json()
                if projects:
                    project_id = projects[0]["id"]
                    response = await async_client.get(f"/api/projects/{project_id}/threads")
                    assert response.status_code == 200
                    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_create_thread(async_client: AsyncClient):
    """Test POST /api/projects/{project_id}/threads."""
    # Get a project ID first
    companies_response = await async_client.get("/api/companies?page=1&page_size=1")
    if companies_response.status_code == 200:
        companies = companies_response.json().get("items", [])
        if companies:
            company_id = companies[0]["id"]
            projects_response = await async_client.get(f"/api/companies/{company_id}/projects")
            if projects_response.status_code == 200:
                projects = projects_response.json()
                if projects:
                    project_id = projects[0]["id"]
                    thread_data = {
                        "title": "Test Thread",
                        "status": "active"
                    }
                    response = await async_client.post(
                        f"/api/projects/{project_id}/threads",
                        json=thread_data
                    )
                    assert response.status_code in [200, 201]
                    data = response.json()
                    assert data["title"] == thread_data["title"]





