import contextvars
from typing import Optional
import logging
import json

# Context variable to store request ID
_request_id_ctx_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("request_id", default=None)

def get_request_id() -> Optional[str]:
    return _request_id_ctx_var.get()

def set_request_id(request_id: str):
    return _request_id_ctx_var.set(request_id)

def clear_request_id(token):
    _request_id_ctx_var.reset(token)

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

class JSONFormatter(logging.Formatter):
    """
    SOTA: Formata logs como JSON para consumo por ferramentas de monitorização.
    """
    def format(self, record):
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "no-id"),
            "module": record.module,
            "func": record.funcName,
            "logger": record.name
        }
        # Include exception info if available
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_entry)

def setup_sota_logging():
    """
    Configures the root logger with SOTA JSON formatting and Context Filtering.
    """
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter(datefmt='%Y-%m-%d %H:%M:%S'))
    
    # Injetar o filtro mágico!
    handler.addFilter(LoggingContextFilter())
    
    root_logger = logging.getLogger()
    # Remove existing handlers to avoid duplicates/conflicts
    if root_logger.handlers:
        for h in root_logger.handlers:
            root_logger.removeHandler(h)
            
    root_logger.addHandler(handler)
    # Note: Level is usually set in main.py based on ENV, but we can default to INFO
    root_logger.setLevel(logging.INFO)
