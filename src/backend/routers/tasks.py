"""
Tasks endpoints for managing tasks.
"""

from fastapi import APIRouter, HTTPException, Query, Request, Depends
from typing import Optional, List
from db.supabase_client import get_supabase_client
from db.models import Task, TaskCreate, TaskUpdate
from utils.pagination import PaginatedResponse, get_pagination_params, PaginationParams
from middleware.logging_context import get_request_id
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tasks"])


@router.get("/tasks", response_model=PaginatedResponse[Task])
def get_tasks(
    company_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    thread_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(get_pagination_params),
    request: Request = None
):
    """Get tasks with optional filters and pagination."""
    try:
        supabase = get_supabase_client()
        
        # Build query
        try:
            query = supabase.table("tasks").select("*")
            count_query = supabase.table("tasks").select("id", count="exact")
            
            if company_id:
                query = query.eq("company_id", company_id)
                count_query = count_query.eq("company_id", company_id)
            if project_id:
                query = query.eq("project_id", project_id)
                count_query = count_query.eq("project_id", project_id)
            if thread_id:
                query = query.eq("thread_id", thread_id)
                count_query = count_query.eq("thread_id", thread_id)
            # if status:
            #     query = query.eq("status", status)
            #     count_query = count_query.eq("status", status)
            # if priority:
            #     query = query.eq("priority", priority)
            #     count_query = count_query.eq("priority", priority)
            
            # Get total count
            try:
                count_response = count_query.execute()
                total = count_response.count if hasattr(count_response, 'count') and count_response.count is not None else 0
            except Exception as count_error:
                logger.warning(f"Error getting task count: {count_error}")
                total = 0
            
            # Get paginated data
            try:
                response = (
                    query
                    .order("created_at", desc=True)
                    .range(pagination.offset, pagination.offset + pagination.limit - 1)
                    .execute()
                )
                items = response.data if response.data else []
            except Exception as query_error:
                logger.warning(f"Error querying tasks: {query_error}")
                items = []
            
            return PaginatedResponse.create(
                items=items,
                total=total,
                page=pagination.page,
                page_size=pagination.page_size
            )
        except Exception as query_build_error:
            logger.warning(f"Error building task query: {query_build_error}")
            # Return empty result on query error
            return PaginatedResponse.create(
                items=[],
                total=0,
                page=pagination.page,
                page_size=pagination.page_size
            )
    except Exception as e:
        request_id = get_request_id()
        logger.error(f"Error fetching tasks: {e}", exc_info=True, extra={"request_id": request_id})
        # Return empty result instead of raising error
        return PaginatedResponse.create(
            items=[],
            total=0,
            page=pagination.page,
            page_size=pagination.page_size
        )


@router.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: str):
    """Get a specific task."""
    supabase = get_supabase_client()
    response = supabase.table("tasks").select("*").eq("id", task_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return response.data[0]


@router.post("/tasks", response_model=Task)
def create_task(task: TaskCreate):
    """Create a new task."""
    supabase = get_supabase_client()
    response = supabase.table("tasks").insert(task.dict()).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create task")
    return response.data[0]


@router.put("/tasks/{task_id}", response_model=Task)
def update_task(task_id: str, task: TaskUpdate):
    """Update a task."""
    supabase = get_supabase_client()
    data = {k: v for k, v in task.dict().items() if v is not None}
    data["updated_at"] = datetime.now().isoformat()
    response = supabase.table("tasks").update(data).eq("id", task_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return response.data[0]


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    """Delete a task."""
    supabase = get_supabase_client()
    response = supabase.table("tasks").delete().eq("id", task_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

