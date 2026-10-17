# Architecture &amp; Product Blueprint

This document describes how the MVP is built and how it scales to the full product vision — a
**legal/policy intelligence platform** that helps ordinary people understand rules, documents,
rights, obligations, changes, risks, and next steps, grounded in authoritative sources.

Positioning, deliberately, is **"Understand laws, policies, and legal documents in plain language —
backed by sources you can verify,"** not "Ask AI any legal question." That framing is what gives the
product a defensible trust, accuracy, and liability posture.

---

## 1. System overview

```
                          ┌────────────────────────┐
                          │   Web Frontend (React)  │
                          │  Vite · TS · Tailwind   │
                          └───────────┬────────────┘
                                      │  HTTPS / JSON + SSE
                          ┌───────────▼────────────┐
                          │   Backend API (FastAPI) │
                          │  Auth · Business logic  │
                          │  Security · Rate limit  │
                          └───────────┬────────────┘
              ┌───────────────────────┼────────────────────────┐
              ▼                       ▼                        ▼
      ┌──────────────┐        ┌───────────────┐        ┌──────────────┐
      │  Database    │        │  LLM Service  │        │  File Store  │
      │ (SQLite/PG)  │        │ Anthropic /   │        │ (local / S3) │
      └──────────────┘        │ OpenAI / Mock │        └──────────────┘
                              └──────┬────────┘
                                     ▼
                          ┌────────────────────────┐
                          │   RAG / Retrieval       │
                          │  Embeddings · Vector DB │
                          │  Rerank · Grounding     │
                          └───────────┬────────────┘
                                      ▼
                              Official Sources
                    (legislation · gazettes · regulators · courts)
```

The MVP implements the top three tiers fully. The RAG tier is present in **design and interface**
(the `legal_data` service + citation contract) and is the primary V2 upgrade path (§6).

---

## 2. Backend design

**Framework:** FastAPI, chosen because Python is the strongest ecosystem for the AI/RAG, document
processing, and OCR work this product depends on.

**Key modules**

- `config.py` — all runtime configuration from environment/`.env` (12-factor). Includes an
  `effective_provider` guard that falls back to mock if the selected LLM has no key.
- `database.py` — SQLAlchemy 2 engine + session. `DATABASE_URL` switches SQLite ↔ Postgres with no
  code change.
- `models.py` — the domain model (§4).
- `schemas.py` — the Pydantic v2 API contract, the single source of truth shared with the typed
  frontend client.
- `security.py` — bcrypt password hashing + HS256 JWTs.
- `deps.py` — `get_current_user`, an in-memory sliding-window **rate limiter**, an `require_admin`
  gate, and an audit-log writer.
- `routers/` — one module per resource.
- `services/` — the parts that would grow most:
  - `llm.py` — provider-agnostic LLM calls (Anthropic/OpenAI over HTTP, or mock), plus normalizers
    that guarantee the structured output contract regardless of model quirks.
  - `prompts.py` — the system/user prompt construction that enforces grounding, the source-vs-
    interpretation split, jurisdiction, mode, persona, and the strict JSON output schema.
  - `legal_data.py` — the India-first seed corpus and keyword search (the RAG placeholder).
  - `documents.py` — PDF/DOCX/TXT text extraction.

**Cross-cutting concerns already wired**

