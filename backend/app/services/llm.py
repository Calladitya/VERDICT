"""Provider-agnostic LLM service.

Supports Anthropic and OpenAI-compatible APIs (OpenAI, OpenRouter, Fireworks)
over raw HTTP (no hard SDK dependency), plus a fully offline **mock** provider
so the app runs end-to-end with no API key. The public functions always return
validated Python dicts shaped like the structured schemas in ``prompts.py``.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from ..config import settings
from . import legal_data
from .prompts import (
    DOC_ANALYSIS_SYSTEM,
    build_doc_analysis_prompt,
    build_system_prompt,
    build_user_prompt,
)

try:  # optional: repairs truncated / slightly broken JSON
    import json_repair  # type: ignore
except ImportError:  # pragma: no cover
    json_repair = None

log = logging.getLogger("verdict.llm")

# Long PDFs make the model run out of output tokens -> broken JSON.
# Only the first part of the document is sent for analysis.
MAX_DOC_CHARS = 30000
DOC_MAX_TOKENS = 8000
EXPLAIN_MAX_TOKENS = 8000
HTTP_TIMEOUT = 180

JSON_ONLY_SUFFIX = (
    "\n\nIMPORTANT OUTPUT RULES:\n"
    "- Respond with ONE valid JSON object only. No markdown, no code fences, no extra text.\n"
    "- Keep every text field short (1-3 sentences).\n"
    "- Include at most 12 clauses, choosing the most important ones.\n"
)


class LLMError(Exception):
    pass


# ── Low-level provider calls ────────────────────────────────────────────
async def _call_anthropic(system: str, user: str, max_tokens: int) -> str:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": settings.llm_model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        r = await client.post(url, headers=headers, json=body)
        if r.status_code >= 400:
            raise LLMError(f"Anthropic API error {r.status_code}: {r.text[:300]}")
        data = r.json()
        return "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )


async def _call_openai(system: str, user: str, max_tokens: int) -> str:
    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
        # Optional OpenRouter attribution headers (ignored by other providers)
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Verdict",
    }
    body: dict[str, Any] = {
        "model": settings.llm_model,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        r = await client.post(url, headers=headers, json=body)

        # Some models don't support JSON mode -> retry once without it
        if r.status_code == 400 and "response_format" in r.text:
            body.pop("response_format", None)
            r = await client.post(url, headers=headers, json=body)

        if r.status_code >= 400:
            raise LLMError(f"LLM API error {r.status_code}: {r.text[:300]}")

        data = r.json()
        if not data.get("choices"):
            raise LLMError(f"LLM returned no choices: {str(data)[:300]}")

        choice = data["choices"][0]
        content = (choice.get("message") or {}).get("content") or ""
        finish = choice.get("finish_reason")
        if not content.strip():
            raise LLMError(f"Model returned an empty answer (finish_reason={finish})")
        if finish == "length":
            log.warning("LLM output hit max_tokens; JSON may be truncated (will try to repair)")
        return content


async def _call_gemini(system: str, user: str, max_tokens: int) -> str:
    """Call Google's Gemini generateContent REST endpoint and return text."""
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise LLMError("Gemini provider is selected but GEMINI_API_KEY is missing")

    model = settings.llm_model.strip() or "gemini-2.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        response = await client.post(url, params={"key": api_key}, json=body)
        if response.status_code >= 400:
            # Avoid including the request URL (which contains the API key) in errors.
            detail = response.text[:500]
            raise LLMError(f"Gemini API error {response.status_code}: {detail}")

    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        feedback = data.get("promptFeedback", {})
        raise LLMError(f"Gemini returned no candidates: {str(feedback)[:300]}")

    candidate = candidates[0]
    parts = (candidate.get("content") or {}).get("parts") or []
    content = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    finish = candidate.get("finishReason")
    if not content.strip():
        raise LLMError(f"Gemini returned an empty answer (finishReason={finish})")
    if finish == "MAX_TOKENS":
        log.warning("Gemini output hit maxOutputTokens; JSON may be truncated (will try to repair)")
    return content


async def _call_llm(system: str, user: str, max_tokens: int = 2000) -> str:
    provider = settings.effective_provider
    if provider == "anthropic":
        return await _call_anthropic(system, user, max_tokens)
    if provider == "openai":
        return await _call_openai(system, user, max_tokens)
    if provider == "gemini":
        return await _call_gemini(system, user, max_tokens)
    raise LLMError(f"Unsupported LLM provider: {provider}")


