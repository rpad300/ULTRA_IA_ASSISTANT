from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any

class StartStreamingRequest(BaseModel):
    session_id: str = Field(alias="sessionId")
    language: str = "pt"
    microphone_device_id: Optional[str] = Field(default=None, alias="microphoneDeviceId")
    system_device_id: Optional[str] = Field(default=None, alias="systemDeviceId")
    company_name: Optional[str] = Field(default=None, alias="companyName")
    project_name: Optional[str] = Field(default=None, alias="projectName")
    keyterms: Optional[List[str]] = None
    use_assemblyai: bool = Field(default=True, alias="useAssemblyAI")

    class Config:
        populate_by_name = True

class StartTestRequest(BaseModel):
    file_path: Optional[str] = Field(default=None, alias="filePath")
    microphone_device_id: Optional[str] = Field(default=None, alias="microphoneDeviceId")
    system_device_id: Optional[str] = Field(default=None, alias="systemDeviceId")
    keyterms: Optional[List[str]] = None
    transcription_service: Optional[str] = Field(default="assemblyai", alias="transcription_service")

    class Config:
        populate_by_name = True


class GainRequest(BaseModel):
    gain: float

# --- RESPONSE MODELS (SOTA) ---
class AudioDevice(BaseModel):
    id: str
    name: str
    is_default: bool = False
    is_microphone: bool = True # Abstração: true se for input

class AudioServiceStatus(BaseModel):
    status: str = "unknown" # Default to unknown if missing
    is_capturing: bool = Field(alias="isCapturing")
    active_session_id: Optional[str] = Field(default=None, alias="sessionId")
    detail: Optional[str] = None
    is_assemblyai_connected: bool = Field(default=False, alias="isAssemblyAIConnected")
    is_backend_connected: bool = Field(default=False, alias="isBackendConnected")

    @model_validator(mode='before')
    @classmethod
    def compute_status(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "status" not in data:
                # Infer status from state
                if data.get("isCapturing"):
                    data["status"] = "streaming"
                else:
                    data["status"] = "ready"
        return data

class SimpleResponse(BaseModel):
    success: bool = True
    status: Optional[str] = None
    message: Optional[str] = None

class DeviceListResponse(BaseModel):
    devices: List[AudioDevice]
