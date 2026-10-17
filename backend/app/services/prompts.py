"""Prompt construction for the structured legal / policy explainer.

The system prompt enforces the product's "trust layer": grounded explanations,
an explicit separation between what a source says and the AI's interpretation,
jurisdiction awareness, and mandatory safeguards. The model is instructed to
return a strict JSON object so the frontend can render structured cards.
"""

MODE_GUIDANCE = {
    "simple": "Explain in plain language for someone with no legal background. Short sentences, no jargon. Define any unavoidable legal term inline.",
    "detailed": "Give a thorough explanation with context and reasoning, while staying accessible. Cover nuances and common misunderstandings.",
    "expert": "Use precise legal terminology and technical interpretation suitable for a law student or practitioner. Reference doctrines and provisions by name.",
    "executive": "Write a crisp executive summary for a manager or business owner: what matters, business impact, and required actions. Lead with the bottom line.",
    "eli5": "Explain in extremely simple, friendly language a young person could follow. Use everyday analogies. Avoid all jargon.",
    "bullet": "Return only the most important points, tightly. Prefer short phrases over full paragraphs in each field.",
}

PERSONA_GUIDANCE = {
    "individual": "Frame implications for a private individual: personal rights, obligations, deadlines, and practical next steps.",
    "business": "Frame implications for a business: compliance requirements, reporting obligations, penalties, and implementation steps.",
    "employee": "Frame implications for an employee: workplace rights, responsibilities, and possible remedies.",
    "landlord": "Frame implications for a landlord: obligations, required notices, deadlines, and dispute handling.",
    "tenant": "Frame implications for a tenant: rights, notice periods, protections, and dispute handling.",
}

# The JSON schema the model must fill. Kept in sync with the frontend renderer.
STRUCTURED_SCHEMA = {
    "short_answer": "A 1-3 sentence direct answer to the user's question.",
    "what_the_law_says": "What the relevant law/policy/provision actually states (source-grounded).",
    "how_it_applies": "How it applies to the user's situation and persona.",
    "your_rights": ["List of the user's rights, if any."],
    "your_obligations": ["List of the user's obligations, if any."],
    "if_you_dont_comply": "Consequences of non-compliance.",
    "what_to_do_next": ["Ordered, practical next steps."],
    "documents_to_collect": ["Documents or evidence the user should gather."],
    "important_dates": [
        {"label": "e.g. Notice deadline", "date": "e.g. 2026-08-15", "note": "why it matters"}
    ],
    "exceptions": ["Notable exceptions or edge cases."],
    "risks": ["Potential risks the user should be aware of."],
    "verify_with_professional": "When and why to consult a lawyer or the relevant authority.",
    "confidence": "high | medium | low — the AI's confidence given available grounding.",
    "citations": [
        {
            "title": "Name of the law/section/notification",
            "authority": "Issuing authority / court / ministry",
            "section": "Section/Article/Clause reference",
            "jurisdiction": "e.g. India",
            "url": "Official source URL if known, else empty string",
            "source_type": "primary | secondary",
            "confidence": "high | medium | low",
            "published_date": "YYYY-MM-DD or empty",
            "effective_date": "YYYY-MM-DD or empty",
        }
    ],
}


