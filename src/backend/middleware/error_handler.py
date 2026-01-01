
import logging
import traceback
import time
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from config import ENVIRONMENT
from services.metrics_service import get_metrics_service
import datetime

logger = logging.getLogger(__name__)

from postgrest.exceptions import APIError

async def error_handler(request: Request, exc: Exception) -> JSONResponse:
    """SOTA Global Exception Handler com Telemetria."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    # EMERGENCY CRASH LOGGING
    try:
        with open("debug_crash.log", "a", encoding="utf-8") as f:
            timestamp = datetime.datetime.now().isoformat()
            f.write(f"\n[{timestamp}] CRITICAL CRASH in {request.url.path}:\n")
            f.write(traceback.format_exc())
            f.write("-" * 80 + "\n")
    except:
        pass

    # 1. Telemetria: Incrementar erros críticos (Fail-safe)
    try:
        metrics = get_metrics_service()
        metrics.increment("errors_500_total", tags={"path": request.url.path})
    except Exception as metric_err:
        # Prevent metrics failure from masking the original error
        logger.warning(f"Failed to record error metric: {metric_err}")

    # 2. Logging Estruturado (Specific handling for Supabase/Postgrest)
    error_detail = {}
    if isinstance(exc, APIError):
        # Extract Postgres error details
        error_detail = {
            "hint": exc.hint,
            "details": exc.details,
            "code": exc.code,
            "message": exc.message
        }
        logger.error(
            f"DB API ERROR: {exc.message} | Code: {exc.code} | Trace: {request_id}",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "db_error": error_detail
            }
        )
    else:
        logger.error(
            f"CRITICAL ERROR: {type(exc).__name__}: {exc}",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
                "exception": type(exc).__name__
            },
            exc_info=True
        )
    
    # 3. Resposta de Segurança
    content = {
        "success": False,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "Ocorreu um erro inesperado no servidor.",
            "request_id": request_id
        }
    }

    if ENVIRONMENT != "production":
        content["error"]["detail"] = str(exc)
        if error_detail:
             content["error"]["db_details"] = error_detail
        content["error"]["traceback"] = traceback.format_exc()
    else:
        # Em produção, damos uma sugestão de ação
        content["error"]["message"] = "Erro interno. Por favor, tente novamente ou contacte o suporte com o ID abaixo."

    return JSONResponse(status_code=500, content=content)

async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handler de Exceções HTTP com mapeamento de códigos."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    # Telemetria para 404 e 401
    metrics = get_metrics_service()
    metrics.increment(f"errors_{exc.status_code}_total")

    if exc.status_code >= 400:
        logger.warning(f"HTTP {exc.status_code}: {exc.detail} | Trace: {request_id}")

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "request_id": request_id
            }
        }
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handler de Erros de Schema (Pydantic)."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    # Log dos erros de validação (útil para detetar bugs no frontend)
    logger.debug(f"Validation Failed: {exc.errors()} | Trace: {request_id}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Os dados enviados são inválidos.",
                "details": exc.errors(),
                "request_id": request_id
            }
        }
    )
