"""
app/services/auto_match_service.py
────────────────────────────────────
Phase 3 Step 2: Auto-Matching Engine.
Runs periodically to match all active candidates against all active jobs.
Sends email + in-app notifications for new high-score matches.
"""

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import (
    JobPosting, JobStatus, Match, MatchStatus,
    Notification, NotificationType, ResumeAnalysis, User, UserRole,
)
from app.services.email_service import send_new_match_email
from app.services.gemini_service import score_resume

logger   = get_logger(__name__)
settings = get_settings()


def run_auto_match(db: Session) -> dict:
    """
    Score all active candidates against all active jobs.
    Only creates matches that don't already exist.
    Notifies candidates with score >= auto_match_min_score.

    Returns a summary dict of what was processed.
    """
    if not settings.auto_match_enabled:
        logger.info("Auto-match disabled — skipping")
        return {"skipped": True}

    logger.info("Auto-match started (min_score=%d)", settings.auto_match_min_score)

    # Get all active jobs
    active_jobs = db.query(JobPosting).filter(JobPosting.status == JobStatus.active).all()
    if not active_jobs:
        logger.info("No active jobs — auto-match complete")
        return {"jobs": 0, "candidates": 0, "matches_created": 0}

    # Get all active candidates with at least one resume
    candidate_ids_with_resume = [
        r.user_id for r in db.query(ResumeAnalysis.user_id).distinct().all()
        if r.user_id is not None
    ]
    candidates = db.query(User).filter(
        User.id.in_(candidate_ids_with_resume),
        User.role == UserRole.candidate,
        User.is_active == True,
    ).all()

    matches_created = 0
    notifications_sent = 0

    for candidate in candidates:
        # Get latest resume
        latest_resume = (
            db.query(ResumeAnalysis)
            .filter(ResumeAnalysis.user_id == candidate.id)
            .order_by(ResumeAnalysis.created_at.desc())
            .first()
        )
        if not latest_resume:
            continue

        for job in active_jobs:
            # Skip if already matched
            existing = db.query(Match).filter(
                Match.candidate_id == candidate.id,
                Match.job_id == job.id,
            ).first()
            if existing:
                continue

            try:
                result = score_resume(latest_resume.resume_text, job.description)

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
                matches_created += 1

                # Notify if score meets threshold
                if result.score >= settings.auto_match_min_score:
                    # In-app notification
                    notif = Notification(
                        user_id=candidate.id,
                        type=NotificationType.match_created,
                        title="New Job Match Found! ⚡",
                        message=f"You matched {result.score}/100 for {job.title} at {job.company}",
                        data={"job_id": job.id, "match_score": result.score},
                    )
                    db.add(notif)

                    # Email notification
                    if candidate.email_notifications:
                        try:
                            send_new_match_email(
                                email=candidate.email,
                                full_name=candidate.full_name,
                                job_title=job.title,
                                company=job.company,
                                score=result.score,
                            )
                        except Exception as e:
                            logger.warning("Email failed for user_id=%d: %s", candidate.id, e)

                    notifications_sent += 1

            except Exception as exc:
                logger.error(
                    "Auto-match failed: candidate_id=%d job_id=%d error=%s",
                    candidate.id, job.id, exc,
                )
                continue

    db.commit()
    summary = {
        "jobs": len(active_jobs),
        "candidates": len(candidates),
        "matches_created": matches_created,
        "notifications_sent": notifications_sent,
    }
    logger.info("Auto-match complete: %s", summary)
    return summary