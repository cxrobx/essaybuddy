"""Writing sample upload and management."""
import json
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

from services.sandbox import data_root, atomic_write
from services.file_parser import extract_text

router = APIRouter(prefix="/samples", tags=["samples"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIMES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}


def _samples_dir() -> Path:
    return data_root() / "samples"


def _files_dir() -> Path:
    return data_root() / "samples" / "files"


@router.get("")
async def list_samples():
    samples = []
    for f in sorted(_samples_dir().glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            samples.append({
                "id": data["id"],
                "filename": data["filename"],
                "char_count": len(data.get("text", "")),
                "created_at": data.get("created_at"),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return samples


@router.post("/upload", status_code=201)
async def upload_sample(file: UploadFile = File(...)):
    # MIME validation
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {content_type}. Allowed: .pdf, .docx, .txt",
        )

    # Read and size check
    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    sample_id = str(uuid.uuid4())[:8]

    # Save raw file
    ext = Path(file.filename or "file").suffix or ".txt"
    raw_path = _files_dir() / f"{sample_id}{ext}"
    raw_path.write_bytes(raw)

    # Extract text
    try:
        text = extract_text(raw_path, content_type)
    except ValueError as e:
        raw_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(e))

    # Cap extracted text
    text = text[:100_000]

    sample = {
        "id": sample_id,
        "filename": file.filename or "unknown",
        "content_type": content_type,
        "text": text,
        "raw_file": str(raw_path.name),
        "created_at": datetime.utcnow().isoformat(),
    }
    meta_path = _samples_dir() / f"{sample_id}.json"
    atomic_write(meta_path, json.dumps(sample, indent=2))

    return {
        "id": sample_id,
        "filename": sample["filename"],
        "char_count": len(text),
        "created_at": sample["created_at"],
    }


@router.get("/{sample_id}")
async def get_sample(sample_id: str):
    path = _samples_dir() / f"{sample_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Sample not found")
    return json.loads(path.read_text(encoding="utf-8"))


@router.delete("/{sample_id}")
async def delete_sample(sample_id: str):
    meta_path = _samples_dir() / f"{sample_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Sample not found")

    data = json.loads(meta_path.read_text(encoding="utf-8"))
    raw_file = _files_dir() / data.get("raw_file", "")
    raw_file.unlink(missing_ok=True)
    meta_path.unlink()
    return {"deleted": True}
