"""
app/services/resume_library_service.py
───────────────────────────────────────
Candidate resume library — one resume per role type for smarter matching.
"""

from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import InsufficientPermissionsError
from app.core.logging import get_logger
from app.db.models import CandidateResume, ResumeAnalysis, User, UserRole
from app.services.gemini_service import score_resume
from app.schemas.resume import ResumeScoreResponse

logger = get_logger(__name__)

ALLOWED_ROLE_TYPES = frozenset({
    "general",
    "backend",
    "frontend",
    "fullstack",
    "data",
    "devops",
    "mobile",
    "product",
})


def normalize_role_type(role_type: str) -> str:
    normalized = role_type.strip().lower().replace(" ", "_")
    if normalized not in ALLOWED_ROLE_TYPES:
        raise InsufficientPermissionsError(
            f"Invalid role_type '{role_type}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_ROLE_TYPES))}."
        )
    return normalized


def upsert_candidate_resume(
    db: Session,
    user: User,
    role_type: str,
    resume_text: str,
    original_filename: Optional[str] = None,
) -> CandidateResume:
    if user.role != UserRole.candidate:
        raise InsufficientPermissionsError("Only candidates can manage resume library entries.")

    role = normalize_role_type(role_type)
    existing = (
        db.query(CandidateResume)
        .filter(CandidateResume.user_id == user.id, CandidateResume.role_type == role)
        .first()
    )
    if existing:
        existing.resume_text = resume_text
        existing.original_filename = original_filename
        db.commit()
        db.refresh(existing)
        logger.info("Updated resume library user_id=%d role=%s", user.id, role)
        return existing

    entry = CandidateResume(
        user_id=user.id,
        role_type=role,
        resume_text=resume_text,
        original_filename=original_filename,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.info("Created resume library user_id=%d role=%s", user.id, role)
    return entry


def list_candidate_resumes(db: Session, user: User) -> list[CandidateResume]:
    if user.role != UserRole.candidate:
        raise InsufficientPermissionsError("Only candidates have a resume library.")
    return (
        db.query(CandidateResume)
        .filter(CandidateResume.user_id == user.id)
        .order_by(CandidateResume.role_type.asc())
        .all()
    )


def delete_candidate_resume(db: Session, user: User, resume_id: int) -> None:
    entry = (
        db.query(CandidateResume)
        .filter(CandidateResume.id == resume_id, CandidateResume.user_id == user.id)
        .first()
    )
    if not entry:
        raise InsufficientPermissionsError(
            f"Resume {resume_id} not found or does not belong to you."
        )
    db.delete(entry)
    db.commit()


def get_resumes_for_matching(db: Session, candidate: User) -> list[tuple[str, Optional[str]]]:
    """
    Return (resume_text, role_type) pairs to score against a job.
    Uses the resume library when present; otherwise falls back to latest analysis.
    """
    library = (
        db.query(CandidateResume)
        .filter(CandidateResume.user_id == candidate.id)
        .order_by(CandidateResume.updated_at.desc())
        .all()
    )
    if library:
        return [(r.resume_text, r.role_type) for r in library]

    latest = (
        db.query(ResumeAnalysis)
        .filter(ResumeAnalysis.user_id == candidate.id)
        .order_by(ResumeAnalysis.created_at.desc())
        .first()
    )
    if latest:
        return [(latest.resume_text, None)]

    return []


def pick_role_type_for_job(job_type: Optional[str]) -> Optional[str]:
    if not job_type:
        return None
    normalized = job_type.strip().lower().replace(" ", "_")
    return normalized if normalized in ALLOWED_ROLE_TYPES else None


def score_best_resume_for_job(
    db: Session,
    candidate: User,
    job_description: str,
    job_type: Optional[str] = None,
) -> tuple[ResumeScoreResponse, Optional[str]]:
    """
    Score all available resumes and return the best result plus role_type used.
    """
    resumes = get_resumes_for_matching(db, candidate)
    if not resumes:
        raise InsufficientPermissionsError(
            "No resume found. Upload a role-specific resume or score one via "
            "POST /api/v1/score-resume before matching against jobs."
        )

    preferred = pick_role_type_for_job(job_type)
    ordered = resumes
    if preferred:
        preferred_entries = [r for r in resumes if r[1] == preferred]
        other_entries = [r for r in resumes if r[1] != preferred]
        ordered = preferred_entries + other_entries

    best_result: Optional[ResumeScoreResponse] = None
    best_role: Optional[str] = None

    for resume_text, role_type in ordered:
        result = score_resume(resume_text, job_description)
        if best_result is None or result.score > best_result.score:
            best_result = result
            best_role = role_type

    assert best_result is not None
    return best_result, best_role
