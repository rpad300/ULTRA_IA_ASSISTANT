import contextvars
from typing import Optional
import logging

# Context variable to store request ID
_request_id_ctx_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("request_id", default=None)

def get_request_id() -> Optional[str]:
    return _request_id_ctx_var.get()

def set_request_id(request_id: str):
    return _request_id_ctx_var.set(request_id)

class LoggingContextFilter(logging.Filter):
    """
    Logging filter that injects the request_id from contextvars into the log record.
    This eliminates the need to pass extra={'request_id': ...} manually.
    """
    def filter(self, record):
        request_id = get_request_id()
        if request_id:
            record.request_id = request_id
        elif not hasattr(record, 'request_id'):
            record.request_id = 'no-request-id'
        return True
