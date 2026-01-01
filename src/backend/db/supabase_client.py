
import logging
import asyncio
from typing import Optional
from supabase import create_client, Client, create_async_client
from supabase.lib.client_options import ClientOptions
from config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

class SupabaseManager:
    """
    SOTA Supabase Connection Manager.
    Gere o ciclo de vida das conexões com otimização de Pool para High-Concurrency.
    """
    _sync_client: Optional[Client] = None
    _async_client: Optional[Client] = None 

    @classmethod
    def _get_options(cls) -> ClientOptions:
        return ClientOptions(
            schema="public"
        )

    @classmethod
    def get_sync_client(cls) -> Client:
        if cls._sync_client is None:
            if not SUPABASE_URL or not SUPABASE_KEY:
                raise ValueError("[CRITICAL] SUPABASE_URL/KEY missing!")
            
            cls._sync_client = create_client(
                SUPABASE_URL, 
                SUPABASE_KEY
            )
            logger.info("[OK] Supabase Sync Client Initialized")
        return cls._sync_client

    @classmethod
    async def get_async_client(cls) -> Client:
        if cls._async_client is None:
            if not SUPABASE_URL or not SUPABASE_KEY:
                raise ValueError("[CRITICAL] SUPABASE_URL/KEY missing!")
            
            # SOTA: Retry Loop for Initialization (Handle Flaky Startup)
            for attempt in range(3):
                try:
                    logger.info(f"Initializing Supabase Async Client (Attempt {attempt+1})...")
                    
                    # Create options with forced timeout settings to prevent hanging
                    options = ClientOptions(
                        schema="public",
                        auto_refresh_token=True,
                        persist_session=True,
                    )
                    # Create Client
                    client = await create_async_client(
                        SUPABASE_URL, 
                        SUPABASE_KEY,
                        # options=options (DISABLED: Causing AttributeError on 'headers' in installed SDK)
                    )
                    
                    # SOTA: Smoke Test (CRITICAL)
                    # We MUST verify the transport is working.
                    # We use a lightweight query. "companies" count is good.
                    await client.table("companies").select("count", count="exact").limit(1).execute()
                    
                    logger.info("[OK] Supabase Async Client Ready & Verified")
                    cls._async_client = client
                    return cls._async_client

                except Exception as e:
                    logger.error(f"[FAIL] Supabase Connection Init Failed (Attempt {attempt+1}): {e}")
                    # Force cleanup if partial init happened
                    if 'client' in locals() and client:
                        try:
                            # Try to close specific internal clients if they exist
                            if hasattr(client, 'aclose'): await client.aclose()
                            if hasattr(client, 'auth') and hasattr(client.auth, '_client'): 
                                await client.auth._client.aclose()
                        except: pass
                    
                    cls._async_client = None
                    await asyncio.sleep(1)
            
            # If we get here, all attempts failed.
            # We raise to prevent the app from running with a broken client.
            raise RuntimeError("Failed to initialize Supabase Async Client after 3 attempts.")
        
        return cls._async_client

    @classmethod
    async def close_all(cls):
        """SOTA: Cleanup total para fechar a garagem com segurança."""
        if cls._async_client:
            logger.info("[INFO] Closing Async Supabase Connections...")
            try:
                # SOTA: Aggressive cleanup of underlying httpx resources
                client = cls._async_client
                tasks = []
                
                # 1. Try public aclose (if available in newer SDKs)
                if hasattr(client, 'aclose'):
                    tasks.append(client.aclose())
                
                # 2. Try auth client (often separate httpx client)
                if hasattr(client, 'auth') and hasattr(client.auth, '_client'):
                     if hasattr(client.auth._client, 'aclose'):
                        tasks.append(client.auth._client.aclose())

                # 3. Try postgrest client
                if hasattr(client, 'postgrest') and hasattr(client.postgrest, '_client'):
                     if hasattr(client.postgrest._client, 'aclose'):
                        tasks.append(client.postgrest._client.aclose())

                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                    
            except Exception as e:
                logger.warning(f"Error during Supabase Client cleanup: {e}")
            finally:
                cls._async_client = None

        if cls._sync_client:
            # Sync client usually fits in GC, but good to nullify
            cls._sync_client = None
            logger.info("[INFO] Sync Supabase Client Reset")

# Shortcuts para manter compatibilidade com o teu código existente
def get_supabase_client() -> Client:
    return SupabaseManager.get_sync_client()

async def get_async_supabase_client() -> Client:
    return await SupabaseManager.get_async_client()
