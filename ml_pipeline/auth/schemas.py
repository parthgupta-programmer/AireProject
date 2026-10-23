"""
schemas.py
──────────
Pydantic schemas for authentication and user preferences validation.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


class UserSignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Full display name")
    email: str = Field(..., description="Email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password (at least 8 characters)")

    @field_validator("email")
    @classmethod
    def validate_and_normalize_email(cls, v: str) -> str:
        norm = v.strip().lower()
        if not EMAIL_REGEX.match(norm):
            raise ValueError("Enter a valid email address.")
        return norm

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Name cannot be blank.")
        return s


class UserLoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserPreferencesSchema(BaseModel):
    preferred_location_id: str = "ghaziabad"
    saved_locations: List[str] = ["ghaziabad", "delhi"]
    health_guidance: Dict[str, Any] = Field(default_factory=dict)
    alert_thresholds: Dict[str, Any] = Field(default_factory=lambda: {"aqi": 200, "pm25": 60, "enabled": True})
    notification_channels: Dict[str, Any] = Field(default_factory=lambda: {"email": True, "push": False})
    theme: str = "system"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime
    preferences: Optional[UserPreferencesSchema] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
