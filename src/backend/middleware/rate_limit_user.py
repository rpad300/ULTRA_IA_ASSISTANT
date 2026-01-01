
import time
import logging
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from services.redis_service import get_redis_service
from config import ENVIRONMENT

logger = logging.getLogger(__name__)

class UserRateLimitMiddleware(BaseHTTPMiddleware):
    """
    SOTA User-Aware Rate Limiter.
    Implementa Sliding Window distribuída via Redis.
    """
    
    def __init__(self, app, authenticated_limit: int = 200, anonymous_limit: int = 100):
        super().__init__(app)
        self.auth_limit = authenticated_limit
        self.anon_limit = anonymous_limit
        self.window = 60

    async def dispatch(self, request: Request, call_next):
        try:
            # 1. Isenções (Health, Docs, Dev)
            if ENVIRONMENT == "development" or self._is_exempt(request.url.path):
                return await call_next(request)

            # Initialize Redis Service early
            redis_svc = await get_redis_service()

            # 2. Identificar Utilizador ou IP
            user_id = None
            if hasattr(request.state, "user") and request.state.user:
                user_id = request.state.user.get("user_id")
            
            if user_id:
                # SOTA: Prioritize Active Audio Sessions
                is_active = False
                try:
                    if redis_svc and redis_svc._client:
                         is_active = await redis_svc._client.exists(f"active_session:{user_id}")
                except Exception:
                    pass

                if is_active:
                    limit = 2000 
                    logger.debug(f"User {user_id} has active session. Boosting Rate Limit.")
                else:
                    limit = self.auth_limit
                
                identifier = f"user:{user_id}"
            else:
                limit = self.anon_limit
                client_ip = request.headers.get("cf-connecting-ip") or \
                            request.headers.get("x-forwarded-for") or \
                            (request.client.host if request.client else "unknown")
                identifier = f"ip:{client_ip}"

            # 3. Lógica de Janela Deslizante via Redis
            current_count = 0
            
            if redis_svc and redis_svc._client:
                now = time.time()
                key = f"rl:{identifier}"
                try:
                    async with redis_svc._client.pipeline(transaction=True) as pipe:
                        pipe.zremrangebyscore(key, 0, now - self.window)
                        pipe.zadd(key, {str(now): now})
                        pipe.zcard(key)
                        pipe.expire(key, self.window + 10)
                        results = await pipe.execute()
                    current_count = results[2]
                except Exception as e:
                    logger.error(f"Redis Rate Limit Error: {e}")
                    return await call_next(request)
            else:
                # Fallback considered successful
                return await call_next(request)

            # 4. Verificação de Limite
            if current_count > limit:
                logger.warning(f"🚫 User Rate Limit hit: {identifier}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Muitos pedidos. Por favor, aguarde um momento.",
                    headers={
                        "Retry-After": str(self.window),
                        "X-RateLimit-Limit": str(limit),
                        "X-RateLimit-Remaining": "0"
                    }
                )

            response = await call_next(request)
            
            # 5. Injetar Headers SOTA
            remaining = max(0, limit - current_count)
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            if user_id:
                response.headers["X-RateLimit-Type"] = "authenticated"
                
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            # SOTA Fail-Open: Se o rate limiter falhar, o sistema DEVE continuar a funcionar.
            # Não bloquear o utilizador por erros de infraestrutura.
            logger.error(f"Rate Limit Middleware Critical Failure: {e}")
            return await call_next(request)

    def _is_exempt(self, path: str) -> bool:
        exempt_prefixes = ["/health", "/api/health", "/docs", "/openapi.json", "/redoc"]
        return any(path.startswith(p) for p in exempt_prefixes)
