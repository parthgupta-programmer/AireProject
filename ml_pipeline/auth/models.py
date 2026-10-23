"""
models.py
─────────
SQLAlchemy relational models for users, preferences, and session tokens.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from ml_pipeline.auth.database import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False)

    preferences = relationship(
        "UserPreference",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="joined",
    )


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    preferred_location_id = Column(String(50), default="ghaziabad", nullable=False)
    saved_locations_json = Column(Text, default="[\"ghaziabad\", \"delhi\"]", nullable=False)
    health_guidance_json = Column(Text, default="{}", nullable=False)
    alert_thresholds_json = Column(Text, default="{\"aqi\": 200, \"pm25\": 60, \"enabled\": true}", nullable=False)
    notification_channels_json = Column(Text, default="{\"email\": true, \"push\": false}", nullable=False)
    theme = Column(String(20), default="system", nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False)

    user = relationship("User", back_populates="preferences")

    @property
    def saved_locations(self) -> List[str]:
        try:
            return json.loads(self.saved_locations_json)
        except Exception:
            return []

    @saved_locations.setter
    def saved_locations(self, val: List[str]) -> None:
        self.saved_locations_json = json.dumps(val or [])

    @property
    def health_guidance(self) -> Dict[str, Any]:
        try:
            return json.loads(self.health_guidance_json)
        except Exception:
            return {}

    @health_guidance.setter
    def health_guidance(self, val: Dict[str, Any]) -> None:
        self.health_guidance_json = json.dumps(val or {})

    @property
    def alert_thresholds(self) -> Dict[str, Any]:
        try:
            return json.loads(self.alert_thresholds_json)
        except Exception:
            return {}

    @alert_thresholds.setter
    def alert_thresholds(self, val: Dict[str, Any]) -> None:
        self.alert_thresholds_json = json.dumps(val or {})

    @property
    def notification_channels(self) -> Dict[str, Any]:
        try:
            return json.loads(self.notification_channels_json)
        except Exception:
            return {}

    @notification_channels.setter
    def notification_channels(self, val: Dict[str, Any]) -> None:
        self.notification_channels_json = json.dumps(val or {})


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    jti = Column(String(36), primary_key=True)
    user_id = Column(String(36), index=True, nullable=False)
    revoked_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
