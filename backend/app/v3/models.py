"""New tables only (all prefixed v3_). Existing tables are never touched."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, String, Text

from .compat import Base


def _id() -> str:
    return uuid4().hex


def _now() -> datetime:
    return datetime.utcnow()


class V3Case(Base):
    __tablename__ = "v3_cases"
    id = Column(String(32), primary_key=True, default=_id)
    user_id = Column(String(64), index=True, nullable=False)
    title = Column(String(200), nullable=False)
    case_type = Column(String(60), default="other")
    status = Column(String(30), default="open")
    forum = Column(String(200), default="")  # court / authority / forum
    your_side = Column(String(200), default="")
    opposing_party = Column(String(200), default="")
    description = Column(Text, default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class V3CaseDocument(Base):
    __tablename__ = "v3_case_documents"
    id = Column(String(32), primary_key=True, default=_id)
    case_id = Column(String(32), ForeignKey("v3_cases.id"), index=True, nullable=False)
    user_id = Column(String(64), index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    kind = Column(String(30), default="upload")  # upload | notice | draft
    text = Column(Text, default="")
    created_at = Column(DateTime, default=_now)


class V3CaseNote(Base):
    __tablename__ = "v3_case_notes"
    id = Column(String(32), primary_key=True, default=_id)
    case_id = Column(String(32), ForeignKey("v3_cases.id"), index=True, nullable=False)
    user_id = Column(String(64), index=True, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now)


class V3CaseTask(Base):
    __tablename__ = "v3_case_tasks"
    id = Column(String(32), primary_key=True, default=_id)
    case_id = Column(String(32), ForeignKey("v3_cases.id"), index=True, nullable=False)
    user_id = Column(String(64), index=True, nullable=False)
    title = Column(String(300), nullable=False)
    detail = Column(Text, default="")
    due_date = Column(Date, nullable=True)
    done = Column(Boolean, default=False)
    source = Column(String(30), default="manual")  # manual | planner
    created_at = Column(DateTime, default=_now)


class V3CaseEvent(Base):
    __tablename__ = "v3_case_events"
    id = Column(String(32), primary_key=True, default=_id)
    case_id = Column(String(32), ForeignKey("v3_cases.id"), index=True, nullable=False)
    user_id = Column(String(64), index=True, nullable=False)
    title = Column(String(300), nullable=False)
    detail = Column(Text, default="")
    event_date = Column(Date, nullable=True)
    kind = Column(String(20), default="event")  # event | deadline
    source = Column(String(30), default="manual")  # manual | notice | ai
    created_at = Column(DateTime, default=_now)


class V3CaseMessage(Base):
    __tablename__ = "v3_case_messages"
    id = Column(String(32), primary_key=True, default=_id)
    case_id = Column(String(32), ForeignKey("v3_cases.id"), index=True, nullable=False)
    user_id = Column(String(64), index=True, nullable=False)
    role = Column(String(12), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now)


class V3CaseShare(Base):
    __tablename__ = "v3_case_shares"
    token = Column(String(64), primary_key=True)
    case_id = Column(String(32), ForeignKey("v3_cases.id"), index=True, nullable=False)
    user_id = Column(String(64), index=True, nullable=False)
    include_notes = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)
