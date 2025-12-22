from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
import uuid
from utils.validation import sanitize_string, validate_url, validate_email

# --- Base Models ---

class CompanyBase(BaseModel):
    name: str
    description: Optional[str] = None
    drive_root_folder_id: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = "active"
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
             # allowing loose check for now
             pass
        return self

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    drive_root_folder_id: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = None
    industry: Optional[str] = None

class Company(CompanyBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ProjectBase(BaseModel):
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
    name: Optional[str] = None
    description: Optional[str] = None
    drive_folder_id: Optional[str] = None

class Project(ProjectBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ProfileBase(BaseModel):
    name: str
    type: str # e.g. business_analyst
    base_prompt: Optional[str] = None
    company_id: str

class Profile(ProfileBase):
    id: str

# --- Threads & Chat ---

class ThreadBase(BaseModel):
    title: str
    project_id: str
    status: str = "active"
    profile_id: Optional[str] = None
    description: Optional[str] = None
    calendar_event_id: Optional[str] = None

class ThreadCreateRequest(BaseModel):
    """Model for creating a thread - project_id comes from URL"""
    title: str
    status: str = "active"
    profile_id: Optional[str] = None
    description: Optional[str] = None
    calendar_event_id: Optional[str] = None

class Thread(ThreadBase):
    id: str
    updated_at: Optional[datetime] = None

class MessageBase(BaseModel):
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
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    company_id: Optional[str] = None  # Made optional for auto-creation from voice profiles

    @field_validator('name')
    def sanitize_name(cls, v):
        return sanitize_string(v, max_length=200)

    @field_validator('email')
    def validate_contact_email(cls, v):
        return validate_email(v)

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

class Contact(ContactBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --- Sessions ---

class SessionBase(BaseModel):
    thread_id: str
    type: str  # prep_chat, prep_meeting, main_meeting, follow_up, focus_block
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    stt_provider: Optional[str] = None
    transcript_file_id: Optional[str] = None
    summary_file_id: Optional[str] = None
    audio_file_path: Optional[str] = None
    audio_file_drive_id: Optional[str] = None

class Session(SessionBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --- Profiles (Complete) ---

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    base_prompt: Optional[str] = None

class ProfileFull(ProfileBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --- Tasks ---

class TaskBase(BaseModel):
    description: str
    status: str = "open"  # open, done, dropped
    priority: str = "medium"  # low, medium, high
    company_id: Optional[str] = None
    project_id: Optional[str] = None
    thread_id: Optional[str] = None
    session_id: Optional[str] = None
    owner_contact_id: Optional[str] = None
    due_date: Optional[str] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    owner_contact_id: Optional[str] = None
    due_date: Optional[str] = None

class Task(TaskBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None