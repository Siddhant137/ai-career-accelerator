"""
app/api/routes/auditor.py
────────────────────────
Candidate evaluation endpoint using Groq + GitHub context extraction.
"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException, status

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.auditor import EvaluateCandidateRequest, EvaluateCandidateResponse
from app.services.github_service import (
    GitHubRateLimitError,
    GitHubRepositoryNotFoundError,
    InvalidGitHubUrlError,
    fetch_github_context,
)

router = APIRouter(prefix="/api/v1", tags=["Auditor"])
logger = get_logger(__name__)
settings = get_settings()


_SYSTEM_INSTRUCTION = """You are an Enterprise Technical Auditor. Evaluate the candidate with absolute zero leniency and output strict JSON. Start candidate score at 0.
CRITERIA:
- Experience & Education: If they have zero formal experience, you MUST evaluate the academic rigor and reputation of their university (e.g., Tier-1/2/3 alignment, CGPA consistency) to baseline potential.
- Job Matching & Skills: Map proven skills against requirements. Penalize unverified claims.
- Project Verification: Cross-reference GitHub data against resume claims. Flag template-cloning or trivial tutorials.
- The Ambush: Based on GitHub data, generate 3 highly specific, technical questions that only the true author of that codebase could answer under a 60-second time limit. No generic questions."""


def _build_user_prompt(payload: EvaluateCandidateRequest, github_context: str) -> str:
    return (
        "Return STRICT JSON with this exact schema:\n"
        "{\n"
        '  "composite_score": int,\n'
        '  "evaluation": {\n'
        '    "experience_and_education_score": int,\n'
        '    "skills_match_score": int,\n'
        '    "project_verification_score": int,\n'
        '    "red_flags": string[]\n'
        "  },\n"
        '  "interrogation_questions": [string, string, string],\n'
        '  "hiring_verdict": string\n'
        "}\n\n"
        "RESUME_TEXT:\n"
        f"{payload.resume_text}\n\n"
        "JOB_DESCRIPTION:\n"
        f"{payload.job_description}\n\n"
        "GITHUB_CONTEXT:\n"
        f"{github_context or '(none)'}\n"
    )


def _call_groq_sync(system_instruction: str, user_prompt: str) -> str:
    """
    Groq SDK call (sync). Wrapped in a thread from the async route.
    """
    try:
        from groq import Groq  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("Groq SDK is not installed or failed to import.") from exc

    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    client = Groq(api_key=settings.groq_api_key)
    resp = client.chat.completions.create(
        model="llama3-70b-8192",
        temperature=0.0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = (resp.choices[0].message.content or "").strip()
    if not content:
        raise RuntimeError("Groq returned an empty response.")
    return content


@router.post(
    "/evaluate-candidate",
    response_model=EvaluateCandidateResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate candidate with Groq + GitHub verification",
)
async def evaluate_candidate(payload: EvaluateCandidateRequest) -> EvaluateCandidateResponse:
    # 1) Fetch GitHub contexts concurrently
    github_urls = [u.strip() for u in (payload.github_urls or []) if (u or "").strip()]

    async def _fetch_one(url: str) -> str:
        return await fetch_github_context(url)

    try:
        results = await asyncio.gather(*[_fetch_one(u) for u in github_urls], return_exceptions=True)
    except Exception as exc:
        logger.error("Unexpected error while gathering GitHub contexts: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch GitHub context.") from exc

    github_context_blocks: list[str] = []
    for url, result in zip(github_urls, results):
        if isinstance(result, Exception):
            if isinstance(result, InvalidGitHubUrlError):
                raise HTTPException(status_code=400, detail=f"Invalid GitHub URL: {url}")
            if isinstance(result, GitHubRepositoryNotFoundError):
                raise HTTPException(status_code=404, detail=f"GitHub repository not found: {url}")
            if isinstance(result, GitHubRateLimitError):
                raise HTTPException(status_code=429, detail="GitHub API rate limit exceeded. Try again later.")

            logger.warning("GitHub context fetch failed url=%s err=%s", url, result)
            continue

        if result:
            github_context_blocks.append(f"## Repository: {url}\n{result}")

    github_context = "\n\n".join(github_context_blocks).strip()

    # 2) Call Groq with strict JSON output
    user_prompt = _build_user_prompt(payload, github_context)
    try:
        raw_json = await asyncio.to_thread(_call_groq_sync, _SYSTEM_INSTRUCTION, user_prompt)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Groq evaluation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="AI evaluation failed.") from exc

    # 3) Validate and return exact schema
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        logger.error("Groq returned non-JSON: %s", raw_json)
        raise HTTPException(status_code=502, detail="AI returned invalid JSON.") from exc

    try:
        parsed = EvaluateCandidateResponse.model_validate(data)
    except Exception as exc:
        logger.error("AI JSON failed schema validation: %s", data)
        raise HTTPException(status_code=502, detail="AI returned JSON with wrong schema.") from exc

    # Enforce exactly 3 questions defensively (even if AI returns more/less)
    if len(parsed.interrogation_questions) != 3:
        raise HTTPException(
            status_code=502,
            detail="AI returned wrong number of interrogation questions (expected 3).",
        )

    return parsed

