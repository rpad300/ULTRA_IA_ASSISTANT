
import json
import os
import logging
from typing import Dict, Any, Optional

SETTINGS_FILE = "settings.json"
logger = logging.getLogger(__name__)

DEFAULT_SETTINGS = {
    "transcription_service": "assemblyai" # Options: "assemblyai", "local_whisper"
}

import json
import logging
import aiofiles
from pydantic import BaseModel, Field
from typing import Literal, Optional

logger = logging.getLogger(__name__)

SETTINGS_FILE = "settings.json"

class AppSettings(BaseModel):
    """
    SOTA Settings Schema with Validation.
    Defines the contract for application configuration.
    """
    transcription_service: Literal["assemblyai", "local_whisper"] = "assemblyai"
    vad_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    debug_mode: bool = False
    
    # Add more fields as needed (e.g., specific API versions)
    
class SettingsService:
    def __init__(self, settings_path=SETTINGS_FILE):
        self.path = settings_path
        self._current: AppSettings = AppSettings()
        self._loaded = False

    async def load(self):
        """
        Asynchronously loads and validates settings.
        Graceful fallback to defaults if file is missing/invalid.
        """
        import os
        if not os.path.exists(self.path):
            logger.info("Settings file not found. Using defaults.")
            self._loaded = True
            return

        try:
            async with aiofiles.open(self.path, mode='r') as f:
                content = await f.read()
                data = json.loads(content)
                # Pydantic Validation
                self._current = AppSettings.model_validate(data)
                self._loaded = True
                logger.info("Settings loaded successfully.")
        except Exception as e:
            logger.warning(f"Failed to load settings (using defaults): {e}")
            # We keep default settings in self._current
            self._loaded = True

    @property
    def current(self) -> AppSettings:
        return self._current

    async def update(self, **kwargs):
        """
        Updates settings atomically and persists to disk.
        """
        try:
            # Create a new validated instance (Copy-on-Write logic)
            new_settings = self._current.model_copy(update=kwargs)
            self._current = new_settings
            
            # Persist non-blocking
            async with aiofiles.open(self.path, mode='w') as f:
                # model_dump_json is fast and standardized
                await f.write(self._current.model_dump_json(indent=4))
            
            logger.info(f"Settings updated: {kwargs}")
            
            # Reactive Logic could go here:
            # e.g., if "transcription_service" in kwargs: notify_transcription_manager()
            
        except Exception as e:
            logger.error(f"Failed to update settings: {e}")
            raise ValueError(f"Invalid settings update: {e}")

    async def get_value(self, key: str):
        # Helper for dynamic access mostly for legacy compatibility
        if not self._loaded: await self.load()
        return getattr(self._current, key, None)


# Singleton with deferred initialization capability
_instance = SettingsService()

async def get_settings_service():
    """
    Async Factory for Settings Service.
    Ensures settings are loaded before returning.
    """
    if not _instance._loaded:
        await _instance.load()
    return _instance
