"""
app/schemas/admin.py
─────────────────────
Pydantic v2 schemas for admin endpoints.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.db.models import JobStatus, UserRole


class AdminUserResponse(BaseModel):
    id:          int
    email:       str
    full_name:   str
    role:        UserRole
    is_active:   bool
    is_verified: bool
    created_at:  datetime

    model_config = {"from_attributes": True}


class PaginatedAdminUsers(BaseModel):
    total:   int
    page:    int
    size:    int
    results: list[AdminUserResponse]


class AdminJobResponse(BaseModel):
    id:           int
    recruiter_id: int
    title:        str
    company:      str
    status:       JobStatus
    created_at:   datetime

    model_config = {"from_attributes": True}


class PaginatedAdminJobs(BaseModel):
    total:   int
    page:    int
    size:    int
    results: list[AdminJobResponse]