"""
app/api/routes/analytics.py
────────────────────────────
Analytics endpoints.

    GET /analytics/candidate  → score over time, skill gaps, improvement
    GET /analytics/recruiter  → jobs posted, avg score, shortlist rate
    GET /analytics/admin      → platform-wide stats
"""

from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.logging import get_logger
from app.db.models import (
    JobPosting, JobStatus, Match, MatchStatus,
    ResumeAnalysis, User, UserRole,
)
from app.db.session import get_db

router = APIRouter(prefix="/analytics", tags=["Analytics"])
logger = get_logger(__name__)


# ── Candidate analytics ────────────────────────────────────────────────────────

@router.get("/candidate", summary="Candidate score trends and skill gaps")
def candidate_analytics(
    days: int = Query(default=90, ge=7, le=365),
    current_user: User = Depends(require_role(UserRole.candidate)),
    db: Session = Depends(get_db),
) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    analyses = (
        db.query(ResumeAnalysis)
        .filter(
            ResumeAnalysis.user_id == current_user.id,
            ResumeAnalysis.created_at >= since,
        )
        .order_by(ResumeAnalysis.created_at.asc())
        .all()
    )

    # Score over time
    score_trend = [
        {
            "date": a.created_at.strftime("%Y-%m-%d"),
            "score": a.score,
            "filename": a.original_filename or "Resume",
        }
        for a in analyses
    ]

    # Skill gap frequency
    all_skills: list[str] = []
    for a in analyses:
        all_skills.extend(a.missing_skills or [])
    skill_gaps = [
        {"skill": skill, "count": count}
        for skill, count in Counter(all_skills).most_common(10)
    ]

    # Improvement: compare first half avg vs second half avg
    improvement = 0
    if len(analyses) >= 4:
        mid   = len(analyses) // 2
        first = sum(a.score for a in analyses[:mid]) / mid
        last  = sum(a.score for a in analyses[mid:]) / (len(analyses) - mid)
        improvement = round(last - first, 1)

    # Match stats
    matches = db.query(Match).filter(Match.candidate_id == current_user.id).all()
    match_status_counts = Counter(m.status.value for m in matches)

    return {
        "score_trend":    score_trend,
        "skill_gaps":     skill_gaps,
        "improvement":    improvement,
        "total_analyses": len(analyses),
        "avg_score":      round(sum(a.score for a in analyses) / len(analyses), 1) if analyses else 0,
        "best_score":     max((a.score for a in analyses), default=0),
        "match_stats":    match_status_counts,
    }


# ── Recruiter analytics ────────────────────────────────────────────────────────

@router.get("/recruiter", summary="Recruiter hiring funnel stats")
def recruiter_analytics(
    current_user: User = Depends(require_role(UserRole.recruiter)),
    db: Session = Depends(get_db),
) -> dict:
    jobs = (
        db.query(JobPosting)
        .filter(JobPosting.recruiter_id == current_user.id)
        .all()
    )
    job_ids = [j.id for j in jobs]

    matches = (
        db.query(Match).filter(Match.job_id.in_(job_ids)).all()
        if job_ids else []
    )

    # Per-job stats
    job_stats = []
    for job in jobs:
        job_matches = [m for m in matches if m.job_id == job.id]
        avg = round(sum(m.score for m in job_matches) / len(job_matches), 1) if job_matches else 0
        shortlisted = sum(1 for m in job_matches if m.status == MatchStatus.shortlisted)
        job_stats.append({
            "job_id":        job.id,
            "title":         job.title,
            "status":        job.status.value,
            "applications":  len(job_matches),
            "avg_score":     avg,
            "shortlisted":   shortlisted,
            "shortlist_rate": round(shortlisted / len(job_matches) * 100, 1) if job_matches else 0,
        })

    # Funnel
    funnel = Counter(m.status.value for m in matches)
    avg_score_all = round(sum(m.score for m in matches) / len(matches), 1) if matches else 0

    return {
        "total_jobs":       len(jobs),
        "active_jobs":      sum(1 for j in jobs if j.status == JobStatus.active),
        "total_candidates": len(matches),
        "avg_score":        avg_score_all,
        "funnel":           funnel,
        "job_stats":        sorted(job_stats, key=lambda x: x["applications"], reverse=True),
    }


# ── Admin analytics ────────────────────────────────────────────────────────────

@router.get("/admin", summary="Platform-wide statistics (admin only)")
def admin_analytics(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
) -> dict:
    total_users      = db.query(func.count(User.id)).scalar()
    total_candidates = db.query(func.count(User.id)).filter(User.role == UserRole.candidate).scalar()
    total_recruiters = db.query(func.count(User.id)).filter(User.role == UserRole.recruiter).scalar()
    total_jobs       = db.query(func.count(JobPosting.id)).scalar()
    active_jobs      = db.query(func.count(JobPosting.id)).filter(JobPosting.status == JobStatus.active).scalar()
    total_matches    = db.query(func.count(Match.id)).scalar()
    total_analyses   = db.query(func.count(ResumeAnalysis.id)).scalar()

    avg_score = db.query(func.avg(Match.score)).scalar()

    # Signups last 30 days
    since = datetime.now(timezone.utc) - timedelta(days=30)
    new_users = db.query(func.count(User.id)).filter(User.created_at >= since).scalar()

    return {
        "users": {
            "total":      total_users,
            "candidates": total_candidates,
            "recruiters": total_recruiters,
            "new_last_30d": new_users,
        },
        "jobs": {
            "total":  total_jobs,
            "active": active_jobs,
        },
        "matches": {
            "total":     total_matches,
            "avg_score": round(float(avg_score), 1) if avg_score else 0,
        },
        "analyses": total_analyses,
    }