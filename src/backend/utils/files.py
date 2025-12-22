import os
import shutil
import asyncio
from typing import Optional
import aiofiles

class AsyncTempFile:
    """
    Context manager for handling temporary files safely in async workflows.
    Ensures cleanup (file deletion) occurs when the context exits,
    even if errors occur.
    """
    def __init__(self, filename: str, content: bytes = None):
        self.filename = f"temp_{filename}"
        self.content = content
        self.path = os.path.abspath(self.filename)

    async def __aenter__(self):
        # Optimized: If content provided, write it asynchronously
        if self.content:
            async with aiofiles.open(self.path, 'wb') as f:
                await f.write(self.content)
        return self.path

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        try:
            if os.path.exists(self.path):
                os.remove(self.path)
        except Exception:
             pass # Best effort cleanup
