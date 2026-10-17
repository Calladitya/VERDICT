"""Authentication & account routes."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, rate_limit, write_audit
from ..models import User
from ..schemas import Token, UserCreate, UserLogin, UserOut, UserUpdate
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue(user: User) -> Token:
    token = create_access_token(user.id, extra={"role": user.role})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/signup", response_model=Token, status_code=201)
def signup(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit),
):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    write_audit(db, user.id, "signup", ip=request.client.host if request.client else "")
    return _issue(user)


@router.post("/login", response_model=Token)
def login(
    payload: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit),
):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    write_audit(db, user.id, "login", ip=request.client.host if request.client else "")
    return _issue(user)


@router.post("/token", response_model=Token, include_in_schema=False)
def login_form(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """OAuth2 password-flow endpoint so the interactive docs 'Authorize' works."""
    user = db.query(User).filter(User.email == form.username.lower()).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return _issue(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.persona is not None:
        user.persona = payload.persona
    if payload.default_jurisdiction is not None:
        user.default_jurisdiction = payload.default_jurisdiction
    db.commit()
    db.refresh(user)
    return user


@router.delete("/me", status_code=204)
def delete_me(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Right-to-erasure: hard-deletes the account and all owned data."""
    db.delete(user)
    db.commit()
