"""Case Workspace endpoints. Private routes need login; /shared/{token} is public + read-only."""
import secrets
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import exporters, extract, llm
from .compat import get_current_user, get_db, user_id
from .helpers import (add_events, case_context, case_out, doc_out, event_out, get_owned_case, note_out, parse_date,
                      task_out)
from .models import (V3Case, V3CaseDocument, V3CaseEvent, V3CaseMessage, V3CaseNote, V3CaseShare, V3CaseTask)

router = APIRouter(prefix="/api/v3", tags=["v3-cases"], dependencies=[Depends(get_current_user)])
public_router = APIRouter(prefix="/api/v3/shared", tags=["v3-shared"])

CASE_TYPES = ["consumer", "tenant", "employment", "family", "criminal", "property", "cyber", "rti", "banking", "other"]
CASE_STATUS = ["open", "in_progress", "waiting", "closed"]


# ===================================================================== cases
class CaseIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    case_type: str = "other"
    status: str = "open"
    forum: str = ""
    your_side: str = ""
    opposing_party: str = ""
    description: str = ""


class CasePatch(BaseModel):
    title: Optional[str] = None
    case_type: Optional[str] = None
    status: Optional[str] = None
    forum: Optional[str] = None
    your_side: Optional[str] = None
    opposing_party: Optional[str] = None
    description: Optional[str] = None


@router.get("/cases")
def list_cases(db: Session = Depends(get_db), user=Depends(get_current_user)):
    uid = user_id(user)
    out = []
    for c in db.query(V3Case).filter(V3Case.user_id == uid).order_by(V3Case.updated_at.desc()):
        nxt = (db.query(V3CaseEvent)
               .filter(V3CaseEvent.case_id == c.id, V3CaseEvent.kind == "deadline", V3CaseEvent.event_date >= date.today())
               .order_by(V3CaseEvent.event_date).first())
        d = case_out(c)
        d["open_tasks"] = db.query(V3CaseTask).filter(V3CaseTask.case_id == c.id, V3CaseTask.done == False).count()  # noqa: E712
        d["documents"] = db.query(V3CaseDocument).filter(V3CaseDocument.case_id == c.id).count()
        d["next_deadline"] = event_out(nxt) if nxt else None
        out.append(d)
    return {"cases": out, "types": CASE_TYPES, "statuses": CASE_STATUS}


