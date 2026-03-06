import os
import time
import hashlib
import json
import logging
from pathlib import Path
import httpx
from typing import Optional

from services.sandbox import data_root, atomic_write

log = logging.getLogger(__name__)


class DiskCache:
    """Persistent JSON cache stored in data/research/cache/."""

    def __init__(self, subdir: str = "cache"):
        self._dir = data_root() / "research" / subdir
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
OPENALEX_BASE = "https://api.openalex.org"
UNPAYWALL_BASE = "https://api.unpaywall.org/v2"
CROSSREF_BASE = "https://api.crossref.org/works"


class ResearchClient:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._s2_limiter = RateLimiter(1.0)  # 1 req/sec default
        self._openalex_limiter = RateLimiter(10.0)  # 10 req/sec polite pool
        self._unpaywall_limiter = RateLimiter(10.0)
        self._crossref_limiter = RateLimiter(10.0)
        self._s2_api_key = os.environ.get("SEMANTIC_SCHOLAR_API_KEY")
        self._openalex_email = os.environ.get("OPENALEX_EMAIL", "essaybuddy@localhost")
        self._openalex_api_key = os.environ.get("OPENALEX_API_KEY")
        self._cache = DiskCache()
        self._tldr_cache = DiskCache(subdir="cache/tldrs")

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    # ── Semantic Scholar (primary) ───────────────────────────────

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

    async def _s2_search(self, query: str, year_min: Optional[int], year_max: Optional[int],
                         limit: int, offset: int, fields_of_study: Optional[list[str]]) -> dict:
        params = {"query": query, "limit": min(limit, 100), "offset": offset, "fields": S2_FIELDS}
        if year_min or year_max:
            params["year"] = f"{year_min or ''}-{year_max or ''}"
        if fields_of_study:
            params["fieldsOfStudy"] = ",".join(fields_of_study)

        resp = await self._s2_request("GET", f"{S2_BASE}/paper/search", params=params)
        data = resp.json()

        papers = [_normalize_s2_paper(p) for p in data.get("data", [])]
        total = data.get("total", 0)
        return {
            "papers": papers,
            "total": total,
            "offset": offset,
            "next_offset": offset + len(papers) if offset + len(papers) < total else None,
        }

    async def _s2_get_paper(self, paper_id: str) -> dict:
        resp = await self._s2_request("GET", f"{S2_BASE}/paper/{paper_id}", params={"fields": S2_FIELDS})
        return _normalize_s2_paper(resp.json())

    # ── OpenAlex (fallback) ──────────────────────────────────────

    def _openalex_headers(self) -> dict:
        return {"User-Agent": f"mailto:{self._openalex_email}"}

    async def _openalex_request(self, method: str, url: str, **kwargs) -> httpx.Response:
        """Make an OpenAlex request with retry on 429."""
        import asyncio
        # Inject api_key into params if available
        if self._openalex_api_key:
            params = kwargs.get("params", {})
            if isinstance(params, dict):
                params["api_key"] = self._openalex_api_key
                kwargs["params"] = params
        max_retries = 3
        for attempt in range(max_retries):
            await self._openalex_limiter.wait()
            resp = await self.client.request(method, url, headers=self._openalex_headers(), **kwargs)
            if resp.status_code == 429 and attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        resp.raise_for_status()
        return resp

    async def _openalex_search(self, query: str, year_min: Optional[int], year_max: Optional[int],
                               limit: int, offset: int, fields_of_study: Optional[list[str]]) -> dict:
        search_query = query
        if fields_of_study:
            search_query = f"{query} {' '.join(fields_of_study)}"

        params = {
            "search": search_query,
            "per_page": min(limit, 100),
            "page": (offset // max(limit, 1)) + 1,
            "mailto": self._openalex_email,
        }
        if year_min or year_max:
            params["filter"] = f"publication_year:{year_min or ''}-{year_max or ''}"

        resp = await self._openalex_request("GET", f"{OPENALEX_BASE}/works", params=params)
        data = resp.json()

        papers = [_normalize_openalex_paper(p) for p in data.get("results", [])]
        total = data.get("meta", {}).get("count", 0)

        self._inject_cached_tldrs(papers)

        return {
            "papers": papers,
            "total": total,
            "offset": offset,
            "next_offset": offset + len(papers) if offset + len(papers) < total else None,
        }

    async def _openalex_get_paper(self, paper_id: str) -> dict:
        resp = await self._openalex_request("GET", f"{OPENALEX_BASE}/works/{paper_id}")
        paper = _normalize_openalex_paper(resp.json())

        # Generate AI TLDR if paper has abstract but no cached TLDR
        if paper.get("abstract"):
            tldr_key = DiskCache.make_key("tldr", paper["paper_id"])
            cached_tldr = self._tldr_cache.get(tldr_key)
            if cached_tldr:
                paper["tldr"] = cached_tldr
            else:
                tldr = await self._generate_tldr(paper["paper_id"], paper["abstract"])
                if tldr:
                    paper["tldr"] = tldr

        return paper

    # ── Public API (S2 primary, OpenAlex fallback) ───────────────

    async def search(self, query: str, year_min: Optional[int] = None, year_max: Optional[int] = None,
                     limit: int = 10, offset: int = 0, fields_of_study: Optional[list[str]] = None,
                     refresh: bool = False) -> dict:
        cache_key = DiskCache.make_key("search", query, year_min, year_max, limit, offset, fields_of_study)
        if not refresh:
            cached = self._cache.get(cache_key)
            if cached is not None:
                self._inject_cached_tldrs(cached.get("papers", []))
                return cached

        try:
            result = await self._s2_search(query, year_min, year_max, limit, offset, fields_of_study)
        except Exception as e:
            log.warning("Semantic Scholar search failed, falling back to OpenAlex: %s", e)
            result = await self._openalex_search(query, year_min, year_max, limit, offset, fields_of_study)

        self._cache.set(cache_key, result)
        return result

    async def get_paper(self, paper_id: str, refresh: bool = False) -> dict:
        cache_key = DiskCache.make_key("paper", paper_id)
        if not refresh:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached

        try:
            paper = await self._s2_get_paper(paper_id)
        except Exception as e:
            log.warning("Semantic Scholar paper fetch failed, falling back to OpenAlex: %s", e)
            paper = await self._openalex_get_paper(paper_id)

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

    # ── TLDR helpers ─────────────────────────────────────────────

    def _inject_cached_tldrs(self, papers: list[dict]):
        """Replace truncated TLDRs with cached AI-generated ones where available."""
        for paper in papers:
            pid = paper.get("paper_id", "")
            if pid:
                cached_tldr = self._tldr_cache.get(DiskCache.make_key("tldr", pid))
                if cached_tldr:
                    paper["tldr"] = cached_tldr

    async def _generate_tldr(self, paper_id: str, abstract: str) -> Optional[str]:
        """Generate a TLDR summary using the AI provider and cache it."""
        try:
            from services.ai_provider import get_provider
            provider = get_provider()
            prompt = (
                "Summarize this academic paper abstract in 1-2 sentences (max 200 chars):\n\n"
                + abstract
            )
            tldr = await provider.generate(prompt)
            tldr = tldr.strip()
            if tldr:
                self._tldr_cache.set(DiskCache.make_key("tldr", paper_id), tldr)
                return tldr
        except Exception:
            pass
        # Fallback: truncated abstract
        if len(abstract) > 200:
            return abstract[:197] + "..."
        return abstract

    # ── Unpaywall / CrossRef (unchanged) ─────────────────────────

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


# ── Normalizers ──────────────────────────────────────────────────

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


def _reconstruct_abstract(inverted_index: dict) -> str:
    """Convert OpenAlex inverted index abstract to plain text."""
    if not inverted_index:
        return ""
    positions = []
    for word, indices in inverted_index.items():
        for idx in indices:
            positions.append((idx, word))
    positions.sort(key=lambda x: x[0])
    return " ".join(word for _, word in positions)


def _normalize_openalex_paper(p: dict) -> dict:
    """Normalize OpenAlex paper response to our schema."""
    raw_id = p.get("id", "")
    paper_id = raw_id.replace("https://openalex.org/", "") if raw_id else ""

    raw_doi = p.get("doi") or ""
    doi = raw_doi.replace("https://doi.org/", "") if raw_doi else None

    abstract = _reconstruct_abstract(p.get("abstract_inverted_index") or {})

    authors = []
    for authorship in (p.get("authorships") or []):
        author = authorship.get("author") or {}
        authors.append({
            "name": author.get("display_name", ""),
            "authorId": (author.get("id") or "").replace("https://openalex.org/", ""),
        })

    oa = p.get("open_access") or {}
    best_oa = p.get("best_oa_location") or {}
    topics = [t.get("display_name", "") for t in (p.get("topics") or []) if t.get("display_name")]

    tldr = None
    if abstract:
        tldr = abstract[:197] + "..." if len(abstract) > 200 else abstract

    return {
        "paper_id": paper_id,
        "title": p.get("display_name", ""),
        "authors": authors,
        "year": p.get("publication_year"),
        "abstract": abstract or None,
        "tldr": tldr,
        "doi": doi,
        "citation_count": p.get("cited_by_count"),
        "fields_of_study": topics[:5],
        "is_open_access": oa.get("is_oa", False),
        "pdf_url": best_oa.get("pdf_url"),
    }


# Module-level singleton
_client: Optional[ResearchClient] = None


def get_research_client() -> ResearchClient:
    global _client
    if _client is None:
        _client = ResearchClient()
    return _client
