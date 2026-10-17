"""Everyday legal help endpoints (all under /api/v3, login required)."""
import json
import re
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import extract, exporters, grounding, llm
from .compat import get_current_user, get_db, user_id
from .helpers import add_events, add_tasks, event_out, get_owned_case, task_out
from .models import V3CaseDocument

router = APIRouter(prefix="/api/v3", tags=["v3-everyday"], dependencies=[Depends(get_current_user)])

DATA = Path(__file__).parent / "data"


def _load(name: str) -> Dict[str, Any]:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


# ------------------------------------------------------------------ health
@router.get("/health")
def health():
    return {"ok": True, "llm_configured": llm.is_configured(), "sources": grounding.status()}


# ------------------------------------------------------------------ static data
@router.get("/rights")
def rights():
    return _load("rights.json")


@router.get("/resources")
def resources(issue: str = "", state: str = "", q: str = ""):
    items = _load("resources.json")["items"]
    out = []
    for it in items:
        if state and state.lower() not in [s.lower() for s in it.get("states", [])] and "all india" not in [s.lower() for s in it.get("states", [])]:
            continue
        hay = " ".join([it["name"], it.get("what", ""), " ".join(it.get("issues", []))]).lower()
        if issue and issue.lower() not in " ".join(it.get("issues", [])).lower():
            continue
        if q and q.lower() not in hay:
            continue
        out.append(it)
    issues = sorted({i for it in items for i in it.get("issues", [])})
    return {"items": out, "issues": issues}


@router.get("/mapping")
def mapping(q: str = Query("", max_length=60)):
    """Search by old OR new section number / law / keyword. e.g. 302, 498A, BNSS 173, bail."""
    data = _load("code_mapping.json")
    rows = data["rows"]
    s = q.strip().lower()
    if not s:
        return {"rows": rows[:40], "total": len(rows), "note": data["note"]}

    def base(x: str) -> str:
        return x.lower().split("(")[0]

    m = re.search(r"(\d+[a-z]?)", s)
    law_words = re.findall(r"\b(ipc|bnss|bns|crpc|bsa|evidence)\b", s)
    res = []
    for r in rows:
        laws = {r["old_law"].lower().split()[0], r["new_law"].lower()}
        if m:
            num = m.group(1)
            if (base(r["old"]) == num or base(r["new"]) == num) and (not law_words or any(w in laws for w in law_words)):
                res.append(r)
        elif s in r["title"].lower() or any(w in laws for w in law_words):
            res.append(r)
    return {"rows": res, "total": len(res), "note": data["note"]}


