"""
app/api/routes/health.py
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db

router = APIRouter(tags=["Health"])
settings = get_settings()


@router.get("/health", summary="Liveness probe")
def liveness() -> dict:
    return {"status": "ok", "env": settings.app_env}


@router.get("/health/db", summary="Readiness probe — checks DB connectivity")
def readiness(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:
        db_status = f"error: {exc}"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
    }


@router.get("/health/email", summary="Email + allowlist configuration")
def email_health() -> dict:
    from app.services.email_service import get_email_delivery_status

    info = get_email_delivery_status()
    allowlist = info["allowlist"]
    return {
        "status": "ok" if allowlist["enabled"] or info["mode"] != "console" else "not_configured",
        **info,
        "hint": (
            "Set EMAIL_ALLOWLIST=you@gmail.com,friend@gmail.com in .env and restart the API. "
            "See GET /health/email to verify."
            if not allowlist["enabled"]
            else f"Allowlist active: {allowlist['count']} address(es). "
            + ("Registration is invite-only." if allowlist["enforce_registration"] else "Anyone may register; only allowlisted emails receive mail.")
        ),
    }