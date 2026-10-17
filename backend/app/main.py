"""FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .routers import (
    auth,
    bookmarks,
    conversations,
    documents,
    explain,
    feedback,
    search,
    transcribe,
    chatbot,
)
from .seed import init_db, seed_demo_user
from .v3 import init_v3, get_routers  # VERDICT 3.0 add-on


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_v3()  # creates the new v3_* tables (existing tables untouched)
    seed_demo_user()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "API for the Verdict platform — turns complex legal, "
        "regulatory and policy information into clear, source-grounded explanations."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never leak internals; the client shows a friendly message.
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our side. Please try again."},
    )


@app.get("/api/health", tags=["meta"])
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "llm_provider": settings.effective_provider,
        "mock_mode": settings.effective_provider == "mock",
    }


@app.get("/api/disclaimer", tags=["meta"])
def disclaimer():
    return {
        "short": "Information only — not legal advice.",
        "full": (
            "This platform provides general information generated with AI assistance and "
            "curated sources. It is not a substitute for advice from a qualified lawyer. "
            "Laws vary by jurisdiction and change over time, and AI can make mistakes. "
            "Always verify against official sources and consult a professional for "
            "high-stakes matters."
        ),
    }


for r in (auth, explain, conversations, documents, bookmarks, feedback, search, transcribe, chatbot ):
    app.include_router(r.router)

# VERDICT 3.0 routes (/api/v3/...)
for _r in get_routers():
    app.include_router(_r)