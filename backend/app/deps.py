"""Shared FastAPI dependencies: current user, rate limiting, audit logging."""
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import AuditLog, User
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# Simple in-memory sliding-window rate limiter (per client IP).
# Production would use Redis; this keeps the MVP dependency-free.
_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = settings.rate_limit_window_seconds
    bucket = _hits[ip]
    while bucket and bucket[0] < now - window:
        bucket.popleft()
    if len(bucket) >= settings.rate_limit_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please slow down and try again shortly.",
        )
    bucket.append(now)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exc
    user_id = decode_access_token(token)
    if not user_id:
        raise credentials_exc
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_exc
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def write_audit(db: Session, user_id: str, action: str, detail: str = "", ip: str = ""):
    db.add(AuditLog(user_id=user_id, action=action, detail=detail[:600], ip=ip))
    db.commit()
