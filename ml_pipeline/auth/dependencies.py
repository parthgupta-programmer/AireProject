"""
dependencies.py
───────────────
FastAPI dependencies for authentication, token extraction from Bearer headers
or secure HTTP-only cookies, and token revocation checks.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ml_pipeline.auth.database import get_db
from ml_pipeline.auth.models import RevokedToken, User
from ml_pipeline.auth.security import AUTH_COOKIE_NAME, decode_access_token

# auto_error=False allows falling back to cookie if header is not present
bearer_scheme = HTTPBearer(auto_error=False)


def extract_token_from_request(
    request: Request,
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[str]:
    """Extract access token from Bearer Authorization header or HTTP-only cookie."""
    if bearer_creds and bearer_creds.credentials:
        return bearer_creds.credentials

    cookie_token = request.cookies.get(AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token

    return None


def get_current_user(
    token: Optional[str] = Depends(extract_token_from_request),
    db: Session = Depends(get_db),
) -> User:
    """
    Authenticate the current user. Enforces valid token signature, expiration,
    and database revocation status.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    user_id = payload.get("sub")
    jti = payload.get("jti")

    if not user_id or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if this token has been explicitly revoked
    revoked = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    if revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been terminated. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_optional_current_user(
    token: Optional[str] = Depends(extract_token_from_request),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Returns the current User if authenticated, otherwise None."""
    if not token:
        return None
    try:
        return get_current_user(token=token, db=db)
    except HTTPException:
        return None
