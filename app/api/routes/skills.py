"""
app/api/routes/skills.py
─────────────────────────
Phase 3 Step 2: Skill Progress Tracker endpoints.

    GET    /skills              → list all my skills
    GET    /skills/stats        → completion statistics
    POST   /skills              → add or update a skill
    DELETE /skills/{id}         → remove a skill
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.db.models import User, UserRole
from app.db.session import get_db
from app.schemas.phase3 import (
    SkillProgressResponse, SkillStatsResponse, SkillUpsertRequest,
)
from app.services.skill_service import (
    delete_skill, get_all_skills, get_skill_stats, upsert_skill,
)

router = APIRouter(prefix="/skills", tags=["Skill Progress"])
logger = get_logger(__name__)

_candidate = Depends(require_role(UserRole.candidate))


@router.get("", response_model=list[SkillProgressResponse], summary="Get all my skills")
def list_skills(
    current_user: User    = _candidate,
    db:           Session = Depends(get_db),
) -> list[SkillProgressResponse]:
    skills = get_all_skills(db, current_user)
    return [SkillProgressResponse.model_validate(s) for s in skills]


@router.get("/stats", response_model=SkillStatsResponse, summary="Get skill completion stats")
def skill_stats(
    current_user: User    = _candidate,
    db:           Session = Depends(get_db),
) -> SkillStatsResponse:
    stats = get_skill_stats(db, current_user)
    return SkillStatsResponse(**stats)


@router.post("", response_model=SkillProgressResponse, status_code=status.HTTP_200_OK, summary="Add or update a skill")
def upsert(
    payload:      SkillUpsertRequest,
    current_user: User    = _candidate,
    db:           Session = Depends(get_db),
) -> SkillProgressResponse:
    skill = upsert_skill(
        db, current_user,
        skill_name=payload.skill_name,
        status=payload.status,
        notes=payload.notes,
        resource_url=payload.resource_url,
    )
    return SkillProgressResponse.model_validate(skill)


@router.delete("/{skill_id}", status_code=status.HTTP_200_OK, summary="Remove a skill")
def remove_skill(
    skill_id:     int,
    current_user: User    = _candidate,
    db:           Session = Depends(get_db),
) -> dict:
    try:
        delete_skill(db, current_user, skill_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return {"message": f"Skill {skill_id} removed."}