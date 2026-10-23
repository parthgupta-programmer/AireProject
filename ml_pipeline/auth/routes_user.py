"""
routes_user.py
──────────────
User-specific endpoints for preferences management and password changes.
Enforces strict user ownership: users can ONLY access and modify their own settings.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ml_pipeline.auth.database import get_db
from ml_pipeline.auth.dependencies import get_current_user
from ml_pipeline.auth.models import User, UserPreference
from ml_pipeline.auth.schemas import (
    PasswordChangeRequest,
    UserPreferencesSchema,
)
from ml_pipeline.auth.security import hash_password, verify_password

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/preferences", response_model=UserPreferencesSchema)
def get_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve private settings for the authenticated user."""
    prefs = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not prefs:
        # Create default preference if missing
        prefs = UserPreference(user_id=current_user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)

    return UserPreferencesSchema(
        preferred_location_id=prefs.preferred_location_id,
        saved_locations=prefs.saved_locations,
        health_guidance=prefs.health_guidance,
        alert_thresholds=prefs.alert_thresholds,
        notification_channels=prefs.notification_channels,
        theme=prefs.theme,
    )


@router.put("/preferences", response_model=UserPreferencesSchema)
def update_preferences(
    updated: UserPreferencesSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update settings for the authenticated user.
    Backend strictly binds update to current_user.id (prevents unauthorized modification).
    """
    prefs = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreference(user_id=current_user.id)
        db.add(prefs)

    prefs.preferred_location_id = updated.preferred_location_id
    prefs.saved_locations = updated.saved_locations
    prefs.health_guidance = updated.health_guidance
    prefs.alert_thresholds = updated.alert_thresholds
    prefs.notification_channels = updated.notification_channels
    prefs.theme = updated.theme

    db.commit()
    db.refresh(prefs)

    return UserPreferencesSchema(
        preferred_location_id=prefs.preferred_location_id,
        saved_locations=prefs.saved_locations,
        health_guidance=prefs.health_guidance,
        alert_thresholds=prefs.alert_thresholds,
        notification_channels=prefs.notification_channels,
        theme=prefs.theme,
    )


@router.put("/password")
def change_password(
    req: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Securely change password after verifying the current password."""
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed.",
        )

    if req.current_password == req.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    current_user.password_hash = hash_password(req.new_password)
    db.commit()

    return {"status": "ok", "message": "Password changed successfully."}
