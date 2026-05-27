"""
app/api/routes/coach.py
────────────────────────
Phase 3 Step 1: AI Career Coach endpoints.

    POST /coach/chat           → send a message, get AI response
    GET  /coach/history        → get full conversation history
    DELETE /coach/history      → clear conversation history
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import GeminiAPIError
from app.core.logging import get_logger
from app.db.models import User, UserRole
from app.db.session import get_db
from app.schemas.phase3 import ChatRequest, ChatMessageResponse, ChatResponse
from app.services.coach_service import chat, clear_history, get_conversation_history

router = APIRouter(prefix="/coach", tags=["AI Career Coach"])
logger = get_logger(__name__)

_candidate = Depends(require_role(UserRole.candidate))


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Chat with your AI Career Coach",
)
def send_message(
    payload: ChatRequest,
    current_user: User = _candidate,
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    Send a message to your AI Career Coach.
    The coach has context of your resume scores and missing skills.
    Conversation history is maintained across sessions.
    """
    try:
        reply = chat(db, current_user, payload.message)
    except GeminiAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    history = get_conversation_history(db, current_user)
    return ChatResponse(
        reply=reply,
        history=[ChatMessageResponse.model_validate(m) for m in history],
    )


@router.get(
    "/history",
    response_model=list[ChatMessageResponse],
    summary="Get conversation history",
)
def get_history(
    current_user: User = _candidate,
    db: Session = Depends(get_db),
) -> list[ChatMessageResponse]:
    history = get_conversation_history(db, current_user)
    return [ChatMessageResponse.model_validate(m) for m in history]


@router.delete(
    "/history",
    status_code=status.HTTP_200_OK,
    summary="Clear conversation history",
)
def clear_chat_history(
    current_user: User = _candidate,
    db: Session = Depends(get_db),
) -> dict:
    count = clear_history(db, current_user)
    return {"message": f"Cleared {count} messages."}