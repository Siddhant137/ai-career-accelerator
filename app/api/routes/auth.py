"""
app/api/routes/auth.py
───────────────────────
Auth endpoints — Phase 2 + Phase 3.

    POST /auth/register              → create account
    POST /auth/login                 → get tokens
    POST /auth/refresh               → refresh access token
    GET  /auth/me                    → current user
    PUT  /auth/me/password           → change password
    POST /auth/forgot-password       → request reset email  [Phase 3]
    POST /auth/reset-password        → reset with token     [Phase 3]
    POST /auth/verify-email          → verify email token   [Phase 3]
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.core.exceptions import (
    InvalidCredentialsError,
    InvalidTokenError,
    UserAlreadyExistsError,
)
from app.core.logging import get_logger
from app.db.models import PasswordResetToken, User
from app.db.session import get_db
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
)
from app.schemas.phase3 import ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest
from app.services.auth_service import (
    authenticate_user,
    change_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_user_by_email,
    get_user_by_id,
    hash_password,
    register_user,
)

# Email service imported lazily inside routes so a broken email config
# does NOT prevent the router from loading and crashing all auth endpoints.

router   = APIRouter(prefix="/auth", tags=["Authentication"])
logger   = get_logger(__name__)
settings = get_settings()


# ── Register ───────────────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    try:
        user = register_user(db, payload)
    except UserAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except Exception as exc:
        logger.error("Unexpected error during register: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed due to a server error. Please try again.",
        )

    # Send verification email — failure must never block registration.
    # verification_token column must exist on User; if it doesn't,
    # add it via a migration before enabling this block.
    if hasattr(user, "verification_token"):
        try:
            token = secrets.token_urlsafe(32)
            user.verification_token = token
            db.commit()

            from app.services.email_service import send_verification_email  # lazy import
            send_verification_email(user.email, user.full_name, token)
        except Exception as e:
            logger.warning("Verification email failed (non-fatal): %s", e)

    return RegisterResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


# ── Login ──────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = authenticate_user(db, payload.email, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


# ── Refresh ────────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user_id = decode_refresh_token(payload.refresh_token)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


# ── Current user ───────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


# ── Change password ────────────────────────────────────────────────────────────

@router.put("/me/password", status_code=status.HTTP_200_OK)
def update_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        change_password(db, current_user, payload.current_password, payload.new_password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"message": "Password updated successfully."}


# ── Phase 3: Password Reset ────────────────────────────────────────────────────

@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Request password reset email",
)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> dict:
    _GENERIC = {"message": "If that email exists, a reset link has been sent."}

    user = get_user_by_email(db, payload.email)
    if not user:
        return _GENERIC  # Prevent email enumeration

    token = secrets.token_urlsafe(32)
    reset = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        used=False,
    )
    db.add(reset)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("DB error saving reset token: %s", exc, exc_info=True)
        return _GENERIC  # Still return generic — don't leak DB errors

    try:
        from app.services.email_service import send_password_reset_email  # lazy import
        send_password_reset_email(user.email, user.full_name, token)
    except Exception as e:
        logger.error("Password reset email failed: %s", e)

    return _GENERIC


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Reset password with token",
)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    reset = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token == payload.token,
            PasswordResetToken.used == False,  # noqa: E712
        )
        .first()
    )

    if not reset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    # Normalise timezone — DB may return naive datetime
    expires_at = reset.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    user = get_user_by_id(db, reset.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found.",
        )

    user.hashed_password = hash_password(payload.new_password)
    reset.used = True

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("DB error during password reset: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not reset password. Please try again.",
        )

    logger.info("Password reset for user id=%d", user.id)
    return {"message": "Password reset successfully. Please login."}


# ── Phase 3: Email Verification ────────────────────────────────────────────────

@router.post(
    "/verify-email",
    status_code=status.HTTP_200_OK,
    summary="Verify email address",
)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.verification_token == payload.token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token.",
        )

    if user.is_verified:
        return {"message": "Email already verified."}

    user.is_verified = True
    user.verification_token = None

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("DB error during email verification: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not verify email. Please try again.",
        )

    logger.info("Email verified for user id=%d", user.id)
    return {"message": "Email verified successfully!"}