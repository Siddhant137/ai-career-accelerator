"""
app/services/skill_service.py
──────────────────────────────
Phase 3 Step 2: Skill Progress Tracker.
Candidates track their learning progress on missing skills.
Completing a skill triggers a notification.
"""

import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.db.models import (
    Notification, NotificationType,
    SkillProgress, SkillStatus, User,
)

logger = get_logger(__name__)


def get_all_skills(db: Session, user: User) -> list[SkillProgress]:
    """Return all skill progress records for a candidate."""
    return (
        db.query(SkillProgress)
        .filter(SkillProgress.user_id == user.id)
        .order_by(SkillProgress.created_at.desc())
        .all()
    )


def upsert_skill(
    db: Session,
    user: User,
    skill_name: str,
    status: SkillStatus,
    notes: Optional[str] = None,
    resource_url: Optional[str] = None,
) -> SkillProgress:
    """
    Create or update a skill progress record.
    Sends a notification when a skill is marked completed.
    """
    skill = db.query(SkillProgress).filter(
        SkillProgress.user_id == user.id,
        SkillProgress.skill_name == skill_name,
    ).first()

    is_newly_completed = False

    if skill:
        old_status = skill.status
        skill.status       = status
        skill.notes        = notes or skill.notes
        skill.resource_url = resource_url or skill.resource_url
        if status == SkillStatus.completed and old_status != SkillStatus.completed:
            skill.completed_at = datetime.datetime.utcnow()
            is_newly_completed = True
    else:
        skill = SkillProgress(
            user_id=user.id,
            skill_name=skill_name,
            status=status,
            notes=notes,
            resource_url=resource_url,
            completed_at=datetime.datetime.utcnow() if status == SkillStatus.completed else None,
        )
        if status == SkillStatus.completed:
            is_newly_completed = True
        db.add(skill)

    db.commit()
    db.refresh(skill)

    # Notify on completion
    if is_newly_completed:
        notif = Notification(
            user_id=user.id,
            type=NotificationType.skill_completed,
            title="Skill Completed! 🎉",
            message=f"You've marked '{skill_name}' as completed. Your match scores will improve!",
            data={"skill_name": skill_name},
        )
        db.add(notif)
        db.commit()
        logger.info("Skill completed: user_id=%d skill=%s", user.id, skill_name)

    return skill


def delete_skill(db: Session, user: User, skill_id: int) -> None:
    """Delete a skill progress record."""
    skill = db.query(SkillProgress).filter(
        SkillProgress.id == skill_id,
        SkillProgress.user_id == user.id,
    ).first()
    if not skill:
        raise NotFoundError(f"Skill {skill_id} not found.")
    db.delete(skill)
    db.commit()


def get_skill_stats(db: Session, user: User) -> dict:
    """Return skill completion statistics for a candidate."""
    all_skills  = get_all_skills(db, user)
    completed   = [s for s in all_skills if s.status == SkillStatus.completed]
    learning    = [s for s in all_skills if s.status == SkillStatus.learning]
    not_started = [s for s in all_skills if s.status == SkillStatus.not_started]

    return {
        "total":       len(all_skills),
        "completed":   len(completed),
        "learning":    len(learning),
        "not_started": len(not_started),
        "completion_rate": round(len(completed) / len(all_skills) * 100) if all_skills else 0,
    }