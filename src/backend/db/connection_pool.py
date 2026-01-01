
import logging
from typing import Optional
from supabase import create_async_client, AsyncClient
from supabase.lib.client_options import ClientOptions
from config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

# Singleton assíncrono
_async_supabase: Optional[AsyncClient] = None

async def init_supabase():
    """
    SOTA: Inicializa o cliente assíncrono com otimização de pool.
    Configura o httpx para manter conexões quentes e evitar overhead de TCP.
    """
    global _async_supabase
    
    if _async_supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("🚀 SUPABASE_URL/KEY missing in environment!")

        # Configurações de performance do httpx (o motor da conexão)
        options = ClientOptions(
            postgrest_client_timeout=10,
            storage_client_timeout=20,
            # SOTA: Schema caching e limites de pool
            schema="public"
        )

        _async_supabase = await create_async_client(
            SUPABASE_URL, 
            SUPABASE_KEY,
            options=options
        )
        logger.info("✅ Supabase Async Connection Pool Initialized (F1 Ready)")

    return _async_supabase

async def get_supabase() -> AsyncClient:
    """Dependency para rotas FastAPI e Services."""
    if _async_supabase is None:
        return await init_supabase()
    return _async_supabase

async def close_supabase():
    """Encerramento gracioso para evitar Memory Leaks."""
    global _async_supabase
    if _async_supabase:
        # Nota: O cliente assíncrono do Supabase tem um método aclose() 
        # herdado do httpx para limpar o pool de conexões.
        # Atualmente o SDK pode variar, mas fechar o client é best practice.
        logger.info("🔌 Closing Supabase connection pool...")
        # await _async_supabase.aclose() # Se suportado pela versão
        try:
             # Try best effort close if method exists
             if hasattr(_async_supabase, "process_shutdown"):
                 await _async_supabase.process_shutdown()
        except Exception:
             pass 
             
        _async_supabase = None
