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
    Integer,
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
    alert_rules = relationship(
        "AlertRule",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    alert_events = relationship(
        "AlertEvent",
        back_populates="user",
        cascade="all, delete-orphan",
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


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id = Column(String(50), nullable=False, default="delhi")
    location_name = Column(String(100), nullable=False, default="Delhi")
    condition_type = Column(String(30), nullable=False, default="above_threshold")  # above_threshold | category_reach | below_threshold_improvement
    threshold_value = Column(Integer, nullable=False, default=200)
    severity_category = Column(String(30), nullable=True)  # moderate | poor | veryPoor | severe
    enabled = Column(Boolean, nullable=False, default=True)
    channel_in_app = Column(Boolean, nullable=False, default=True)
    channel_browser = Column(Boolean, nullable=False, default=True)
    last_evaluated_at = Column(DateTime(timezone=True), nullable=True)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_aqi = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False)

    user = relationship("User", back_populates="alert_rules")
    events = relationship("AlertEvent", back_populates="rule", cascade="all, delete-orphan")


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(String(36), ForeignKey("alert_rules.id", ondelete="SET NULL"), nullable=True, index=True)
    location_id = Column(String(50), nullable=False)
    location_name = Column(String(100), nullable=False)
    aqi = Column(Integer, nullable=False)
    category = Column(String(30), nullable=False)
    condition_type = Column(String(30), nullable=False)
    threshold_value = Column(Integer, nullable=False)
    message = Column(Text, nullable=False)
    observation_timestamp = Column(DateTime(timezone=True), nullable=False)
    evaluated_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    is_dismissed = Column(Boolean, nullable=False, default=False)
    idempotency_key = Column(String(128), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)

    user = relationship("User", back_populates="alert_events")
    rule = relationship("AlertRule", back_populates="events")

