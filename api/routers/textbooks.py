"""Textbook upload and management."""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from services.sandbox import data_root, atomic_write
from services.file_parser import extract_pdf_pages

router = APIRouter(prefix="/textbooks", tags=["textbooks"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def _textbooks_dir() -> Path:
    return data_root() / "textbooks"


def _files_dir() -> Path:
    return data_root() / "textbooks" / "files"


@router.get("")
async def list_textbooks():
    textbooks = []
    for f in sorted(_textbooks_dir().glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            textbooks.append({
                "id": data["id"],
                "filename": data["filename"],
                "title": data.get("title", data["filename"]),
                "page_count": data.get("page_count", 0),
                "total_chars": data.get("total_chars", 0),
                "created_at": data.get("created_at"),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return textbooks


@router.post("/upload", status_code=201)
async def upload_textbook(file: UploadFile = File(...)):
    content_type = file.content_type or ""
    if content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Only PDF files are supported for textbooks")

    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    tb_id = "tb_" + str(uuid.uuid4())[:8]

    # Save raw file
    raw_path = _files_dir() / f"{tb_id}.pdf"
    raw_path.write_bytes(raw)

    # Extract pages
    try:
        pages = extract_pdf_pages(raw_path)
    except ValueError as e:
        raw_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(e))

    total_chars = sum(len(p["text"]) for p in pages)
    filename = file.filename or "unknown.pdf"

    textbook = {
        "id": tb_id,
        "filename": filename,
        "title": Path(filename).stem,
        "page_count": len(pages),
        "pages": pages,
        "total_chars": total_chars,
        "raw_file": f"{tb_id}.pdf",
        "created_at": datetime.utcnow().isoformat(),
    }
    meta_path = _textbooks_dir() / f"{tb_id}.json"
    atomic_write(meta_path, json.dumps(textbook, indent=2))

    return {
        "id": tb_id,
        "filename": filename,
        "title": textbook["title"],
        "page_count": len(pages),
        "total_chars": total_chars,
        "created_at": textbook["created_at"],
    }


@router.get("/{textbook_id}")
async def get_textbook(textbook_id: str):
    path = _textbooks_dir() / f"{textbook_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Textbook not found")
    return json.loads(path.read_text(encoding="utf-8"))


class UpdateTextbookRequest(BaseModel):
    title: str


@router.put("/{textbook_id}")
async def update_textbook(textbook_id: str, body: UpdateTextbookRequest):
    path = _textbooks_dir() / f"{textbook_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Textbook not found")

    data = json.loads(path.read_text(encoding="utf-8"))
    data["title"] = body.title
    atomic_write(path, json.dumps(data, indent=2))
    return {"id": textbook_id, "title": body.title}


@router.delete("/{textbook_id}")
async def delete_textbook(textbook_id: str):
    meta_path = _textbooks_dir() / f"{textbook_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Textbook not found")

    data = json.loads(meta_path.read_text(encoding="utf-8"))
    raw_file = _files_dir() / data.get("raw_file", "")
    raw_file.unlink(missing_ok=True)
    meta_path.unlink()
    return {"deleted": True}


@router.get("/{textbook_id}/pages")
async def get_pages(textbook_id: str, start: int = 1, end: Optional[int] = None):
    path = _textbooks_dir() / f"{textbook_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Textbook not found")

    data = json.loads(path.read_text(encoding="utf-8"))
    pages = data.get("pages", [])

    if end is None:
        end = len(pages)

    if start < 1 or start > len(pages):
        raise HTTPException(status_code=422, detail=f"start must be between 1 and {len(pages)}")
    if end < start or end > len(pages):
        raise HTTPException(status_code=422, detail=f"end must be between {start} and {len(pages)}")

    # pages are 1-indexed in the data
    filtered = [p for p in pages if start <= p["page"] <= end]
    return {"textbook_id": textbook_id, "pages": filtered, "total_pages": len(pages)}
