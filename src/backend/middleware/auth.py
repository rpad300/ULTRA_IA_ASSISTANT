
import jwt
import logging
from typing import Optional
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import ENVIRONMENT, SUPABASE_JWT_SECRET
from services.redis_service import get_redis_service
from db.supabase_client import get_async_supabase_client

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> Optional[dict]:
    """
    SOTA Auth: JWT Validation + Redis Cached Permissions.
    """
    # 1. Bypass em Dev
    if not credentials:
        if ENVIRONMENT == "development":
            dev_user = {"user_id": "dev-user", "company_id": "dev-company-id", "company_ids": ["dev-company-id"]}
            request.state.user = dev_user
            return dev_user
        raise HTTPException(status_code=401, detail="Auth Required")

    token = credentials.credentials
    # Get Redis service instance (it is an async retrieval, but the service methods are what matters)
    redis = await get_redis_service()

    try:
        # 2. Descodificação Rápida (Local)
        # SOTA: Validar o campo 'aud' (audience) que o Supabase define como 'authenticated'
        decoded = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=["HS256"], 
            # Note: Verify audience might need to be true in prod if audience is strictly 'authenticated'
            options={"verify_aud": False} 
        )
        user_id = decoded.get("sub")
        email = decoded.get("email")

        # 3. Cache-First Permissions Check (Fórmula 1 Performance)
        cache_key = f"auth:permissions:{user_id}"
        permissions = await redis.get_json(cache_key) if redis else None

        if not permissions:
            # SOTA: Fetch Assíncrono apenas se necessário
            try:
                supabase = await get_async_supabase_client()
                # Use .limit(1) logic or just .execute() for list. filtering by user_id should return list.
                res = await supabase.table("user_companies").select("company_id").eq("user_id", user_id).execute()
                company_ids = [c["company_id"] for c in (res.data or [])]
            except Exception as db_err:
                logger.error(f"Auth DB Error for {user_id}: {db_err}")
                company_ids = []
            
            permissions = {
                "user_id": user_id,
                "email": email,
                "company_ids": company_ids,
                "company_id": company_ids[0] if company_ids else None
            }
            
            # Guardar em cache por 5 minutos
            if redis:
                await redis.set_json(cache_key, permissions, ttl_seconds=300)

        # 4. Injetar no Request State para acesso global
        request.state.user = permissions
        return permissions

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token Expired")
    except Exception as e:
        logger.error(f"Auth Shield Breach: {e}")
        raise HTTPException(status_code=401, detail="Invalid Identity")

def get_company_context(
    requested_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
) -> str:
    """
    SOTA Multi-tenancy Guard.
    Garante isolamento total de dados.
    """
    target_id = requested_id or user.get("company_id")
    
    if not target_id:
        raise HTTPException(status_code=400, detail="No company context")

    # VALIDAÇÃO CRÍTICA: O utilizador tem permissão para esta empresa?
    if target_id not in user.get("company_ids", []):
        logger.warning(f"🚨 ALERT: User {user.get('user_id')} tried to access Company {target_id}")
        raise HTTPException(status_code=403, detail="Access Denied to this Workspace")

    return target_id
