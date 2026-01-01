from pydantic import BaseModel, Field, model_validator, ConfigDict
from typing import Optional, List, Any
from enum import Enum

# --- ENUMS (SOTA Validation) ---
class AudioLanguage(str, Enum):
    PT = "pt"
    EN = "en"
    ES = "es"
    FR = "fr"

class ServiceStatusEnum(str, Enum):
    READY = "ready"
    STREAMING = "streaming"
    ERROR = "error"
    OFFLINE = "offline"
    UNKNOWN = "unknown"

class StartStreamingRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(alias="sessionId", examples=["sess_12345"])
    language: AudioLanguage = Field(default=AudioLanguage.PT, examples=["pt"])
    microphone_device_id: Optional[str] = Field(default=None, alias="microphoneDeviceId", examples=["mic_default"])
    system_device_id: Optional[str] = Field(default=None, alias="systemDeviceId", examples=["sys_default"])
    company_name: Optional[str] = Field(default=None, alias="companyName", examples=["Acme Corp"])
    project_name: Optional[str] = Field(default=None, alias="projectName", examples=["Project Alpha"])
    keyterms: Optional[List[str]] = Field(default=None, examples=[["CRM", "SaaS"]])
    use_assemblyai: bool = Field(default=True, alias="useAssemblyAI")

class StartTestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    file_path: Optional[str] = Field(default=None, alias="filePath", examples=["C:/audio/test.wav"])
    microphone_device_id: Optional[str] = Field(default=None, alias="microphoneDeviceId")
    system_device_id: Optional[str] = Field(default=None, alias="systemDeviceId")
    keyterms: Optional[List[str]] = None
    transcription_service: Optional[str] = Field(default="assemblyai", alias="transcription_service")


class GainRequest(BaseModel):
    gain: float = Field(examples=[1.5])

# --- RESPONSE MODELS (SOTA) ---
class AudioDevice(BaseModel):
    id: str
    name: str
    is_default: bool = False
    is_microphone: bool = True # Abstração: true se for input

class AudioServiceStatus(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: ServiceStatusEnum = Field(default=ServiceStatusEnum.UNKNOWN)
    is_capturing: bool = Field(alias="isCapturing")
    active_session_id: Optional[str] = Field(default=None, alias="sessionId")
    detail: Optional[str] = None
    is_assemblyai_connected: bool = Field(default=False, alias="isAssemblyAIConnected")
    is_backend_connected: bool = Field(default=False, alias="isBackendConnected")

    @model_validator(mode='before')
    @classmethod
    def compute_status(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "status" not in data or data["status"] is None:
                # Infer status from state
                if data.get("isCapturing"):
                    data["status"] = ServiceStatusEnum.STREAMING.value
                else:
                    data["status"] = ServiceStatusEnum.READY.value
        return data

class SimpleResponse(BaseModel):
    success: bool = True
    status: Optional[str] = None
    message: Optional[str] = None

class DeviceListResponse(BaseModel):
    devices: List[AudioDevice]