@router.post("/cases")
def create_case(body: CaseIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = V3Case(user_id=user_id(user), **body.dict())
    db.add(c)
    db.commit()
    db.refresh(c)
    return case_out(c)


@router.get("/cases/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    docs = db.query(V3CaseDocument).filter(V3CaseDocument.case_id == c.id).order_by(V3CaseDocument.created_at.desc()).all()
    notes = db.query(V3CaseNote).filter(V3CaseNote.case_id == c.id).order_by(V3CaseNote.created_at.desc()).all()
    tasks = db.query(V3CaseTask).filter(V3CaseTask.case_id == c.id).order_by(V3CaseTask.done, V3CaseTask.due_date).all()
    events = db.query(V3CaseEvent).filter(V3CaseEvent.case_id == c.id).order_by(V3CaseEvent.event_date).all()
    return {"case": case_out(c), "documents": [doc_out(d) for d in docs], "notes": [note_out(n) for n in notes],
            "tasks": [task_out(t) for t in tasks], "events": [event_out(e) for e in events],
            "types": CASE_TYPES, "statuses": CASE_STATUS}


@router.patch("/cases/{case_id}")
def update_case(case_id: str, body: CasePatch, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    for k, v in body.dict(exclude_unset=True).items():
        if v is not None:
            setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return case_out(c)


@router.delete("/cases/{case_id}")
def delete_case(case_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    for model in (V3CaseDocument, V3CaseNote, V3CaseTask, V3CaseEvent, V3CaseMessage, V3CaseShare):
        db.query(model).filter(model.case_id == c.id).delete()
    db.delete(c)
    db.commit()
    return {"ok": True}


# ===================================================================== documents
@router.post("/cases/{case_id}/documents")
def upload_document(case_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    uid = user_id(user)
    c = get_owned_case(db, case_id, uid)
    data = file.file.read(extract.MAX_BYTES + 1)
    text, method = extract.extract_text(file.filename or "file", data)
    d = V3CaseDocument(case_id=c.id, user_id=uid, filename=(file.filename or "file")[:255], kind="upload", text=text)
    db.add(d)
    db.commit()
    db.refresh(d)
    return {**doc_out(d), "method": method}


class DocTextIn(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    text: str = Field(min_length=1, max_length=extract.MAX_CHARS)
    kind: str = "draft"


@router.post("/cases/{case_id}/documents/text")
def add_text_document(case_id: str, body: DocTextIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    uid = user_id(user)
    c = get_owned_case(db, case_id, uid)
    d = V3CaseDocument(case_id=c.id, user_id=uid, filename=body.filename, kind=body.kind, text=body.text)
    db.add(d)
    db.commit()
    db.refresh(d)
    return doc_out(d)


@router.get("/cases/{case_id}/documents/{doc_id}")
def read_document(case_id: str, doc_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    d = db.query(V3CaseDocument).filter(V3CaseDocument.id == doc_id, V3CaseDocument.case_id == c.id).first()
    if not d:
        raise HTTPException(404, "Document not found.")
    return {**doc_out(d), "text": d.text}


@router.delete("/cases/{case_id}/documents/{doc_id}")
def delete_document(case_id: str, doc_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    db.query(V3CaseDocument).filter(V3CaseDocument.id == doc_id, V3CaseDocument.case_id == c.id).delete()
    db.commit()
    return {"ok": True}


# ===================================================================== notes
class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


@router.post("/cases/{case_id}/notes")
def add_note(case_id: str, body: NoteIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    uid = user_id(user)
    c = get_owned_case(db, case_id, uid)
    n = V3CaseNote(case_id=c.id, user_id=uid, body=body.body)
    db.add(n)
    db.commit()
    db.refresh(n)
    return note_out(n)


@router.delete("/cases/{case_id}/notes/{note_id}")
def delete_note(case_id: str, note_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    db.query(V3CaseNote).filter(V3CaseNote.id == note_id, V3CaseNote.case_id == c.id).delete()
    db.commit()
    return {"ok": True}


# ===================================================================== tasks
class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    detail: str = ""
    due_date: Optional[str] = None


class TaskPatch(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None
    due_date: Optional[str] = None


@router.post("/cases/{case_id}/tasks")
def add_task(case_id: str, body: TaskIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    uid = user_id(user)
    c = get_owned_case(db, case_id, uid)
    t = V3CaseTask(case_id=c.id, user_id=uid, title=body.title, detail=body.detail, due_date=parse_date(body.due_date))
    db.add(t)
    db.commit()
    db.refresh(t)
    return task_out(t)


@router.patch("/cases/{case_id}/tasks/{task_id}")
def patch_task(case_id: str, task_id: str, body: TaskPatch, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    t = db.query(V3CaseTask).filter(V3CaseTask.id == task_id, V3CaseTask.case_id == c.id).first()
    if not t:
        raise HTTPException(404, "Task not found.")
    data = body.dict(exclude_unset=True)
    if "title" in data and data["title"]:
        t.title = data["title"]
    if "done" in data and data["done"] is not None:
        t.done = data["done"]
    if "due_date" in data:
        t.due_date = parse_date(data["due_date"])
    db.commit()
    return task_out(t)


@router.delete("/cases/{case_id}/tasks/{task_id}")
def delete_task(case_id: str, task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    db.query(V3CaseTask).filter(V3CaseTask.id == task_id, V3CaseTask.case_id == c.id).delete()
    db.commit()
    return {"ok": True}


# ===================================================================== timeline / deadlines
class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    detail: str = ""
    date: Optional[str] = None
    kind: str = "event"  # event | deadline


@router.post("/cases/{case_id}/events")
def add_event(case_id: str, body: EventIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    uid = user_id(user)
    c = get_owned_case(db, case_id, uid)
    created = add_events(db, c.id, uid, [body.dict()], source="manual")
    if not created:
        raise HTTPException(409, "This event already exists.")
    return event_out(created[0])


@router.delete("/cases/{case_id}/events/{event_id}")
def delete_event(case_id: str, event_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    db.query(V3CaseEvent).filter(V3CaseEvent.id == event_id, V3CaseEvent.case_id == c.id).delete()
    db.commit()
    return {"ok": True}


@router.post("/cases/{case_id}/events/extract")
def extract_events(case_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Read all case documents + notes and add dated events / deadlines to the timeline."""
    uid = user_id(user)
    c = get_owned_case(db, case_id, uid)
    context = case_context(db, c, per_doc=15000, total=50000)
    system = (
        llm.BASE_SYSTEM + " " + llm.today_line() + " " + llm.DOC_GUARD + "\n"
        'Task: build a timeline from the case file. Output JSON: {"events": [{"title": str, "detail": str, '
        '"date": "YYYY-MM-DD or null", "kind": "event"|"deadline"}]}. '
        "Use kind=deadline for dates by which someone must act (reply, hearing, payment, filing). "
        "Only include facts present in the text. Max 25 items."
    )
    result = llm.ask_json(system, f"<<<DOCUMENT>>>\n{context}\n<<<DOCUMENT>>>", max_tokens=3000)
    items = [e for e in (result.get("events") or []) if isinstance(e, dict)]
    created = add_events(db, c.id, uid, items, source="ai")
    return {"added": len(created), "events": [event_out(e) for e in created]}


def _upcoming(db: Session, uid: str, case_id: Optional[str] = None, days: int = 365):
    q = (db.query(V3CaseEvent, V3Case)
         .join(V3Case, V3Case.id == V3CaseEvent.case_id)
         .filter(V3CaseEvent.user_id == uid, V3CaseEvent.kind == "deadline", V3CaseEvent.event_date != None,  # noqa: E711
                 V3CaseEvent.event_date >= date.today() - timedelta(days=7),
                 V3CaseEvent.event_date <= date.today() + timedelta(days=days)))
    if case_id:
        q = q.filter(V3CaseEvent.case_id == case_id)
    return q.order_by(V3CaseEvent.event_date).all()


@router.get("/deadlines")
def deadlines(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = _upcoming(db, user_id(user))
    return {"deadlines": [{**event_out(e), "case_id": c.id, "case_title": c.title} for e, c in rows]}


def _ics_response(rows, name: str) -> Response:
    ics = exporters.make_ics(
        [{"id": e.id, "title": f"{e.title} ({c.title})", "detail": e.detail or "", "date": e.event_date} for e, c in rows], cal_name=name)
    return Response(content=ics, media_type="text/calendar", headers={"Content-Disposition": 'attachment; filename="verdict-deadlines.ics"'})


@router.get("/deadlines.ics")
def deadlines_ics(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return _ics_response(_upcoming(db, user_id(user)), "VERDICT deadlines")


@router.get("/cases/{case_id}/deadlines.ics")
def case_deadlines_ics(case_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    uid = user_id(user)
    c = get_owned_case(db, case_id, uid)
    return _ics_response(_upcoming(db, uid, c.id), f"{c.title} deadlines")


# ===================================================================== case chat
class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    language: str = "English"


@router.get("/cases/{case_id}/chat")
def chat_history(case_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    msgs = db.query(V3CaseMessage).filter(V3CaseMessage.case_id == c.id).order_by(V3CaseMessage.created_at).all()
    return {"messages": [{"id": m.id, "role": m.role, "content": m.content} for m in msgs]}


@router.post("/cases/{case_id}/chat")
def chat(case_id: str, body: ChatIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    uid = user_id(user)
    c = get_owned_case(db, case_id, uid)
    history = (db.query(V3CaseMessage).filter(V3CaseMessage.case_id == c.id)
               .order_by(V3CaseMessage.created_at.desc()).limit(10).all())[::-1]
    system = (
        llm.BASE_SYSTEM + " " + llm.today_line() + " " + llm.lang_line(body.language) + " " + llm.DOC_GUARD + "\n"
        "You are the assistant for ONE case. Answer ONLY from the CASE FILE below (details, timeline, notes, tasks and documents). "
        "Mention the document name when you use it. If the answer is not in the case file, say 'This is not in your case file' "
        "and suggest what to add or who to ask; you may add clearly-labelled general legal information, but never invent case facts. "
        "End legal-interpretation answers with: 'General information, not legal advice.'\n\n"
        f"<<<DOCUMENT>>>\n{case_context(db, c)}\n<<<DOCUMENT>>>"
    )
    messages = [{"role": "system", "content": system}] + [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": body.message})
    answer = llm.chat(messages, temperature=0.2, max_tokens=1800)
    db.add(V3CaseMessage(case_id=c.id, user_id=uid, role="user", content=body.message))
    db.add(V3CaseMessage(case_id=c.id, user_id=uid, role="assistant", content=answer))
    db.commit()
    return {"answer": answer}


@router.delete("/cases/{case_id}/chat")
def clear_chat(case_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    db.query(V3CaseMessage).filter(V3CaseMessage.case_id == c.id).delete()
    db.commit()
    return {"ok": True}


# ===================================================================== summary / export / share
def build_summary(db: Session, c: V3Case, *, include_notes: bool = True) -> Dict[str, Any]:
    events = db.query(V3CaseEvent).filter(V3CaseEvent.case_id == c.id).order_by(V3CaseEvent.event_date).all()
    tasks = db.query(V3CaseTask).filter(V3CaseTask.case_id == c.id).order_by(V3CaseTask.done, V3CaseTask.due_date).all()
    docs = db.query(V3CaseDocument).filter(V3CaseDocument.case_id == c.id).order_by(V3CaseDocument.created_at).all()
    notes = db.query(V3CaseNote).filter(V3CaseNote.case_id == c.id).order_by(V3CaseNote.created_at).all() if include_notes else []
    return {
        "case": case_out(c),
        "timeline": [event_out(e) for e in events],
        "tasks": [task_out(t) for t in tasks],
        "documents": [{"filename": d.filename, "kind": d.kind} for d in docs],
        "notes": [note_out(n) for n in notes],
        "generated_on": date.today().isoformat(),
    }


def summary_blocks(s: Dict[str, Any]) -> List[exporters.Block]:
    c = s["case"]
    b: List[exporters.Block] = [("h", "Case details")]
    for label, key in [("Type", "case_type"), ("Status", "status"), ("Forum / authority", "forum"),
                       ("Your side", "your_side"), ("Opposing party", "opposing_party")]:
        if c.get(key):
            b.append(("p", f"{label}: {c[key]}"))
    if c.get("description"):
        b += [("h", "Background"), ("p", c["description"])]
    dl = [e for e in s["timeline"] if e["kind"] == "deadline"]
    if dl:
        b.append(("h", "Deadlines"))
        b += [("b", f"{e['event_date'] or 'No date'} - {e['title']}" + (f": {e['detail']}" if e["detail"] else "")) for e in dl]
    ev = [e for e in s["timeline"] if e["kind"] != "deadline"]
    if ev:
        b.append(("h", "Timeline"))
        b += [("b", f"{e['event_date'] or 'No date'} - {e['title']}" + (f": {e['detail']}" if e["detail"] else "")) for e in ev]
    if s["tasks"]:
        b.append(("h", "Tasks"))
        b += [("b", f"[{'done' if t['done'] else 'open'}] {t['title']}" + (f" (due {t['due_date']})" if t["due_date"] else "")) for t in s["tasks"]]
    if s["documents"]:
        b.append(("h", "Documents on file"))
        b += [("b", d["filename"]) for d in s["documents"]]
    if s["notes"]:
        b.append(("h", "Notes"))
        b += [("p", n["body"]) for n in s["notes"]]
    b.append(("p", f"Generated by VERDICT on {s['generated_on']}. General information, not legal advice."))
    return b


def _file_response(s: Dict[str, Any], fmt: str) -> Response:
    title = f"Case summary: {s['case']['title']}"
    blocks = summary_blocks(s)
    if fmt == "docx":
        data = exporters.render_docx(title, blocks)
        mime, ext = "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"
    else:
        data, mime, ext = exporters.render_pdf(title, blocks), "application/pdf", "pdf"
    return Response(content=data, media_type=mime, headers={"Content-Disposition": f'attachment; filename="case-summary.{ext}"'})


@router.get("/cases/{case_id}/summary")
def case_summary(case_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return build_summary(db, get_owned_case(db, case_id, user_id(user)))


@router.get("/cases/{case_id}/export")
def case_export(case_id: str, format: str = "pdf",
                db: Session = Depends(get_db), user=Depends(get_current_user)):
    if format not in ("pdf", "docx"):
        raise HTTPException(400, "format must be pdf or docx")
    return _file_response(build_summary(db, get_owned_case(db, case_id, user_id(user))), format)


class ShareIn(BaseModel):
    days: int = Field(default=7, ge=1, le=90)
    include_notes: bool = False


@router.post("/cases/{case_id}/share")
def create_share(case_id: str, body: ShareIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    uid = user_id(user)
    c = get_owned_case(db, case_id, uid)
    s = V3CaseShare(token=secrets.token_urlsafe(24), case_id=c.id, user_id=uid, include_notes=body.include_notes,
                    expires_at=datetime.utcnow() + timedelta(days=body.days))
    db.add(s)
    db.commit()
    return {"token": s.token, "expires_at": s.expires_at.isoformat(), "include_notes": s.include_notes}


@router.get("/cases/{case_id}/shares")
def list_shares(case_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    rows = db.query(V3CaseShare).filter(V3CaseShare.case_id == c.id).order_by(V3CaseShare.created_at.desc()).all()
    return {"shares": [{"token": s.token, "expires_at": s.expires_at.isoformat(), "include_notes": s.include_notes,
                        "active": (not s.revoked) and s.expires_at > datetime.utcnow()} for s in rows]}


@router.delete("/cases/{case_id}/share/{token}")
def revoke_share(case_id: str, token: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = get_owned_case(db, case_id, user_id(user))
    s = db.query(V3CaseShare).filter(V3CaseShare.token == token, V3CaseShare.case_id == c.id).first()
    if s:
        s.revoked = True
        db.commit()
    return {"ok": True}


# ----------------------------------------------------------- public (no login), read-only
def _valid_share(db: Session, token: str) -> V3CaseShare:
    s = db.query(V3CaseShare).filter(V3CaseShare.token == token).first()
    if not s or s.revoked or s.expires_at < datetime.utcnow():
        raise HTTPException(404, "This link is invalid or has expired.")
    return s


@public_router.get("/{token}")
def shared_view(token: str, db: Session = Depends(get_db)):
    s = _valid_share(db, token)
    c = db.query(V3Case).filter(V3Case.id == s.case_id).first()
    if not c:
        raise HTTPException(404, "This link is invalid or has expired.")
    data = build_summary(db, c, include_notes=bool(s.include_notes))
    data["expires_at"] = s.expires_at.isoformat()
    return data


@public_router.get("/{token}/pdf")
def shared_pdf(token: str, db: Session = Depends(get_db)):
    s = _valid_share(db, token)
    c = db.query(V3Case).filter(V3Case.id == s.case_id).first()
    if not c:
        raise HTTPException(404, "This link is invalid or has expired.")
    return _file_response(build_summary(db, c, include_notes=bool(s.include_notes)), "pdf")
