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


# ── Alert Rules & Events Schemas (Phase 5) ────────────────────────────────────

class AlertRuleCreateRequest(BaseModel):
    location_id: str = Field(..., min_length=1, max_length=50)
    location_name: str = Field(..., min_length=1, max_length=100)
    condition_type: str = Field("above_threshold", pattern="^(above_threshold|category_reach|below_threshold_improvement)$")
    threshold_value: int = Field(200, ge=0, le=500, description="CPCB NAQI threshold between 0 and 500")
    severity_category: Optional[str] = Field(None, pattern="^(good|moderate|poor|veryPoor|severe)$")
    enabled: bool = True
    channel_in_app: bool = True
    channel_browser: bool = True


class AlertRuleUpdateRequest(BaseModel):
    location_id: Optional[str] = Field(None, min_length=1, max_length=50)
    location_name: Optional[str] = Field(None, min_length=1, max_length=100)
    condition_type: Optional[str] = Field(None, pattern="^(above_threshold|category_reach|below_threshold_improvement)$")
    threshold_value: Optional[int] = Field(None, ge=0, le=500)
    severity_category: Optional[str] = Field(None, pattern="^(good|moderate|poor|veryPoor|severe)$")
    enabled: Optional[bool] = None
    channel_in_app: Optional[bool] = None
    channel_browser: Optional[bool] = None


class AlertRuleResponse(BaseModel):
    id: str
    user_id: str
    location_id: str
    location_name: str
    condition_type: str
    threshold_value: int
    severity_category: Optional[str] = None
    enabled: bool
    channel_in_app: bool
    channel_browser: bool
    last_evaluated_at: Optional[datetime] = None
    last_triggered_at: Optional[datetime] = None
    last_seen_aqi: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertEventResponse(BaseModel):
    id: str
    user_id: str
    rule_id: Optional[str] = None
    location_id: str
    location_name: str
    aqi: int
    category: str
    condition_type: str
    threshold_value: int
    message: str
    observation_timestamp: datetime
    evaluated_at: datetime
    is_read: bool
    is_dismissed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertEvaluationRequest(BaseModel):
    location_id: str
    location_name: str
    current_aqi: int = Field(..., ge=0, le=500)
    category: str
    observation_timestamp: datetime

