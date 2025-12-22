"""
Timeout Utilities
Handles request timeouts gracefully
"""

import asyncio
from typing import TypeVar, Callable, Any
from functools import wraps
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T')


async def with_timeout(
    coro: Callable,
    timeout_seconds: float = 30.0,
    default_value: Any = None,
    error_message: str = "Operation timed out"
) -> Any:
    """
    Execute coroutine with timeout.
    
    Args:
        coro: Coroutine to execute
        timeout_seconds: Maximum time to wait
        default_value: Value to return on timeout
        error_message: Error message if timeout occurs
    
    Returns:
        Result of coroutine or default_value on timeout
    """
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        logger.warning(f"{error_message} (timeout: {timeout_seconds}s)")
        if default_value is not None:
            return default_value
        raise TimeoutError(error_message)


def timeout_decorator(timeout_seconds: float = 30.0):
    """
    Decorator to add timeout to async functions.
    
    Usage:
        @timeout_decorator(timeout_seconds=10.0)
        async def my_function():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await with_timeout(
                func(*args, **kwargs),
                timeout_seconds=timeout_seconds,
                error_message=f"{func.__name__} timed out"
            )
        return wrapper
    return decorator





