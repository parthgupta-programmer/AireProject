"""
routes_alerts.py
────────────────
Endpoints for Phase 5: Functional AQI Alerts, Notifications, and Rules Management.
Strictly isolates data per authenticated user: users can only manage their own rules and notifications.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ml_pipeline.auth.database import get_db
from ml_pipeline.auth.dependencies import get_current_user
from ml_pipeline.auth.models import AlertEvent, AlertRule, User
from ml_pipeline.auth.schemas import (
    AlertEvaluationRequest,
    AlertEventResponse,
    AlertRuleCreateRequest,
    AlertRuleResponse,
    AlertRuleUpdateRequest,
)

log = logging.getLogger(__name__)

router = APIRouter()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ── Alert Rules Endpoints ─────────────────────────────────────────────────────

@router.get("/rules", response_model=List[AlertRuleResponse])
def get_user_alert_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all alert rules created by the authenticated user."""
    rules = (
        db.query(AlertRule)
        .filter(AlertRule.user_id == current_user.id)
        .order_by(AlertRule.created_at.desc())
        .all()
    )
    return rules


@router.post("/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
def create_alert_rule(
    req: AlertRuleCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new personal alert rule."""
    rule = AlertRule(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        location_id=req.location_id.strip().lower(),
        location_name=req.location_name.strip(),
        condition_type=req.condition_type,
        threshold_value=req.threshold_value,
        severity_category=req.severity_category,
        enabled=req.enabled,
        channel_in_app=req.channel_in_app,
        channel_browser=req.channel_browser,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/rules/{rule_id}", response_model=AlertRuleResponse)
def update_alert_rule(
    rule_id: str,
    req: AlertRuleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing alert rule. Enforces strict ownership."""
    rule = (
        db.query(AlertRule)
        .filter(AlertRule.id == rule_id, AlertRule.user_id == current_user.id)
        .first()
    )
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found or unauthorized.",
        )

    if req.location_id is not None:
        rule.location_id = req.location_id.strip().lower()
    if req.location_name is not None:
        rule.location_name = req.location_name.strip()
    if req.condition_type is not None:
        rule.condition_type = req.condition_type
    if req.threshold_value is not None:
        rule.threshold_value = req.threshold_value
    if req.severity_category is not None:
        rule.severity_category = req.severity_category
    if req.enabled is not None:
        rule.enabled = req.enabled
    if req.channel_in_app is not None:
        rule.channel_in_app = req.channel_in_app
    if req.channel_browser is not None:
        rule.channel_browser = req.channel_browser

    rule.updated_at = _utc_now()
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an alert rule. Enforces strict ownership."""
    rule = (
        db.query(AlertRule)
        .filter(AlertRule.id == rule_id, AlertRule.user_id == current_user.id)
        .first()
    )
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found or unauthorized.",
        )

    db.delete(rule)
    db.commit()
    return None


# ── Alert Events / In-App Notification Center Endpoints ───────────────────────

@router.get("/events", response_model=List[AlertEventResponse])
def get_user_alert_events(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve in-app notification events for the user."""
    events = (
        db.query(AlertEvent)
        .filter(AlertEvent.user_id == current_user.id, AlertEvent.is_dismissed.is_(False))
        .order_by(AlertEvent.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )
    return events


@router.patch("/events/{event_id}/read", response_model=AlertEventResponse)
def mark_event_read(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a notification event as read."""
    event = (
        db.query(AlertEvent)
        .filter(AlertEvent.id == event_id, AlertEvent.user_id == current_user.id)
        .first()
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert event not found or unauthorized.",
        )

    event.is_read = True
    db.commit()
    db.refresh(event)
    return event


@router.patch("/events/read-all", status_code=status.HTTP_200_OK)
def mark_all_events_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all unread notifications for the user as read."""
    db.query(AlertEvent).filter(
        AlertEvent.user_id == current_user.id,
        AlertEvent.is_read.is_(False),
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def dismiss_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dismiss a notification event from the history."""
    event = (
        db.query(AlertEvent)
        .filter(AlertEvent.id == event_id, AlertEvent.user_id == current_user.id)
        .first()
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert event not found or unauthorized.",
        )

    event.is_dismissed = True
    db.commit()
    return None


# ── Alert Evaluation Engine ───────────────────────────────────────────────────

@router.post("/evaluate", response_model=List[AlertEventResponse])
def evaluate_user_alerts(
    req: AlertEvaluationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Evaluate real AQI observations against enabled user rules.
    - Idempotency: Uses unique idempotency_key to prevent duplicate triggers across repeated polls.
    - Handles threshold crossing, category reach, and improvement conditions.
    """
    loc_id = req.location_id.strip().lower()
    rules = (
        db.query(AlertRule)
        .filter(
            AlertRule.user_id == current_user.id,
            AlertRule.enabled.is_(True),
            AlertRule.location_id == loc_id,
        )
        .all()
    )

    now = _utc_now()
    triggered_events: List[AlertEvent] = []

    for rule in rules:
        triggered = False
        message = ""

        # Condition 1: AQI rises above threshold
        if rule.condition_type == "above_threshold":
            if req.current_aqi >= rule.threshold_value:
                # Genuine transition crossing
                if rule.last_seen_aqi is None or rule.last_seen_aqi < rule.threshold_value:
                    triggered = True
                    message = (
                        f"Air quality in {req.location_name} reached AQI {req.current_aqi} "
                        f"({req.category.capitalize()}), exceeding your alert threshold of {rule.threshold_value}."
                    )

        # Condition 2: AQI reaches target category
        elif rule.condition_type == "category_reach":
            if rule.severity_category and req.category.lower() == rule.severity_category.lower():
                if rule.last_seen_aqi is None or req.current_aqi != rule.last_seen_aqi:
                    triggered = True
                    message = (
                        f"Air quality in {req.location_name} reached '{rule.severity_category}' "
                        f"category with AQI {req.current_aqi}."
                    )

        # Condition 3: AQI improves below threshold (recovery)
        elif rule.condition_type == "below_threshold_improvement":
            if req.current_aqi < rule.threshold_value:
                # Only trigger if prior known observation was above or at threshold
                if rule.last_seen_aqi is not None and rule.last_seen_aqi >= rule.threshold_value:
                    triggered = True
                    message = (
                        f"Air quality in {req.location_name} improved to AQI {req.current_aqi} "
                        f"({req.category.capitalize()}), dropping below your threshold of {rule.threshold_value}."
                    )

        rule.last_evaluated_at = now
        rule.last_seen_aqi = req.current_aqi

        if triggered:
            # Construct idempotent key: rule_id + observation_timestamp + current_aqi
            obs_iso = req.observation_timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
            idempotency_key = f"{rule.id}_{obs_iso}_{req.current_aqi}"

            existing = db.query(AlertEvent).filter(AlertEvent.idempotency_key == idempotency_key).first()
            if not existing:
                rule.last_triggered_at = now
                event = AlertEvent(
                    id=str(uuid.uuid4()),
                    user_id=current_user.id,
                    rule_id=rule.id,
                    location_id=loc_id,
                    location_name=req.location_name,
                    aqi=req.current_aqi,
                    category=req.category,
                    condition_type=rule.condition_type,
                    threshold_value=rule.threshold_value,
                    message=message,
                    observation_timestamp=req.observation_timestamp,
                    evaluated_at=now,
                    idempotency_key=idempotency_key,
                )
                db.add(event)
                triggered_events.append(event)

    db.commit()
    for ev in triggered_events:
        db.refresh(ev)

    return triggered_events