def _extract_json(text: str | None) -> dict[str, Any]:
    """Best-effort extraction of a JSON object from model output."""
    if not text or not text.strip():
        raise LLMError("Model returned an empty answer")

    # Remove reasoning blocks and markdown fences
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
    text = re.sub(r"\s*```$", "", text).strip()

    # 1) Plain parse
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    # 2) Parse the {...} block only
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            data = json.loads(text[start : end + 1])
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    # 3) Repair truncated / broken JSON
    if json_repair is not None and start != -1:
        try:
            data = json_repair.loads(text[start:])
            if isinstance(data, dict) and data:
                log.warning("LLM JSON was broken; repaired automatically")
                return data
        except Exception:  # noqa: BLE001
            pass

    log.error("Invalid JSON from model. First 1500 chars:\n%s", text[:1500])
    raise LLMError("Model did not return valid JSON")


# ── Public API ──────────────────────────────────────────────────────────
async def generate_explanation(
    question: str,
    jurisdiction: str,
    mode: str,
    persona: str,
    topic: str = "",
    document_excerpt: str = "",
) -> dict[str, Any]:
    if settings.effective_provider == "mock":
        return _mock_explanation(question, jurisdiction, mode, persona, topic)

    system = build_system_prompt(jurisdiction)
    user = build_user_prompt(
        question, mode, persona, topic, (document_excerpt or "")[:MAX_DOC_CHARS]
    )
    raw = await _call_llm(system, user, max_tokens=EXPLAIN_MAX_TOKENS)
    data = _extract_json(raw)
    return _normalize_explanation(data)


async def analyze_document(
    filename: str, text: str, jurisdiction: str
) -> dict[str, Any]:
    if not text or not text.strip():
        raise LLMError("No extractable text in document")
    if settings.effective_provider == "mock":
        return _mock_analysis(filename, text)

    truncated = len(text) > MAX_DOC_CHARS
    doc_text = text[:MAX_DOC_CHARS]
    if truncated:
        doc_text += "\n\n[Document truncated for analysis — only the first part is included.]"

    user = build_doc_analysis_prompt(filename, doc_text, jurisdiction) + JSON_ONLY_SUFFIX
    raw = await _call_llm(DOC_ANALYSIS_SYSTEM, user, max_tokens=DOC_MAX_TOKENS)
    result = _normalize_analysis(_extract_json(raw))
    if truncated and result.get("summary"):
        result["summary"] += " (Note: only the first part of this long document was analyzed.)"
    return result


# ── Normalizers (guarantee the frontend contract) ───────────────────────
_EXPLAIN_DEFAULTS = {
    "short_answer": "",
    "what_the_law_says": "",
    "how_it_applies": "",
    "your_rights": [],
    "your_obligations": [],
    "if_you_dont_comply": "",
    "what_to_do_next": [],
    "documents_to_collect": [],
    "important_dates": [],
    "exceptions": [],
    "risks": [],
    "verify_with_professional": "",
    "confidence": "medium",
    "citations": [],
}


def _normalize_explanation(data: dict) -> dict:
    out = {**_EXPLAIN_DEFAULTS, **{k: v for k, v in data.items() if k in _EXPLAIN_DEFAULTS}}
    for key, default in _EXPLAIN_DEFAULTS.items():
        if isinstance(default, list) and not isinstance(out[key], list):
            out[key] = []
    return out


_ANALYSIS_DEFAULTS = {
    "summary": "",
    "document_type": "Document",
    "parties": [],
    "overall_risk": 0,
    "risk_categories": {},
    "clauses": [],
    "important_dates": [],
    "obligations": [],
    "penalties": [],
    "definitions": [],
    "problematic_provisions": [],
    "confidence": "medium",
}


def _normalize_analysis(data: dict) -> dict:
    out = {**_ANALYSIS_DEFAULTS, **{k: v for k, v in data.items() if k in _ANALYSIS_DEFAULTS}}

    # Type safety so a half-repaired JSON can't crash the frontend
    for key, default in _ANALYSIS_DEFAULTS.items():
        if isinstance(default, list) and not isinstance(out[key], list):
            out[key] = []
        if isinstance(default, dict) and not isinstance(out[key], dict):
            out[key] = {}
    out["clauses"] = [c for c in out["clauses"] if isinstance(c, dict)]

    try:
        out["overall_risk"] = max(0, min(10, int(float(out["overall_risk"]))))
    except (TypeError, ValueError):
        out["overall_risk"] = 0
    return out


