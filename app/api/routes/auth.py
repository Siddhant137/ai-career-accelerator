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
    GET  /auth/verify                → verify email via link [Phase 3]
    POST /auth/verify-email          → verify email token   [Phase 3]
"""

import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
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
    from app.core.email_allowlist import assert_registration_allowed

    assert_registration_allowed(payload.email)

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

    try:
        token = secrets.token_urlsafe(32)
        from app.services.verification_service import set_verification_token
        set_verification_token(user, token)
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
        message="Account created. Please check your email to verify your address.",
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

@router.get(
    "/verify",
    summary="Verify email address (link from email)",
)
def verify_email_get(
    token: str = Query(..., description="Verification token from email"),
    db: Session = Depends(get_db),
):
    from app.services.verification_service import VerificationError, verify_user_email

    try:
        verify_user_email(db, token)
        return RedirectResponse(
            url=f"{settings.frontend_url}/login?verified=1",
            status_code=status.HTTP_302_FOUND,
        )
    except VerificationError as exc:
        return RedirectResponse(
            url=(
                f"{settings.frontend_url}/verify?token={quote(token)}"
                f"&error={quote(str(exc))}"
            ),
            status_code=status.HTTP_302_FOUND,
        )


@router.post(
    "/verify-email",
    status_code=status.HTTP_200_OK,
    summary="Verify email address",
)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> dict:
    from app.services.verification_service import VerificationError, verify_user_email

    try:
        verify_user_email(db, payload.token)
    except VerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return {"message": "Email verified successfully!"}


@router.post(
    "/resend-verification",
    status_code=status.HTTP_200_OK,
    summary="Resend verification email",
)
def resend_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if current_user.is_verified:
        return {"message": "Email is already verified."}

    try:
        token = secrets.token_urlsafe(32)
        from app.services.verification_service import set_verification_token
        set_verification_token(current_user, token)
        db.commit()

        from app.services.email_service import send_verification_email
        send_verification_email(current_user.email, current_user.full_name, token)
    except Exception as e:
        logger.warning("Resend verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not send verification email. Try again later.",
        ) from e

    return {"message": "Verification email sent. Please check your inbox."}