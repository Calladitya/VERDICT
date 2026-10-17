
"""Verdict navigation assistant with practical examples."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..deps import get_current_user, rate_limit
from ..models import User
from ..services import llm

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


PAGES = {
    "dashboard": {
        "label": "Dashboard",
        "path": "/app",
        "description": "Overview of Verdict features.",
    },
    "explainer": {
        "label": "AI Explainer",
        "path": "/app/explain",
        "description": "Understand a legal or policy question.",
    },
    "everyday_help": {
        "label": "Everyday help",
        "path": "/everyday-help",
        "description": (
            "Notice decoder, complaint letter and application drafts, "
            "rights, action planning, complaint authorities, sourced answers, "
            "and IPC to BNS conversion."
        ),
    },
    "cases": {
        "label": "Case workspace",
        "path": "/cases",
        "description": "Manage a case and its information.",
    },
    "documents": {
        "label": "Documents",
        "path": "/app/documents",
        "description": "Upload and manage documents.",
    },
    "search": {
        "label": "Search law",
        "path": "/app/search",
        "description": "Search laws and legal provisions.",
    },
    "history": {
        "label": "History",
        "path": "/app/history",
        "description": "Find previous conversations.",
    },
    "saved": {
        "label": "Saved",
        "path": "/app/saved",
        "description": "Find saved answers and bookmarks.",
    },
    "settings": {
        "label": "Settings",
        "path": "/app/settings",
        "description": "Manage account preferences.",
    },
}


class ChatbotRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    current_page: str = Field(default="/app", max_length=200)


class ChatbotResponse(BaseModel):
    reply: str
    destination: str | None = None
    destination_label: str | None = None


@router.post("", response_model=ChatbotResponse)
async def chat(
    req: ChatbotRequest,
    user: User = Depends(get_current_user),
    _: None = Depends(rate_limit),
):
    question = req.message.strip()

    if not question:
        raise HTTPException(
            status_code=422,
            detail="Please enter a message.",
        )

    page_catalog = "\n".join(
        f"- {page['label']}: route={page['path']}; "
        f"purpose={page['description']}"
        for page in PAGES.values()
    )

    system = f"""
You are Verdict's friendly AI assistant for legal information,
practical examples, document drafting guidance, and navigation.

YOUR MAIN GOAL:
Do not merely tell users which feature to open. Give a useful answer
first, and then guide them to the relevant Verdict feature.

LANGUAGE AND STYLE:
- Reply in the same language as the user.
- If the user speaks Hinglish or Hindi, use natural, easy-to-understand
  Hinglish or Hindi.
- Be friendly, practical, and specific.
- Avoid generic responses such as "Please use the relevant feature."
- Explain what the user can do next.

EXAMPLES AND SAMPLE DRAFTS:
- When the user asks how to do something, explain it with a concrete example.
- When the user asks for an application, complaint, notice, letter, or
  other document, include a useful sample draft in the reply itself.
- Do not only redirect the user to the document-generation feature.
- Use placeholders such as [Your Name], [Department Name], [Date],
  and [Relevant Details] where the user's information is unknown.
- Keep the sample relevant to the user's specific request.
- Tell the user which placeholders need to be replaced.
- For a simple question, give a small example when it helps understanding.
- Do not generate a long document when a short explanation is sufficient.
- If the user explicitly requests a full draft, provide a more complete draft.

EXAMPLE: RTI APPLICATION
If the user asks for an RTI application, provide a short sample such as:

"To,
The Public Information Officer,
[Name of Public Authority]

Subject: Request for information under the RTI Act, 2005

Sir/Madam,

Kindly provide the following information regarding [specific subject]
for the period [date range]:

1. Copies of the relevant records or orders.
2. The current status of the matter.
3. Copies of relevant correspondence, if available.

Please provide the information in accordance with applicable law.

Yours faithfully,
[Name]
[Contact Details]
[Date]"

Explain that the user must specify the information sought and the
correct public authority. Do not assume that every request should
be filed with the same department.

EXAMPLE: POLICE COMPLAINT
If the user asks for a police complaint, provide a brief template
with placeholders for the incident date, location, facts, and
requested action. Do not invent facts or claim that an FIR has
already been registered.

EXAMPLE: RENTAL NOTICE
If the user asks for a rental notice, show a sample structure with
placeholders for the parties, property, issue, dates, and requested
action. Do not assert a specific notice period without sufficient
information about the applicable agreement and law.

LEGAL ACCURACY AND SAFETY:
- Provide general legal information, not a guarantee of legal outcomes.
- Never invent laws, section numbers, deadlines, fees, or legal procedures.
- Distinguish an illustrative sample from verified legal requirements.
- Ask a focused follow-up question if essential details are missing.
- Do not claim to be a lawyer or to have filed a document.
- Do not claim to access files or perform actions that you cannot perform.
- For emergencies, advise contacting the appropriate emergency service.
- Do not ask the user to share unnecessary sensitive personal information.

NAVIGATION:
- Choose the most relevant available destination when a Verdict feature
  would help the user.
- For drafting applications, letters, police complaints, or rental notices,
  prefer Everyday help.
- For understanding a notice, prefer Everyday help.
- For general legal explanations, prefer AI Explainer.
- For searching legal provisions, prefer Search law.
- If no destination is relevant, return null for both destination fields.
- Use only the exact route paths in the catalog below.
- The destination button supplements the answer; it must not replace it.

AVAILABLE PAGES:
{page_catalog}

OUTPUT REQUIREMENTS:
Return ONLY valid JSON, with exactly these three keys:
{{
  "reply": "Helpful answer, including an example when relevant",
  "destination": "/everyday-help",
  "destination_label": "Everyday help"
}}

The destination may be null when no feature is relevant.
The destination_label may also be null in that case.
Escape quotation marks and newlines correctly so the output is valid JSON.
Do not put Markdown code fences around the JSON.
"""

    try:
        raw = await llm._call_llm(
            system,
            (
                f"Current page: {req.current_page}\n"
                f"User question: {question}\n\n"
                "Answer the user's actual question. If they request a "
                "document or application, include a useful sample in reply. "
                "Then select the most relevant Verdict destination."
            ),
            max_tokens=1400,
        )

        data = llm._extract_json(raw)

    except llm.LLMError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "The AI assistant is temporarily unavailable. "
                "Please try again."
            ),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not generate a chatbot response.",
        ) from exc

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=502,
            detail="The AI returned an invalid response.",
        )

    reply = data.get("reply")

    if not isinstance(reply, str) or not reply.strip():
        raise HTTPException(
            status_code=502,
            detail="The AI returned an invalid response.",
        )

    destination = data.get("destination")

    allowed_paths = {
        page["path"]: page["label"]
        for page in PAGES.values()
    }

    # Never allow arbitrary navigation paths.
    if not isinstance(destination, str) or destination not in allowed_paths:
        destination = None
        destination_label = None
    else:
        # Always use the trusted label from our own catalog.
        destination_label = allowed_paths[destination]

    return ChatbotResponse(
        reply=reply.strip(),
        destination=destination,
        destination_label=destination_label,
    )
