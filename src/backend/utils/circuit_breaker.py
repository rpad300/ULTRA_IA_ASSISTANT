"""
Circuit Breaker Pattern
Prevents cascading failures by stopping requests to failing services
"""

import time
from enum import Enum
from typing import Callable, Any, Optional
from functools import wraps
import logging

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker implementation.
    Opens circuit after failure_threshold failures within time_window.
    Closes after success_timeout seconds.
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        success_timeout: int = 60,
        time_window: int = 60,
        name: str = "circuit"
    ):
        self.failure_threshold = failure_threshold
        self.success_timeout = success_timeout
        self.time_window = time_window
        self.name = name
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.last_success_time: Optional[float] = None
        self.opened_at: Optional[float] = None
    
    def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection."""
        # Check if circuit should be opened
        if self.state == CircuitState.OPEN:
            if time.time() - self.opened_at > self.success_timeout:
                # Try to recover
                self.state = CircuitState.HALF_OPEN
                logger.info(f"Circuit {self.name} entering HALF_OPEN state")
            else:
                raise Exception(f"Circuit {self.name} is OPEN")
        
        # Execute function
        try:
            result = func(*args, **kwargs)
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise
    
    def on_success(self):
        """Handle successful call."""
        self.failure_count = 0
        self.last_success_time = time.time()
        
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            self.opened_at = None
            logger.info(f"Circuit {self.name} CLOSED after recovery")
    
    def on_failure(self):
        """Handle failed call."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        # Check if we should open circuit
        if self.failure_count >= self.failure_threshold:
            if self.state != CircuitState.OPEN:
                self.state = CircuitState.OPEN
                self.opened_at = time.time()
                logger.warning(
                    f"Circuit {self.name} OPENED after {self.failure_count} failures"
                )
        
        # Reset failure count if outside time window
        if (
            self.last_failure_time
            and time.time() - self.last_failure_time > self.time_window
        ):
            self.failure_count = 0
    
    def reset(self):
        """Manually reset circuit breaker."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.opened_at = None
        logger.info(f"Circuit {self.name} manually reset")


# Global circuit breakers
_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str, **kwargs) -> CircuitBreaker:
    """Get or create circuit breaker by name."""
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name=name, **kwargs)
    return _circuit_breakers[name]


def circuit_breaker(name: str, **kwargs):
    """
    Decorator for circuit breaker pattern.
    
    Usage:
        @circuit_breaker("supabase", failure_threshold=5)
        def my_function():
            ...
    """
    def decorator(func: Callable) -> Callable:
        breaker = get_circuit_breaker(name, **kwargs)
        
        @wraps(func)
        def wrapper(*args, **kw):
            return breaker.call(func, *args, **kw)
        
        return wrapper
    return decorator





