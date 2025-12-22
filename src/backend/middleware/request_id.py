"""
Request ID Middleware
Adds unique request ID to each request for tracing
"""

import uuid
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from middleware.logging_context import set_request_id

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Adds X-Request-ID header to requests and responses."""
    
    async def dispatch(self, request: Request, call_next):
        # Generate or extract request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        
        # Add to request state
        request.state.request_id = request_id
        
        # Set context var for thread-safe access
        set_request_id(request_id)
        
        # Define noisy endpoints to skip logging
        noisy_endpoints = [
            "/api/health", 
            "/api/audio-service/status", 
            "/api/audio-service/devices"
        ]
        
        # Only log if NOT a noisy endpoint
        if not any(request.url.path.startswith(prefix) for prefix in noisy_endpoints):
            # Add to logging context
            logger.info(
                f"[REQUEST] {request.method} {request.url.path} - Request ID: {request_id}",
                extra={"request_id": request_id}
            )
            # logger.debug(
            #     f"[REQUEST] Full URL: {request.url} - Headers: {dict(request.headers)}",
            #     extra={"request_id": request_id}
            # )
        
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as e:
            logger.error(
                f"Request failed: {e}",
                extra={"request_id": request_id},
                exc_info=True
            )
            raise


def get_request_id(request: Request) -> str:
    """Extract request ID from request state."""
    return getattr(request.state, "request_id", "unknown")

