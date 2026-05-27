"""
Restrict who can register and who receives emails (you + friends only).
Configure via EMAIL_ALLOWLIST in .env (comma-separated addresses).
"""

from functools import lru_cache

from fastapi import HTTPException, status

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_email_allowlist() -> frozenset[str] | None:
    """None = no restriction. Otherwise only these addresses (lowercase)."""
    raw = get_settings().email_allowlist.strip()
    if not raw:
        return None
    emails = {e.strip().lower() for e in raw.split(",") if e.strip()}
    return frozenset(emails) if emails else None


def is_email_allowlisted(email: str) -> bool:
    allowlist = get_email_allowlist()
    if allowlist is None:
        return True
    return email.strip().lower() in allowlist


def assert_registration_allowed(email: str) -> None:
    settings = get_settings()
    if not settings.email_allowlist_enforce_registration:
        return
    if get_email_allowlist() is None:
        return
    if not is_email_allowlisted(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Registration is invite-only. Add your email to EMAIL_ALLOWLIST in the "
                "server .env file, then restart the API."
            ),
        )


def allowlist_status() -> dict:
    allowlist = get_email_allowlist()
    settings = get_settings()
    if allowlist is None:
        return {
            "enabled": False,
            "count": 0,
            "emails": [],
            "enforce_registration": settings.email_allowlist_enforce_registration,
        }
    emails = sorted(allowlist)
    return {
        "enabled": True,
        "count": len(emails),
        "emails": emails if settings.app_env == "development" else [],
        "enforce_registration": settings.email_allowlist_enforce_registration,
    }