# ── Mock provider (offline, deterministic-ish) ──────────────────────────
def _mock_explanation(
    question: str, jurisdiction: str, mode: str, persona: str, topic: str
) -> dict:
    matches = legal_data.search(question or topic, jurisdiction, limit=2)
    citations = [
        {
            "title": m["title"],
            "authority": m["authority"],
            "section": m["section"],
            "jurisdiction": m["jurisdiction"],
            "url": m["url"],
            "source_type": "primary",
            "confidence": "medium",
            "published_date": m["published_date"],
            "effective_date": m["effective_date"],
        }
        for m in matches
    ]
    subject = (question or topic or "your query").strip().rstrip("?")
    persona_line = {
        "individual": "As an individual, you personally carry the rights and duties described below.",
        "business": "As a business, you should map this to your compliance and reporting workflow.",
        "employee": "As an employee, this bears on your workplace rights and remedies.",
        "landlord": "As a landlord, note the notice and procedural obligations below.",
        "tenant": "As a tenant, note the protections and notice periods below.",
    }.get(persona, "")
    return {
        "short_answer": (
            f"[Sample explanation — running in offline mock mode] Here is a plain-language "
            f"take on “{subject}” under {jurisdiction} law. Add an API key to get a "
            f"real, source-grounded answer."
        ),
        "what_the_law_says": (
            "The relevant law sets out the conditions, procedure, and consequences that apply. "
            + (f"See, for example, {matches[0]['title']} ({matches[0]['section']}). " if matches else "")
            + "In mock mode this text is illustrative rather than authoritative."
        ),
        "how_it_applies": persona_line
        + " Whether it applies depends on the specific facts, dates, and any sub-jurisdiction rules.",
        "your_rights": [
            "Right to be given proper notice / due process where the law requires it.",
            "Right to seek clarification or challenge an action through the correct authority.",
        ],
        "your_obligations": [
            "Comply with any mandatory timelines or filings.",
            "Keep records and evidence relevant to the matter.",
        ],
        "if_you_dont_comply": "Non-compliance can lead to penalties, loss of rights, or escalation — verify specifics for your situation.",
        "what_to_do_next": [
            "Confirm the exact rule and effective date for your jurisdiction.",
            "Collect the relevant documents and dates.",
            "If the matter is high-stakes, consult a qualified professional.",
        ],
        "documents_to_collect": ["Any notice/letter received", "Relevant agreement or ID", "Proof of dates (emails, receipts)"],
        "important_dates": [],
        "exceptions": ["Special categories or thresholds may be exempt — check the specific provision."],
        "risks": ["Acting on outdated or non-jurisdiction-specific information."],
        "verify_with_professional": "This is general information, not legal advice. For anything with financial or legal stakes, confirm with a qualified lawyer or the relevant authority.",
        "confidence": "low",
        "citations": citations,
    }


def _mock_analysis(filename: str, text: str) -> dict:
    words = len(text.split())
    return {
        "summary": f"[Mock analysis] '{filename}' contains roughly {words} words. Add an API key for a real clause-by-clause analysis grounded in the document text.",
        "document_type": "Uploaded document",
        "parties": ["Party A", "Party B"],
        "overall_risk": 5,
        "risk_categories": {
            "financial": 5, "legal": 4, "compliance": 3,
            "termination": 6, "liability": 5, "privacy": 2, "ambiguity": 4,
        },
        "clauses": [
            {
                "heading": "Sample Clause 1 — Term & Termination",
                "original": (text[:180] + "…") if text else "(no text extracted)",
                "plain_english": "This clause describes how long the agreement lasts and how it can end.",
                "what_it_means_for_you": "Check the notice period so you are not locked in unexpectedly.",
                "risk_level": "medium",
                "risk_color": "yellow",
                "recommended_action": "Confirm the notice period and any auto-renewal.",
            },
            {
                "heading": "Sample Clause 2 — Liability",
                "original": "Illustrative clause (mock mode).",
                "plain_english": "Limits or assigns responsibility if something goes wrong.",
                "what_it_means_for_you": "Understand your exposure before signing.",
                "risk_level": "high",
                "risk_color": "red",
                "recommended_action": "Have a professional review liability caps and indemnities.",
            },
        ],
        "important_dates": [],
        "obligations": ["Meet payment and notice timelines.", "Maintain confidentiality if required."],
        "penalties": ["Late fees or interest may apply.", "Possible termination for breach."],
        "definitions": [{"term": "Effective Date", "meaning": "The date the agreement takes effect."}],
        "problematic_provisions": ["Broad liability clause (illustrative)."],
        "confidence": "low",
    }