# ------------------------------------------------------------------ drafting suite
DRAFT_TYPES: Dict[str, Dict[str, Any]] = {
    "legal_notice": {
        "label": "Legal notice",
        "instruction": "A formal legal notice from the sender to the recipient. Structure: heading, date, sender and recipient details, "
                       "subject line, numbered facts, the legal grievance in general terms, the demand, a deadline of the given number of days, "
                       "a warning that legal action will follow if the demand is not met, and a closing with signature block. "
                       "Do NOT cite specific sections unless they are obviously standard; prefer general wording.",
        "fields": [
            {"key": "sender_name", "label": "Your name", "type": "text", "required": True},
            {"key": "sender_address", "label": "Your address", "type": "textarea", "required": True},
            {"key": "recipient_name", "label": "Recipient name", "type": "text", "required": True},
            {"key": "recipient_address", "label": "Recipient address", "type": "textarea", "required": False},
            {"key": "subject", "label": "Subject", "type": "text", "required": True, "placeholder": "e.g. Non-payment of Rs 50,000 due since March"},
            {"key": "facts", "label": "What happened (facts, dates, amounts)", "type": "textarea", "required": True},
            {"key": "demand", "label": "What do you want them to do?", "type": "textarea", "required": True},
            {"key": "deadline_days", "label": "Days to comply", "type": "number", "required": False, "placeholder": "15"},
        ],
    },
    "rti": {
        "label": "RTI application",
        "instruction": "An application under the Right to Information Act, 2005 addressed to the Public Information Officer. Include: "
                       "applicant details, the authority, a numbered list of specific information sought (clear and narrow), the period, "
                       "a line stating the application fee is enclosed/paid as per rules (or BPL exemption if stated), the preferred mode of reply, "
                       "and a declaration that the applicant is an Indian citizen. Do not give reasons for seeking information.",
        "fields": [
            {"key": "applicant_name", "label": "Your name", "type": "text", "required": True},
            {"key": "applicant_address", "label": "Your address", "type": "textarea", "required": True},
            {"key": "authority", "label": "Department / Public Authority", "type": "text", "required": True},
            {"key": "information_sought", "label": "What information do you want?", "type": "textarea", "required": True},
            {"key": "period", "label": "Time period (optional)", "type": "text", "required": False, "placeholder": "e.g. April 2024 to March 2025"},
            {"key": "bpl", "label": "Below poverty line? (yes/no)", "type": "text", "required": False, "placeholder": "no"},
        ],
    },
    "consumer_complaint": {
        "label": "Consumer complaint",
        "instruction": "A consumer complaint to the District Consumer Disputes Redressal Commission under the Consumer Protection Act, 2019. "
                       "Include: forum heading, complainant and opposite party details, facts in numbered paragraphs, deficiency in service / defect, "
                       "previous attempts to resolve, relief claimed (refund / replacement / compensation / costs), list of documents enclosed, "
                       "a prayer clause and verification placeholder. Leave limitation and jurisdiction paragraphs generic with placeholders.",
        "fields": [
            {"key": "complainant_name", "label": "Your name", "type": "text", "required": True},
            {"key": "complainant_address", "label": "Your address", "type": "textarea", "required": True},
            {"key": "opposite_party", "label": "Company / seller name and address", "type": "textarea", "required": True},
            {"key": "product_service", "label": "Product or service", "type": "text", "required": True},
            {"key": "purchase_date", "label": "Date of purchase / service", "type": "date", "required": False},
            {"key": "amount_paid", "label": "Amount paid (Rs)", "type": "text", "required": False},
            {"key": "grievance", "label": "What went wrong?", "type": "textarea", "required": True},
            {"key": "previous_attempts", "label": "What did you already try (calls, emails, helpline)?", "type": "textarea", "required": False},
            {"key": "relief_sought", "label": "Relief you want", "type": "textarea", "required": True},
        ],
    },
    "rental_termination": {
        "label": "Rental termination notice",
        "instruction": "A rental agreement termination notice. Include the parties, property address, original lease start date, the notice period "
                       "and the date the tenancy ends, handling of security deposit and handover of possession, and a polite but firm closing. "
                       "Mention that the notice is given as per the rent agreement and applicable law.",
        "fields": [
            {"key": "sender_role", "label": "You are the", "type": "text", "required": True, "placeholder": "tenant or landlord"},
            {"key": "sender_name", "label": "Your name", "type": "text", "required": True},
            {"key": "other_party", "label": "Other party's name", "type": "text", "required": True},
            {"key": "property_address", "label": "Property address", "type": "textarea", "required": True},
            {"key": "lease_start", "label": "Agreement start date", "type": "date", "required": False},
            {"key": "notice_days", "label": "Notice period (days, as per agreement)", "type": "number", "required": False},
            {"key": "end_date", "label": "Tenancy end date", "type": "date", "required": False},
            {"key": "reason", "label": "Reason (optional)", "type": "textarea", "required": False},
            {"key": "deposit", "label": "Security deposit details", "type": "text", "required": False},
        ],
    },
    "police_complaint": {
        "label": "Police complaint / FIR request",
        "instruction": "A written complaint to the Station House Officer requesting registration of an FIR. Include complainant details, "
                       "date/time/place of incident, a chronological narration, details of accused (if known), witnesses, evidence, "
                       "and a request to register the FIR and provide a free copy. Do not name specific sections.",
        "fields": [
            {"key": "complainant_name", "label": "Your name", "type": "text", "required": True},
            {"key": "complainant_address", "label": "Your address and phone", "type": "textarea", "required": True},
            {"key": "police_station", "label": "Police station", "type": "text", "required": True},
            {"key": "incident_when", "label": "Date and time of incident", "type": "text", "required": True},
            {"key": "incident_where", "label": "Place of incident", "type": "text", "required": True},
            {"key": "description", "label": "What happened?", "type": "textarea", "required": True},
            {"key": "accused", "label": "Accused (if known)", "type": "textarea", "required": False},
            {"key": "witnesses_evidence", "label": "Witnesses / evidence", "type": "textarea", "required": False},
        ],
    },
    "general_complaint": {
        "label": "General complaint letter",
        "instruction": "A formal complaint letter to an authority or company. Include subject, a concise factual background, what went wrong, "
                       "earlier attempts, the specific resolution requested, a reasonable time limit, and a list of enclosures.",
        "fields": [
            {"key": "from_name", "label": "Your name and contact", "type": "textarea", "required": True},
            {"key": "to_authority", "label": "Addressed to (authority / company)", "type": "textarea", "required": True},
            {"key": "subject", "label": "Subject", "type": "text", "required": True},
            {"key": "details", "label": "Details of the problem", "type": "textarea", "required": True},
            {"key": "resolution", "label": "What resolution do you want?", "type": "textarea", "required": True},
        ],
    },
}