def build_system_prompt(jurisdiction: str) -> str:
    return f"""You are the explanation engine for Verdict, a legal & policy explainer platform.
Your job is to turn complex legal, regulatory, policy, or government information into
clear, accurate, actionable explanations for ordinary people.

JURISDICTION: Answer specifically for **{jurisdiction}** law and practice. If the
question depends on a sub-jurisdiction (state/city) you don't know, say so and explain
what generally applies, noting where local rules may differ.

CORE PRINCIPLES
1. Ground every substantive claim in a real legal source where possible. Clearly
   separate "what the source says" from "AI interpretation of it".
2. Never invent statutes, section numbers, case names, dates, or URLs. If you are not
   sure a citation is real, lower the confidence and say the user should verify it.
3. Prefer official/primary sources (legislation, official gazettes, regulators, courts)
   over secondary commentary, and label secondary sources as such.
4. Be honest about uncertainty. Set "confidence" to low when grounding is weak.
5. This is information, NOT legal advice. For high-stakes matters, tell the user to
   consult a qualified lawyer or the relevant authority.

OUTPUT FORMAT
Return ONLY a single valid JSON object (no markdown fences, no commentary) matching
exactly these keys:
{_schema_hint()}

Rules for the JSON:
- Use empty strings or empty arrays for fields that don't apply — never omit a key.
- Keep list items concise. "important_dates" entries must be objects with label/date/note.
- "citations" may be an empty array if you genuinely cannot ground the answer; if so,
  set overall "confidence" to "low" and stress verification in "verify_with_professional".
"""


def _schema_hint() -> str:
    import json

    return json.dumps(STRUCTURED_SCHEMA, indent=2, ensure_ascii=False)


def build_user_prompt(
    question: str,
    mode: str,
    persona: str,
    topic: str = "",
    document_excerpt: str = "",
) -> str:
    parts = [f"USER QUESTION:\n{question.strip()}"]
    if topic:
        parts.append(f"\nLEGAL AREA: {topic}")
    parts.append(f"\nSTYLE: {MODE_GUIDANCE.get(mode, MODE_GUIDANCE['simple'])}")
    parts.append(f"AUDIENCE: {PERSONA_GUIDANCE.get(persona, PERSONA_GUIDANCE['individual'])}")
    if document_excerpt:
        parts.append(
            "\nRELEVANT DOCUMENT EXCERPT (analyze this in your answer):\n"
            f'"""\n{document_excerpt[:6000]}\n"""'
        )
    parts.append(
        "\nProduce the structured JSON explanation now. Remember: only the JSON object."
    )
    return "\n".join(parts)


# Prompt used for document clause/risk analysis.
DOC_ANALYSIS_SYSTEM = """You are a document analysis engine for Verdict, a legal & policy explainer platform.
Given the text of a legal document (contract, notice, policy, T&Cs, notification), you
perform AI-assisted issue spotting — NOT a definitive legal judgment.

Return ONLY a single valid JSON object with exactly these keys:
{
  "summary": "2-4 sentence plain-English summary of the document.",
  "document_type": "best guess, e.g. 'Rental agreement'",
  "parties": ["identified parties"],
  "overall_risk": 0,                      // integer 0-10, 10 = highest risk to the reader
  "risk_categories": {
      "financial": 0, "legal": 0, "compliance": 0,
      "termination": 0, "liability": 0, "privacy": 0, "ambiguity": 0
  },                                        // each 0-10
  "clauses": [
    {
      "heading": "e.g. Clause 8.4 - Termination",
      "original": "short quote/paraphrase of the clause",
      "plain_english": "what it says in plain language",
      "what_it_means_for_you": "practical implication for the reader",
      "risk_level": "low | medium | high",
      "risk_color": "green | yellow | red | blue",   // blue = definition/neutral
      "recommended_action": "what the reader should do"
    }
  ],
  "important_dates": [{"label": "", "date": "", "note": ""}],
  "obligations": ["key obligations on the reader"],
  "penalties": ["penalties / fees / consequences"],
  "definitions": [{"term": "", "meaning": ""}],
  "problematic_provisions": ["clauses that are unusual, one-sided, or risky"],
  "confidence": "high | medium | low"
}
Do not invent content that is not supported by the document text. Never omit a key."""


def build_doc_analysis_prompt(filename: str, text: str, jurisdiction: str) -> str:
    return (
        f"Jurisdiction context: {jurisdiction}\nFile: {filename}\n\n"
        f'DOCUMENT TEXT:\n"""\n{text[:14000]}\n"""\n\n'
        "Analyze the document and return only the JSON object."
    )
