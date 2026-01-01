import asyncio
import logging
import random
from typing import Callable, Any, Optional, Type, Union, Tuple
from functools import wraps

logger = logging.getLogger(__name__)

async def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retry_on: Union[Type[Exception], Tuple[Type[Exception], ...]] = Exception,
    *args,
    **kwargs
) -> Any:
    """
    SOTA Retry with Full Jitter and Exception Filtering.
    Prevents 'Thundering Herd' via random backoff and ensures strict error handling.
    """
    delay = initial_delay
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            return func(*args, **kwargs)

        except retry_on as e:
            last_exception = e
            if attempt == max_retries:
                logger.error(f"❌ [SOTA Retry] {func.__name__} exhausted after {max_retries} attempts. Final Error: {e}")
                raise

            # SOTA: Full Jitter implementation
            # Instead of waiting exactly 'delay', we wait random(0, min(cap, delay))
            # This distributes the load of retrying clients.
            current_delay = min(max_delay, delay)
            sleep_time = random.uniform(0, current_delay) if jitter else current_delay

            logger.warning(
                f"⚠️ [SOTA Retry] {func.__name__} failed (attempt {attempt + 1}/{max_retries + 1}). "
                f"Reason: {type(e).__name__}. Retrying in {sleep_time:.2f}s..."
            )
            
            await asyncio.sleep(sleep_time)
            delay *= exponential_base

        except Exception as e:
            # If exception is not in 'retry_on', fail immediately.
            # This prevents retrying logic errors or 4xx failures that are permanent.
            logger.error(f"🚫 [SOTA Retry] Non-recoverable error in {func.__name__}: {e}")
            raise

    raise last_exception

def retry_on_failure(
    max_retries: int = 3, 
    initial_delay: float = 1.0, 
    retry_on: Union[Type[Exception], Tuple[Type[Exception], ...]] = Exception
):
    """
    SOTA Decorator for async functions.
    Usage: @retry_on_failure(retry_on=(TimeoutError, ConnectionError))
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await retry_with_backoff(
                func,
                max_retries=max_retries,
                initial_delay=initial_delay,
                retry_on=retry_on,
                *args,
                **kwargs
            )
        return wrapper
    return decorator





