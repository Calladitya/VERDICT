"""SQLAlchemy ORM models — the core data model for the platform.

Entities cover the MVP slice of the full product spec: users, conversations,
messages, citations, documents, bookmarks, feedback, and an audit log. The
schema is intentionally close to the V2/V3 target so it can grow without a
disruptive migration.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="user")  # user | admin
    # Persona used to power the "What does this mean for me?" engine.
    persona: Mapped[str] = mapped_column(String(40), default="individual")
    default_jurisdiction: Mapped[str] = mapped_column(String(120), default="India")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    bookmarks: Mapped[list["Bookmark"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="New conversation")
    jurisdiction: Mapped[str] = mapped_column(String(120), default="India")
    topic: Mapped[str] = mapped_column(String(120), default="")
    mode: Mapped[str] = mapped_column(String(40), default="simple")
    persona: Mapped[str] = mapped_column(String(40), default="individual")
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now
    )

    user: Mapped["User"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text, default="")
    # Structured legal explanation payload (short_answer, rights, deadlines...).
    structured: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
    citations: Mapped[list["Citation"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )
    feedback: Mapped[list["Feedback"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class Citation(Base):
    __tablename__ = "citations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"), index=True)
    title: Mapped[str] = mapped_column(String(400))
    authority: Mapped[str] = mapped_column(String(255), default="")
    section: Mapped[str] = mapped_column(String(120), default="")
    jurisdiction: Mapped[str] = mapped_column(String(120), default="")
    url: Mapped[str] = mapped_column(String(600), default="")
    source_type: Mapped[str] = mapped_column(String(40), default="primary")
    confidence: Mapped[str] = mapped_column(String(20), default="medium")
    published_date: Mapped[str] = mapped_column(String(40), default="")
    effective_date: Mapped[str] = mapped_column(String(40), default="")

    message: Mapped["Message"] = relationship(back_populates="citations")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column(String(400))
    content_type: Mapped[str] = mapped_column(String(120), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="uploaded")
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    # Analysis result: risk score, clauses, dates, parties, obligations...
    analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped["User"] = relationship(back_populates="documents")


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    item_type: Mapped[str] = mapped_column(String(40))  # message | document | law
    title: Mapped[str] = mapped_column(String(400))
    folder: Mapped[str] = mapped_column(String(120), default="General")
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ref_id: Mapped[str] = mapped_column(String(36), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped["User"] = relationship(back_populates="bookmarks")


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), default="")
    helpful: Mapped[bool] = mapped_column(Boolean, default=True)
    reason: Mapped[str] = mapped_column(String(60), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    message: Mapped["Message"] = relationship(back_populates="feedback")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), default="", index=True)
    action: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str] = mapped_column(String(600), default="")
    ip: Mapped[str] = mapped_column(String(60), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
