import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..config import settings
from ..deps import get_current_user  # same auth dependency the other routers use

logger = logging.getLogger("transcribe")

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])

GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


@router.post("")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None, description="ISO-639-1 code like 'en' or 'hi'. Omit to auto-detect."),
    user=Depends(get_current_user),
):
    try:
        api_key = getattr(settings, "groq_api_key", "")
        stt_model = getattr(settings, "stt_model", None) or "whisper-large-v3-turbo"
        max_mb = getattr(settings, "max_audio_mb", None) or 25

        if not api_key:
            raise HTTPException(500, "GROQ_API_KEY is not configured in backend/.env.")

        audio = await file.read()
        if not audio:
            raise HTTPException(400, "Empty audio file.")
        if len(audio) > max_mb * 1024 * 1024:
            raise HTTPException(413, f"Audio too large (max {max_mb}MB).")

        data = {"model": stt_model, "response_format": "json", "temperature": "0"}
        if language and language != "auto":
            data["language"] = language

        files = {"file": (file.filename or "voice.wav", audio, file.content_type or "audio/wav")}
        headers = {"Authorization": f"Bearer {api_key}"}

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(GROQ_STT_URL, headers=headers, data=data, files=files)
        except httpx.TimeoutException:
            raise HTTPException(504, "Transcription timed out.")
        except httpx.RequestError as e:
            logger.error("Groq request failed: %s", e)
            raise HTTPException(502, "Could not reach Groq.")

        if resp.status_code != 200:
            try:
                body = resp.json()
            except ValueError:
                body = {"message": resp.text}
            logger.error("Groq STT error %s: %s", resp.status_code, body)
            err = body.get("error", body) if isinstance(body, dict) else body
            message = err.get("message") if isinstance(err, dict) else str(err)
            raise HTTPException(resp.status_code, message or "Transcription failed.")

        result = resp.json()
        return {"text": (result.get("text") or "").strip()}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Transcribe endpoint crashed")
        raise HTTPException(500, "Transcription failed on the server. Check backend logs.")