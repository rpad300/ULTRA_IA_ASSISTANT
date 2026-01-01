
import uuid
import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from middleware.logging_context import set_request_id, clear_request_id

logger = logging.getLogger(__name__)

class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    SOTA Tracing Middleware.
    Garante rastreabilidade total, métricas de latência e logs limpos.
    """
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        
        # 1. Identidade Única (Trace/Correlation)
        # Aceita ID vindo de fora (C# ou Gateway) ou gera um novo
        request_id = (
            request.headers.get("X-Request-ID") or 
            request.headers.get("X-Correlation-ID") or 
            str(uuid.uuid4())
        )
        
        # 2. Fixar Contexto (Thread/Task Safe)
        token = set_request_id(request_id)
        request.state.request_id = request_id
        
        # Endpoints silenciosos (Telemetria de baixo nível)
        is_noisy = any(request.url.path.startswith(p) for p in [
            "/api/health", "/api/audio-service/status", "/api/audio-service/devices"
        ])
        
        try:
            response = await call_next(request)
            
            # 3. Telemetria de Latência
            process_time = time.perf_counter() - start_time
            
            if not is_noisy:
                logger.info(
                    f"Completed {request.method} {request.url.path} "
                    f"[{response.status_code}] in {process_time:.4f}s",
                    extra={"request_id": request_id, "duration": process_time}
                )
            
            # 4. Propagação de Resposta
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time:.4f}"
            return response

        except Exception as e:
            process_time = time.perf_counter() - start_time
            logger.error(
                f"🚨 Request Failed: {request.method} {request.url.path} "
                f"Error: {e} | Trace: {request_id}",
                extra={"request_id": request_id, "duration": process_time},
                exc_info=True
            )
            raise
        finally:
            # SOTA: Limpar sempre o contexto para evitar fugas de memória/contexto
            clear_request_id(token)
