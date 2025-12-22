import os
import io
import asyncio
from typing import Optional, Protocol, Union
import logging
from services.drive_service import get_drive_service

logger = logging.getLogger(__name__)

class StorageProvider(Protocol):
    async def get_bytes(self, path: str) -> Optional[bytes]:
        """Retrieve file bytes from the storage provider."""
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

class DriveStorageProvider:
    async def get_bytes(self, path: str) -> Optional[bytes]:
        """Reads file from Google Drive. Expects path format 'gdrive:FILE_ID'."""
        try:
            if not path.startswith("gdrive:"):
                logger.error(f"Invalid Drive path format: {path}")
                return None
                
            file_id = path.split(":", 1)[1]
            service = get_drive_service()
            if not service:
                logger.error("Drive service not available")
                return None

            # get_file_bytes is blocking, run in thread
            return await asyncio.to_thread(service.get_file_bytes, file_id)
        except Exception as e:
            logger.error(f"Failed to read Drive file {path}: {e}")
            return None

def get_storage_provider(path: str) -> StorageProvider:
    """Factory to get the correct provider based on path prefix."""
    if path.startswith("gdrive:"):
        return DriveStorageProvider()
    return LocalStorageProvider()
