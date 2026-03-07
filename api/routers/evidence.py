"""Evidence extraction and management."""
# Supports both book and legacy textbook terminology for backward compat.
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.sandbox import data_root, atomic_write
from services.ai_provider import get_provider

router = APIRouter(prefix="/evidence", tags=["evidence"])

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "evidence_extraction.md"

MAX_CHAPTER_CHARS = 50_000


class ChapterSpec(BaseModel):
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    chapter_ref: Optional[str] = None


class ExtractEvidenceRequest(BaseModel):
    essay_id: str
    book_id: Optional[str] = None
    textbook_id: Optional[str] = None  # backward compat alias for book_id
    chapter: ChapterSpec
    topic: Optional[str] = None
    thesis: Optional[str] = None
    num_quotes: int = 5
    profile_id: Optional[str] = None
    citation_style: Optional[str] = None

    @property
    def resolved_book_id(self) -> str:
        bid = self.book_id or self.textbook_id
        if not bid:
            raise ValueError("book_id is required")
        return bid


class AssignRequest(BaseModel):
    evidence_id: str
    section_id: str


class UnassignRequest(BaseModel):
    pass


def _evidence_dir() -> Path:
    return data_root() / "evidence"


def _books_dir() -> Path:
    return data_root() / "books"


def _load_evidence_file(essay_id: str) -> dict:
    path = _evidence_dir() / f"{essay_id}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"essay_id": essay_id, "items": []}


def _save_evidence_file(essay_id: str, data: dict) -> None:
    path = _evidence_dir() / f"{essay_id}.json"
    atomic_write(path, json.dumps(data, indent=2))


def _resolve_chapter_text(pages: list[dict], chapter: ChapterSpec) -> str:
    """Resolve chapter text from pages using page range and/or chapter reference."""
    has_pages = chapter.page_start is not None or chapter.page_end is not None
    has_ref = chapter.chapter_ref is not None and chapter.chapter_ref.strip()

    if not has_pages and not has_ref:
        raise HTTPException(
            status_code=422,
            detail="At least one of page_start/page_end or chapter_ref is required",
        )

    if has_pages:
        # Filter by page range
        start = chapter.page_start or 1
        end = chapter.page_end or len(pages)
        filtered = [p for p in pages if start <= p["page"] <= end]
        if not filtered:
            raise HTTPException(status_code=422, detail="No pages found in specified range")

        label = ""
        if has_ref:
            label = f"Chapter: {chapter.chapter_ref}\n\n"

        parts = []
        for p in filtered:
            parts.append(f"[Page {p['page']}]\n{p['text']}")
        text = label + "\n\n".join(parts)
    else:
        # Chapter reference only — scan for heading match
        ref = chapter.chapter_ref.strip()
        ref_lower = ref.lower()

        # Find page where chapter heading appears
        start_idx = None
        for i, p in enumerate(pages):
            # Look for the chapter reference as a heading in the text
            if ref_lower in p["text"].lower():
                start_idx = i
                break

        if start_idx is None:
            raise HTTPException(
                status_code=422,
                detail=f"Chapter heading '{ref}' not found in book. Try specifying page numbers instead.",
            )

        # Find next chapter heading (look for common chapter patterns)
        chapter_pattern = re.compile(
            r"^(chapter\s+\d+|part\s+\d+|section\s+\d+)",
            re.IGNORECASE | re.MULTILINE,
        )

        end_idx = len(pages)
        for i in range(start_idx + 1, len(pages)):
            if chapter_pattern.search(pages[i]["text"]):
                end_idx = i
                break

        filtered = pages[start_idx:end_idx]
        parts = []
        for p in filtered:
            parts.append(f"[Page {p['page']}]\n{p['text']}")
        text = "\n\n".join(parts)

    # Cap at max chars
    if len(text) > MAX_CHAPTER_CHARS:
        text = text[:MAX_CHAPTER_CHARS]
        # Try to break at a word boundary
        last_space = text.rfind(" ")
        if last_space > MAX_CHAPTER_CHARS - 200:
            text = text[:last_space] + "..."

    return text


