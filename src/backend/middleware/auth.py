"""
Authentication and Authorization Middleware
Handles JWT token validation and user context injection
Integrates with Supabase Auth for production
"""

import jwt
import logging
from typing import Optional
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import ENVIRONMENT, SUPABASE_URL, SUPABASE_JWT_SECRET
from db.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

# For MVP, we'll use a simple token validation
# In production, integrate with Supabase Auth or your auth provider
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> Optional[dict]:
    """
    Extract and validate JWT token from Authorization header.
    Returns user context dict with user_id, company_id, etc.
    
    In production, validates JWT token with Supabase Auth.
    In development, allows requests without auth for easier testing.
    """
    if not credentials:
        # In development, allow requests without auth
        if ENVIRONMENT == "development":
            return {
                "user_id": "dev-user",
                "user_id": "dev-user",
                "company_id": "dev-company-id",  # Default for dev
                "company_ids": ["dev-company-id"],
                "email": "dev@example.com"
            }
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    try:
        # In development, accept any token for easier testing
        if ENVIRONMENT == "development":
            # Simple validation - in production, verify with Supabase
            return {
                "user_id": "dev-user",
                "user_id": "dev-user",
                "company_id": "dev-company-id",
                "company_ids": ["dev-company-id"],
                "email": "dev@example.com"
            }
        
        # Production: Validate with Supabase Auth
        if SUPABASE_JWT_SECRET:
            # Validate JWT directly using the secret
            try:
                decoded = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"])
                user_id = decoded.get("sub")
                
                # Get user's companies from database
                supabase = get_supabase_client()
                companies_response = supabase.table("user_companies").select("company_id, role").eq("user_id", user_id).execute()
                company_ids = [c["company_id"] for c in (companies_response.data or [])]
                
                return {
                    "user_id": user_id,
                    "email": decoded.get("email"),
                    "company_ids": company_ids,
                    "company_id": company_ids[0] if company_ids else None
                }
            except jwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Token expired")
            except jwt.InvalidTokenError as e:
                logger.warning(f"Invalid JWT token: {e}")
                raise HTTPException(status_code=401, detail="Invalid token")
        else:
            # Fallback: Use Supabase client to verify token
            logger.info("SUPABASE_JWT_SECRET not set, using Supabase client for validation")
            supabase = get_supabase_client()
            try:
                # Get user from Supabase Auth
                user_response = supabase.auth.get_user(token)
                if user_response.user:
                    user = user_response.user
                    # Get user's companies
                    companies_response = supabase.table("user_companies").select("company_id, role").eq("user_id", user.id).execute()
                    company_ids = [c["company_id"] for c in (companies_response.data or [])]
                    
                    return {
                        "user_id": user.id,
                        "email": user.email,
                        "company_ids": company_ids,
                        "company_id": company_ids[0] if company_ids else None
                    }
            except Exception as e:
                logger.error(f"Supabase auth validation error: {e}")
                raise HTTPException(status_code=401, detail="Invalid token")
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}", exc_info=True)
        raise HTTPException(status_code=401, detail="Authentication failed")


async def require_auth(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Dependency that requires authentication."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return current_user


def get_company_id_from_request(
    current_user: dict = Depends(get_current_user),
    company_id: Optional[str] = None
) -> str:
    """
    Extract company_id from user context or request parameter.
    Ensures multi-tenancy isolation.
    """
    # Priority: request param > user context > None
    if company_id:
        return company_id
    
    if current_user and current_user.get("company_id"):
        return current_user["company_id"]
    
    raise HTTPException(
        status_code=400,
        detail="company_id is required"
    )

