"""
security.py
───────────
Cryptographic functions, password hashing (bcrypt), JWT creation & verification,
cookie management, and rate limiting.
"""

from __future__ import annotations

import os
import time
import uuid
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, List

import bcrypt
import jwt
from fastapi import Response, Request, HTTPException, status
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "aire-development-jwt-secret-do-not-use-in-production-32bytes")
JWT_ALGORITHM: str = "HS256"
JWT_ISSUER: str = "aire-backend"
JWT_AUDIENCE: str = "aire-app"

# Default token lifespan: 7 days
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))

AUTH_COOKIE_NAME = "aire_access_token"

# In production, require HTTPS for cookies
IS_PRODUCTION: bool = os.getenv("ENVIRONMENT", "development").lower() == "production"
COOKIE_SECURE: bool = IS_PRODUCTION or os.getenv("COOKIE_SECURE", "false").lower() == "true"


# ── Password Hashing (bcrypt) ─────────────────────────────────────────────────

def hash_password(plain_password: str) -> str:
    """Hash password with bcrypt (12 rounds of salting)."""
    if not plain_password:
        raise ValueError("Password cannot be empty")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time verification of password against bcrypt hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


# ── JWT Token Lifecycle ───────────────────────────────────────────────────────

def create_access_token(
    user_id: str,
    email: str,
    expires_delta: Optional[timedelta] = None,
) -> Tuple[str, str, datetime]:
    """
    Creates a signed JWT with unique jti, audience, issuer, and expiration.
    Returns: (token_string, jti, expiry_datetime)
    """
    now = datetime.now(timezone.utc)
    delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expires_at = now + delta
    jti = str(uuid.uuid4())

    payload = {
        "sub": user_id,
        "email": email,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }

    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, jti, expires_at


def decode_access_token(token: str) -> dict:
    """
    Decodes and validates JWT signature, expiration, issuer, and audience.
    Raises HTTPException(401) on invalid or expired token.
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid session token ({str(err)}).",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Cookie Handling ───────────────────────────────────────────────────────────

def set_auth_cookie(response: Response, token: str, expires_at: datetime) -> None:
    """Set secure, HTTP-only session cookie."""
    max_age = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=max(0, max_age),
        expires=expires_at,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear session cookie upon logout."""
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )


# ── In-Memory Rate Limiter ────────────────────────────────────────────────────

class InMemoryRateLimiter:
    """Sliding-window rate limiter for sensitive authentication endpoints."""

    def __init__(self, max_requests: int = 15, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._history: Dict[str, List[float]] = defaultdict(list)

    def check(self, key: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        # Evict old entries
        valid_timestamps = [t for t in self._history[key] if t > cutoff]
        if len(valid_timestamps) >= self.max_requests:
            return False
        valid_timestamps.append(now)
        self._history[key] = valid_timestamps
        return True


auth_rate_limiter = InMemoryRateLimiter(max_requests=20, window_seconds=60)
