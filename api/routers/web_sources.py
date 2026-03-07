"""Web source management."""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.sandbox import data_root, atomic_write
from services.metadata_fetcher import fetch_url_metadata

router = APIRouter(prefix="/web-sources", tags=["web_sources"])


def _web_sources_dir() -> Path:
    return data_root() / "web_sources"


class CreateWebSourceRequest(BaseModel):
    url: str
    essay_id: Optional[str] = None
    title: Optional[str] = None
    author: Optional[str] = None


class UpdateWebSourceRequest(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    date_published: Optional[str] = None
    site_name: Optional[str] = None
    description: Optional[str] = None


class LinkRequest(BaseModel):
    essay_id: str
    action: str = "link"  # "link" or "unlink"


def _load_source(source_id: str) -> dict:
    path = _web_sources_dir() / f"{source_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Web source not found")
    return json.loads(path.read_text(encoding="utf-8"))


def _save_source(source_id: str, data: dict) -> None:
    path = _web_sources_dir() / f"{source_id}.json"
    atomic_write(path, json.dumps(data, indent=2))


@router.post("", status_code=201)
async def create_web_source(body: CreateWebSourceRequest):
    # Auto-fetch metadata
    meta = await fetch_url_metadata(body.url)

    ws_id = "ws_" + str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()

    source = {
        "id": ws_id,
        "url": body.url,
        "title": body.title or meta.get("title", ""),
        "author": body.author or meta.get("author", ""),
        "date_published": meta.get("date_published", ""),
        "site_name": meta.get("site_name", ""),
        "description": meta.get("description", ""),
        "accessed_at": now,
        "essay_ids": [body.essay_id] if body.essay_id else [],
        "created_at": now,
    }
    _save_source(ws_id, source)
    return source


@router.get("")
async def list_web_sources(essay_id: Optional[str] = None):
    sources = []
    for f in sorted(_web_sources_dir().glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            if essay_id and essay_id not in data.get("essay_ids", []):
                continue
            sources.append(data)
        except (json.JSONDecodeError, KeyError):
            continue
    return sources


@router.get("/{source_id}")
async def get_web_source(source_id: str):
    return _load_source(source_id)


@router.put("/{source_id}")
async def update_web_source(source_id: str, body: UpdateWebSourceRequest):
    data = _load_source(source_id)
    updates = body.model_dump(exclude_none=True)
    data.update(updates)
    _save_source(source_id, data)
    return data


@router.delete("/{source_id}")
async def delete_web_source(source_id: str):
    path = _web_sources_dir() / f"{source_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Web source not found")
    path.unlink()
    return {"deleted": True}


@router.put("/{source_id}/link")
async def link_web_source(source_id: str, body: LinkRequest):
    data = _load_source(source_id)
    essay_ids = data.get("essay_ids", [])
    if body.action == "link":
        if body.essay_id not in essay_ids:
            essay_ids.append(body.essay_id)
    elif body.action == "unlink":
        essay_ids = [eid for eid in essay_ids if eid != body.essay_id]
    data["essay_ids"] = essay_ids
    _save_source(source_id, data)
    return data


@router.get("/{source_id}/citation")
async def get_web_citation(source_id: str, style: str = "apa7"):
    data = _load_source(source_id)
    from services.citation_formatter import format_web_citation
    citation = format_web_citation(data, style)
    return {"citation": citation, "style": style}
