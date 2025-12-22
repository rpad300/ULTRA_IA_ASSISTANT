"""
Retry utilities with exponential backoff for resilient vector operations.
"""

import asyncio
import logging
from typing import Callable, Any, Optional
from functools import wraps

logger = logging.getLogger(__name__)


async def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    *args,
    **kwargs
) -> Any:
    """
    Retry a function with exponential backoff.
    
    Args:
        func: Async function to retry
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
        exponential_base: Base for exponential backoff
        *args, **kwargs: Arguments to pass to func
    
    Returns:
        Result of func
    
    Raises:
        Exception: If all retries fail
    """
    delay = initial_delay
    
    for attempt in range(max_retries + 1):
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        except Exception as e:
            if attempt == max_retries:
                logger.error(f"Function {func.__name__} failed after {max_retries} retries: {e}")
                raise
            
            logger.warning(
                f"Function {func.__name__} failed (attempt {attempt + 1}/{max_retries + 1}): {e}. "
                f"Retrying in {delay:.2f}s..."
            )
            await asyncio.sleep(delay)
            delay = min(delay * exponential_base, max_delay)
    
    raise Exception(f"Unexpected retry loop exit for {func.__name__}")


def retry_on_failure(max_retries: int = 3, initial_delay: float = 1.0):
    """
    Decorator for retrying async functions with exponential backoff.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await retry_with_backoff(
                func,
                max_retries=max_retries,
                initial_delay=initial_delay,
                *args,
                **kwargs
            )
        return wrapper
    return decorator





