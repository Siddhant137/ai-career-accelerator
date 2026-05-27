"""
app/services/notification_service.py
──────────────────────────────────────
Phase 3 Step 4: In-app notifications system.
Creates, lists, and marks notifications as read.
"""

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.models import Notification, NotificationType, User

logger = get_logger(__name__)


def create_notification(
    db: Session,
    user_id: int,
    type: NotificationType,
    title: str,
    message: str,
    data: dict | None = None,
) -> Notification:
    """Create and persist a notification."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        data=data or {},
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    logger.info("Notification created: user_id=%d type=%s", user_id, type)
    return notif


def get_notifications(
    db: Session,
    user: User,
    unread_only: bool = False,
    page: int = 1,
    size: int = 20,
) -> tuple[int, list[Notification]]:
    """Return paginated notifications for a user."""
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    query = query.order_by(Notification.created_at.desc())
    total   = query.count()
    results = query.offset((page - 1) * size).limit(size).all()
    return total, results


def mark_as_read(db: Session, user: User, notification_id: int) -> Notification | None:
    """Mark a single notification as read."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    ).first()
    if notif:
        notif.is_read = True
        db.commit()
    return notif


def mark_all_as_read(db: Session, user: User) -> int:
    """Mark all notifications as read. Returns count updated."""
    count = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    logger.info("Marked %d notifications as read for user_id=%d", count, user.id)
    return count


def get_unread_count(db: Session, user: User) -> int:
    """Return count of unread notifications."""
    return db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False,
    ).count()