"""Small helpers shared by the v3 route files."""
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import (V3Case, V3CaseDocument, V3CaseEvent, V3CaseNote, V3CaseTask)


def parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def get_owned_case(db: Session, case_id: str, uid: str) -> V3Case:
    case = db.query(V3Case).filter(V3Case.id == case_id, V3Case.user_id == uid).first()
    if not case:
        raise HTTPException(404, "Case not found.")
    return case


def iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def case_out(c: V3Case) -> Dict[str, Any]:
    return {
        "id": c.id, "title": c.title, "case_type": c.case_type, "status": c.status, "forum": c.forum,
        "your_side": c.your_side, "opposing_party": c.opposing_party, "description": c.description,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def doc_out(d: V3CaseDocument) -> Dict[str, Any]:
    return {"id": d.id, "filename": d.filename, "kind": d.kind, "chars": len(d.text or ""),
            "created_at": d.created_at.isoformat() if d.created_at else None}


def note_out(n: V3CaseNote) -> Dict[str, Any]:
    return {"id": n.id, "body": n.body, "created_at": n.created_at.isoformat() if n.created_at else None}


def task_out(t: V3CaseTask) -> Dict[str, Any]:
    return {"id": t.id, "title": t.title, "detail": t.detail, "due_date": iso(t.due_date), "done": bool(t.done), "source": t.source}


def event_out(e: V3CaseEvent) -> Dict[str, Any]:
    days = (e.event_date - date.today()).days if e.event_date else None
    return {"id": e.id, "title": e.title, "detail": e.detail, "event_date": iso(e.event_date), "kind": e.kind,
            "source": e.source, "days_left": days}


def add_events(db: Session, case_id: str, uid: str, items: Iterable[Dict[str, Any]], source: str) -> List[V3CaseEvent]:
    """items: dicts with title, detail?, date?, kind? . Skips duplicates (same title+date)."""
    existing = {(e.title.strip().lower(), e.event_date) for e in db.query(V3CaseEvent).filter(V3CaseEvent.case_id == case_id)}
    created = []
    for it in items:
        title = str(it.get("title") or it.get("label") or "").strip()[:300]
        if not title:
            continue
        d = parse_date(it.get("date"))
        if (title.lower(), d) in existing:
            continue
        kind = "deadline" if it.get("kind") == "deadline" else "event"
        ev = V3CaseEvent(case_id=case_id, user_id=uid, title=title, detail=str(it.get("detail") or "")[:2000],
                         event_date=d, kind=kind, source=source)
        db.add(ev)
        existing.add((title.lower(), d))
        created.append(ev)
    db.commit()
    return created


def add_tasks(db: Session, case_id: str, uid: str, steps: Iterable[Dict[str, Any]], source: str) -> List[V3CaseTask]:
    created = []
    for st in steps:
        title = str(st.get("title") or "").strip()[:300]
        if not title:
            continue
        due = None
        n = st.get("due_in_days")
        if isinstance(n, (int, float)) and 0 <= n <= 3650:
            due = date.today() + timedelta(days=int(n))
        t = V3CaseTask(case_id=case_id, user_id=uid, title=title, detail=str(st.get("detail") or "")[:2000],
                       due_date=due, source=source)
        db.add(t)
        created.append(t)
    db.commit()
    return created


def case_context(db: Session, case: V3Case, *, per_doc: int = 12000, total: int = 45000) -> str:
    """Plain-text dump of a case used as the ONLY knowledge for case chat."""
    parts = [
        f"CASE TITLE: {case.title}", f"TYPE: {case.case_type}", f"STATUS: {case.status}", f"FORUM/AUTHORITY: {case.forum}",
        f"YOUR SIDE: {case.your_side}", f"OPPOSING PARTY: {case.opposing_party}", f"DESCRIPTION: {case.description}",
    ]
    for e in db.query(V3CaseEvent).filter(V3CaseEvent.case_id == case.id).order_by(V3CaseEvent.event_date):
        parts.append(f"[{e.kind.upper()}] {e.event_date or 'no date'}: {e.title}. {e.detail or ''}")
    for n in db.query(V3CaseNote).filter(V3CaseNote.case_id == case.id).order_by(V3CaseNote.created_at):
        parts.append(f"[NOTE] {n.body}")
    for t in db.query(V3CaseTask).filter(V3CaseTask.case_id == case.id):
        parts.append(f"[TASK {'done' if t.done else 'open'}] {t.title} (due {t.due_date or 'n/a'})")
    text = "\n".join(parts)
    for d in db.query(V3CaseDocument).filter(V3CaseDocument.case_id == case.id).order_by(V3CaseDocument.created_at):
        chunk = f"\n\n=== DOCUMENT: {d.filename} ===\n{(d.text or '')[:per_doc]}"
        if len(text) + len(chunk) > total:
            text += f"\n\n=== DOCUMENT: {d.filename} === (omitted: size limit)"
            continue
        text += chunk
    return text
