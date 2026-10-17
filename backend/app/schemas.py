"""Pydantic request/response schemas (API contract)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


# ── Auth ────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    persona: str
    default_jurisdiction: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    persona: Optional[str] = None
    default_jurisdiction: Optional[str] = None


# ── Explain ─────────────────────────────────────────────────────────────
class ExplainRequest(BaseModel):
    question: str = Field(min_length=3, max_length=8000)
    conversation_id: Optional[str] = None
    jurisdiction: str = "India"
    mode: str = "simple"          # simple | detailed | expert | executive | eli5 | bullet
    persona: str = "individual"   # individual | business | employee | landlord | tenant
    topic: str = ""
    document_id: Optional[str] = None


class CitationOut(BaseModel):
    id: str
    title: str
    authority: str
    section: str
    jurisdiction: str
    url: str
    source_type: str
    confidence: str
    published_date: str
    effective_date: str

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    structured: Optional[dict[str, Any]] = None
    created_at: datetime
    citations: list[CitationOut] = []

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: str
    title: str
    jurisdiction: str
    topic: str
    mode: str
    persona: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = []


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    is_archived: Optional[bool] = None


# ── Documents ───────────────────────────────────────────────────────────
class DocumentOut(BaseModel):
    id: str
    filename: str
    content_type: str
    size_bytes: int
    status: str
    risk_score: float
    analysis: Optional[dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Bookmarks ───────────────────────────────────────────────────────────
class BookmarkCreate(BaseModel):
    item_type: str
    title: str
    folder: str = "General"
    ref_id: str = ""
    payload: Optional[dict[str, Any]] = None


class BookmarkOut(BaseModel):
    id: str
    item_type: str
    title: str
    folder: str
    ref_id: str
    payload: Optional[dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Feedback ────────────────────────────────────────────────────────────
class FeedbackCreate(BaseModel):
    message_id: str
    helpful: bool
    reason: str = ""
    note: str = ""


# ── Search ──────────────────────────────────────────────────────────────
class SearchResult(BaseModel):
    title: str
    description: str
    jurisdiction: str
    authority: str
    section: str
    topic: str
    url: str
    published_date: str
    effective_date: str
    relevance: float
