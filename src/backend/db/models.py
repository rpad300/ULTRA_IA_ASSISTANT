
from pydantic import BaseModel, field_validator, model_validator, ConfigDict, Field, computed_field
from typing import Optional, List, Literal
from datetime import datetime
import uuid
from utils.validation import sanitize_string, validate_url, validate_email

# --- SOTA Enums & Types ---
ContactStatus = Literal["active", "inactive", "archived"]
SessionType = Literal["prep_chat", "prep_meeting", "main_meeting", "follow_up", "focus_block"]
TaskStatus = Literal["open", "in_progress", "done", "dropped"]
TaskPriority = Literal["low", "medium", "high"]
CompanyStatus = Literal["active", "inactive", "suspended"]

# --- Base Models ---

class CompanyBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    name: str
    description: Optional[str] = None
    drive_root_folder_id: Optional[str] = None
    website: Optional[str] = None
    status: CompanyStatus = "active"
    industry: Optional[str] = None

    @field_validator('name')
    def sanitize_name(cls, v):
        return sanitize_string(v, max_length=200)

    @field_validator('description')
    def sanitize_description(cls, v):
        return sanitize_string(v, max_length=1000)

    @field_validator('website')
    def validate_website(cls, v):
        return validate_url(v)

    @model_validator(mode='after')
    def validate_dependencies(self):
        # Example lazy validation: If drive location is set, verify format
        if self.drive_root_folder_id and not self.drive_root_folder_id.startswith("1"):
             # Mock validation: Real Drive IDs often start with specific chars or are 33 chars long
             pass
        return self

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    name: Optional[str] = None
    description: Optional[str] = None
    drive_root_folder_id: Optional[str] = None
    website: Optional[str] = None
    status: Optional[CompanyStatus] = None
    industry: Optional[str] = None

class Company(CompanyBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ProjectBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    name: str
    description: Optional[str] = None
    drive_folder_id: Optional[str] = None
    company_id: str

    @field_validator('name')
    def sanitize_name(cls, v):
        return sanitize_string(v, max_length=200)

    @field_validator('description')
    def sanitize_description(cls, v):
        return sanitize_string(v, max_length=1000)

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    name: Optional[str] = None
    description: Optional[str] = None
    drive_folder_id: Optional[str] = None

class Project(ProjectBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    updated_at: Optional[datetime] = None

class DocumentBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    name: str
    project_id: str
    company_id: Optional[str] = None
    drive_file_id: Optional[str] = None
    drive_folder_id: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    metadata: Optional[dict] = None

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    name: Optional[str] = None
    metadata: Optional[dict] = None

class Document(DocumentBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ProfileBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    name: str # e.g. "Legal Guard"
    type: str # e.g. "legal_counsel"
    
    # SOTA 2025 Agent Architecture
    instructions: Optional[dict] = Field(default_factory=dict) # Role, Mission, Tone, Focus, Forbidden
    capabilities: Optional[List[str]] = Field(default_factory=list) # e.g. ["search_law_db", "flag_risk"]
    
    # SOTA Refinement: Rich Metadata objects {id, name, type}
    knowledge_sources: Optional[List[dict]] = Field(default_factory=list) 
    
    few_shot_examples: Optional[List[dict]] = Field(default_factory=list) # [{"input": "...", "output": "..."}]
    response_format: Optional[str] = None # "structured_report", "bullet_points", "json"
    
    # Visuals
    icon: Optional[str] = None # Lucide icon name
    color: Optional[str] = None # UI Color
    
    # Legacy / Calculated
    base_prompt: Optional[str] = None # Deprecated in UI, kept for compatibility or generated from instructions
    company_id: str
    project_id: Optional[str] = None

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    name: Optional[str] = None
    type: Optional[str] = None
    base_prompt: Optional[str] = None
    instructions: Optional[dict] = None
    capabilities: Optional[List[str]] = None
    knowledge_sources: Optional[List[dict]] = None
    few_shot_examples: Optional[List[dict]] = None
    response_format: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    project_id: Optional[str] = None

class ProfileFull(ProfileBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --- Threads & Chat ---

class ThreadBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    title: str
    project_id: str
    status: str = "active"
    profile_id: Optional[str] = None
    description: Optional[str] = None
    calendar_event_id: Optional[str] = None

class ThreadCreateRequest(BaseModel):
    """Model for creating a thread - project_id comes from URL"""
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    title: str
    status: str = "active"
    profile_id: Optional[str] = None
    description: Optional[str] = None
    calendar_event_id: Optional[str] = None

class Thread(ThreadBase):
    id: str
    updated_at: Optional[datetime] = None

class MessageBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    role: str # user, assistant
    content: str

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: str
    thread_id: str
    created_at: Optional[datetime] = None

# --- Contacts ---

class ContactBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None  
    company_id: Optional[str] = None
    status: ContactStatus = "active" 
    
    # SOTA: Metadados Biométricos
    voice_profile_version: int = Field(default=0, description="Versão do perfil de voz (Incremental Centroids)")
    has_voice_profile: bool = False

    @field_validator('name')
    def sanitize_name(cls, v):
        return sanitize_string(v, max_length=200)

    @field_validator('email')
    def validate_contact_email(cls, v):
        return validate_email(v)

    @field_validator('company_id', mode='before')
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[ContactStatus] = None
    voice_profile_version: Optional[int] = None
    has_voice_profile: Optional[bool] = None

class Contact(ContactBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --- Sessions ---

class SessionBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    thread_id: str
    type: SessionType  
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    stt_provider: Optional[str] = "whisper_local"
    transcript_file_id: Optional[str] = None
    summary_file_id: Optional[str] = None
    audio_file_path: Optional[str] = None
    audio_file_path: Optional[str] = None
    audio_file_drive_id: Optional[str] = None
    drive_folder_id: Optional[str] = None # SOTA: Track the specific session folder

    @computed_field
    def duration_seconds(self) -> Optional[float]:
        """Cálculo de telemetria automático."""
        if self.started_at and self.ended_at:
            return (self.ended_at - self.started_at).total_seconds()
        return None

class Session(SessionBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --- Tasks ---

class TaskBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    description: str
    status: TaskStatus = "open"  
    priority: TaskPriority = "medium" 
    company_id: Optional[str] = None
    project_id: Optional[str] = None
    thread_id: Optional[str] = None
    session_id: Optional[str] = None
    owner_contact_id: Optional[str] = None
    due_date: Optional[str] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    owner_contact_id: Optional[str] = None
    due_date: Optional[str] = None

class Task(TaskBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --- AI Governance (Agent 6) ---

class AIConfigBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    slug: str
    model_name: str
    system_prompt: str
    temperature: float = Field(ge=0.0, le=2.0)
    max_tokens: int = Field(gt=0)
    is_active: bool = True

class AIConfigCreate(AIConfigBase):
    pass

class AIConfigUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)
    
    model_name: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None

class AIConfig(AIConfigBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
