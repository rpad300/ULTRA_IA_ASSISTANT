
import json
import os
import logging
from typing import Dict, Any, Optional

SETTINGS_FILE = "settings.json"
logger = logging.getLogger(__name__)

DEFAULT_SETTINGS = {
    "transcription_service": "assemblyai" # Options: "assemblyai", "local_whisper"
}

class SettingsService:
    def __init__(self):
        self._settings = self._load_settings()

    def _load_settings(self) -> Dict[str, Any]:
        if not os.path.exists(SETTINGS_FILE):
            return DEFAULT_SETTINGS.copy()
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load settings: {e}")
            return DEFAULT_SETTINGS.copy()

    def _save_settings(self):
        try:
            with open(SETTINGS_FILE, "w") as f:
                json.dump(self._settings, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to save settings: {e}")

    def get_setting(self, key: str, default: Any = None) -> Any:
        return self._settings.get(key, default)

    def set_setting(self, key: str, value: Any):
        self._settings[key] = value
        self._save_settings()

_settings_service = None

def get_settings_service():
    global _settings_service
    if _settings_service is None:
        _settings_service = SettingsService()
    return _settings_service
