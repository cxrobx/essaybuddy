import os
import time
import hashlib
import json
from pathlib import Path
import httpx
from typing import Optional

from services.sandbox import data_root, atomic_write


class DiskCache:
    """Persistent JSON cache stored in data/research/cache/."""

    def __init__(self):
        self._dir = data_root() / "research" / "cache"
        self._dir.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self._dir / f"{key}.json"

    def get(self, key: str):
        path = self._path(key)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def set(self, key: str, value):
        atomic_write(self._path(key), json.dumps(value))

    @staticmethod
    def make_key(*args) -> str:
        raw = json.dumps(args, sort_keys=True, default=str)
        return hashlib.md5(raw.encode()).hexdigest()


class RateLimiter:
    """Simple token bucket rate limiter."""
    def __init__(self, rate: float):
        self.rate = rate  # requests per second
        self._last = 0.0

    async def wait(self):
        now = time.monotonic()
        elapsed = now - self._last
        wait_time = (1.0 / self.rate) - elapsed
        if wait_time > 0:
            import asyncio
            await asyncio.sleep(wait_time)
        self._last = time.monotonic()


S2_BASE = "https://api.semanticscholar.org/graph/v1"
S2_FIELDS = "paperId,title,abstract,authors,year,citationCount,tldr,externalIds,isOpenAccess,openAccessPdf,fieldsOfStudy"
UNPAYWALL_BASE = "https://api.unpaywall.org/v2"
CROSSREF_BASE = "https://api.crossref.org/works"


class ResearchClient:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._s2_limiter = RateLimiter(1.0)  # 1 req/sec default
        self._unpaywall_limiter = RateLimiter(10.0)
        self._crossref_limiter = RateLimiter(10.0)
        self._s2_api_key = os.environ.get("SEMANTIC_SCHOLAR_API_KEY")
        self._cache = DiskCache()

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    def _s2_headers(self) -> dict:
        headers = {}
        if self._s2_api_key:
            headers["x-api-key"] = self._s2_api_key
        return headers

    async def _s2_request(self, method: str, url: str, **kwargs) -> httpx.Response:
        """Make an S2 request with retry on 429."""
        import asyncio
        max_retries = 3
        for attempt in range(max_retries):
            await self._s2_limiter.wait()
            resp = await self.client.request(method, url, headers=self._s2_headers(), **kwargs)
            if resp.status_code == 429 and attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        resp.raise_for_status()
        return resp

    async def search(self, query: str, year_min: Optional[int] = None, year_max: Optional[int] = None,
                     limit: int = 10, offset: int = 0, fields_of_study: Optional[list[str]] = None,
                     refresh: bool = False) -> dict:
        cache_key = DiskCache.make_key("search", query, year_min, year_max, limit, offset, fields_of_study)
        if not refresh:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached

        params = {"query": query, "limit": min(limit, 100), "offset": offset, "fields": S2_FIELDS}
        if year_min or year_max:
            year_range = f"{year_min or ''}-{year_max or ''}"
            params["year"] = year_range
        if fields_of_study:
            params["fieldsOfStudy"] = ",".join(fields_of_study)

        resp = await self._s2_request("GET", f"{S2_BASE}/paper/search", params=params)
        data = resp.json()

        papers = []
        for p in data.get("data", []):
            papers.append(_normalize_s2_paper(p))

        result = {
            "papers": papers,
            "total": data.get("total", 0),
            "offset": offset,
            "next_offset": offset + len(papers) if offset + len(papers) < data.get("total", 0) else None,
        }
        self._cache.set(cache_key, result)
        return result

    async def get_paper(self, paper_id: str) -> dict:
        cache_key = DiskCache.make_key("paper", paper_id)
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        resp = await self._s2_request("GET", f"{S2_BASE}/paper/{paper_id}", params={"fields": S2_FIELDS})
        paper = _normalize_s2_paper(resp.json())
        # Enrich with Unpaywall PDF if DOI available
        if paper.get("doi") and not paper.get("pdf_url"):
            try:
                pdf_url = await self.get_pdf_url(paper["doi"])
                if pdf_url:
                    paper["pdf_url"] = pdf_url
            except Exception:
                pass
        self._cache.set(cache_key, paper)
        return paper

    async def get_pdf_url(self, doi: str) -> Optional[str]:
        await self._unpaywall_limiter.wait()
        email = os.environ.get("UNPAYWALL_EMAIL", "essaybuddy@localhost")
        resp = await self.client.get(f"{UNPAYWALL_BASE}/{doi}", params={"email": email})
        if resp.status_code != 200:
            return None
        data = resp.json()
        best = data.get("best_oa_location")
        if best:
            return best.get("url_for_pdf") or best.get("url")
        return None

    async def get_crossref_metadata(self, doi: str) -> dict:
        await self._crossref_limiter.wait()
        headers = {"User-Agent": "EssayBuddy/1.0 (mailto:essaybuddy@localhost)"}
        resp = await self.client.get(f"{CROSSREF_BASE}/{doi}", headers=headers)
        resp.raise_for_status()
        return resp.json().get("message", {})


def _normalize_s2_paper(p: dict) -> dict:
    """Normalize Semantic Scholar paper response to our schema."""
    ext_ids = p.get("externalIds") or {}
    oa_pdf = p.get("openAccessPdf") or {}
    tldr = p.get("tldr")
    return {
        "paper_id": p.get("paperId", ""),
        "title": p.get("title", ""),
        "authors": [{"name": a.get("name", ""), "authorId": a.get("authorId")} for a in (p.get("authors") or [])],
        "year": p.get("year"),
        "abstract": p.get("abstract"),
        "tldr": tldr.get("text") if isinstance(tldr, dict) else None,
        "doi": ext_ids.get("DOI"),
        "citation_count": p.get("citationCount"),
        "fields_of_study": p.get("fieldsOfStudy") or [],
        "is_open_access": p.get("isOpenAccess", False),
        "pdf_url": oa_pdf.get("url"),
    }


# Module-level singleton
_client: Optional[ResearchClient] = None


def get_research_client() -> ResearchClient:
    global _client
    if _client is None:
        _client = ResearchClient()
    return _client
