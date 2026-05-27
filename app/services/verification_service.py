"""
app/services/verification_service.py
──────────────────────────────────────
Email verification token validation and completion.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.models import User

logger = get_logger(__name__)

VERIFICATION_EXPIRE_HOURS = 24


class VerificationError(Exception):
    """Raised when a verification token is invalid or expired."""


def set_verification_token(user: User, token: str) -> None:
    user.verification_token = token
    user.verification_token_expires_at = (
        datetime.now(timezone.utc) + timedelta(hours=VERIFICATION_EXPIRE_HOURS)
    )


def verify_user_email(db: Session, token: str) -> User:
    """
    Mark a user's email as verified using the one-time token.

    Raises
    ------
    VerificationError
        Invalid or expired token.
    """
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        raise VerificationError("Invalid verification token.")

    if user.is_verified:
        return user

    if user.verification_token_expires_at:
        expires_at = user.verification_token_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise VerificationError(
                "Verification link has expired. Please request a new verification email."
            )

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None

    try:
        db.commit()
        db.refresh(user)
    except Exception as exc:
        db.rollback()
        logger.error("DB error during email verification: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not verify email. Please try again.",
        ) from exc

    logger.info("Email verified for user id=%d", user.id)
    return user
