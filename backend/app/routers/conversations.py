"""Conversation history: list, view, rename, archive, delete."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Conversation, User
from ..schemas import ConversationDetail, ConversationOut, ConversationUpdate

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    q: str | None = Query(None),
    archived: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Conversation).filter(
        Conversation.user_id == user.id,
        Conversation.is_archived == archived,
    )
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Conversation.title.ilike(like), Conversation.topic.ilike(like)))
    return query.order_by(Conversation.updated_at.desc()).all()


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.patch("/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if payload.title is not None:
        conv.title = payload.title.strip()[:255] or conv.title
    if payload.is_archived is not None:
        conv.is_archived = payload.is_archived
    db.commit()
    db.refresh(conv)
    return conv


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
