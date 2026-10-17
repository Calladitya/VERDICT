"""Feedback on AI answers (was this helpful?)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Feedback, Message, User
from ..schemas import FeedbackCreate

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("", status_code=201)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    msg = db.get(Message, payload.message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    fb = Feedback(
        message_id=payload.message_id,
        user_id=user.id,
        helpful=payload.helpful,
        reason=payload.reason[:60],
        note=payload.note[:2000],
    )
    db.add(fb)
    db.commit()
    return {"status": "ok"}
