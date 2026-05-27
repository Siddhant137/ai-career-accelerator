"""
app/api/routes/candidates.py
─────────────────────────────
Candidate-facing endpoints:

    GET  /candidates/me              → my profile
    PUT  /candidates/me              → update my profile
    GET  /candidates/me/history      → paginated scoring history
    GET  /candidates/me/history/{id} → single analysis detail
"""

import asyncio
from functools import partial

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role, require_verified_candidate
from app.core.exceptions import (
    EmptyPDFError,
    InsufficientPermissionsError,
    PDFExtractionError,
    PDFTooLargeError,
)
from app.core.logging import get_logger
from app.db.models import User, UserRole
from app.db.session import get_db
from app.schemas.candidate import (
    AnalysisDetail,
    AnalysisSummary,
    CandidateProfileResponse,
    CandidateProfileUpdate,
    CandidateResumeResponse,
    PaginatedHistory,
)
from app.services.candidate_service import (
    get_analysis_by_id,
    get_analysis_history,
    get_candidate_profile,
    update_candidate_profile,
)
from app.services.pdf_service import extract_text_from_pdf
from app.services.resume_library_service import (
    ALLOWED_ROLE_TYPES,
    delete_candidate_resume,
    list_candidate_resumes,
    upsert_candidate_resume,
)

router = APIRouter(prefix="/candidates", tags=["Candidates"])
logger = get_logger(__name__)

_candidate = Depends(require_role(UserRole.candidate))
_verified_candidate = Depends(require_verified_candidate)

_RESUME_CONTENT_TYPES = {
    "application/pdf",
    "application/x-pdf",
    "application/octet-stream",
}


# ── GET /candidates/me ─────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=CandidateProfileResponse,
    summary="Get my candidate profile",
)
def get_my_profile(
    current_user: User = _candidate,
) -> CandidateProfileResponse:
    """Return the authenticated candidate's full profile."""
    try:
        user = get_candidate_profile(current_user)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    return CandidateProfileResponse.model_validate(user)


# ── PUT /candidates/me ─────────────────────────────────────────────────────────

@router.put(
    "/me",
    response_model=CandidateProfileResponse,
    summary="Update my candidate profile",
)
def update_my_profile(
    payload: CandidateProfileUpdate,
    current_user: User = _candidate,
    db: Session = Depends(get_db),
) -> CandidateProfileResponse:
    """
    Update one or more profile fields.
    Only provided fields are changed — omitted fields stay as-is.
    """
    try:
        user = update_candidate_profile(db, current_user, payload)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    return CandidateProfileResponse.model_validate(user)


# ── GET /candidates/me/history ─────────────────────────────────────────────────

@router.get(
    "/me/history",
    response_model=PaginatedHistory,
    summary="Get my resume scoring history",
)
def get_my_history(
    page: int = Query(default=1, ge=1, description="Page number"),
    size: int = Query(default=10, ge=1, le=50, description="Results per page (max 50)"),
    current_user: User = _candidate,
    db: Session = Depends(get_db),
) -> PaginatedHistory:
    """
    Return a paginated list of all past resume analyses for the
    authenticated candidate, ordered by most recent first.
    """
    try:
        total, analyses = get_analysis_history(db, current_user, page, size)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    return PaginatedHistory(
        total=total,
        page=page,
        size=size,
        results=[AnalysisSummary.model_validate(a) for a in analyses],
    )


# ── GET /candidates/me/history/{analysis_id} ───────────────────────────────────

@router.get(
    "/me/history/{analysis_id}",
    response_model=AnalysisDetail,
    summary="Get a single analysis in detail",
)
def get_analysis_detail(
    analysis_id: int,
    current_user: User = _candidate,
    db: Session = Depends(get_db),
) -> AnalysisDetail:
    """
    Return the full detail of a single past analysis including
    the original job description submitted.
    """
    try:
        analysis = get_analysis_by_id(db, current_user, analysis_id)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return AnalysisDetail.model_validate(analysis)


# ── Resume library (one PDF per role type) ─────────────────────────────────────

@router.get(
    "/me/resumes",
    response_model=list[CandidateResumeResponse],
    summary="List my role-specific resumes",
)
def list_my_resumes(
    current_user: User = _verified_candidate,
    db: Session = Depends(get_db),
) -> list[CandidateResumeResponse]:
    try:
        resumes = list_candidate_resumes(db, current_user)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return [CandidateResumeResponse.model_validate(r) for r in resumes]


@router.get("/me/resumes/role-types", summary="Allowed resume role types")
def list_resume_role_types() -> dict:
    return {"role_types": sorted(ALLOWED_ROLE_TYPES)}


@router.post(
    "/me/resumes",
    response_model=CandidateResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload or replace a role-specific resume",
)
async def upload_role_resume(
    role_type: str = Form(..., description="e.g. backend, frontend, data"),
    resume: UploadFile = File(..., description="PDF resume for this role"),
    current_user: User = _verified_candidate,
    db: Session = Depends(get_db),
) -> CandidateResumeResponse:
    if resume.content_type not in _RESUME_CONTENT_TYPES and not (
        resume.filename or ""
    ).lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are accepted.",
        )

    file_bytes = await resume.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        resume_text = await asyncio.to_thread(extract_text_from_pdf, file_bytes)
    except PDFTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc))
    except (EmptyPDFError, PDFExtractionError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    try:
        entry = upsert_candidate_resume(
            db, current_user, role_type, resume_text, resume.filename
        )
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return CandidateResumeResponse.model_validate(entry)


@router.delete("/me/resumes/{resume_id}", status_code=status.HTTP_200_OK)
def remove_role_resume(
    resume_id: int,
    current_user: User = _verified_candidate,
    db: Session = Depends(get_db),
) -> dict:
    try:
        delete_candidate_resume(db, current_user, resume_id)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"message": f"Resume {resume_id} deleted."}