"""
app/schemas/phase3.py
──────────────────────
Pydantic v2 schemas for all Phase 3 endpoints.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.db.models import NotificationType, SkillStatus


# ── Auth (password reset + verification) ──────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str = Field(..., min_length=8)

class VerifyEmailRequest(BaseModel):
    token: str


# ── Notifications ──────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id:         int
    type:       NotificationType
    title:      str
    message:    str
    is_read:    bool
    data:       Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedNotifications(BaseModel):
    total:        int
    unread_count: int
    page:         int
    size:         int
    results:      list[NotificationResponse]


# ── Skill Progress ─────────────────────────────────────────────────────────────

class SkillUpsertRequest(BaseModel):
    skill_name:   str = Field(..., min_length=1, max_length=255)
    status:       SkillStatus
    notes:        Optional[str] = None
    resource_url: Optional[str] = None

class SkillProgressResponse(BaseModel):
    id:           int
    skill_name:   str
    status:       SkillStatus
    notes:        Optional[str]
    resource_url: Optional[str]
    completed_at: Optional[datetime]
    created_at:   datetime
    updated_at:   datetime

    model_config = {"from_attributes": True}

class SkillStatsResponse(BaseModel):
    total:           int
    completed:       int
    learning:        int
    not_started:     int
    completion_rate: int


# ── AI Career Coach ────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)

class ChatMessageResponse(BaseModel):
    id:         int
    role:       str
    content:    str
    created_at: datetime

    model_config = {"from_attributes": True}

class ChatResponse(BaseModel):
    reply:   str
    history: list[ChatMessageResponse]


# ── Company Profiles ───────────────────────────────────────────────────────────

class CompanyProfileUpdate(BaseModel):
    company_name:        Optional[str] = Field(None, max_length=255)
    company_description: Optional[str] = None
    company_website:     Optional[str] = Field(None, max_length=500)
    company_size:        Optional[str] = Field(None, max_length=50)
    company_industry:    Optional[str] = Field(None, max_length=100)
    company_logo_url:    Optional[str] = Field(None, max_length=500)
    full_name:           Optional[str] = Field(None, max_length=255)
    location:            Optional[str] = Field(None, max_length=255)

class CompanyProfileResponse(BaseModel):
    id:                  int
    full_name:           str
    company_name:        Optional[str]
    company_description: Optional[str]
    company_website:     Optional[str]
    company_size:        Optional[str]
    company_industry:    Optional[str]
    company_logo_url:    Optional[str]
    location:            Optional[str]
    created_at:          datetime

    model_config = {"from_attributes": True}

class PaginatedCompanies(BaseModel):
    total:   int
    page:    int
    size:    int
    results: list[CompanyProfileResponse]


# ── Auto-match ─────────────────────────────────────────────────────────────────

class AutoMatchResponse(BaseModel):
    jobs:               int
    candidates:         int
    matches_created:    int
    notifications_sent: int
    skipped:            bool = False