@router.get("/draft/types")
def draft_types():
    return {"types": [{"key": k, "label": v["label"], "fields": v["fields"]} for k, v in DRAFT_TYPES.items()]}


class DraftIn(BaseModel):
    doc_type: str
    fields: Dict[str, Any] = Field(default_factory=dict)
    language: str = "English"


@router.post("/draft/generate")
def draft_generate(body: DraftIn):
    spec = DRAFT_TYPES.get(body.doc_type)
    if not spec:
        raise HTTPException(400, "Unknown document type.")
    missing = [f["label"] for f in spec["fields"] if f.get("required") and not str(body.fields.get(f["key"], "")).strip()]
    if missing:
        raise HTTPException(400, "Please fill: " + ", ".join(missing))
    facts = "\n".join(f"{f['label']}: {str(body.fields.get(f['key'], '')).strip()}" for f in spec["fields"] if str(body.fields.get(f["key"], "")).strip())
    system = (
        llm.BASE_SYSTEM + " You draft documents for ordinary people. " + llm.today_line() + " " + llm.lang_line(body.language) + "\n"
        f"Draft: {spec['label']}. {spec['instruction']}\n"
        "RULES: use ONLY the facts supplied; never invent names, dates, amounts, registration numbers or case numbers. "
        "Where information is missing write a [BRACKETED PLACEHOLDER]. Plain text only, no markdown symbols, no headings with #. "
        "Do not add commentary before or after the document."
    )
    text = llm.ask_text(system, "Facts supplied by the user:\n" + facts, max_tokens=3500, temperature=0.3)
    text = re.sub(r"^```[a-z]*\n|\n```$", "", text.strip())
    text = text.replace("**", "")
    return {"title": spec["label"], "text": text}


class ExportIn(BaseModel):
    title: str = "Document"
    text: str = Field(min_length=1, max_length=60000)
    format: str = "docx"


@router.post("/export")
def export_doc(body: ExportIn):
    blocks = exporters.text_to_blocks(body.text)
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", body.title)[:40] or "document"
    if body.format == "pdf":
        data, mime, ext = exporters.render_pdf(body.title, blocks, show_title=False), "application/pdf", "pdf"
    else:
        data = exporters.render_docx(body.title, blocks, show_title=False)
        mime, ext = "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"
    return Response(content=data, media_type=mime, headers={"Content-Disposition": f'attachment; filename="{safe}.{ext}"'})


