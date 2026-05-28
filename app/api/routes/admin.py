"""
app/api/routes/admin.py
────────────────────────
Admin-only endpoints.

    GET  /admin/stats          → platform statistics
    GET  /admin/users          → paginated user list
    PUT  /admin/users/{id}     → activate / deactivate user
    GET  /admin/jobs           → all jobs
    DELETE /admin/jobs/{id}    → remove any job
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.logging import get_logger
from app.db.models import JobPosting, Match, ResumeAnalysis, User, UserRole
from app.db.session import get_db
from app.schemas.admin import (
    AdminUserResponse, AdminJobResponse,
    PaginatedAdminUsers, PaginatedAdminJobs,
)

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = get_logger(__name__)

_admin = Depends(require_role(UserRole.admin))


@router.get("/users", response_model=PaginatedAdminUsers, summary="List all users")
def list_users(
    page:   int = Query(default=1, ge=1),
    size:   int = Query(default=20, ge=1, le=100),
    search: str = Query(default=""),
    role:   str = Query(default=""),
    admin:  User = _admin,
    db:     Session = Depends(get_db),
) -> PaginatedAdminUsers:
    q = db.query(User)
    if search:
        q = q.filter(
            User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )
    if role:
        try:
            q = q.filter(User.role == UserRole(role))
        except ValueError:
            pass
    total   = q.count()
    results = q.order_by(User.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return PaginatedAdminUsers(
        total=total, page=page, size=size,
        results=[AdminUserResponse.model_validate(u) for u in results],
    )


@router.put("/users/{user_id}", summary="Activate or deactivate a user")
def toggle_user(
    user_id: int,
    active:  bool,
    admin:   User = _admin,
    db:      Session = Depends(get_db),
) -> dict:
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = active
    db.commit()
    logger.info("Admin id=%d set user id=%d is_active=%s", admin.id, user_id, active)
    return {"message": f"User {'activated' if active else 'deactivated'}."}


@router.get("/jobs", response_model=PaginatedAdminJobs, summary="List all jobs")
def list_all_jobs(
    page:  int = Query(default=1, ge=1),
    size:  int = Query(default=20, ge=1, le=100),
    admin: User = _admin,
    db:    Session = Depends(get_db),
) -> PaginatedAdminJobs:
    total   = db.query(JobPosting).count()
    results = (
        db.query(JobPosting)
        .order_by(JobPosting.created_at.desc())
        .offset((page - 1) * size).limit(size).all()
    )
    return PaginatedAdminJobs(
        total=total, page=page, size=size,
        results=[AdminJobResponse.model_validate(j) for j in results],
    )


@router.delete("/jobs/{job_id}", summary="Remove any job posting")
def delete_job(
    job_id: int,
    admin:  User = _admin,
    db:     Session = Depends(get_db),
) -> dict:
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    db.delete(job)
    db.commit()
    logger.info("Admin id=%d deleted job id=%d", admin.id, job_id)
    return {"message": f"Job {job_id} deleted."}