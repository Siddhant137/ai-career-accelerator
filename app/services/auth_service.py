"""
app/services/auth_service.py
─────────────────────────────
Handles all authentication logic:
  * Password hashing / verification  (bcrypt)
  * JWT creation / decoding          (HS256 via python-jose)
  * User CRUD operations used by auth routes
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import (
    InvalidCredentialsError,
    InvalidTokenError,
    UserAlreadyExistsError,
)
from app.core.logging import get_logger
from app.db.models import User, UserRole
from app.schemas.auth import RegisterRequest

logger   = get_logger(__name__)
settings = get_settings()


# ── Password hashing ───────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── JWT ────────────────────────────────────────────────────────────────────────

def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(user_id: int, role: str) -> str:
    return _create_token(
        {"sub": str(user_id), "role": role, "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_access_token(token: str) -> dict:
    """
    Decode and validate an access token.
    Returns the full payload dict on success.

    Raises
    ------
    InvalidTokenError
    """
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except JWTError as exc:
        raise InvalidTokenError(f"Token is invalid or expired: {exc}") from exc

    if payload.get("type") != "access":
        raise InvalidTokenError("Token is not an access token.")

    return payload


def decode_refresh_token(token: str) -> int:
    """
    Decode a refresh token and return the user_id.

    Raises
    ------
    InvalidTokenError
    """
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except JWTError as exc:
        raise InvalidTokenError(f"Refresh token is invalid or expired: {exc}") from exc

    if payload.get("type") != "refresh":
        raise InvalidTokenError("Token is not a refresh token.")

    try:
        return int(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise InvalidTokenError("Refresh token payload is malformed.") from exc


# ── User CRUD ──────────────────────────────────────────────────────────────────

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower().strip()).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def register_user(db: Session, payload: RegisterRequest) -> User:
    """
    Create a new user account.

    Raises
    ------
    UserAlreadyExistsError
        If the email is already registered.
    """
    if get_user_by_email(db, payload.email):
        raise UserAlreadyExistsError(
            f"An account with email '{payload.email}' already exists."
        )

    # Resolve role safely — accepts both enum instance and raw string
    role = payload.role if isinstance(payload.role, UserRole) else UserRole(payload.role)

    user = User(
        email=payload.email.lower().strip(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=role,
        is_active=True,
        is_verified=True,
    )
    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except Exception as exc:
        db.rollback()
        logger.error("DB error during register_user: %s", exc, exc_info=True)
        raise

    logger.info(
        "New user registered: id=%d email=%s role=%s",
        user.id, user.email, user.role,
    )
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    """
    Verify credentials and return the User.

    Raises
    ------
    InvalidCredentialsError
    """
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError("Invalid email or password.")

    if not user.is_active:
        raise InvalidCredentialsError("This account has been deactivated.")

    return user


def change_password(db: Session, user: User, current: str, new: str) -> None:
    """
    Update a user's password after verifying the current one.

    Raises
    ------
    InvalidCredentialsError
    """
    if not verify_password(current, user.hashed_password):
        raise InvalidCredentialsError("Current password is incorrect.")

    user.hashed_password = hash_password(new)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("DB error during change_password: %s", exc, exc_info=True)
        raise

    logger.info("Password changed for user id=%d", user.id)