"""Saved items / bookmarks with folders."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Bookmark, User
from ..schemas import BookmarkCreate, BookmarkOut

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


@router.get("", response_model=list[BookmarkOut])
def list_bookmarks(
    folder: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Bookmark).filter(Bookmark.user_id == user.id)
    if folder:
        query = query.filter(Bookmark.folder == folder)
    return query.order_by(Bookmark.created_at.desc()).all()


@router.post("", response_model=BookmarkOut, status_code=201)
def create_bookmark(
    payload: BookmarkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    bm = Bookmark(
        user_id=user.id,
        item_type=payload.item_type,
        title=payload.title[:400],
        folder=payload.folder or "General",
        ref_id=payload.ref_id,
        payload=payload.payload,
    )
    db.add(bm)
    db.commit()
    db.refresh(bm)
    return bm


@router.delete("/{bookmark_id}", status_code=204)
def delete_bookmark(
    bookmark_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    bm = db.get(Bookmark, bookmark_id)
    if not bm or bm.user_id != user.id:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.delete(bm)
    db.commit()
