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
    SOTA: Thread-safe, Optimized Sorting, Prometheus Export.
    """
    
    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        self.metrics: deque = deque(maxlen=max_history)
        self.counters: Dict[str, int] = defaultdict(int)
        
        # SOTA Optimization: Keep timers sorted implicitly or sort on demand?
        # Bisect is efficient for insertion, but list.insert is O(N). 
        # Actually standard append + regular sort is Timsort (very fast for nearly sorted).
        # But if we read often, sorted is better. Let's stick to append + sorted() but optimized.
        # Actually, let's use a lock first.
        self.timers: Dict[str, List[float]] = defaultdict(list)
        self.gauges: Dict[str, float] = {}
        
        # Concurrency Safety
        import threading
        self._lock = threading.Lock()
    
    def increment(self, name: str, value: int = 1, tags: Optional[Dict[str, str]] = None):
        """Increment a counter metric."""
        with self._lock:
            self.counters[name] += value
            # Record metric inside lock to ensure order/consistency? 
            # Or outside to reduce contention? Inside is safer for state.
            self._record_metric(name, float(self.counters[name]), "counter", tags or {})
        logger.debug(f"Metric incremented: {name} = {self.counters.get(name)}")
    
    def gauge(self, name: str, value: float, tags: Optional[Dict[str, str]] = None):
        """Set a gauge metric."""
        with self._lock:
            self.gauges[name] = value
            self._record_metric(name, value, "gauge", tags or {})
    
    def timer(self, name: str, duration_seconds: float, tags: Optional[Dict[str, str]] = None):
        """Record a timing metric."""
        import bisect
        with self._lock:
            # SOTA: Maintenance of sorted list if we wanted P95 speed, but pop(0) breaks it.
            # If we keep it sorted, we can't pop "oldest" easily unless we store (timestamp, value).
            # For simplicity and "deque" behavior, we just append.
            # But let's optimize the stats read.
            
            # Limiting history size
            if len(self.timers[name]) >= 100:
                self.timers[name].pop(0)
            self.timers[name].append(duration_seconds)
            
            self._record_metric(name, duration_seconds, "timer", tags or {})
    
    def record_metric(self, name: str, value: float, metric_type: str, tags: Dict[str, str]):
        """Public alias for _record_metric."""
        self._record_metric(name, value, metric_type, tags)

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
        with self._lock:
            return self.counters.get(name, 0)
    
    def get_gauge(self, name: str) -> Optional[float]:
        """Get current gauge value."""
        with self._lock:
            return self.gauges.get(name)
    
    def get_timer_stats(self, name: str) -> Dict[str, float]:
        """Get statistics for a timer metric."""
        # Snapshot to release lock quickly
        with self._lock:
            timings = list(self.timers.get(name, []))
            
        if not timings:
            return {}
        
        # SOTA: Optimized Stat Calculation
        # Only sort once
        sorted_timings = sorted(timings)
        count = len(sorted_timings)
        
        return {
            "count": count,
            "min": sorted_timings[0],
            "max": sorted_timings[-1],
            "avg": sum(sorted_timings) / count,
            "p50": sorted_timings[count // 2],
            "p95": sorted_timings[int(count * 0.95)],
            "p99": sorted_timings[int(count * 0.99)],
        }
    
    def get_summary(self, last_minutes: int = 60) -> Dict:
        """Get summary of all metrics from last N minutes."""
        cutoff = datetime.now() - timedelta(minutes=last_minutes)
        with self._lock:
            # Copy to avoid mutation during iteration if metrics is modified
            metrics_snapshot = list(self.metrics)
            counters_snap = dict(self.counters)
            gauges_snap = dict(self.gauges)
            timers_keys = list(self.timers.keys())

        recent_metrics = [
            asdict(m) for m in metrics_snapshot
            if m.timestamp >= cutoff
        ]
        
        return {
            "counters": counters_snap,
            "gauges": gauges_snap,
            "timers": {
                name: self.get_timer_stats(name)
                for name in timers_keys
            },
            "recent_metrics_count": len(recent_metrics),
            "time_range_minutes": last_minutes
        }
    
    def export_json(self) -> str:
        """Export metrics as JSON."""
        return json.dumps(self.get_summary(), default=str, indent=2)

    def export_prometheus(self) -> str:
        """
        Export metrics in Prometheus text format (SOTA Interoperability).
        """
        lines = []
        summary = self.get_summary(last_minutes=60) # Default window
        
        # Help / Type headers would be nice but optional for simple scrape
        
        # Counters
        for name, value in summary["counters"].items():
            safe_name = name.replace(".", "_").replace("-", "_")
            lines.append(f"# TYPE {safe_name} counter")
            lines.append(f"{safe_name}_total {value}")
        
        # Gauges
        for name, value in summary["gauges"].items():
            safe_name = name.replace(".", "_").replace("-", "_")
            lines.append(f"# TYPE {safe_name} gauge")
            lines.append(f"{safe_name} {value}")
            
        # Timers (Summary/Histogram equivalent)
        for name, stats in summary["timers"].items():
            safe_name = name.replace(".", "_").replace("-", "_")
            lines.append(f"# TYPE {safe_name} summary")
            lines.append(f"{safe_name}_count {stats.get('count', 0)}")
            lines.append(f"{safe_name}_sum {stats.get('avg', 0) * stats.get('count', 0)}") # Approx sum
            lines.append(f"{safe_name}{{quantile=\"0.5\"}} {stats.get('p50', 0)}")
            lines.append(f"{safe_name}{{quantile=\"0.95\"}} {stats.get('p95', 0)}")
            lines.append(f"{safe_name}{{quantile=\"0.99\"}} {stats.get('p99', 0)}")
            lines.append(f"{safe_name}{{quantile=\"1.0\"}} {stats.get('max', 0)}") # Max
            
        return "\n".join(lines)


# Singleton
_metrics_service = None


def get_metrics_service() -> MetricsService:
    """Get global metrics service instance."""
    global _metrics_service
    if _metrics_service is None:
        _metrics_service = MetricsService()
        logger.info(f"DEBUG: Initialized MetricsService: {type(_metrics_service)}")
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





