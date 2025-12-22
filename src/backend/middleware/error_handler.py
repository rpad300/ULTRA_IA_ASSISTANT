"""
Error Handling Middleware
Provides consistent error responses and logging
"""

import logging
import traceback
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from config import ENVIRONMENT

logger = logging.getLogger(__name__)


async def error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global error handler for unhandled exceptions."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    # Log error
    logger.error(
        f"Unhandled exception: {exc}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method
        },
        exc_info=True
    )
    
    # In production, don't expose internal errors
    if ENVIRONMENT == "production":
        detail = "An internal error occurred. Please try again later."
    else:
        detail = str(exc)
        traceback_str = traceback.format_exc()
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": detail,
            "request_id": request_id,
            **({"traceback": traceback_str} if ENVIRONMENT != "production" else {})
        }
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handler for HTTP exceptions."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    # Log 404 errors with more detail
    if exc.status_code == 404:
        logger.warning(
            f"[404] {request.method} {request.url.path} - {exc.detail} - Request ID: {request_id}",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
                "full_url": str(request.url)
            }
        )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "request_id": request_id
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handler for validation errors."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "detail": exc.errors(),
            "request_id": request_id
        }
    )

