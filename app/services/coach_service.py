"""
app/services/coach_service.py
──────────────────────────────
Phase 3 Step 1: AI Career Coach.
Maintains per-user conversation history and answers career questions
using the candidate's resume + job history as context.
"""

from groq import Groq
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import GeminiAPIError
from app.core.logging import get_logger
from app.db.models import ChatMessage, ResumeAnalysis, User

logger   = get_logger(__name__)
settings = get_settings()

_client = Groq(api_key=settings.groq_api_key)

_SYSTEM_PROMPT = """\
You are CareerAI Coach — an expert AI career advisor with deep knowledge of software engineering,
data science, product management, and related tech disciplines.

You help candidates:
- Understand their resume match scores and what they mean
- Prioritise which skills to learn first based on their goals
- Get advice on projects to build for their portfolio
- Prepare for technical interviews
- Write cover letters and improve their resume
- Navigate salary negotiations and career transitions

Guidelines:
- Be specific and actionable, not generic
- Give concrete project ideas with tech stacks
- Reference the candidate's actual skills and gaps when known
- Keep responses concise (3-5 sentences max per point)
- Use bullet points for lists
- Be encouraging but honest about gaps
"""


def _get_candidate_context(db: Session, user: User) -> str:
    """Build a context string from the candidate's latest resume analysis."""
    latest = (
        db.query(ResumeAnalysis)
        .filter(ResumeAnalysis.user_id == user.id)
        .order_by(ResumeAnalysis.created_at.desc())
        .first()
    )
    if not latest:
        return ""

    return f"""
Candidate Context:
- Name: {user.full_name}
- Headline: {user.headline or 'Not set'}
- Location: {user.location or 'Not set'}
- Latest Resume Score: {latest.score}/100
- Missing Skills: {', '.join(latest.missing_skills)}
- AI Summary: {latest.summary}
- Recommended Project: {latest.recommended_project}
"""


def _get_history(db: Session, user: User, limit: int = 20) -> list[dict]:
    """Retrieve recent conversation history for a user."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in reversed(messages)]


def _save_message(db: Session, user_id: int, role: str, content: str) -> ChatMessage:
    """Persist a chat message."""
    msg = ChatMessage(user_id=user_id, role=role, content=content)
    db.add(msg)
    db.commit()
    return msg


def chat(db: Session, user: User, user_message: str) -> str:
    """
    Process a user message and return the AI coach's response.
    Saves both user message and AI response to the database.

    Raises
    ------
    GeminiAPIError — if the Groq API call fails.
    """
    # Save user message
    _save_message(db, user.id, "user", user_message)

    # Build messages for Groq
    context    = _get_candidate_context(db, user)
    history    = _get_history(db, user, limit=18)  # last 9 exchanges

    system = _SYSTEM_PROMPT
    if context:
        system += f"\n\n{context}"

    messages = [{"role": "system", "content": system}] + history

    logger.info("Career coach request: user_id=%d message=%s", user.id, user_message[:80])

    try:
        response = _client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        reply = response.choices[0].message.content or "I couldn't generate a response. Please try again."
    except Exception as exc:
        logger.error("Groq coach error: %s", exc)
        raise GeminiAPIError(f"AI coach error: {exc}") from exc

    # Save assistant response
    _save_message(db, user.id, "assistant", reply)
    logger.info("Career coach response: user_id=%d length=%d", user.id, len(reply))

    return reply


def get_conversation_history(db: Session, user: User, limit: int = 50) -> list[ChatMessage]:
    """Return full conversation history for display."""
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )


def clear_history(db: Session, user: User) -> int:
    """Clear all chat history for a user. Returns count deleted."""
    count = db.query(ChatMessage).filter(ChatMessage.user_id == user.id).delete()
    db.commit()
    logger.info("Cleared %d chat messages for user_id=%d", count, user.id)
    return count