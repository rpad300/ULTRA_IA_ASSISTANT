"""
Input Validation and Sanitization Utilities
"""

import re
from typing import Optional
from pydantic import validator, BaseModel


def sanitize_string(value: Optional[str], max_length: int = 1000) -> Optional[str]:
    """
    Sanitize string input:
    - Strip whitespace
    - Limit length
    - Remove control characters
    """
    if not value:
        return None
    
    # Strip whitespace
    sanitized = value.strip()
    
    # Remove control characters (except newlines and tabs)
    sanitized = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]', '', sanitized)
    
    # Limit length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    return sanitized


def validate_email(email: Optional[str]) -> Optional[str]:
    """Validate and normalize email address."""
    if not email:
        return None
    
    email = email.strip().lower()
    
    # Basic email validation
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        raise ValueError("Invalid email format")
    
    return email


def validate_url(url: Optional[str]) -> Optional[str]:
    """Validate and normalize URL."""
    if not url:
        return None
    
    url = url.strip()
    
    # Add protocol if missing
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    # Basic URL validation
    pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    if not re.match(pattern, url):
        raise ValueError("Invalid URL format")
    
    return url


def validate_uuid(value: str) -> str:
    """Validate UUID format."""
    pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    if not re.match(pattern, value.lower()):
        raise ValueError("Invalid UUID format")
    return value.lower()


class SanitizedString(BaseModel):
    """Pydantic model with automatic string sanitization."""
    
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if isinstance(v, str):
            return sanitize_string(v)
        return v