@router.post("/extract")
async def extract_evidence(body: ExtractEvidenceRequest):
    # Resolve book_id (accepts both book_id and textbook_id)
    try:
        book_id = body.resolved_book_id
    except ValueError:
        raise HTTPException(status_code=422, detail="book_id is required")

    # Load book
    bk_path = _books_dir() / f"{book_id}.json"
    if not bk_path.exists():
        raise HTTPException(status_code=404, detail="Book not found")

    bk_data = json.loads(bk_path.read_text(encoding="utf-8"))
    pages = bk_data.get("pages", [])

    # Resolve chapter text
    chapter_text = _resolve_chapter_text(pages, body.chapter)

    # Load prompt template
    system_prompt = ""
    if _PROMPT_PATH.exists():
        system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")

    # Build extraction prompt
    topic_line = f"\nEssay Topic: {body.topic}" if body.topic else ""
    thesis_line = f"\nEssay Thesis: {body.thesis}" if body.thesis else ""
    cite_line = f"\nCitation Style: {body.citation_style}" if body.citation_style else ""

    prompt = f"""{system_prompt}

<source-chapter>
Source: {bk_data.get('title', bk_data.get('filename', 'Unknown'))}

{chapter_text}
</source-chapter>
{topic_line}{thesis_line}{cite_line}

Extract {body.num_quotes} pieces of citable evidence from this chapter.
Return ONLY the JSON array."""

    provider = get_provider()
    try:
        result = await provider.generate(prompt)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Parse AI response
    try:
        extracted = json.loads(result)
    except json.JSONDecodeError:
        # Try to extract JSON array from response
        match = re.search(r"\[.*\]", result, re.DOTALL)
        if match:
            try:
                extracted = json.loads(match.group())
            except json.JSONDecodeError:
                raise HTTPException(status_code=502, detail="AI returned invalid JSON")
        else:
            raise HTTPException(status_code=502, detail="AI returned invalid JSON")

    # Build evidence items
    now = datetime.utcnow().isoformat()
    new_items = []
    for item in extracted:
        ev_id = "ev_" + str(uuid.uuid4())[:8]
        new_items.append({
            "id": ev_id,
            "book_id": book_id,
            "source_title": bk_data.get("title", bk_data.get("filename", "")),
            "source_type": "book",
            "quote": item.get("quote", ""),
            "page_number": item.get("page_number"),
            "context": item.get("context", ""),
            "relevance": item.get("relevance", ""),
            "section_id": None,
            "created_at": now,
        })

    # Save to evidence file
    ev_data = _load_evidence_file(body.essay_id)
    ev_data["items"].extend(new_items)
    _save_evidence_file(body.essay_id, ev_data)

    return {"items": new_items, "total": len(ev_data["items"])}


@router.get("/{essay_id}")
async def get_evidence(essay_id: str):
    return _load_evidence_file(essay_id)


@router.put("/{essay_id}/assign")
async def assign_evidence(essay_id: str, body: AssignRequest):
    ev_data = _load_evidence_file(essay_id)

    found = False
    for item in ev_data["items"]:
        if item["id"] == body.evidence_id:
            item["section_id"] = body.section_id
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    _save_evidence_file(essay_id, ev_data)
    return {"assigned": True, "evidence_id": body.evidence_id, "section_id": body.section_id}


@router.put("/{essay_id}/unassign/{evidence_id}")
async def unassign_evidence(essay_id: str, evidence_id: str):
    ev_data = _load_evidence_file(essay_id)

    found = False
    for item in ev_data["items"]:
        if item["id"] == evidence_id:
            item["section_id"] = None
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    _save_evidence_file(essay_id, ev_data)
    return {"unassigned": True, "evidence_id": evidence_id}


@router.delete("/{essay_id}/{evidence_id}")
async def delete_evidence(essay_id: str, evidence_id: str):
    ev_data = _load_evidence_file(essay_id)

    original_count = len(ev_data["items"])
    ev_data["items"] = [item for item in ev_data["items"] if item["id"] != evidence_id]

    if len(ev_data["items"]) == original_count:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    _save_evidence_file(essay_id, ev_data)
    return {"deleted": True}
