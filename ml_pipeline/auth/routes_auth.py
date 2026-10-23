"""
routes_auth.py
──────────────
FastAPI router handling registration, login, logout, and session check (/auth/me).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ml_pipeline.auth.database import get_db
from ml_pipeline.auth.dependencies import extract_token_from_request, get_current_user
from ml_pipeline.auth.models import RevokedToken, User, UserPreference
from ml_pipeline.auth.schemas import (
    TokenResponse,
    UserLoginRequest,
    UserPreferencesSchema,
    UserResponse,
    UserSignupRequest,
)
from ml_pipeline.auth.security import (
    auth_rate_limiter,
    clear_auth_cookie,
    create_access_token,
    decode_access_token,
    hash_password,
    set_auth_cookie,
    verify_password,
)

log = logging.getLogger(__name__)

router = APIRouter()


def _format_user_response(user: User) -> UserResponse:
    pref_schema = None
    if user.preferences:
        p = user.preferences
        pref_schema = UserPreferencesSchema(
            preferred_location_id=p.preferred_location_id,
            saved_locations=p.saved_locations,
            health_guidance=p.health_guidance,
            alert_thresholds=p.alert_thresholds,
            notification_channels=p.notification_channels,
            theme=p.theme,
        )
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=user.created_at,
        preferences=pref_schema,
    )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(req: UserSignupRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if not auth_rate_limiter.check(f"signup:{client_ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please wait a minute and try again.",
        )

    # Check for existing user with normalized email
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Try logging in.",
        )

    hashed = hash_password(req.password)
    user = User(
        name=req.name,
        email=req.email,
        password_hash=hashed,
    )
    db.add(user)
    db.flush()  # populate user.id

    # Create default user preferences
    prefs = UserPreference(user_id=user.id)
    db.add(prefs)
    db.commit()
    db.refresh(user)

    token_str, jti, expires_at = create_access_token(user.id, user.email)
    set_auth_cookie(response, token_str, expires_at)

    return TokenResponse(
        access_token=token_str,
        token_type="bearer",
        user=_format_user_response(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(req: UserLoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"login:{client_ip}:{req.email}"
    if not auth_rate_limiter.check(rate_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait a minute and try again.",
        )

    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact support.",
        )

    token_str, jti, expires_at = create_access_token(user.id, user.email)
    set_auth_cookie(response, token_str, expires_at)

    return TokenResponse(
        access_token=token_str,
        token_type="bearer",
        user=_format_user_response(user),
    )


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    token: str | None = Depends(extract_token_from_request),
    db: Session = Depends(get_db),
):
    if token:
        try:
            payload = decode_access_token(token)
            jti = payload.get("jti")
            user_id = payload.get("sub")
            exp_ts = payload.get("exp")
            if jti and user_id and exp_ts:
                exp_dt = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
                revoked = RevokedToken(jti=jti, user_id=user_id, expires_at=exp_dt)
                db.add(revoked)
                db.commit()
        except Exception:
            pass  # token might already be expired or invalid

    clear_auth_cookie(response)
    return {"status": "ok", "message": "Successfully logged out."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return _format_user_response(current_user)
