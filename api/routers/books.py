"""Book upload and management."""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from services.sandbox import data_root, atomic_write
from services.file_parser import extract_pdf_pages

router = APIRouter(prefix="/books", tags=["books"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def _books_dir() -> Path:
    return data_root() / "books"


def _files_dir() -> Path:
    return data_root() / "books" / "files"


def _resolve_path(book_id: str) -> Path:
    """Resolve book JSON path, accepting both bk_ and legacy tb_ IDs."""
    path = _books_dir() / f"{book_id}.json"
    if path.exists():
        return path
    # Legacy tb_ IDs: also check books dir (migrated files keep original ID)
    if book_id.startswith("tb_"):
        return path  # return the path even if not found; caller handles 404
    return path


@router.get("")
async def list_books():
    books = []
    for f in sorted(_books_dir().glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            books.append({
                "id": data["id"],
                "filename": data["filename"],
                "title": data.get("title", data["filename"]),
                "author": data.get("author", ""),
                "publisher": data.get("publisher", ""),
                "year": data.get("year"),
                "page_count": data.get("page_count", 0),
                "total_chars": data.get("total_chars", 0),
                "created_at": data.get("created_at"),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return books


class UpdateBookRequest(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    year: Optional[int] = None
    edition: Optional[str] = None
    isbn: Optional[str] = None
    editors: Optional[str] = None
    city: Optional[str] = None


@router.post("/upload", status_code=201)
async def upload_book(file: UploadFile = File(...)):
    content_type = file.content_type or ""
    if content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Only PDF files are supported for books")

    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    bk_id = "bk_" + str(uuid.uuid4())[:8]

    # Save raw file
    raw_path = _files_dir() / f"{bk_id}.pdf"
    raw_path.write_bytes(raw)

    # Extract pages
    try:
        pages = extract_pdf_pages(raw_path)
    except ValueError as e:
        raw_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(e))

    total_chars = sum(len(p["text"]) for p in pages)
    filename = file.filename or "unknown.pdf"

    book = {
        "id": bk_id,
        "filename": filename,
        "title": Path(filename).stem,
        "author": "",
        "publisher": "",
        "year": None,
        "edition": None,
        "isbn": None,
        "editors": None,
        "city": None,
        "page_count": len(pages),
        "pages": pages,
        "total_chars": total_chars,
        "raw_file": f"{bk_id}.pdf",
        "created_at": datetime.utcnow().isoformat(),
    }
    meta_path = _books_dir() / f"{bk_id}.json"
    atomic_write(meta_path, json.dumps(book, indent=2))

    return {
        "id": bk_id,
        "filename": filename,
        "title": book["title"],
        "page_count": len(pages),
        "total_chars": total_chars,
        "created_at": book["created_at"],
    }


@router.get("/isbn-lookup/{isbn}")
async def isbn_lookup(isbn: str):
    """Fetch book metadata from Open Library, fallback to Google Books."""
    isbn = isbn.strip().replace("-", "")

    # Try Open Library first
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"https://openlibrary.org/isbn/{isbn}.json")
            if resp.status_code == 200:
                ol = resp.json()
                # Resolve author names from author keys
                authors = []
                for author_ref in ol.get("authors", []):
                    key = author_ref.get("key", "")
                    if key:
                        a_resp = await client.get(f"https://openlibrary.org{key}.json")
                        if a_resp.status_code == 200:
                            authors.append(a_resp.json().get("name", ""))
                return {
                    "title": ol.get("title", ""),
                    "author": "; ".join(authors) if authors else "",
                    "publisher": ", ".join(ol.get("publishers", [])),
                    "year": ol.get("publish_date", ""),
                    "edition": ol.get("edition_name", ""),
                    "isbn": isbn,
                    "source": "openlibrary",
                }
    except httpx.HTTPError:
        pass

    # Fallback: Google Books
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://www.googleapis.com/books/v1/volumes",
                params={"q": f"isbn:{isbn}", "maxResults": 1},
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])
                if items:
                    info = items[0].get("volumeInfo", {})
                    return {
                        "title": info.get("title", ""),
                        "author": "; ".join(info.get("authors", [])),
                        "publisher": info.get("publisher", ""),
                        "year": info.get("publishedDate", ""),
                        "edition": "",
                        "isbn": isbn,
                        "source": "google_books",
                    }
    except httpx.HTTPError:
        pass

    raise HTTPException(status_code=404, detail=f"No book found for ISBN {isbn}")


@router.get("/{book_id}")
async def get_book(book_id: str):
    path = _resolve_path(book_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Book not found")
    return json.loads(path.read_text(encoding="utf-8"))


@router.put("/{book_id}")
async def update_book(book_id: str, body: UpdateBookRequest):
    path = _resolve_path(book_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Book not found")

    data = json.loads(path.read_text(encoding="utf-8"))
    updates = body.model_dump(exclude_none=True)
    data.update(updates)
    atomic_write(path, json.dumps(data, indent=2))
    return {"id": book_id, **updates}


@router.delete("/{book_id}")
async def delete_book(book_id: str):
    meta_path = _resolve_path(book_id)
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Book not found")

    data = json.loads(meta_path.read_text(encoding="utf-8"))
    raw_file = _files_dir() / data.get("raw_file", "")
    raw_file.unlink(missing_ok=True)
    meta_path.unlink()
    return {"deleted": True}


@router.get("/{book_id}/pages")
async def get_pages(book_id: str, start: int = 1, end: Optional[int] = None):
    path = _resolve_path(book_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Book not found")

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
    return {"book_id": book_id, "pages": filtered, "total_pages": len(pages)}


@router.get("/{book_id}/citation")
async def get_book_citation(book_id: str, style: str = "apa7"):
    path = _resolve_path(book_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Book not found")

    data = json.loads(path.read_text(encoding="utf-8"))
    from services.citation_formatter import format_book_citation
    citation = format_book_citation(data, style)
    return {"citation": citation, "style": style}
