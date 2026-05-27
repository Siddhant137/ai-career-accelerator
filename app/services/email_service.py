"""
app/services/email_service.py
──────────────────────────────
Phase 3 Step 1: Email service using Resend.
Handles verification emails and password reset emails.
Falls back to console logging when RESEND_API_KEY is not set (development).
"""

import resend
from app.core.config import get_settings
from app.core.exceptions import EmailServiceError
from app.core.logging import get_logger

logger   = get_logger(__name__)
settings = get_settings()


def _send(to: str, subject: str, html: str) -> None:
    """Internal send helper. Falls back to log in dev when key not set."""
    if not settings.resend_api_key:
        logger.info("EMAIL (dev mode) to=%s subject=%s", to, subject)
        logger.info("HTML preview: %s", html[:200])
        return

    resend.api_key = settings.resend_api_key
    try:
        resend.Emails.send({
            "from": settings.email_from,
            "to":   [to],
            "subject": subject,
            "html": html,
        })
        logger.info("Email sent to=%s subject=%s", to, subject)
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
        raise EmailServiceError(f"Failed to send email: {exc}") from exc


def send_verification_email(email: str, full_name: str, token: str) -> None:
    """Send account verification email."""
    url = f"{settings.frontend_url}/verify?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#0f0f1a;color:#e2e8f0;border-radius:16px;">
        <h1 style="background:linear-gradient(135deg,#a78bfa,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:28px;">
            Welcome to CareerAI ⚡
        </h1>
        <p style="color:#94a3b8;">Hi {full_name},</p>
        <p style="color:#94a3b8;">Thanks for joining CareerAI! Please verify your email address to get started.</p>
        <a href="{url}" style="display:inline-block;margin:24px 0;padding:12px 32px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;border-radius:12px;text-decoration:none;font-weight:600;">
            Verify Email Address
        </a>
        <p style="color:#475569;font-size:12px;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
    </div>
    """
    _send(email, "Verify your CareerAI account", html)


def send_password_reset_email(email: str, full_name: str, token: str) -> None:
    """Send password reset email."""
    url = f"{settings.frontend_url}/reset-password?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#0f0f1a;color:#e2e8f0;border-radius:16px;">
        <h1 style="color:#f87171;font-size:24px;">Password Reset Request</h1>
        <p style="color:#94a3b8;">Hi {full_name},</p>
        <p style="color:#94a3b8;">We received a request to reset your password. Click below to set a new one.</p>
        <a href="{url}" style="display:inline-block;margin:24px 0;padding:12px 32px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;border-radius:12px;text-decoration:none;font-weight:600;">
            Reset Password
        </a>
        <p style="color:#475569;font-size:12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>
    """
    _send(email, "Reset your CareerAI password", html)


def send_shortlisted_email(email: str, full_name: str, job_title: str, company: str, notes: str) -> None:
    """Notify candidate they were shortlisted."""
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#0f0f1a;color:#e2e8f0;border-radius:16px;">
        <h1 style="color:#4ade80;font-size:24px;">🎉 You've Been Shortlisted!</h1>
        <p style="color:#94a3b8;">Hi {full_name},</p>
        <p style="color:#94a3b8;">Congratulations! You've been shortlisted for <strong style="color:#a78bfa;">{job_title}</strong> at <strong style="color:#38bdf8;">{company}</strong>.</p>
        {f'<div style="background:rgba(167,139,250,0.1);border-left:3px solid #a78bfa;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;"><p style="color:#94a3b8;margin:0;font-size:14px;">{notes}</p></div>' if notes else ''}
        <a href="{settings.frontend_url}/matches" style="display:inline-block;margin:24px 0;padding:12px 32px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;border-radius:12px;text-decoration:none;font-weight:600;">
            View My Matches
        </a>
    </div>
    """
    _send(email, f"You've been shortlisted for {job_title} at {company}!", html)


def send_new_match_email(email: str, full_name: str, job_title: str, company: str, score: int) -> None:
    """Notify candidate of a new auto-match."""
    color = "#4ade80" if score >= 75 else "#fbbf24" if score >= 50 else "#f87171"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#0f0f1a;color:#e2e8f0;border-radius:16px;">
        <h1 style="background:linear-gradient(135deg,#a78bfa,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:24px;">
            New Job Match Found! ⚡
        </h1>
        <p style="color:#94a3b8;">Hi {full_name},</p>
        <p style="color:#94a3b8;">We found a new job that matches your profile:</p>
        <div style="background:rgba(15,15,30,0.8);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:20px;margin:16px 0;">
            <p style="color:white;font-size:18px;font-weight:600;margin:0 0 4px;">{job_title}</p>
            <p style="color:#a78bfa;margin:0 0 12px;">{company}</p>
            <p style="color:{color};font-size:36px;font-weight:800;margin:0;">{score}<span style="color:#475569;font-size:14px;">/100</span></p>
        </div>
        <a href="{settings.frontend_url}/matches" style="display:inline-block;margin:24px 0;padding:12px 32px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;border-radius:12px;text-decoration:none;font-weight:600;">
            View Match Details
        </a>
    </div>
    """
    _send(email, f"New job match: {job_title} at {company} ({score}/100)", html)