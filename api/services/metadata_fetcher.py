"""URL metadata extraction using httpx + BeautifulSoup."""
import json
from typing import Optional

import httpx
from bs4 import BeautifulSoup


async def fetch_url_metadata(url: str) -> dict:
    """Fetch and extract metadata from a URL.

    Returns dict with: title, author, description, site_name, date_published, url.
    Always includes url even on failure.
    """
    result = {
        "title": "",
        "author": "",
        "description": "",
        "site_name": "",
        "date_published": "",
        "url": url,
    }

    try:
        async with httpx.AsyncClient(
            timeout=10,
            follow_redirects=True,
            headers={"User-Agent": "EssayBuddy/1.0 (metadata fetcher)"},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            html = resp.text
    except (httpx.HTTPError, httpx.InvalidURL):
        return result

    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return result

    # 1. Try JSON-LD
    _extract_json_ld(soup, result)

    # 2. Open Graph tags (override empty fields)
    _extract_og(soup, result)

    # 3. Standard meta tags (fill remaining gaps)
    _extract_meta(soup, result)

    # 4. Title fallback
    if not result["title"]:
        tag = soup.find("title")
        if tag and tag.string:
            result["title"] = tag.string.strip()

    return result


def _extract_json_ld(soup: BeautifulSoup, result: dict) -> None:
    """Extract metadata from JSON-LD script tags."""
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        # Handle @graph arrays
        items = [data] if isinstance(data, dict) else data if isinstance(data, list) else []
        if isinstance(data, dict) and "@graph" in data:
            items = data["@graph"] if isinstance(data["@graph"], list) else [data["@graph"]]

        for item in items:
            if not isinstance(item, dict):
                continue
            if not result["title"] and item.get("headline"):
                result["title"] = str(item["headline"])
            if not result["title"] and item.get("name"):
                result["title"] = str(item["name"])
            if not result["author"]:
                author = item.get("author")
                if isinstance(author, dict):
                    result["author"] = str(author.get("name", ""))
                elif isinstance(author, list) and author:
                    names = [a.get("name", "") if isinstance(a, dict) else str(a) for a in author]
                    result["author"] = "; ".join(n for n in names if n)
                elif isinstance(author, str):
                    result["author"] = author
            if not result["description"] and item.get("description"):
                result["description"] = str(item["description"])
            if not result["date_published"] and item.get("datePublished"):
                result["date_published"] = str(item["datePublished"])
            if not result["site_name"] and item.get("publisher"):
                pub = item["publisher"]
                if isinstance(pub, dict):
                    result["site_name"] = str(pub.get("name", ""))
                elif isinstance(pub, str):
                    result["site_name"] = pub


def _extract_og(soup: BeautifulSoup, result: dict) -> None:
    """Extract Open Graph meta tags."""
    og_map = {
        "og:title": "title",
        "og:description": "description",
        "og:site_name": "site_name",
        "article:author": "author",
        "article:published_time": "date_published",
    }
    for prop, key in og_map.items():
        if not result[key]:
            tag = soup.find("meta", attrs={"property": prop})
            if tag and tag.get("content"):
                result[key] = tag["content"].strip()


def _extract_meta(soup: BeautifulSoup, result: dict) -> None:
    """Extract standard meta tags."""
    meta_map = {
        "author": "author",
        "description": "description",
    }
    for name, key in meta_map.items():
        if not result[key]:
            tag = soup.find("meta", attrs={"name": name})
            if tag and tag.get("content"):
                result[key] = tag["content"].strip()

    # twitter:title as title fallback
    if not result["title"]:
        tag = soup.find("meta", attrs={"name": "twitter:title"})
        if tag and tag.get("content"):
            result["title"] = tag["content"].strip()
