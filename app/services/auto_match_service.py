"""
app/services/auto_match_service.py
────────────────────────────────────
Auto-matching engine: scores candidates against jobs and notifies top matches.
Triggered when a recruiter posts a job and on a periodic schedule.
"""

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import (
    CandidateResume,
    JobPosting,
    JobStatus,
    Match,
    Notification,
    NotificationType,
    ResumeAnalysis,
    User,
    UserRole,
)
from app.services.email_service import send_new_match_email
from app.services.resume_library_service import (
    get_resumes_for_matching,
    score_best_resume_for_job,
)

logger   = get_logger(__name__)
settings = get_settings()


def _active_candidates_with_resumes(db: Session) -> list[User]:
    library_user_ids = [
        r.user_id for r in db.query(CandidateResume.user_id).distinct().all()
    ]
    analysis_user_ids = [
        r.user_id
        for r in db.query(ResumeAnalysis.user_id).distinct().all()
        if r.user_id is not None
    ]
    candidate_ids = set(library_user_ids) | set(analysis_user_ids)
    if not candidate_ids:
        return []

    return db.query(User).filter(
        User.id.in_(candidate_ids),
        User.role == UserRole.candidate,
        User.is_active == True,
        User.is_verified == True,
    ).all()


def _notify_candidate_match(
    db: Session,
    candidate: User,
    job: JobPosting,
    score: int,
) -> None:
    if score < settings.auto_match_min_score:
        return

    notif = Notification(
        user_id=candidate.id,
        type=NotificationType.match_created,
        title="New Job Match Found! ⚡",
        message=f"You matched {score}/100 for {job.title} at {job.company}",
        data={"job_id": job.id, "match_score": score},
    )
    db.add(notif)

    if candidate.email_notifications:
        try:
            send_new_match_email(
                email=candidate.email,
                full_name=candidate.full_name,
                job_title=job.title,
                company=job.company,
                score=score,
            )
        except Exception as e:
            logger.warning("Email failed for user_id=%d: %s", candidate.id, e)


def _create_match_for_candidate(
    db: Session,
    candidate: User,
    job: JobPosting,
) -> tuple[bool, bool]:
    """
    Score candidate against job and create a match if none exists.
    Returns (match_created, notification_sent).
    """
    existing = db.query(Match).filter(
        Match.candidate_id == candidate.id,
        Match.job_id == job.id,
    ).first()
    if existing:
        return False, False

    if not get_resumes_for_matching(db, candidate):
        return False, False

    try:
        result, _ = score_best_resume_for_job(
            db, candidate, job.description, job.job_type
        )
    except Exception as exc:
        logger.error(
            "Auto-match failed: candidate_id=%d job_id=%d error=%s",
            candidate.id, job.id, exc,
        )
        return False, False

    from app.db.models import MatchStatus

    match = Match(
        candidate_id=candidate.id,
        job_id=job.id,
        score=result.score,
        missing_skills=result.missing_skills,
        recommended_project=result.recommended_project,
        summary=result.summary,
        status=MatchStatus.pending,
    )
    db.add(match)
    db.flush()

    notified = result.score >= settings.auto_match_min_score
    if notified:
        _notify_candidate_match(db, candidate, job, result.score)

    return True, notified


def run_auto_match_for_job(db: Session, job_id: int) -> dict:
    """
    Score all verified candidates against a single newly posted job.
    Notifies candidates with score >= auto_match_min_score (default 70).
    """
    if not settings.auto_match_enabled:
        logger.info("Auto-match disabled — skipping job_id=%d", job_id)
        return {"skipped": True, "job_id": job_id}

    job = db.query(JobPosting).filter(
        JobPosting.id == job_id,
        JobPosting.status == JobStatus.active,
    ).first()
    if not job:
        return {"skipped": True, "job_id": job_id, "reason": "job_not_found"}

    logger.info(
        "Auto-match for job_id=%d title=%r (min_score=%d)",
        job.id, job.title, settings.auto_match_min_score,
    )

    candidates = _active_candidates_with_resumes(db)
    matches_created = 0
    notifications_sent = 0

    for candidate in candidates:
        created, notified = _create_match_for_candidate(db, candidate, job)
        if created:
            matches_created += 1
        if notified:
            notifications_sent += 1

    db.commit()
    summary = {
        "job_id": job_id,
        "candidates": len(candidates),
        "matches_created": matches_created,
        "notifications_sent": notifications_sent,
    }
    logger.info("Auto-match for job complete: %s", summary)
    return summary


def run_auto_match(db: Session) -> dict:
    """
    Score all active candidates against all active jobs (periodic full scan).
    Only creates matches that don't already exist.
    """
    if not settings.auto_match_enabled:
        logger.info("Auto-match disabled — skipping")
        return {"skipped": True}

    logger.info("Auto-match started (min_score=%d)", settings.auto_match_min_score)

    active_jobs = db.query(JobPosting).filter(JobPosting.status == JobStatus.active).all()
    if not active_jobs:
        logger.info("No active jobs — auto-match complete")
        return {"jobs": 0, "candidates": 0, "matches_created": 0, "notifications_sent": 0}

    candidates = _active_candidates_with_resumes(db)
    matches_created = 0
    notifications_sent = 0

    for job in active_jobs:
        for candidate in candidates:
            created, notified = _create_match_for_candidate(db, candidate, job)
            if created:
                matches_created += 1
            if notified:
                notifications_sent += 1

    db.commit()
    summary = {
        "jobs": len(active_jobs),
        "candidates": len(candidates),
        "matches_created": matches_created,
        "notifications_sent": notifications_sent,
    }
    logger.info("Auto-match complete: %s", summary)
    return summary
