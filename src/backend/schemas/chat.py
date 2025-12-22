from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any, Dict
from datetime import datetime

class BaseWSMessage(BaseModel):
    type: str

class TokenMessage(BaseWSMessage):
    type: Literal["token"] = "token"
    text: str
    message_id: Optional[str] = None
    thread_id: Optional[str] = None

class WSMessage(BaseWSMessage):
    """Generic wrapper for incoming/outgoing messages"""
    type: str
    payload: Optional[Dict[str, Any]] = None

class IncomingMessage(BaseModel):
    """Strict schema for 'send_message' from Client"""
    type: Literal["send_message"]
    content: str
    role: Literal["user"] = "user"
    thread_id: Optional[str] = None # Optional in payload if inferred from URL

class ChatMessage(BaseModel):
    """Represents a database message object"""
    id: str
    thread_id: str
    role: str
    content: str
    created_at: datetime
    status: Optional[str] = None # streaming, completed, error

class ErrorMessage(BaseWSMessage):
    type: Literal["error"] = "error"
    message: str
