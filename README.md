<p align="center">
  <img src="frontend/public/verdict-logo.svg" alt="Verdict — Justice · Trust · Empowerment" width="320" />
</p>

# Verdict

> Understand laws, policies, and legal documents in plain language — backed by sources you can verify.

A full-stack MVP of a legal/policy intelligence platform that turns complex legal, regulatory, and
policy information into clear, structured, actionable explanations for ordinary people. Inspired by
the ClearClause concept, rebuilt as a **React + FastAPI** application with a real, provider-agnostic
LLM layer and an **India-first** legal corpus.

This is the MVP slice of a much larger product vision — see [`ARCHITECTURE.md`](./ARCHITECTURE.md)
for the full data model, API spec, RAG/accuracy design, security plan, and the MVP → V2 → V3 roadmap.

---

## What's included

**The core product loop — Ask → Analyze → Understand → Act:**

- **AI Legal Explainer** — ask a question in plain English and get a *structured* answer, not a wall
  of text: short answer, what the law says, how it applies to you, your rights, your obligations,
  consequences of non-compliance, next steps, documents to collect, important dates, exceptions,
  risks, sources, and a "verify with a professional" escalation.
- **Streaming responses (SSE)** with staged progress ("Understanding your question…", "Finding
  relevant provisions…").
- **Simplification modes** — Simple, Detailed, Expert, Executive summary, Very simple (ELI5),
  Bullet points.
- **"What does this mean for me?" personas** — Individual, Business, Employee, Landlord, Tenant.
- **Jurisdiction selector** — India-first, with state/region drill-down (e.g. India → Uttar Pradesh)
  and a generic/international fallback.
- **Document analysis** — upload PDF / DOCX / TXT for a clause-by-clause, plain-English breakdown
  with an overall risk score, per-category risk meters, obligations, penalties, important dates, and
  flagged problematic provisions.
- **Source / citation system** — every citation shows authority, section, jurisdiction, published &
  effective dates, source type (primary vs secondary), a confidence level, and a link to the official
  source. The UI clearly separates **"what the source says"** from **"AI interpretation."**
- **Conversation history** — list, search, rename, delete, and revisit past conversations with
  follow-ups.
- **Search** the curated legal corpus with jurisdiction and topic filters.
- **Saved items / bookmarks** organized into folders.
- **Feedback** ("was this helpful?") on every answer.
- **User accounts** — signup, login (JWT), profile & persona settings, account deletion (right to
  erasure), demo user.
- **Trust & safety layer** — persistent, prominent disclaimers, confidence badges, jurisdiction/date
  stamps, and professional-review escalation.
- **Polished, responsive, accessible UI** — semantic HTML, keyboard-navigable, focus states, ARIA
  live regions for toasts/loading, reduced-motion support, mobile drawer nav.

**The LLM layer is provider-agnostic** and ships with a fully offline **mock** provider, so the app
runs end-to-end with **no API key**. Add an Anthropic or OpenAI key to get real, source-grounded
explanations.

---

## Tech stack

| Layer | Choice |
|------|--------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Python, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Auth | JWT (python-jose) + bcrypt password hashing |
| Database | SQLite by default (zero-config); PostgreSQL supported via `DATABASE_URL` |
| LLM | Anthropic / OpenAI over HTTP, or offline **mock** — selected by env |
| Docs | PDF/DOCX/TXT extraction (pypdf, python-docx) |

---

## Quick start

You need **Python 3.10+** and **Node 18+**.

### 1. Backend

```bash
cd backend
cp .env.example .env          # defaults to offline mock mode — no key needed
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000` (interactive docs at `/docs`). A demo user is seeded
automatically.

> Shortcut: `./run.sh` from the `backend/` folder does the venv + install + run steps for you.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to the backend automatically.

### 3. Log in

Use the pre-filled demo credentials (or sign up):

```
Email:    demo@verdict.app
Password: demo12345
```

---

## Enabling a real LLM

By default `LLM_PROVIDER="mock"` returns illustrative sample answers with no network calls. To get
real, grounded explanations, edit `backend/.env`:

```ini
# Anthropic
LLM_PROVIDER="anthropic"
LLM_MODEL="claude-sonnet-4-20250514"
ANTHROPIC_API_KEY="sk-ant-..."

# …or OpenAI
LLM_PROVIDER="openai"
LLM_MODEL="gpt-4o"
OPENAI_API_KEY="sk-..."
```

Restart the backend. `GET /api/health` reports the active provider and whether mock mode is on. If a
provider is selected but its key is missing, the app safely falls back to mock mode.

---

## Using PostgreSQL

SQLite is the default so you can run instantly. To use Postgres, set in `backend/.env`:

```ini
DATABASE_URL="postgresql+psycopg2://user:password@localhost:5432/verdict"
```

`psycopg2-binary` is already in `requirements.txt`. Tables are created automatically on startup.
(For production, wire up Alembic migrations — see `ARCHITECTURE.md`.)

---

## Project layout

```
verdict/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, security headers, error handling
│   │   ├── config.py          # env-driven settings
│   │   ├── database.py        # engine + session
│   │   ├── models.py          # SQLAlchemy models (User, Conversation, Message, Document…)
│   │   ├── schemas.py         # Pydantic request/response contract
│   │   ├── security.py        # bcrypt + JWT
│   │   ├── deps.py            # auth dependency, rate limiting, audit log
│   │   ├── seed.py            # DB init + demo user
│   │   ├── routers/           # auth, explain, conversations, documents, bookmarks, feedback, search
│   │   └── services/          # llm (provider-agnostic), prompts, legal_data (India corpus), documents
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/client.ts      # typed API client + SSE streaming
│       ├── store/             # auth + toast context
│       ├── components/        # AppLayout, StructuredAnswer, AuthShell, ui, icons
│       └── pages/             # Landing, Login, Signup, Dashboard, Explainer, Documents, Search…
└── ARCHITECTURE.md            # full design: schema, API, RAG, security, roadmap
```

---

## Testing the flow

1. Ask on the **AI Explainer** page: *"My landlord says I must vacate in 7 days. Is that legal?"*
2. Watch the staged loading, then read the structured answer with citations.
3. Ask a follow-up in the same conversation.
4. Upload a document on the **Documents** page to see the risk score and clause breakdown.
5. Save an answer, then find it under **Saved**.
6. Revisit it under **History**.

---

## ⚠️ Disclaimer

This platform provides **general information generated with AI assistance and curated sources. It is
not legal advice** and not a substitute for a qualified lawyer. Laws vary by jurisdiction and change
over time, and AI can make mistakes. Always verify against official sources and consult a professional
for high-stakes matters. The seed legal corpus is a small, illustrative set of well-known Indian laws;
section references must be verified against the official source before you rely on them.
