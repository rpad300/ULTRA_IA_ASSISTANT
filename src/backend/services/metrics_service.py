"""
Metrics and Monitoring Service for tracking vector store operations.
"""

import time
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
import json

logger = logging.getLogger(__name__)


@dataclass
class Metric:
    """Single metric data point."""
    name: str
    value: float
    timestamp: datetime
    tags: Dict[str, str]


class MetricsService:
    """
    In-memory metrics service. For production, consider Prometheus, Datadog, etc.
    """
    
    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        self.metrics: deque = deque(maxlen=max_history)
        self.counters: Dict[str, int] = defaultdict(int)
        self.timers: Dict[str, List[float]] = defaultdict(list)
        self.gauges: Dict[str, float] = {}
    
    def increment(self, name: str, value: int = 1, tags: Optional[Dict[str, str]] = None):
        """Increment a counter metric."""
        self.counters[name] += value
        self._record_metric(name, float(self.counters[name]), "counter", tags or {})
        logger.debug(f"Metric incremented: {name} = {self.counters[name]}")
    
    def gauge(self, name: str, value: float, tags: Optional[Dict[str, str]] = None):
        """Set a gauge metric."""
        self.gauges[name] = value
        self._record_metric(name, value, "gauge", tags or {})
    
    def timer(self, name: str, duration_seconds: float, tags: Optional[Dict[str, str]] = None):
        """Record a timing metric."""
        if len(self.timers[name]) >= 100:  # Keep last 100 timings
            self.timers[name].pop(0)
        self.timers[name].append(duration_seconds)
        self._record_metric(name, duration_seconds, "timer", tags or {})
    
    def _record_metric(self, name: str, value: float, metric_type: str, tags: Dict[str, str]):
        """Internal method to record a metric."""
        metric = Metric(
            name=name,
            value=value,
            timestamp=datetime.now(),
            tags={**tags, "type": metric_type}
        )
        self.metrics.append(metric)
    
    def get_counter(self, name: str) -> int:
        """Get current counter value."""
        return self.counters.get(name, 0)
    
    def get_gauge(self, name: str) -> Optional[float]:
        """Get current gauge value."""
        return self.gauges.get(name)
    
    def get_timer_stats(self, name: str) -> Dict[str, float]:
        """Get statistics for a timer metric."""
        timings = self.timers.get(name, [])
        if not timings:
            return {}
        
        return {
            "count": len(timings),
            "min": min(timings),
            "max": max(timings),
            "avg": sum(timings) / len(timings),
            "p50": sorted(timings)[len(timings) // 2] if timings else 0,
            "p95": sorted(timings)[int(len(timings) * 0.95)] if timings else 0,
            "p99": sorted(timings)[int(len(timings) * 0.99)] if timings else 0,
        }
    
    def get_summary(self, last_minutes: int = 60) -> Dict:
        """Get summary of all metrics from last N minutes."""
        cutoff = datetime.now() - timedelta(minutes=last_minutes)
        recent_metrics = [
            asdict(m) for m in self.metrics
            if m.timestamp >= cutoff
        ]
        
        return {
            "counters": dict(self.counters),
            "gauges": dict(self.gauges),
            "timers": {
                name: self.get_timer_stats(name)
                for name in self.timers.keys()
            },
            "recent_metrics_count": len(recent_metrics),
            "time_range_minutes": last_minutes
        }
    
    def export_json(self) -> str:
        """Export metrics as JSON."""
        return json.dumps(self.get_summary(), default=str, indent=2)


# Singleton
_metrics_service = None


def get_metrics_service() -> MetricsService:
    """Get global metrics service instance."""
    global _metrics_service
    if _metrics_service is None:
        _metrics_service = MetricsService()
    return _metrics_service


class TimerContext:
    """Context manager for timing operations."""
    
    def __init__(self, metrics_service: MetricsService, name: str, tags: Optional[Dict[str, str]] = None):
        self.metrics_service = metrics_service
        self.name = name
        self.tags = tags or {}
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        self.metrics_service.timer(self.name, duration, self.tags)





