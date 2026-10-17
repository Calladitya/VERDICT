"""The core AI explainer: turns a legal/policy question into a structured,
source-grounded explanation. Supports a streaming (SSE) endpoint that emits
progress stages, and a plain JSON endpoint."""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..deps import get_current_user, rate_limit
from ..models import Citation, Conversation, Document, Message, User
from ..schemas import ExplainRequest, MessageOut
from ..services import llm

router = APIRouter(prefix="/api/explain", tags=["explain"])

STAGES = [
    "Understanding your question…",
    "Identifying the jurisdiction and legal area…",
    "Finding relevant provisions and official sources…",
    "Preparing your plain-language explanation…",
]


def _get_or_create_conversation(
    db: Session, user: User, req: ExplainRequest
) -> Conversation:
    if req.conversation_id:
        conv = db.get(Conversation, req.conversation_id)
        if not conv or conv.user_id != user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conv
    title = req.question.strip()[:60] + ("…" if len(req.question) > 60 else "")
    conv = Conversation(
        user_id=user.id,
        title=title or "New conversation",
        jurisdiction=req.jurisdiction,
        topic=req.topic,
        mode=req.mode,
        persona=req.persona,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def _document_excerpt(db: Session, user: User, document_id: str | None) -> str:
    if not document_id:
        return ""
    doc = db.get(Document, document_id)
    if doc and doc.user_id == user.id:
        return doc.extracted_text or ""
    return ""


def _persist(db: Session, conv: Conversation, req: ExplainRequest, result: dict) -> Message:
    db.add(Message(conversation_id=conv.id, role="user", content=req.question))
    assistant = Message(
        conversation_id=conv.id,
        role="assistant",
        content=result.get("short_answer", ""),
        structured=result,
    )
    db.add(assistant)
    db.flush()
    for c in result.get("citations", []) or []:
        if not isinstance(c, dict):
            continue
        db.add(
            Citation(
                message_id=assistant.id,
                title=str(c.get("title", ""))[:400],
                authority=str(c.get("authority", ""))[:255],
                section=str(c.get("section", ""))[:120],
                jurisdiction=str(c.get("jurisdiction", req.jurisdiction))[:120],
                url=str(c.get("url", ""))[:600],
                source_type=str(c.get("source_type", "primary"))[:40],
                confidence=str(c.get("confidence", "medium"))[:20],
                published_date=str(c.get("published_date", ""))[:40],
                effective_date=str(c.get("effective_date", ""))[:40],
            )
        )
    conv.updated_at = conv.updated_at  # trigger onupdate
    db.commit()
    db.refresh(assistant)
    return assistant


@router.post("", response_model=MessageOut)
async def explain(
    req: ExplainRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _: None = Depends(rate_limit),
):
    conv = _get_or_create_conversation(db, user, req)
    excerpt = _document_excerpt(db, user, req.document_id)
    try:
        result = await llm.generate_explanation(
            req.question, req.jurisdiction, req.mode, req.persona, req.topic, excerpt
        )
    except llm.LLMError as exc:
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")
    assistant = _persist(db, conv, req, result)
    out = MessageOut.model_validate(assistant)
    return out


@router.post("/stream")
async def explain_stream(
    req: ExplainRequest,
    user: User = Depends(get_current_user),
    _: None = Depends(rate_limit),
):
    """Server-Sent Events stream: progress stages, then the final structured result.

    Uses its own DB session because the generator outlives the request-scoped
    dependency session.
    """

    async def event_gen():
        db = SessionLocal()
        try:
            conv = _get_or_create_conversation(db, user, req)
            yield _sse({"type": "conversation", "conversation_id": conv.id})
            excerpt = _document_excerpt(db, user, req.document_id)

            # Kick off the model call while we emit progress stages.
            task = asyncio.create_task(
                llm.generate_explanation(
                    req.question, req.jurisdiction, req.mode,
                    req.persona, req.topic, excerpt,
                )
            )
            for stage in STAGES:
                yield _sse({"type": "status", "message": stage})
                # Stop stalling once the model is done.
                if task.done():
                    break
                await asyncio.sleep(0.5)

            result = await task
            assistant = _persist(db, conv, req, result)
            payload = MessageOut.model_validate(assistant).model_dump(mode="json")
            yield _sse({"type": "result", "message": payload})
        except llm.LLMError as exc:
            yield _sse({"type": "error", "message": f"AI service error: {exc}"})
        except HTTPException as exc:
            yield _sse({"type": "error", "message": exc.detail})
        except Exception as exc:  # noqa: BLE001
            yield _sse({"type": "error", "message": f"Unexpected error: {exc}"})
        finally:
            db.close()

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
