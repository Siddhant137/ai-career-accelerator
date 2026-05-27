"""
app/services/company_service.py
─────────────────────────────────
Phase 3 Step 5: Recruiter Company Profiles.
"""

from sqlalchemy.orm import Session
from app.core.exceptions import InsufficientPermissionsError
from app.core.logging import get_logger
from app.db.models import User, UserRole

logger = get_logger(__name__)


def get_company_profile(db: Session, recruiter_id: int) -> User:
    """Return a recruiter's company profile by user ID."""
    user = db.query(User).filter(
        User.id == recruiter_id,
        User.role == UserRole.recruiter,
        User.is_active == True,
    ).first()
    if not user:
        raise InsufficientPermissionsError(f"Company profile {recruiter_id} not found.")
    return user


def update_company_profile(db: Session, recruiter: User, data: dict) -> User:
    """Update recruiter's company profile fields."""
    if recruiter.role != UserRole.recruiter:
        raise InsufficientPermissionsError("Only recruiters can update company profiles.")

    allowed_fields = {
        "company_name", "company_description", "company_website",
        "company_size", "company_industry", "company_logo_url",
        "full_name", "location",
    }
    for field, value in data.items():
        if field in allowed_fields and value is not None:
            setattr(recruiter, field, value)

    db.commit()
    db.refresh(recruiter)
    logger.info("Company profile updated for recruiter id=%d", recruiter.id)
    return recruiter


def list_companies(db: Session, page: int = 1, size: int = 10) -> tuple[int, list[User]]:
    """Return paginated list of recruiter company profiles."""
    query = db.query(User).filter(
        User.role == UserRole.recruiter,
        User.is_active == True,
        User.company_name != None,
    ).order_by(User.created_at.desc())
    total   = query.count()
    results = query.offset((page - 1) * size).limit(size).all()
    return total, results