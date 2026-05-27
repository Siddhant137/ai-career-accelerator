"""
app/api/routes/notifications.py
────────────────────────────────
Phase 3 Step 4: Notification endpoints.

    GET  /notifications                → paginated list
    GET  /notifications/unread-count   → badge count
    PUT  /notifications/{id}/read      → mark one as read
    PUT  /notifications/read-all       → mark all as read
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.logging import get_logger
from app.db.models import User
from app.db.session import get_db
from app.schemas.phase3 import NotificationResponse, PaginatedNotifications
from app.services.notification_service import (
    get_notifications, get_unread_count,
    mark_all_as_read, mark_as_read,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])
logger = get_logger(__name__)


@router.get("", response_model=PaginatedNotifications, summary="Get my notifications")
def list_notifications(
    page:        int  = Query(default=1, ge=1),
    size:        int  = Query(default=20, ge=1, le=50),
    unread_only: bool = Query(default=False),
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> PaginatedNotifications:
    total, notifs = get_notifications(db, current_user, unread_only, page, size)
    unread = get_unread_count(db, current_user)
    return PaginatedNotifications(
        total=total, unread_count=unread, page=page, size=size,
        results=[NotificationResponse.model_validate(n) for n in notifs],
    )


@router.get("/unread-count", summary="Get unread notification count")
def unread_count(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> dict:
    return {"unread_count": get_unread_count(db, current_user)}


@router.put("/{notification_id}/read", response_model=NotificationResponse, summary="Mark notification as read")
def read_one(
    notification_id: int,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> NotificationResponse:
    notif = mark_as_read(db, current_user, notification_id)
    if not notif:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found.")
    return NotificationResponse.model_validate(notif)


@router.put("/read-all", summary="Mark all notifications as read")
def read_all(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> dict:
    count = mark_all_as_read(db, current_user)
    return {"message": f"Marked {count} notifications as read."}