# ------------------------------------------------------------------ notice decoder
@router.post("/notice/decode")
def notice_decode(
    file: Optional[UploadFile] = File(None),
    text: str = Form(""),
    language: str = Form("English"),
    case_id: str = Form(""),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user_id(user)
    case = get_owned_case(db, case_id, uid) if case_id else None

    filename, method = "pasted-text.txt", "text"
    if file is not None and file.filename:
        data = file.file.read(extract.MAX_BYTES + 1)
        doc_text, method = extract.extract_text(file.filename, data)
        filename = file.filename
    elif text.strip():
        doc_text = text.strip()[: extract.MAX_CHARS]
    else:
        raise HTTPException(400, "Upload a file or paste the notice text.")

    system = (
        llm.BASE_SYSTEM + " " + llm.today_line() + " " + llm.lang_line(language) + " " + llm.DOC_GUARD + "\n"
        "Task: explain a legal/official notice to an ordinary person. Output JSON with exactly these keys:\n"
        '{"notice_type": str, "sender": str, "summary": str (3-5 simple sentences), '
        '"key_points": [str], '
        '"deadlines": [{"label": str, "date": "YYYY-MM-DD or null", "days_from_receipt": int or null, "consequence": str}], '
        '"what_to_do": [str] (ordered, concrete, simple), '
        '"documents_to_gather": [str], "risks": [str], "urgency": "low"|"medium"|"high", '
        '"questions_for_lawyer": [str]}\n'
        "Only include deadlines that are actually in the document. If a date is not stated, use null. "
        "If the text is not a legal/official notice, say so in summary and keep other lists short."
    )
    result = llm.ask_json(system, f"<<<DOCUMENT>>>\n{doc_text}\n<<<DOCUMENT>>>", max_tokens=3500)

    saved = None
    if case:
        doc = V3CaseDocument(case_id=case.id, user_id=uid, filename=filename, kind="notice", text=doc_text)
        db.add(doc)
        db.commit()
        evs = add_events(
            db, case.id, uid,
            [{"title": d.get("label"), "detail": d.get("consequence"), "date": d.get("date"), "kind": "deadline"}
             for d in (result.get("deadlines") or []) if isinstance(d, dict)],
            source="notice",
        )
        saved = {"case_id": case.id, "document_id": doc.id, "events_added": len(evs)}
    return {"filename": filename, "method": method, "chars": len(doc_text), "result": result, "saved": saved}


# ------------------------------------------------------------------ action planner
class PlannerIn(BaseModel):
    situation: str = Field(min_length=10, max_length=4000)
    language: str = "English"
    case_id: Optional[str] = None


EMERGENCY_WORDS = re.compile(r"\b(arrest(ed)?|beat(ing|en)?|violence|threat(en|ening|ened)?|kill|suicide|rape|abuse[d]?|kidnap|trafficking|acid|stalk(ing|ed)?)\b", re.I)


@router.post("/planner")
def planner(body: PlannerIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    uid = user_id(user)
    case = get_owned_case(db, body.case_id, uid) if body.case_id else None
    system = (
        llm.BASE_SYSTEM + " " + llm.today_line() + " " + llm.lang_line(body.language) + " " + llm.DOC_GUARD + "\n"
        "Task: turn the person's situation into a practical action plan for India. Output JSON with exactly these keys:\n"
        '{"summary": str, "urgency": "low"|"medium"|"high", '
        '"steps": [{"title": str, "detail": str, "due_in_days": int or null}], '
        '"documents_to_collect": [str], "authorities": [str], "warnings": [str], "when_to_see_a_lawyer": str}\n'
        "3 to 8 steps in the right order. due_in_days only when a real legal or practical time limit exists, else null. "
        "Do not invent helpline numbers; name the authority instead."
    )
    result = llm.ask_json(system, f"<<<DOCUMENT>>>\n{body.situation}\n<<<DOCUMENT>>>", max_tokens=3000)
    saved = None
    if case:
        tasks = add_tasks(db, case.id, uid, [s for s in (result.get("steps") or []) if isinstance(s, dict)], source="planner")
        saved = {"case_id": case.id, "tasks": [task_out(t) for t in tasks]}
    return {"result": result, "emergency": bool(EMERGENCY_WORDS.search(body.situation)), "saved": saved}


# ------------------------------------------------------------------ grounded answers
class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=1500)
    language: str = "English"


@router.post("/ask")
def ask_grounded(body: AskIn):
    st = grounding.status()
    if st["chunks"] == 0:
        return {"needs_sources": True, "answer": None, "sources": [], "emergency": False}

    kw = body.question
    if body.language.lower() != "english":
        kw = llm.ask_text("Translate the user's legal question into short English search keywords (max 15 words). Output only the keywords.",
                          body.question, max_tokens=60, temperature=0)
    hits = grounding.search(kw, k=6)
    if not hits:
        return {"needs_sources": False, "answer": None, "sources": [], "emergency": bool(EMERGENCY_WORDS.search(body.question)),
                "message": "No matching provision found in the loaded legal texts."}

    blocks = "\n\n".join(f"[S{i + 1}] {h['act']} - {h['section']}\n{h['text'][:1500]}" for i, h in enumerate(hits))
    system = (
        llm.BASE_SYSTEM + " " + llm.lang_line(body.language) + "\n"
        "Answer the question using ONLY the SOURCES below. Cite every factual claim with [S1], [S2] etc. "
        "If the sources do not answer the question, say clearly that the loaded texts do not cover it. "
        "Do not use outside knowledge for legal rules. Keep it short and simple, then add one line: 'This is general information, not legal advice.'"
    )
    answer = llm.ask_text(system, f"SOURCES:\n{blocks}\n\nQUESTION: {body.question}", max_tokens=1500, temperature=0.1)
    sources = [{"id": f"S{i + 1}", "act": h["act"], "section": h["section"], "url": h["url"], "excerpt": h["text"][:500]} for i, h in enumerate(hits)]
    return {"needs_sources": False, "answer": answer, "sources": sources, "emergency": bool(EMERGENCY_WORDS.search(body.question))}
