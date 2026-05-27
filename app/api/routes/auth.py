"""
app/api/routes/auth.py
───────────────────────
Auth endpoints — Phase 2 + Phase 3 additions.

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
    InvalidCredentialsError, InvalidTokenError, UserAlreadyExistsError,
)
from app.core.logging import get_logger
from app.db.models import PasswordResetToken, User
from app.db.session import get_db
from app.schemas.auth import (
    ChangePasswordRequest, LoginRequest, RefreshRequest,
    RegisterRequest, RegisterResponse, TokenResponse, UserResponse,
)
from app.schemas.phase3 import ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest
from app.services.auth_service import (
    authenticate_user, change_password, create_access_token,
    create_refresh_token, decode_refresh_token, get_user_by_email,
    get_user_by_id, hash_password, register_user,
)
from app.services.email_service import send_password_reset_email, send_verification_email

router   = APIRouter(prefix="/auth", tags=["Authentication"])
logger   = get_logger(__name__)
settings = get_settings()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    try:
        user = register_user(db, payload)
    except UserAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    # Send verification email
    token = secrets.token_urlsafe(32)
    user.verification_token = token
    db.commit()
    try:
        send_verification_email(user.email, user.full_name, token)
    except Exception as e:
        logger.warning("Verification email failed: %s", e)

    return RegisterResponse(id=user.id, email=user.email, full_name=user.full_name, role=user.role)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = authenticate_user(db, payload.email, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc), headers={"WWW-Authenticate": "Bearer"})

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user_id = decode_refresh_token(payload.refresh_token)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


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

@router.post("/forgot-password", status_code=status.HTTP_200_OK, summary="Request password reset email")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> dict:
    user = get_user_by_email(db, payload.email)
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If that email exists, a reset link has been sent."}

    token = secrets.token_urlsafe(32)
    reset = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(reset)
    db.commit()

    try:
        send_password_reset_email(user.email, user.full_name, token)
    except Exception as e:
        logger.error("Password reset email failed: %s", e)

    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK, summary="Reset password with token")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    reset = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == payload.token,
        PasswordResetToken.used == False,
    ).first()

    if not reset or reset.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")

    user = get_user_by_id(db, reset.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found.")

    user.hashed_password = hash_password(payload.new_password)
    reset.used = True
    db.commit()
    logger.info("Password reset for user id=%d", user.id)
    return {"message": "Password reset successfully. Please login."}


# ── Phase 3: Email Verification ────────────────────────────────────────────────

@router.post("/verify-email", status_code=status.HTTP_200_OK, summary="Verify email address")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.verification_token == payload.token).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token.")

    if user.is_verified:
        return {"message": "Email already verified."}

    user.is_verified = True
    user.verification_token = None
    db.commit()
    logger.info("Email verified for user id=%d", user.id)
    return {"message": "Email verified successfully!"}