"""Research paper search, save, and citation endpoints."""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.sandbox import data_root, atomic_write
from services.research_client import get_research_client
from services.citation_formatter import format_citation

log = logging.getLogger(__name__)

router = APIRouter(prefix="/research", tags=["research"])


class SavePaperRequest(BaseModel):
    paper_id: str
    title: str
    authors: list[dict] = []
    year: Optional[int] = None
    abstract: Optional[str] = None
    tldr: Optional[str] = None
    doi: Optional[str] = None
    citation_count: Optional[int] = None
    fields_of_study: list[str] = []
    is_open_access: bool = False
    pdf_url: Optional[str] = None
    notes: Optional[str] = None
    essay_ids: list[str] = []


class LinkRequest(BaseModel):
    essay_id: str
    action: str = "link"  # "link" or "unlink"


class BatchCiteRequest(BaseModel):
    paper_ids: list[str]
    style: str = "apa7"


def _papers_dir():
    return data_root() / "research" / "papers"


def _load_saved_paper(paper_id: str) -> dict:
    path = _papers_dir() / f"{paper_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Saved paper not found")
    return json.loads(path.read_text(encoding="utf-8"))


def _save_paper_file(paper_id: str, data: dict):
    path = _papers_dir() / f"{paper_id}.json"
    atomic_write(path, json.dumps(data, indent=2))


@router.get("/search")
async def search_papers(
    q: str = Query(..., min_length=1),
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    fields_of_study: Optional[str] = None,
    refresh: bool = False,
):
    client = get_research_client()
    fos = [f.strip() for f in fields_of_study.split(",")] if fields_of_study else None
    try:
        result = await client.search(q, year_min=year_min, year_max=year_max,
                                      limit=limit, offset=offset, fields_of_study=fos,
                                      refresh=refresh)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Search failed: {str(e)}")


@router.get("/paper/{paper_id}")
async def get_paper(paper_id: str):
    client = get_research_client()
    try:
        paper = await client.get_paper(paper_id)
        return paper
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch paper: {str(e)}")


@router.post("/save", status_code=201)
async def save_paper(body: SavePaperRequest):
    paper_id = body.paper_id or ("rp_" + str(uuid.uuid4())[:8])
    now = datetime.now(timezone.utc).isoformat()
    data = body.model_dump()
    data["paper_id"] = paper_id
    data["saved_at"] = now
    if "notes" not in data or data["notes"] is None:
        data["notes"] = None
    if "essay_ids" not in data:
        data["essay_ids"] = []
    _save_paper_file(paper_id, data)
    return data


@router.get("/saved")
async def list_saved_papers(essay_id: Optional[str] = None):
    papers = []
    papers_dir = _papers_dir()
    if not papers_dir.exists():
        return papers
    for f in sorted(papers_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            p = json.loads(f.read_text(encoding="utf-8"))
            if essay_id and essay_id not in p.get("essay_ids", []):
                continue
            papers.append(p)
        except (json.JSONDecodeError, Exception):
            continue
    return papers


@router.delete("/saved/{paper_id}")
async def delete_saved_paper(paper_id: str):
    path = _papers_dir() / f"{paper_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Saved paper not found")
    path.unlink()
    # Clean up local PDF if it exists
    pdf_path = _papers_dir() / f"{paper_id}.pdf"
    if pdf_path.exists():
        pdf_path.unlink()
    return {"deleted": True}


@router.post("/saved/{paper_id}/download-pdf")
async def download_paper_pdf(paper_id: str):
    """Download the paper's PDF to local storage."""
    import httpx

    data = _load_saved_paper(paper_id)
    pdf_url = data.get("pdf_url")
    if not pdf_url:
        raise HTTPException(status_code=400, detail="No PDF URL available for this paper")

    pdf_path = _papers_dir() / f"{paper_id}.pdf"
    if pdf_path.exists():
        data["has_local_pdf"] = True
        _save_paper_file(paper_id, data)
        return data

    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(pdf_url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            # Accept if content-type says PDF, URL ends in .pdf, or response starts with PDF magic bytes
            is_pdf = "pdf" in content_type or pdf_url.rstrip("/").endswith(".pdf") or resp.content[:5] == b"%PDF-"
            if not is_pdf:
                raise HTTPException(status_code=502, detail="Remote URL did not return a PDF")
            pdf_path.write_bytes(resp.content)
    except httpx.HTTPError as e:
        log.warning("PDF download failed for %s: %s", paper_id, e)
        raise HTTPException(status_code=502, detail=f"Failed to download PDF: {str(e)}")

    data["has_local_pdf"] = True
    _save_paper_file(paper_id, data)
    return data


@router.get("/saved/{paper_id}/pdf")
async def serve_paper_pdf(paper_id: str):
    """Serve a locally downloaded PDF."""
    pdf_path = _papers_dir() / f"{paper_id}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not downloaded yet")
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"{paper_id}.pdf")


@router.put("/saved/{paper_id}/link")
async def link_paper(paper_id: str, body: LinkRequest):
    data = _load_saved_paper(paper_id)
    essay_ids = data.get("essay_ids", [])
    if body.action == "link":
        if body.essay_id not in essay_ids:
            essay_ids.append(body.essay_id)
    elif body.action == "unlink":
        essay_ids = [eid for eid in essay_ids if eid != body.essay_id]
    data["essay_ids"] = essay_ids
    _save_paper_file(paper_id, data)
    return data


@router.get("/cite/{paper_id}")
async def cite_paper(paper_id: str, style: str = "apa7"):
    # Try saved paper first
    path = _papers_dir() / f"{paper_id}.json"
    if path.exists():
        paper_data = json.loads(path.read_text(encoding="utf-8"))
    else:
        # Fetch from S2
        client = get_research_client()
        try:
            paper_data = await client.get_paper(paper_id)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch paper: {str(e)}")

    # Try CrossRef for better metadata if DOI available
    doi = paper_data.get("doi") or paper_data.get("DOI")
    metadata = paper_data
    if doi:
        client = get_research_client()
        try:
            cr_meta = await client.get_crossref_metadata(doi)
            if cr_meta:
                metadata = cr_meta
        except Exception:
            pass  # Fall back to S2 data

    citation = format_citation(metadata, style)
    return {"paper_id": paper_id, "style": style, "citation": citation}


@router.post("/cite/batch")
async def batch_cite(body: BatchCiteRequest):
    results = []
    for pid in body.paper_ids:
        try:
            result = await cite_paper(pid, body.style)
            results.append(result)
        except Exception:
            results.append({"paper_id": pid, "style": body.style, "citation": "", "error": "Failed to generate citation"})
    return results
