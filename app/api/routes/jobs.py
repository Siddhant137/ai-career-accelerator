"""
app/api/routes/jobs.py
───────────────────────
Job posting + matching endpoints — Phase 2 + Phase 3 notification integration.
"""

import asyncio
from functools import partial
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role, require_verified_candidate
from app.core.exceptions import GeminiAPIError, GeminiParseError, InsufficientPermissionsError
from app.core.logging import get_logger
from app.db.models import JobStatus, NotificationType, User, UserRole
from app.db.session import SessionLocal, get_db
from app.schemas.jobs import (
    JobPostingCreate, JobPostingResponse, JobPostingSummary,
    JobPostingUpdate, PaginatedJobs,
)
from app.schemas.match import (
    MatchResponse, MatchStatusUpdate, MatchWithCandidateResponse,
    MatchWithJobResponse, PaginatedMatches,
)
from app.services.auto_match_service import run_auto_match, run_auto_match_for_job
from app.services.email_service import send_rejected_email, send_shortlisted_email
from app.services.job_service import (
    get_jobs_filtered,
    create_job, delete_job, get_job_by_id, get_jobs,
    get_recruiter_jobs, update_job,
)
from app.services.match_service import (
    get_candidate_matches, get_job_matches,
    match_candidate_to_job, update_match_status,
)
from app.services.notification_service import create_notification

router = APIRouter(prefix="/jobs", tags=["Jobs"])
logger = get_logger(__name__)

_recruiter = Depends(require_role(UserRole.recruiter))
_candidate = Depends(require_role(UserRole.candidate))
_verified_candidate = Depends(require_verified_candidate)


def _run_auto_match_background(job_id: int) -> None:
    db = SessionLocal()
    try:
        run_auto_match_for_job(db, job_id)
    except Exception as exc:
        logger.error("Background auto-match failed for job_id=%d: %s", job_id, exc)
    finally:
        db.close()


@router.post("", response_model=JobPostingResponse, status_code=status.HTTP_201_CREATED)
def create_job_posting(
    payload: JobPostingCreate,
    background_tasks: BackgroundTasks,
    recruiter: User = _recruiter,
    db: Session = Depends(get_db),
):
    job = create_job(db, recruiter, payload)
    background_tasks.add_task(_run_auto_match_background, job.id)
    return JobPostingResponse.model_validate(job)


@router.post("/auto-match", summary="Run full auto-match scan (recruiter/admin)")
def trigger_auto_match(recruiter: User = _recruiter, db: Session = Depends(get_db)) -> dict:
    return run_auto_match(db)


@router.get("", response_model=PaginatedJobs)
def list_jobs(
    page:             int            = Query(default=1, ge=1),
    size:             int            = Query(default=10, ge=1, le=50),
    search:           Optional[str]  = Query(default=None),
    location:         Optional[str]  = Query(default=None),
    job_type:         Optional[str]  = Query(default=None),
    experience_level: Optional[str]  = Query(default=None),
    salary_contains:  Optional[str]  = Query(default=None, description="e.g. '80k', 'remote'"),
    db:               Session        = Depends(get_db),
):
    total, jobs = get_jobs_filtered(
        db, page, size,
        search=search,
        location=location,
        job_type=job_type,
        experience_level=experience_level,
        salary_contains=salary_contains,
    )
    return PaginatedJobs(
        total=total, page=page, size=size,
        results=[JobPostingSummary.model_validate(j) for j in jobs],
    )


@router.get("/mine", response_model=PaginatedJobs)
def list_my_jobs(page: int = Query(default=1, ge=1), size: int = Query(default=10, ge=1, le=50), recruiter: User = _recruiter, db: Session = Depends(get_db)):
    total, jobs = get_recruiter_jobs(db, recruiter, page, size)
    return PaginatedJobs(total=total, page=page, size=size, results=[JobPostingSummary.model_validate(j) for j in jobs])


