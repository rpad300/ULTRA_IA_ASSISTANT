"""
Health Check Utilities
Detailed health checks for services
"""

import time
from typing import Dict, Any, Optional
from datetime import datetime
from db.supabase_client import get_supabase_client
from services.qdrant_service import get_qdrant_service
from services.gemini_service import get_gemini_service
from services.gemini_service import get_gemini_service
import asyncio
from config import ENVIRONMENT

# Health check cache (refresh every 30 seconds)
_health_cache: Optional[Dict[str, Any]] = None
_cache_timestamp: float = 0
_cache_ttl: float = 30.0



async def check_supabase() -> Dict[str, Any]:
    """Check Supabase connection health."""
    try:
        start = time.time()
        from db.supabase_client import get_async_supabase_client
        supabase = await get_async_supabase_client()
        
        # Simple query to test connection (native async)
        result = await supabase.table("companies").select("id").limit(1).execute()
        
        latency_ms = (time.time() - start) * 1000
        
        return {
            "status": "healthy",
            "latency_ms": round(latency_ms, 2),
            "connected": True
        }
    except Exception as e:
        # Reset client on health failure to allow recovery
        try:
            from db.supabase_client import reset_async_supabase_client
            await reset_async_supabase_client()
        except Exception:
            pass
            
        return {
            "status": "unhealthy",
            "error": str(e),
            "connected": False
        }



async def check_qdrant() -> Dict[str, Any]:
    """Check Qdrant connection health."""
    try:
        start = time.time()
        qdrant = get_qdrant_service()
        # Check collection exists (run in executor)
        loop = asyncio.get_event_loop()
        collection_info = await loop.run_in_executor(
            None,
            lambda: qdrant.client.get_collection("ultra_knowledge_base")
        )
        latency_ms = (time.time() - start) * 1000
        
        return {
            "status": "healthy",
            "latency_ms": round(latency_ms, 2),
            "connected": True,
            "collection": "ultra_knowledge_base",
            "vectors_count": collection_info.points_count if hasattr(collection_info, 'points_count') else None
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "connected": False
        }


async def check_gemini() -> Dict[str, Any]:
    """Check Gemini API health."""
    try:
        start = time.time()
        gemini = get_gemini_service()
        # Simple test - check if service is initialized
        if gemini.model_name:
            latency_ms = (time.time() - start) * 1000
            return {
                "status": "healthy",
                "latency_ms": round(latency_ms, 2),
                "connected": True,
                "model": gemini.model_name
            }
        else:
            return {
                "status": "unhealthy",
                "error": "Gemini not configured",
                "connected": False
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "connected": False
        }



async def check_drive() -> Dict[str, Any]:
    """Check Google Drive connection health."""
    try:
        start = time.time()
        from services.drive_service import get_drive_service
        drive = get_drive_service()
        
        if not drive.service:
            return {
                "status": "unhealthy",
                "error": "Drive service not initialized (authentification failed)",
                "connected": False
            }

        # Lightweight call to verify token validity
        # about.get is fast and verifies auth scopes
        loop = asyncio.get_event_loop()
        about = await loop.run_in_executor(
            None,
            lambda: drive.service.about().get(fields="user").execute()
        )
        latency_ms = (time.time() - start) * 1000
        
        return {
            "status": "healthy",
            "latency_ms": round(latency_ms, 2),
            "connected": True,
            "user": about.get('user', {}).get('emailAddress')
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "connected": False
        }


async def check_picovoice() -> Dict[str, Any]:
    """Check PicoVoice/Eagle status."""
    try:
        # Lazy import to avoid circular dependencies
        from routers.native_transcription import get_current_eagle_status
        
        status_data = get_current_eagle_status()
        status = status_data.get("status", "unknown")
        
        # Determine health based on status
        is_healthy = status in ["ready", "initializing"]
        
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "connected": status != "unknown" and status != "failed",
            "details": {
                "status": status
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "connected": False,
            "error": str(e),
            "details": {
                "status": "failed"
            }
        }


async def get_health_status(use_cache: bool = True) -> Dict[str, Any]:
    """
    Get comprehensive health status for all services.
    Uses caching to avoid overwhelming services with health checks.
    """
    global _health_cache, _cache_timestamp
    
    try:
        now = time.time()
        
        # Return cached result if still valid
        if use_cache and _health_cache and (now - _cache_timestamp) < _cache_ttl:
            return _health_cache
        
        # Run health checks
        supabase_health = await check_supabase()
        qdrant_health = await check_qdrant()
        gemini_health = await check_gemini()
        drive_health = await check_drive()
        picovoice_health = await check_picovoice()
        
        # Determine overall status
        all_healthy = all([
            supabase_health.get("status") == "healthy",
            qdrant_health.get("status") == "healthy",
            gemini_health.get("status") == "healthy",
            drive_health.get("status") == "healthy",
            picovoice_health.get("status") == "healthy" or picovoice_health.get("details", {}).get("status") == "unknown" # Unknown is acceptable for overall health if not used
        ])
        
        health_status = {
            "status": "healthy" if all_healthy else "degraded",
            "timestamp": datetime.utcnow().isoformat(),
            "environment": ENVIRONMENT,
            "services": {
                "supabase": supabase_health,
                "qdrant": qdrant_health,
                "gemini": gemini_health,
                "drive": drive_health,
                "picovoice": picovoice_health
            }
        }
        
        # Cache result
        _health_cache = health_status
        _cache_timestamp = now
        
        return health_status
    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "environment": ENVIRONMENT,
            "error": str(e),
            "details": "Critical error in health check execution"
        }





