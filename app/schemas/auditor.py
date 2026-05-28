"""
app/schemas/auditor.py
──────────────────────
Pydantic v2 schemas for the candidate evaluation endpoint.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class EvaluateCandidateRequest(BaseModel):
    resume_text: str = Field(..., min_length=1)
    job_description: str = Field(..., min_length=1)
    github_urls: list[str] = Field(default_factory=list)


class CandidateEvaluationBreakdown(BaseModel):
    experience_and_education_score: int
    skills_match_score: int
    project_verification_score: int
    red_flags: list[str] = Field(default_factory=list)


class EvaluateCandidateResponse(BaseModel):
    composite_score: int
    evaluation: CandidateEvaluationBreakdown
    interrogation_questions: list[str] = Field(..., min_length=3, max_length=3)
    hiring_verdict: str

    # Keep a tight schema while still allowing nested dict types inside red flags, etc.
    model_config = {"extra": "forbid"}