@router.get("/matches/mine", response_model=PaginatedMatches)
def get_my_matches(page: int = Query(default=1, ge=1), size: int = Query(default=10, ge=1, le=50), candidate: User = _candidate, db: Session = Depends(get_db)):
    total, matches = get_candidate_matches(db, candidate, page, size)
    return PaginatedMatches(total=total, page=page, size=size, results=[MatchResponse.model_validate(m) for m in matches])


@router.get("/{job_id}", response_model=JobPostingResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
    return JobPostingResponse.model_validate(job)


@router.put("/{job_id}", response_model=JobPostingResponse)
def update_job_posting(job_id: int, payload: JobPostingUpdate, recruiter: User = _recruiter, db: Session = Depends(get_db)):
    try:
        job = update_job(db, recruiter, job_id, payload)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return JobPostingResponse.model_validate(job)


@router.delete("/{job_id}", status_code=200)
def close_job_posting(job_id: int, recruiter: User = _recruiter, db: Session = Depends(get_db)):
    try:
        delete_job(db, recruiter, job_id)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"message": f"Job {job_id} closed."}


@router.post("/{job_id}/match-me", response_model=MatchWithJobResponse)
async def match_me_to_job(
    job_id: int,
    candidate: User = _verified_candidate,
    db: Session = Depends(get_db),
):
    try:
        match = await asyncio.to_thread(partial(match_candidate_to_job, db, candidate, job_id))
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except (GeminiAPIError, GeminiParseError) as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return MatchWithJobResponse(
        id=match.id, candidate_id=match.candidate_id, job_id=match.job_id,
        score=match.score, missing_skills=match.missing_skills,
        recommended_project=match.recommended_project, summary=match.summary,
        status=match.status, recruiter_notes=match.recruiter_notes,
        created_at=match.created_at,
        job_title=match.job.title, job_company=match.job.company,
        job_location=match.job.location,
    )


@router.get("/{job_id}/candidates", response_model=PaginatedMatches)
def get_job_candidates(job_id: int, page: int = Query(default=1, ge=1), size: int = Query(default=10, ge=1, le=50), recruiter: User = _recruiter, db: Session = Depends(get_db)):
    try:
        total, matches = get_job_matches(db, recruiter, job_id, page, size)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return PaginatedMatches(total=total, page=page, size=size, results=[MatchResponse.model_validate(m) for m in matches])


@router.put("/{job_id}/matches/{match_id}", response_model=MatchResponse)
def update_candidate_match_status(
    job_id: int, match_id: int, payload: MatchStatusUpdate,
    recruiter: User = _recruiter, db: Session = Depends(get_db),
):
    try:
        match = update_match_status(db, recruiter, match_id, payload)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # ── Phase 3: Notify candidate of status change ─────────────────────────────
    if payload.status.value == "shortlisted":
        create_notification(
            db, match.candidate_id,
            NotificationType.shortlisted,
            "You've been shortlisted! 🎉",
            f"You were shortlisted for {match.job.title} at {match.job.company}.",
            {"job_id": job_id, "match_id": match_id},
        )
        if match.candidate.email_notifications:
            try:
                send_shortlisted_email(
                    match.candidate.email, match.candidate.full_name,
                    match.job.title, match.job.company,
                    payload.recruiter_notes or "",
                )
            except Exception as e:
                logger.warning("Shortlist email failed: %s", e)

    elif payload.status.value == "rejected":
        create_notification(
            db, match.candidate_id,
            NotificationType.rejected,
            "Application Update",
            f"Your application for {match.job.title} at {match.job.company} was not selected.",
            {"job_id": job_id, "match_id": match_id},
        )
        if match.candidate.email_notifications:
            try:
                send_rejected_email(
                    match.candidate.email,
                    match.candidate.full_name,
                    match.job.title,
                    match.job.company,
                )
            except Exception as e:
                logger.warning("Rejection email failed: %s", e)

    return MatchResponse.model_validate(match)