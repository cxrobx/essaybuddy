"""Lightweight text-similarity scorer for matching papers to outline sections."""

import re
from typing import Optional

# Try NLTK stopwords; fall back to a minimal set if unavailable
try:
    from nltk.corpus import stopwords
    _STOP_WORDS = set(stopwords.words("english"))
except Exception:
    _STOP_WORDS = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
        "being", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "can", "this", "that", "these",
        "those", "it", "its", "not", "no", "nor", "so", "if", "then", "than",
        "as", "such", "both", "each", "all", "any", "some", "into", "about",
    }

_TOKEN_RE = re.compile(r"[a-z]{2,}")


def _tokenize(text: str) -> set[str]:
    """Tokenize text into lowercase words, filtering stopwords and short tokens."""
    return {w for w in _TOKEN_RE.findall(text.lower()) if w not in _STOP_WORDS}


def _paper_text(paper: dict) -> str:
    """Extract searchable text from a paper dict."""
    parts = [paper.get("title", "")]
    tldr = paper.get("tldr") or paper.get("abstract") or ""
    if tldr:
        parts.append(tldr)
    fields = paper.get("fields_of_study", [])
    if fields:
        parts.append(" ".join(fields))
    return " ".join(parts)


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    intersection = a & b
    union = a | b
    return len(intersection) / len(union) if union else 0.0


def match_papers_to_section(
    section_title: str,
    section_notes: str,
    papers: list[dict],
    max_papers: int = 3,
    threshold: float = 0.1,
) -> list[str]:
    """Return paper_ids ranked by relevance to this section."""
    section_tokens = _tokenize(f"{section_title} {section_notes}")
    if not section_tokens or not papers:
        return []

    scored = []
    for paper in papers:
        paper_tokens = _tokenize(_paper_text(paper))
        score = _jaccard(section_tokens, paper_tokens)
        if score >= threshold:
            paper_id = paper.get("paper_id", "")
            if paper_id:
                scored.append((score, paper_id))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [pid for _, pid in scored[:max_papers]]


def match_papers_to_sections(
    sections: list[dict],
    papers: list[dict],
    max_papers_per_section: int = 3,
    threshold: float = 0.1,
) -> list[list[str]]:
    """Return [paper_ids] per section index."""
    return [
        match_papers_to_section(
            s.get("title", ""),
            s.get("notes", ""),
            papers,
            max_papers=max_papers_per_section,
            threshold=threshold,
        )
        for s in sections
    ]
