
import time
import logging
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from services.redis_service import get_redis_service
from config import ENVIRONMENT

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    SOTA Distributed Rate Limiter.
    Usa Redis para consistência entre múltiplos servidores e proteção contra OOM.
    """
    
    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.limit = requests_per_minute
        self.window = 60

    async def dispatch(self, request: Request, call_next):
        if ENVIRONMENT == "development" or self._is_exempt(request.url.path):
            return await call_next(request)

        # 1. Identificar Utilizador Real (Considerando Proxies/Cloudflare)
        client_ip = request.headers.get("cf-connecting-ip") or \
                    request.headers.get("x-forwarded-for") or \
                    (request.client.host if request.client else "unknown")
        
        # 2. Operação Atómica no Redis (Sliding Window)
        redis_svc = await get_redis_service()
        if not redis_svc or not redis_svc._client:
            # Fallback: Se o Redis cair, deixamos passar (Fail Open) para não parar o negócio
            return await call_next(request)

        now = time.time()
        key = f"rate_limit:{client_ip}"
        
        try:
            # SOTA Pipeline: Limpa antigos e adiciona novo num só salto de rede
            async with redis_svc._client.pipeline(transaction=True) as pipe:
                pipe.zremrangebyscore(key, 0, now - self.window) # Remove expirados
                pipe.zadd(key, {str(now): now})                 # Adiciona atual
                pipe.zcard(key)                                 # Conta quantos restam
                pipe.expire(key, self.window)                   # Auto-limpeza total do IP
                results = await pipe.execute()
            
            current_count = results[2]
            
            if current_count > self.limit:
                logger.warning(f"🚫 Rate Limit hit for {client_ip}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Slow down.",
                    headers={"Retry-After": str(self.window)}
                )

            response = await call_next(request)
            
            # 3. Propagação de Telemetria
            response.headers["X-RateLimit-Limit"] = str(self.limit)
            response.headers["X-RateLimit-Remaining"] = str(max(0, self.limit - current_count))
            return response

        except HTTPException as e: raise e
        except Exception as e:
            logger.error(f"Rate Limit Error: {e}")
            return await call_next(request)

    def _is_exempt(self, path: str) -> bool:
        exempt_prefixes = ["/api/health", "/docs", "/openapi.json", "/redoc"]
        return any(path.startswith(p) for p in exempt_prefixes)
