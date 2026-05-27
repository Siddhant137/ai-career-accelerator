"""
app/api/routes/companies.py
────────────────────────────
Phase 3 Step 5: Company Profile endpoints.

    GET  /companies                → browse all company profiles
    GET  /companies/{id}           → single company profile
    GET  /companies/me             → my company profile (recruiter)
    PUT  /companies/me             → update my company profile
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import InsufficientPermissionsError
from app.core.logging import get_logger
from app.db.models import User, UserRole
from app.db.session import get_db
from app.schemas.phase3 import (
    CompanyProfileResponse, CompanyProfileUpdate, PaginatedCompanies,
)
from app.services.company_service import (
    get_company_profile, list_companies, update_company_profile,
)

router = APIRouter(prefix="/companies", tags=["Company Profiles"])
logger = get_logger(__name__)

_recruiter = Depends(require_role(UserRole.recruiter))


@router.get("", response_model=PaginatedCompanies, summary="Browse all companies")
def browse_companies(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=50),
    db:   Session = Depends(get_db),
) -> PaginatedCompanies:
    total, companies = list_companies(db, page, size)
    return PaginatedCompanies(
        total=total, page=page, size=size,
        results=[CompanyProfileResponse.model_validate(c) for c in companies],
    )


@router.get("/me", response_model=CompanyProfileResponse, summary="Get my company profile")
def get_my_company(
    current_user: User    = _recruiter,
    db:           Session = Depends(get_db),
) -> CompanyProfileResponse:
    return CompanyProfileResponse.model_validate(current_user)


@router.put("/me", response_model=CompanyProfileResponse, summary="Update my company profile")
def update_my_company(
    payload:      CompanyProfileUpdate,
    current_user: User    = _recruiter,
    db:           Session = Depends(get_db),
) -> CompanyProfileResponse:
    try:
        updated = update_company_profile(db, current_user, payload.model_dump(exclude_none=True))
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return CompanyProfileResponse.model_validate(updated)


@router.get("/{company_id}", response_model=CompanyProfileResponse, summary="Get a company profile")
def get_company(
    company_id: int,
    db:         Session = Depends(get_db),
) -> CompanyProfileResponse:
    try:
        company = get_company_profile(db, company_id)
    except InsufficientPermissionsError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return CompanyProfileResponse.model_validate(company)