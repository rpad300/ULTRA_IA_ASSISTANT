from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging

from services.analytics_service import AnalyticsService, get_analytics_service
from middleware.auth import get_current_user
from schemas.analytics import (
    MeetingInsightsResponse, 
    TaskStatsResponse, 
    DashboardStatsResponse, 
    ActivityItem, 
    ContactStatsResponse,
    ProjectInsightsResponse,
    CoachingResponse,
    ContactInteraction,
    ContactCommitment,
    ContactTopic
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)

def _is_valid_uuid(val: str) -> bool:
    if not val: return False
    try:
        from uuid import UUID
        UUID(val)
        return True
    except ValueError:
        return False

def _validate_company_access(user: dict, company_id: Optional[str]) -> Optional[str]:
    """
    Ensure user has access to the requested company_id.
    If company_id is None, return user's default company_id.
    """
    user_companies = user.get("company_ids", [])
    default_company = user.get("company_id")

    # Dev/Test override
    if user.get("user_id") == "dev-user":
        # Return provided (if valid UUID), default, or None
        if company_id:
             if _is_valid_uuid(company_id): return company_id
             return None # Fallback for "dev-company-id" etc
        return default_company

    if company_id:
        if company_id == "dev-company-id" or not _is_valid_uuid(company_id):
             # Invalid UUID -> return None to prevent DB error, or Raise 400?
             # Raising 400 is safer API design.
             raise HTTPException(status_code=400, detail="Invalid Company ID format")

        if company_id not in user_companies:
             raise HTTPException(status_code=403, detail="Access denied to this company")
        return company_id
    
    if default_company:
        return default_company
        
    raise HTTPException(status_code=400, detail="Company ID required")

import functools

def safe_route(func):
    """SOTA: Global Error Handling Decorator for Analytics Router"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"CRITICAL ANALYTICS ERROR: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
    return wrapper

@router.get("/insights/meetings", response_model=MeetingInsightsResponse)
@safe_route
async def get_meetings_insights(
    company_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    service: AnalyticsService = Depends(get_analytics_service),
    user: dict = Depends(get_current_user)
):
    """
    Get meetings insights using SOTA Analytics Engine.
    """
    if project_id and not _is_valid_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid Project ID format")

    validated_company_id = _validate_company_access(user, company_id)
    return await service.get_meetings_insights(validated_company_id, project_id, days)

@router.get("/insights/tasks", response_model=TaskStatsResponse)
@safe_route
async def get_tasks_insights(
    company_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    service: AnalyticsService = Depends(get_analytics_service),
    user: dict = Depends(get_current_user)
):
    """
    Get task statistics.
    """
    if project_id and not _is_valid_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid Project ID format")

    validated_company_id = _validate_company_access(user, company_id)
    return await service.get_tasks_insights(validated_company_id, project_id, days)

@router.get("/insights/coaching", response_model=CoachingResponse)
@safe_route
async def get_coaching_insights(
    company_id: Optional[str] = Query(None),
    profile_type: Optional[str] = Query(None),
    service: AnalyticsService = Depends(get_analytics_service),
    user: dict = Depends(get_current_user)
):
    """
    Get AI-driven coaching insights.
    """
    validated_company_id = _validate_company_access(user, company_id)
    return await service.get_coaching_insights(validated_company_id, profile_type)


@router.get("/contacts/{contact_id}/stats", response_model=ContactStatsResponse)
@safe_route
async def get_contact_stats(
    contact_id: str,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get statistics for a specific contact.
    """
    return await service.get_contact_stats(contact_id)


@router.get("/projects/{project_id}/insights", response_model=ProjectInsightsResponse)
@safe_route
async def get_project_insights(
    project_id: str,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get project-specific insights including trends and risks.
    """
    return await service.get_project_insights(project_id)


@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
@safe_route
async def get_dashboard_stats(
    company_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    service: AnalyticsService = Depends(get_analytics_service),
    user: dict = Depends(get_current_user)
):
    """
    Get dashboard statistics with parallel fetching.
    """
    if project_id and not _is_valid_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid Project ID format")

    validated_company_id = _validate_company_access(user, company_id)
    return await service.get_dashboard_stats(validated_company_id, project_id)


@router.get("/dashboard/today-schedule", response_model=List[ActivityItem])
@safe_route
async def get_today_schedule(
    company_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    service: AnalyticsService = Depends(get_analytics_service),
    user: dict = Depends(get_current_user)
):
    """
    Get today's scheduled meetings/sessions.
    """
    if project_id and not _is_valid_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid Project ID format")

    validated_company_id = _validate_company_access(user, company_id)
    return await service.get_today_schedule(validated_company_id, project_id)


@router.get("/dashboard/urgent-tasks", response_model=List[ActivityItem])
@safe_route
async def get_urgent_tasks(
    company_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    service: AnalyticsService = Depends(get_analytics_service),
    user: dict = Depends(get_current_user)
):
    """
    Get urgent/high priority tasks.
    """
    if project_id and not _is_valid_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid Project ID format")

    validated_company_id = _validate_company_access(user, company_id)
    return await service.get_urgent_tasks(validated_company_id, project_id, limit)


@router.get("/dashboard/recent-activity", response_model=List[ActivityItem])
@safe_route
async def get_recent_activity(
    company_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    service: AnalyticsService = Depends(get_analytics_service),
    user: dict = Depends(get_current_user)
):
    """
    Get recent activity: sessions, tasks, threads.
    """
    if project_id and not _is_valid_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid Project ID format")

    validated_company_id = _validate_company_access(user, company_id)
    return await service.get_recent_activity(validated_company_id, project_id, limit)


# Helper function _format_time_ago removed as it is now in Service


@router.get("/contacts/{contact_id}/interactions", response_model=List[ContactInteraction])
@safe_route
async def get_contact_interactions(
    contact_id: str, 
    limit: int = Query(20, ge=1, le=100),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get recent interactions for a contact (sessions, tasks, etc.)
    """
    return await service.get_contact_interactions(contact_id, limit)

@router.get("/contacts/{contact_id}/commitments", response_model=List[ContactCommitment])
@safe_route
async def get_contact_commitments(
    contact_id: str,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get commitments (tasks) for a specific contact.
    """
    return await service.get_contact_commitments(contact_id)

@router.get("/contacts/{contact_id}/topics", response_model=List[ContactTopic])
@safe_route
async def get_contact_topics(
    contact_id: str,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get topics derived from sessions and projects.
    """
    return await service.get_contact_topics(contact_id)
