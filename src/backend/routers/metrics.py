"""
Metrics endpoints for Prometheus
"""

from fastapi import APIRouter
from fastapi.responses import Response
from utils.prometheus_metrics import get_metrics

router = APIRouter(prefix="/api", tags=["metrics"])

@router.get("/metrics")
async def get_prometheus_metrics():
    """Get Prometheus metrics."""
    return Response(content=get_metrics(), media_type="text/plain")
