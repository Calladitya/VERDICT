"""Document upload, analysis, listing, and deletion."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user, rate_limit
from ..models import Document, User
from ..schemas import DocumentOut
from ..services import llm
from ..services.documents import ExtractionError, extract_text

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "application/octet-stream",  # some browsers send this; validated by extension
}
ALLOWED_EXT = (".pdf", ".docx", ".txt", ".md")


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _: None = Depends(rate_limit),
):
    filename = file.filename or "document"
    if not filename.lower().endswith(ALLOWED_EXT):
        raise HTTPException(status_code=415, detail="Unsupported file type. Use PDF, DOCX, or TXT.")

    content = await file.read()
    size = len(content)
    if size == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if size > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.max_upload_mb} MB.",
        )

    doc = Document(
        user_id=user.id,
        filename=filename[:400],
        content_type=file.content_type or "",
        size_bytes=size,
        status="processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        text = extract_text(filename, content, file.content_type or "")
        doc.extracted_text = text
        doc.status = "analyzing"
        db.commit()

        analysis = await llm.analyze_document(filename, text, user.default_jurisdiction)
        doc.analysis = analysis
        doc.risk_score = float(analysis.get("overall_risk", 0))
        doc.status = "complete"
        db.commit()
        db.refresh(doc)
    except ExtractionError as exc:
        doc.status = "failed"
        doc.analysis = {"error": str(exc)}
        db.commit()
        raise HTTPException(status_code=422, detail=str(exc))
    except llm.LLMError as exc:
        # Text extracted but analysis failed — keep the doc, surface the error.
        doc.status = "extracted"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Analysis failed: {exc}")

    return doc


@router.get("", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(Document)
        .filter(Document.user_id == user.id)
        .order_by(Document.created_at.desc())
        .all()
    )


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
