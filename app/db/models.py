"""
app/db/models.py
─────────────────
SQLAlchemy ORM models.

Phase 1: ResumeAnalysis
Phase 2: User, JobPosting, Match
Phase 3: Notification, SkillProgress, LearningResource, ChatMessage, PasswordResetToken
"""

import datetime
import enum

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey,
    Integer, String, Text, JSON, UniqueConstraint, func,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ── Enums ──────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    candidate = "candidate"
    recruiter = "recruiter"
    admin     = "admin"


class JobStatus(str, enum.Enum):
    active = "active"
    closed = "closed"
    draft  = "draft"


class MatchStatus(str, enum.Enum):
    pending     = "pending"
    reviewed    = "reviewed"
    shortlisted = "shortlisted"
    rejected    = "rejected"


class NotificationType(str, enum.Enum):
    match_created   = "match_created"
    shortlisted     = "shortlisted"
    rejected        = "rejected"
    job_posted      = "job_posted"
    score_complete  = "score_complete"
    skill_completed = "skill_completed"


class SkillStatus(str, enum.Enum):
    not_started = "not_started"
    learning    = "learning"
    completed   = "completed"


# ── User ───────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name       = Column(String(255), nullable=False)
    role            = Column(Enum(UserRole), nullable=False, default=UserRole.candidate)

    # ── Candidate profile ──────────────────────────────────────────────────────
    headline     = Column(String(255), nullable=True)
    bio          = Column(Text,        nullable=True)
    location     = Column(String(255), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    github_url   = Column(String(500), nullable=True)

    # ── Phase 3: Recruiter company profile ────────────────────────────────────
    company_name        = Column(String(255), nullable=True)
    company_description = Column(Text,        nullable=True)
    company_website     = Column(String(500), nullable=True)
    company_size        = Column(String(50),  nullable=True)
    company_industry    = Column(String(100), nullable=True)
    company_logo_url    = Column(String(500), nullable=True)

    # ── Status ─────────────────────────────────────────────────────────────────
    is_active             = Column(Boolean, default=True,  nullable=False)
    is_verified                    = Column(Boolean, default=False, nullable=False)
    verification_token             = Column(String(255), nullable=True)
    verification_token_expires_at  = Column(DateTime(timezone=True), nullable=True)
    email_notifications            = Column(Boolean, default=True,  nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.datetime.utcnow, nullable=False)

    # ── Relationships ──────────────────────────────────────────────────────────
    analyses          = relationship("ResumeAnalysis",   back_populates="user",      lazy="select")
    candidate_resumes = relationship("CandidateResume", back_populates="user",      lazy="select")
    job_posts       = relationship("JobPosting",     back_populates="recruiter",  lazy="select")
    matches         = relationship("Match",          back_populates="candidate",  lazy="select")
    notifications   = relationship("Notification",   back_populates="user",       lazy="select")
    skill_progress  = relationship("SkillProgress",  back_populates="user",       lazy="select")
    chat_messages   = relationship("ChatMessage",    back_populates="user",       lazy="select")
    reset_tokens    = relationship("PasswordResetToken", back_populates="user",   lazy="select")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"


# ── PasswordResetToken ─────────────────────────────────────────────────────────

class PasswordResetToken(Base):
    """Stores one-time password reset tokens."""
    __tablename__ = "password_reset_tokens"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token      = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used       = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="reset_tokens")


# ── Notification ───────────────────────────────────────────────────────────────

class Notification(Base):
    """In-app notifications for both candidates and recruiters."""
    __tablename__ = "notifications"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type       = Column(Enum(NotificationType), nullable=False)
    title      = Column(String(255), nullable=False)
    message    = Column(Text,        nullable=False)
    is_read    = Column(Boolean, default=False, nullable=False)
    data       = Column(JSON, nullable=True)   # extra context (job_id, match_id, etc.)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="notifications")

    def __repr__(self) -> str:
        return f"<Notification id={self.id} user_id={self.user_id} type={self.type} read={self.is_read}>"


# ── SkillProgress ──────────────────────────────────────────────────────────────

