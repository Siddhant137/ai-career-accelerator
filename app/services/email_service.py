"""
app/services/email_service.py
──────────────────────────────
Email service using SMTP (Gmail) with smtplib.
No third-party SDK needed — uses Python's built-in library.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings
from app.core.email_allowlist import allowlist_status
from app.core.logging import get_logger

logger   = get_logger(__name__)
settings = get_settings()


def _send(to: str, subject: str, html: str) -> None:
    """Send an email via SMTP. Falls back to console log in dev."""
    if settings.email_mode == "console":
        logger.info("EMAIL (console mode) to=%s subject=%s", to, subject)
        return

    if not settings.smtp_user or not settings.smtp_password:
        logger.info("EMAIL (dev mode — no SMTP creds) to=%s subject=%s", to, subject)
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = settings.email_from or settings.smtp_user
        msg["To"]      = to
        msg.attach(MIMEText(html, "html"))

        if settings.smtp_use_tls:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(msg["From"], [to], msg.as_string())
        else:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(msg["From"], [to], msg.as_string())

        logger.info("Email sent to=%s subject=%s", to, subject)

    except smtplib.SMTPAuthenticationError as exc:
        logger.error("SMTP auth failed — check SMTP_USER and SMTP_PASSWORD (use App Password for Gmail)")
        raise RuntimeError("SMTP authentication failed.") from exc
    except smtplib.SMTPException as exc:
        logger.error("SMTP error: %s", exc)
        raise RuntimeError("SMTP delivery failed.") from exc
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
        raise RuntimeError("Email delivery failed.") from exc


def send_verification_email(email: str, full_name: str, token: str) -> None:
    url = f"{settings.frontend_url}/verify?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;
                background:#0f0f1a;color:#e2e8f0;border-radius:16px;">
        <h1 style="background:linear-gradient(135deg,#a78bfa,#38bdf8);
                   -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                   font-size:28px;">Welcome to CareerAI ⚡</h1>
        <p style="color:#94a3b8;">Hi {full_name},</p>
        <p style="color:#94a3b8;">Please verify your email to get started.</p>
        <a href="{url}" style="display:inline-block;margin:24px 0;padding:12px 32px;
                               background:linear-gradient(135deg,#7c3aed,#2563eb);
                               color:white;border-radius:12px;text-decoration:none;
                               font-weight:600;">Verify Email</a>
        <p style="color:#475569;font-size:12px;">Link expires in 24 hours.</p>
    </div>
    """
    _send(email, "Verify your CareerAI account", html)


def send_password_reset_email(email: str, full_name: str, token: str) -> None:
    url = f"{settings.frontend_url}/reset-password?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;
                background:#0f0f1a;color:#e2e8f0;border-radius:16px;">
        <h1 style="color:#f87171;font-size:24px;">Password Reset</h1>
        <p style="color:#94a3b8;">Hi {full_name},</p>
        <p style="color:#94a3b8;">Click below to reset your password.</p>
        <a href="{url}" style="display:inline-block;margin:24px 0;padding:12px 32px;
                               background:linear-gradient(135deg,#7c3aed,#2563eb);
                               color:white;border-radius:12px;text-decoration:none;
                               font-weight:600;">Reset Password</a>
        <p style="color:#475569;font-size:12px;">Expires in 1 hour.</p>
    </div>
    """
    _send(email, "Reset your CareerAI password", html)


def send_shortlisted_email(email: str, full_name: str, job_title: str,
                            company: str, notes: str) -> None:
    notes_block = (
        f'<div style="background:rgba(167,139,250,0.1);border-left:3px solid #a78bfa;'
        f'padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;">'
        f'<p style="color:#94a3b8;margin:0;font-size:14px;">{notes}</p></div>'
        if notes else ""
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;
                background:#0f0f1a;color:#e2e8f0;border-radius:16px;">
        <h1 style="color:#4ade80;font-size:24px;">🎉 You've Been Shortlisted!</h1>
        <p style="color:#94a3b8;">Hi {full_name},</p>
        <p style="color:#94a3b8;">You've been shortlisted for
            <strong style="color:#a78bfa;">{job_title}</strong> at
            <strong style="color:#38bdf8;">{company}</strong>.</p>
        {notes_block}
        <a href="{settings.frontend_url}/matches"
           style="display:inline-block;margin:24px 0;padding:12px 32px;
                  background:linear-gradient(135deg,#7c3aed,#2563eb);
                  color:white;border-radius:12px;text-decoration:none;
                  font-weight:600;">View My Matches</a>
    </div>
    """
    _send(email, f"Shortlisted for {job_title} at {company}!", html)


def send_new_match_email(email: str, full_name: str, job_title: str,
                          company: str, score: int) -> None:
    color = "#4ade80" if score >= 75 else "#fbbf24" if score >= 50 else "#f87171"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;
                background:#0f0f1a;color:#e2e8f0;border-radius:16px;">
        <h1 style="background:linear-gradient(135deg,#a78bfa,#38bdf8);
                   -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                   font-size:24px;">New Job Match! ⚡</h1>
        <p style="color:#94a3b8;">Hi {full_name}, we found a new match:</p>
        <div style="background:rgba(15,15,30,0.8);border:1px solid rgba(99,102,241,0.3);
                    border-radius:12px;padding:20px;margin:16px 0;">
            <p style="color:white;font-size:18px;font-weight:600;margin:0 0 4px;">{job_title}</p>
            <p style="color:#a78bfa;margin:0 0 12px;">{company}</p>
            <p style="color:{color};font-size:36px;font-weight:800;margin:0;">
                {score}<span style="color:#475569;font-size:14px;">/100</span></p>
        </div>
        <a href="{settings.frontend_url}/matches"
           style="display:inline-block;margin:24px 0;padding:12px 32px;
                  background:linear-gradient(135deg,#7c3aed,#2563eb);
                  color:white;border-radius:12px;text-decoration:none;
                  font-weight:600;">View Match</a>
    </div>
    """
    _send(email, f"New match: {job_title} at {company} ({score}/100)", html)


def send_rejected_email(email: str, full_name: str, job_title: str, company: str) -> None:
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;
                background:#0f0f1a;color:#e2e8f0;border-radius:16px;">
        <h1 style="color:#f87171;font-size:24px;">Application Update</h1>
        <p style="color:#94a3b8;">Hi {full_name},</p>
        <p style="color:#94a3b8;">
            Thanks for applying to <strong style="color:#a78bfa;">{job_title}</strong> at
            <strong style="color:#38bdf8;">{company}</strong>.
        </p>
        <p style="color:#94a3b8;">
            This role moved forward with other candidates, but we encourage you to keep applying.
        </p>
        <a href="{settings.frontend_url}/jobs"
           style="display:inline-block;margin:24px 0;padding:12px 32px;
                  background:linear-gradient(135deg,#7c3aed,#2563eb);
                  color:white;border-radius:12px;text-decoration:none;
                  font-weight:600;">Browse More Jobs</a>
    </div>
    """
    _send(email, f"Update on your {job_title} application", html)


def get_email_delivery_status() -> dict:
    """Return email delivery configuration and allowlist status for health checks."""
    mode = settings.email_mode
    smtp_configured = bool(
        settings.smtp_host and settings.smtp_user and settings.smtp_password
    )
    return {
        "mode": mode,
        "from": settings.email_from or settings.smtp_user or "",
        "smtp": {
            "host": settings.smtp_host,
            "port": settings.smtp_port,
            "use_tls": settings.smtp_use_tls,
            "configured": smtp_configured,
        },
        "allowlist": allowlist_status(),
    }