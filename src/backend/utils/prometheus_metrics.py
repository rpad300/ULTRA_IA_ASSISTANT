"""
Prometheus Metrics
Optional - backend will work without prometheus_client installed
"""

try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    # Create dummy classes to avoid errors
    class Counter:
        def __init__(self, *args, **kwargs):
            pass
        def labels(self, **kwargs):
            return self
        def inc(self, *args, **kwargs):
            pass
    
    class Histogram:
        def __init__(self, *args, **kwargs):
            pass
        def labels(self, **kwargs):
            return self
        def observe(self, *args, **kwargs):
            pass
    
    class Gauge:
        def __init__(self, *args, **kwargs):
            pass
        def set(self, *args, **kwargs):
            pass
        def inc(self, *args, **kwargs):
            pass
        def dec(self, *args, **kwargs):
            pass
    
    def generate_latest():
        return b"# Prometheus metrics not available (prometheus_client not installed)\n"

from fastapi import Response
from typing import Optional
import logging

logger = logging.getLogger(__name__)

if not PROMETHEUS_AVAILABLE:
    logger.warning("Prometheus client not installed. Metrics will be disabled.")

# Request metrics
if PROMETHEUS_AVAILABLE:
    http_requests_total = Counter(
        "http_requests_total",
        "Total HTTP requests",
        ["method", "endpoint", "status"]
    )

    http_request_duration_seconds = Histogram(
        "http_request_duration_seconds",
        "HTTP request duration in seconds",
        ["method", "endpoint"]
    )

    # Business metrics
    messages_created_total = Counter(
        "messages_created_total",
        "Total messages created",
        ["company_id", "thread_id"]
    )

    embeddings_generated_total = Counter(
        "embeddings_generated_total",
        "Total embeddings generated",
        ["company_id"]
    )

    vector_searches_total = Counter(
        "vector_searches_total",
        "Total vector searches",
        ["company_id"]
    )

    # System metrics
    active_connections = Gauge(
        "active_connections",
        "Number of active connections"
    )

    database_connections = Gauge(
        "database_connections",
        "Number of database connections"
    )
else:
    # Create dummy instances
    http_requests_total = Counter()
    http_request_duration_seconds = Histogram()
    messages_created_total = Counter()
    embeddings_generated_total = Counter()
    vector_searches_total = Counter()
    active_connections = Gauge()
    database_connections = Gauge()


def get_metrics() -> bytes:
    """Get Prometheus metrics in text format."""
    return generate_latest()


def record_request(method: str, endpoint: str, status: int, duration: float):
    """Record HTTP request metrics."""
    if PROMETHEUS_AVAILABLE:
        http_requests_total.labels(method=method, endpoint=endpoint, status=status).inc()
        http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)


def record_message_created(company_id: Optional[str], thread_id: Optional[str]):
    """Record message creation."""
    if PROMETHEUS_AVAILABLE:
        messages_created_total.labels(
            company_id=company_id or "unknown",
            thread_id=thread_id or "unknown"
        ).inc()


def record_embedding_generated(company_id: Optional[str]):
    """Record embedding generation."""
    if PROMETHEUS_AVAILABLE:
        embeddings_generated_total.labels(company_id=company_id or "unknown").inc()


def record_vector_search(company_id: Optional[str]):
    """Record vector search."""
    if PROMETHEUS_AVAILABLE:
        vector_searches_total.labels(company_id=company_id or "unknown").inc()