class SkillProgress(Base):
    """Tracks a candidate's progress on individual skills."""
    __tablename__ = "skill_progress"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_name = Column(String(255), nullable=False)
    status     = Column(Enum(SkillStatus), nullable=False, default=SkillStatus.not_started)
    notes      = Column(Text, nullable=True)
    resource_url = Column(String(500), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="skill_progress")

    def __repr__(self) -> str:
        return f"<SkillProgress id={self.id} skill={self.skill_name!r} status={self.status}>"


# ── ChatMessage ────────────────────────────────────────────────────────────────

class ChatMessage(Base):
    """Stores AI Career Coach conversation history per user."""
    __tablename__ = "chat_messages"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role       = Column(String(20),  nullable=False)   # "user" or "assistant"
    content    = Column(Text,        nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="chat_messages")

    def __repr__(self) -> str:
        return f"<ChatMessage id={self.id} user_id={self.user_id} role={self.role}>"


# ── JobPosting ─────────────────────────────────────────────────────────────────

class JobPosting(Base):
    __tablename__ = "job_postings"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    recruiter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title            = Column(String(255), nullable=False)
    company          = Column(String(255), nullable=False)
    location         = Column(String(255), nullable=True)
    description      = Column(Text,        nullable=False)
    required_skills  = Column(JSON,        nullable=False, default=list)
    salary_range     = Column(String(100), nullable=True)
    job_type         = Column(String(50),  nullable=True)
    experience_level = Column(String(50),  nullable=True)
    status           = Column(Enum(JobStatus), nullable=False, default=JobStatus.active)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.datetime.utcnow, nullable=False)

    recruiter = relationship("User",  back_populates="job_posts", lazy="select")
    matches   = relationship("Match", back_populates="job",       lazy="select")

    def __repr__(self) -> str:
        return f"<JobPosting id={self.id} title={self.title!r} status={self.status}>"


# ── Match ──────────────────────────────────────────────────────────────────────

class Match(Base):
    __tablename__ = "matches"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("users.id",        ondelete="CASCADE"), nullable=False, index=True)
    job_id       = Column(Integer, ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False, index=True)

    score               = Column(Integer, nullable=False)
    missing_skills      = Column(JSON,    nullable=False)
    recommended_project = Column(Text,    nullable=False)
    summary             = Column(Text,    nullable=False)
    status              = Column(Enum(MatchStatus), nullable=False, default=MatchStatus.pending)
    recruiter_notes     = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.datetime.utcnow, nullable=False)

    candidate = relationship("User",       back_populates="matches", lazy="select")
    job       = relationship("JobPosting", back_populates="matches", lazy="select")

    def __repr__(self) -> str:
        return f"<Match id={self.id} candidate_id={self.candidate_id} job_id={self.job_id} score={self.score}>"


# ── CandidateResume ────────────────────────────────────────────────────────────

class CandidateResume(Base):
    """One resume per role type (e.g. backend, frontend) for smarter job matching."""
    __tablename__ = "candidate_resumes"
    __table_args__ = (
        UniqueConstraint("user_id", "role_type", name="uq_candidate_resume_role"),
    )

    id                = Column(Integer, primary_key=True, autoincrement=True)
    user_id           = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_type         = Column(String(100), nullable=False)
    resume_text       = Column(Text, nullable=False)
    original_filename = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

    user = relationship("User", back_populates="candidate_resumes")

    def __repr__(self) -> str:
        return f"<CandidateResume id={self.id} user_id={self.user_id} role={self.role_type!r}>"


# ── ResumeAnalysis ─────────────────────────────────────────────────────────────

class ResumeAnalysis(Base):
    __tablename__ = "resume_analyses"

    id      = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user    = relationship("User", back_populates="analyses")

    original_filename   = Column(String(255), nullable=True)
    resume_text         = Column(Text,        nullable=False)
    job_description     = Column(Text,        nullable=False)
    score               = Column(Integer,     nullable=False)
    missing_skills      = Column(JSON,        nullable=False)
    recommended_project = Column(Text,        nullable=False)
    summary             = Column(Text,        nullable=False)
    gemini_model        = Column(String(64),  nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ResumeAnalysis id={self.id} score={self.score} user_id={self.user_id}>"