- CORS restricted to configured origins.
- Security headers on every response (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`).
- A catch-all exception handler that never leaks internals to the client.
- Structured, friendly error messages (file too large, unsupported type, scanned-PDF-needs-OCR,
  rate limited, expired session, …).

---

## 3. Frontend design

**Framework:** React 18 + TypeScript + Vite + Tailwind.

- `api/client.ts` — a single typed client. Handles auth headers, JSON, multipart upload, friendly
  error mapping (`ApiError`), and **SSE streaming** via `fetch` + `ReadableStream` (so the
  `Authorization` header can be sent, which `EventSource` cannot).
- `store/auth.tsx` — auth context; token in `sessionStorage`; auto-refresh of the current user.
- `store/toast.tsx` — accessible toast notifications (`aria-live`).
- `components/StructuredAnswer.tsx` — renders the structured explanation into the trust-first card
  system, including the citation panel, confidence/source badges, feedback, and save.
- `components/AppLayout.tsx` — responsive app shell with a desktop sidebar and a mobile drawer.
- `pages/` — Landing (marketing), auth, Dashboard, Explainer (core), Documents + detail, Search,
  History + conversation view, Saved, Settings, 404.

**Accessibility:** semantic landmarks, labelled form controls, visible focus rings, `aria-live`
regions for async status, `prefers-reduced-motion` handling, and touch-friendly targets — targeting
WCAG 2.2 AA.

---

## 4. Data model

Implemented entities (`models.py`):

```
User ──┬── Conversation ──── Message ──┬── Citation
       │                                └── Feedback
       ├── Document
       ├── Bookmark
       └── (AuditLog by user_id)
```

| Entity | Purpose | Notable fields |
|--------|---------|----------------|
| `User` | Account | email, hashed_password, role, persona, default_jurisdiction |
| `Conversation` | A thread | title, jurisdiction, topic, mode, persona, is_archived |
| `Message` | A turn | role, content, **structured** (JSON explanation) |
| `Citation` | A source on an answer | title, authority, section, jurisdiction, url, source_type, confidence, published/effective dates |
| `Document` | Uploaded file | filename, status, extracted_text, **analysis** (JSON), risk_score |
| `Bookmark` | Saved item | item_type (message/law/document), folder, payload |
| `Feedback` | Answer rating | helpful, reason, note |
| `AuditLog` | Security trail | user_id, action, detail, ip |

**Target (V2/V3) additions:** `Organization`, `Subscription`, `Usage`, `DocumentChunk` (for
embeddings), `Source`/`Law`/`Regulation`/`Jurisdiction`/`Topic` reference tables, and `Notification`.
The current schema is intentionally close to this shape so growth is additive, not a rewrite.

---

## 5. API surface

Auth: `POST /api/auth/signup`, `POST /api/auth/login`, `GET/PATCH/DELETE /api/auth/me`.

Core:

| Method &amp; path | Purpose |
|----------------|---------|
| `POST /api/explain` | Structured explanation (JSON) |
| `POST /api/explain/stream` | Same, streamed via SSE with progress stages |
| `GET/PATCH/DELETE /api/conversations[/{id}]` | History: list/search, view, rename/archive, delete |
| `POST/GET/DELETE /api/documents[/{id}]` | Upload + analyze, list, view, delete |
| `GET/POST/DELETE /api/bookmarks[/{id}]` | Saved items |
| `POST /api/feedback` | Was-this-helpful |
| `GET /api/search` | Corpus search (jurisdiction/topic filters) |
| `GET /api/reference/meta` | Jurisdictions, topics, modes, personas for the UI |
| `GET /api/health`, `GET /api/disclaimer` | Meta |

Interactive OpenAPI docs are auto-generated at `/docs`.

---

## 6. Accuracy architecture (RAG) — the V2 upgrade

The MVP grounds answers in a small curated corpus via keyword search. The production accuracy design
replaces this with **Retrieval-Augmented Generation**:

```
User question
   → query understanding & jurisdiction detection
   → embed query
   → vector search over official-source chunks (DocumentChunk)
   → rerank top-k
   → LLM explanation constrained to retrieved passages
   → citations linked back to source chunks
   → structured answer
```

Concretely:

1. **Ingestion pipeline** — fetch official legislation/notifications, chunk, embed (e.g.
   `text-embedding-3-large` or an open model), and store vectors in **pgvector** (keeps everything in
   Postgres) or a dedicated store (Qdrant/Pinecone/Weaviate).
2. **Retrieval** — hybrid (BM25 + vector) retrieval, then a cross-encoder **reranker**.
3. **Grounding** — the prompt (already structured in `prompts.py`) is fed only the retrieved
   passages, and each citation carries the source chunk id so the UI can deep-link.
4. **Source hierarchy** — prioritize government/primary sources (legislation, gazettes, regulators,
   courts) over secondary commentary, and label secondary sources explicitly. The `Citation.source_type`
   and `confidence` fields already model this.

This directly reduces hallucination risk and makes every answer traceable.

---

## 7. Security &amp; privacy

**Implemented now:** bcrypt hashing, JWT with expiry, per-IP rate limiting, brute-force-resistant
generic auth errors, CORS allow-list, security headers, file-type and file-size validation, a catch-all
error handler that hides internals, per-user data isolation on every query, audit logging, account
deletion (right to erasure), and data export via `GET /api/auth/me` + conversation/document endpoints.

**Production hardening (roadmap):** HTTPS/TLS termination, secrets manager, encryption at rest,
malware scanning on upload, PII detection &amp; redaction, document retention controls with automatic
deletion, CSRF protection for any cookie-based flows, dependency/vulnerability scanning, and backups.
Because uploads can contain names, addresses, IDs, and financial data, these are treated as mandatory
before handling real user documents.

---

## 8. Trust &amp; safety (product-level)

This is not a generic chatbot, so the UI enforces a **trust layer** on every answer:

- Persistent disclaimers ("Information, not legal advice").
- Confidence badge, jurisdiction stamp, and "checked" date.
- A hard visual separation of **"what the source says"** vs **AI interpretation**.
- A **"verify with a professional"** escalation block, emphasized for high-stakes topics.
- Every citation shows authority, section, dates, primary/secondary type, and an official link.
- When no source can be grounded, confidence drops to *low* and the UI says so explicitly.

---

## 9. Roadmap

**MVP (this build)** — landing, auth, structured AI explainer with streaming, jurisdiction &amp;
persona selection, simplification modes, citations, conversation history, document upload + analysis,
search, dashboard, saved items, feedback, settings, disclaimers, responsive/accessible UI, error &amp;
loading states.

**V2** — pgvector RAG with a real ingestion pipeline &amp; reranking; export to PDF/DOCX; law-vs-law
and old-vs-new **comparison** and **"what changed"** views; notifications &amp; deadline reminders;
richer source management; PII redaction; Alembic migrations; background job queue for document
processing.

**V3** — regulatory monitoring &amp; personalized legal feed; business workspaces &amp; team
collaboration; compliance dashboards; subscriptions &amp; billing; multi-language (Hindi and regional
languages); SSO; admin panel &amp; analytics; public SEO-indexed explanatory pages
(`/legal/india/section-138-cheque-bounce`); API access &amp; integrations.

---

## 10. Deployment notes

- **Frontend:** `npm run build` → static assets; deploy to any static host/CDN (Vercel, Netlify,
  S3+CloudFront). Set `VITE_API_BASE` to the API origin.
- **Backend:** run `uvicorn`/`gunicorn` behind a reverse proxy (nginx/Caddy) terminating TLS. Point
  `DATABASE_URL` at managed Postgres and set `CORS_ORIGINS` to the frontend origin. Provide the LLM
  key via the platform's secret manager.
- **Scaling:** the rate limiter and any future job queue should move to Redis; document storage moves
  to object storage (S3/GCS); the vector index becomes a managed service or pgvector on the primary DB.
