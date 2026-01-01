import os
import io
import asyncio
from typing import Optional, Protocol, Union
import collections.abc
import logging
from services.drive_service import get_drive_service

logger = logging.getLogger(__name__)

class StorageProvider(Protocol):
    async def get_bytes(self, path: str) -> Optional[bytes]:
        """Retrieve file bytes from the storage provider."""
        ...

    async def get_stream(self, path: str, chunk_size: int = 8192) -> Optional[collections.abc.AsyncGenerator[bytes, None]]:
        """Retrieve file as an async stream (generator)."""
        ...

class LocalStorageProvider:
    async def get_bytes(self, path: str) -> Optional[bytes]:
        """Reads file from local disk."""
        if not os.path.exists(path):
            logger.warning(f"Local file not found: {path}")
            return None
        
        try:
            # Run blocking I/O in thread pool
            return await asyncio.to_thread(self._read_file, path)
        except Exception as e:
            logger.error(f"Failed to read local file {path}: {e}")
            return None

    def _read_file(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    async def get_stream(self, path: str, chunk_size: int = 8192) -> Optional[collections.abc.AsyncGenerator[bytes, None]]:
        """SOTA: Stream file from disk using aiofiles-like pattern but standard pool."""
        if not os.path.exists(path):
            return None

        async def stream_generator():
            try:
                # Use standard open in async thread is tricky for generators.
                # Only way to be truly async is to read in chunks in to_thread.
                # Simplified: Open file, read chunk in loop.
                # Actually, blocking open/read in generator isn't ideal but acceptable for low concurrency.
                # Better SOTA: Use aiofiles if available, or run chunk reads in executor.
                # Let's use simple threaded generator for max compatibility.
                # BUT 'yield' cannot be awaited in run_in_executor easily without a queue.
                # Fallback: Just yield chunks synchronously? No, that blocks event loop.
                # Hybrid:
                with open(path, "rb") as f:
                    while True:
                        chunk = await asyncio.to_thread(f.read, chunk_size)
                        if not chunk:
                            break
                        yield chunk
            except Exception as e:
                logger.error(f"Stream error for {path}: {e}")
        
        return stream_generator()

class DriveStorageProvider:
    def __init__(self, cache_dir: str = "./data/cache"):
        self.cache_dir = cache_dir
        # Ensure cache directory exists (blocking is fine here on init, or move to async init)
        os.makedirs(cache_dir, exist_ok=True)

    async def get_bytes(self, path: str) -> Optional[bytes]:
        """
        Reads file from Google Drive with Tiered Caching.
        Expects path format 'gdrive:FILE_ID'.
        """
        try:
            if not path.startswith("gdrive:"):
                logger.error(f"Invalid Drive path format: {path}")
                return None
                
            file_id = path.split(":", 1)[1]
            cache_path = os.path.join(self.cache_dir, file_id) # Using file_id as filename
            
            # 1. Tier 1: Local Cache (SOTA Latency)
            if os.path.exists(cache_path):
                # logger.debug(f"Cache hit for {file_id}")
                return await asyncio.to_thread(self._read_local, cache_path)

            # 2. Tier 2: Cloud Fetch (Fallback)
            service = get_drive_service()
            if not service:
                logger.error("Drive service not available")
                return None

            # get_file_bytes is blocking, run in thread
            data = await asyncio.to_thread(service.get_file_bytes, file_id)
            
            if data:
                # SOTA: Populate Cache asynchronously
                # We await it to ensure data integrity before returning (Write-Through)
                # Or fire-and-forget? Better await to avoid race conditions on rapid re-access.
                await asyncio.to_thread(self._write_local, cache_path, data)
                
            return data
            
        except Exception as e:
            logger.error(f"Failed to read Drive file {path}: {e}")
            return None

    async def get_stream(self, path: str, chunk_size: int = 8192) -> Optional[collections.abc.AsyncGenerator[bytes, None]]:
        """
        SOTA: Smart Streaming.
        - If cached, streams from disk immediately.
        - If not, downloads to cache first (Cache-Through), then streams.
        """
        if not path.startswith("gdrive:"):
            return None
        
        file_id = path.split(":", 1)[1]
        cache_path = os.path.join(self.cache_dir, file_id)

        # Ensure content is local
        if not os.path.exists(cache_path):
            await self.get_bytes(path) # Trigger download + cache (Reuse logic)
        
        # Now stream from cache using Local logic
        local_provider = LocalStorageProvider()
        return await local_provider.get_stream(cache_path, chunk_size)

    def _read_local(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    def _write_local(self, path: str, data: bytes):
        try:
            # Atomic write pattern could be better (write tmp then rename), 
            # but simple write is okay for cache.
            with open(path, "wb") as f:
                f.write(data)
        except Exception as e:
            logger.warning(f"Failed to write cache for {path}: {e}")

def get_storage_provider(path: str) -> StorageProvider:
    """Factory to get the correct provider based on path prefix."""
    if path.startswith("gdrive:"):
        # We could inject custom cache dir here from settings
        return DriveStorageProvider()
    return LocalStorageProvider()
