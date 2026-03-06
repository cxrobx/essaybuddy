"""Tests for research paper integration in expand-section and generate-full-essay."""
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

# Set DATA_ROOT before importing app
_tmpdir = tempfile.mkdtemp()
os.environ["DATA_ROOT"] = _tmpdir

from main import app  # noqa: E402
from services.sandbox import data_root  # noqa: E402
from routers.ai import _load_research_papers_by_ids, _load_linked_research_papers_raw  # noqa: E402


def _setup_dirs():
    for d in ("essays", "profiles", "evidence", "research/papers", "samples"):
        (data_root() / d).mkdir(parents=True, exist_ok=True)


def _create_essay(essay_id: str, topic: str = "Test", thesis: str = "Test thesis"):
    _setup_dirs()
    meta = {"title": "Test Essay", "topic": topic, "thesis": thesis}
    content = "---\n" + "\n".join(f"{k}: {v}" for k, v in meta.items() if v) + "\n---\n"
    (data_root() / "essays" / f"{essay_id}.md").write_text(content, encoding="utf-8")


def _create_outline(essay_id: str, sections: list):
    (data_root() / "essays" / f"{essay_id}.outline.json").write_text(
        json.dumps(sections), encoding="utf-8"
    )


def _create_profile(profile_id: str):
    (data_root() / "profiles" / f"{profile_id}.json").write_text(
        json.dumps({
            "id": profile_id,
            "name": "Test Profile",
            "sample_ids": [],
            "metrics": {"avg_sentence_length": 15},
        }),
        encoding="utf-8",
    )


def _create_saved_paper(paper_id: str, title: str = "Test Paper",
                        essay_ids: list = None):
    paper = {
        "paper_id": paper_id,
        "title": title,
        "authors": [{"name": "Author One"}, {"name": "Author Two"}],
        "year": 2024,
        "abstract": f"Abstract for {title}",
        "tldr": f"TLDR for {title}",
        "doi": f"10.1234/{paper_id}",
        "essay_ids": essay_ids or [],
        "saved_at": "2024-01-01T00:00:00Z",
    }
    (data_root() / "research" / "papers" / f"{paper_id}.json").write_text(
        json.dumps(paper), encoding="utf-8"
    )
    return paper


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


MOCK_SECTION_TEXT = "This is a generated paragraph about the topic."


async def _noop_humanize(text, profile):
    return text


# --- Unit tests for _load_research_papers_by_ids ---

def test_load_research_papers_by_ids_formats_correctly():
    _setup_dirs()
    _create_saved_paper("paper1", "Neural Networks in Education")
    result = _load_research_papers_by_ids(["paper1"])
    assert "<research-papers>" in result
    assert "Neural Networks in Education" in result
    assert "Author One" in result
    assert "2024" in result
    assert "10.1234/paper1" in result
    assert "</research-papers>" in result


def test_load_research_papers_by_ids_caps_at_max():
    _setup_dirs()
    for i in range(8):
        _create_saved_paper(f"cap{i}", f"Paper {i}")
    result = _load_research_papers_by_ids([f"cap{i}" for i in range(8)])
    # Should only include MAX_RESEARCH_PAPERS (5)
    count = result.count("### Paper")
    assert count == 5


def test_load_research_papers_by_ids_skips_missing():
    _setup_dirs()
    _create_saved_paper("exists1", "Existing Paper")
    result = _load_research_papers_by_ids(["exists1", "nonexistent", "also_missing"])
    assert "Existing Paper" in result
    assert "nonexistent" not in result


def test_load_research_papers_by_ids_empty_list():
    _setup_dirs()
    result = _load_research_papers_by_ids([])
    assert result == ""


# --- Integration tests for expand-section with paper_ids ---

@pytest.mark.anyio
@patch("routers.ai._humanize_pass", side_effect=_noop_humanize)
@patch("routers.ai.get_provider")
async def test_expand_section_with_paper_ids(mock_provider, mock_humanize, client):
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=MOCK_SECTION_TEXT)
    mock_provider.return_value = provider

    essay_id = "expand_papers"
    _create_essay(essay_id)
    _create_profile("prof1")
    _create_saved_paper("rp1", "Climate Change Impacts")

    resp = await client.post("/ai/expand-section", json={
        "essay_id": essay_id,
        "section_title": "Introduction",
        "section_notes": "Overview",
        "profile_id": "prof1",
        "paper_ids": ["rp1"],
    })
    assert resp.status_code == 200
    assert resp.json()["text"] == MOCK_SECTION_TEXT

    # Verify the prompt sent to AI includes the paper
    prompt = provider.generate.call_args_list[0][0][0]
    assert "Climate Change Impacts" in prompt
    assert "<research-papers>" in prompt


@pytest.mark.anyio
@patch("routers.ai._humanize_pass", side_effect=_noop_humanize)
@patch("routers.ai.get_provider")
async def test_expand_section_missing_paper_ids_graceful(mock_provider, mock_humanize, client):
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=MOCK_SECTION_TEXT)
    mock_provider.return_value = provider

    essay_id = "expand_missing"
    _create_essay(essay_id)
    _create_profile("prof1")

    resp = await client.post("/ai/expand-section", json={
        "essay_id": essay_id,
        "section_title": "Body",
        "profile_id": "prof1",
        "paper_ids": ["nonexistent1", "nonexistent2"],
    })
    assert resp.status_code == 200
    assert resp.json()["text"] == MOCK_SECTION_TEXT


@pytest.mark.anyio
@patch("routers.ai._humanize_pass", side_effect=_noop_humanize)
@patch("routers.ai.get_provider")
async def test_expand_section_without_paper_ids(mock_provider, mock_humanize, client):
    """Backward compatibility: expand-section still works without paper_ids."""
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=MOCK_SECTION_TEXT)
    mock_provider.return_value = provider

    essay_id = "expand_nopaper"
    _create_essay(essay_id)
    _create_profile("prof1")

    resp = await client.post("/ai/expand-section", json={
        "essay_id": essay_id,
        "section_title": "Body",
        "profile_id": "prof1",
    })
    assert resp.status_code == 200
    prompt = provider.generate.call_args_list[0][0][0]
    assert "<research-papers>" not in prompt


# --- Integration test for generate-full-essay with section-level papers ---

@pytest.mark.anyio
@patch("routers.ai._humanize_pass", side_effect=_noop_humanize)
@patch("routers.ai.get_provider")
async def test_full_essay_section_papers_augment_essay_papers(mock_provider, mock_humanize, client):
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=MOCK_SECTION_TEXT)
    mock_provider.return_value = provider

    essay_id = "full_papers"
    _create_essay(essay_id)
    _create_profile("prof1")

    # Essay-level paper (linked to essay)
    _create_saved_paper("essay_paper", "General Background Paper", essay_ids=[essay_id])
    # Section-level paper (not linked to essay but attached to section)
    _create_saved_paper("section_paper", "Section Specific Paper")

    _create_outline(essay_id, [
        {"id": "s1", "title": "Introduction", "notes": "Intro", "paper_ids": ["section_paper"]},
        {"id": "s2", "title": "Body", "notes": "Main"},
    ])

    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": essay_id,
        "profile_id": "prof1",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["sections_generated"] == 2

    # First section prompt should contain both essay-level and section-level papers
    first_prompt = provider.generate.call_args_list[0][0][0]
    assert "Section Specific Paper" in first_prompt
    assert "General Background Paper" in first_prompt

    # Second section prompt should only have essay-level paper
    second_prompt = provider.generate.call_args_list[1][0][0]
    assert "General Background Paper" in second_prompt
    assert "Section Specific Paper" not in second_prompt


# --- Tests for outline generation with paper catalog ---

@pytest.mark.anyio
@patch("routers.ai.get_provider")
async def test_outline_generation_includes_paper_ids(mock_provider, client):
    """AI returns sections with paper_ids — verify they're in the response."""
    ai_response = json.dumps([
        {"title": "Introduction", "notes": "Overview", "evidence": "...", "paper_ids": ["climate1"]},
        {"title": "Body", "notes": "Analysis", "evidence": "...", "paper_ids": ["climate1", "climate2"]},
    ])
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=ai_response)
    mock_provider.return_value = provider

    essay_id = "outline_papers"
    _create_essay(essay_id)
    _create_profile("prof1")
    _create_saved_paper("climate1", "Climate Change Study", essay_ids=[essay_id])
    _create_saved_paper("climate2", "Rising Temperatures", essay_ids=[essay_id])

    resp = await client.post("/ai/generate-outline", json={
        "topic": "Climate Change",
        "thesis": "It's urgent",
        "profile_id": "prof1",
        "essay_id": essay_id,
    })
    assert resp.status_code == 200
    outline = resp.json()["outline"]
    assert len(outline) == 2
    assert outline[0]["paper_ids"] == ["climate1"]
    assert set(outline[1]["paper_ids"]) == {"climate1", "climate2"}

    # Verify prompt included the paper catalog
    prompt = provider.generate.call_args_list[0][0][0]
    assert "<available-papers>" in prompt
    assert "climate1" in prompt


@pytest.mark.anyio
@patch("routers.ai.get_provider")
async def test_outline_generation_fallback_heuristic(mock_provider, client):
    """AI returns sections WITHOUT paper_ids — heuristic assigns them."""
    ai_response = json.dumps([
        {"title": "Climate Effects on Oceans", "notes": "Sea level rise and ocean acidification", "evidence": "..."},
        {"title": "Unrelated Conclusion", "notes": "Final thoughts", "evidence": "..."},
    ])
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=ai_response)
    mock_provider.return_value = provider

    essay_id = "outline_fallback"
    _create_essay(essay_id, topic="Climate Change")
    _create_profile("prof1")
    _create_saved_paper("ocean1", "Ocean Acidification and Climate",
                        essay_ids=[essay_id])

    resp = await client.post("/ai/generate-outline", json={
        "topic": "Climate Change",
        "profile_id": "prof1",
        "essay_id": essay_id,
    })
    assert resp.status_code == 200
    outline = resp.json()["outline"]
    # Heuristic should match ocean paper to the ocean-related section
    ocean_section = outline[0]
    assert "ocean1" in ocean_section.get("paper_ids", [])


@pytest.mark.anyio
@patch("routers.ai.get_provider")
async def test_outline_generation_strips_invalid_paper_ids(mock_provider, client):
    """AI hallucinates paper_ids — invalid ones are stripped."""
    ai_response = json.dumps([
        {"title": "Introduction", "notes": "Intro", "evidence": "...", "paper_ids": ["real1", "hallucinated_id"]},
    ])
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=ai_response)
    mock_provider.return_value = provider

    essay_id = "outline_invalid"
    _create_essay(essay_id)
    _create_profile("prof1")
    _create_saved_paper("real1", "Real Paper", essay_ids=[essay_id])

    resp = await client.post("/ai/generate-outline", json={
        "topic": "Test",
        "profile_id": "prof1",
        "essay_id": essay_id,
    })
    assert resp.status_code == 200
    outline = resp.json()["outline"]
    assert outline[0]["paper_ids"] == ["real1"]


# --- Test for full essay auto-pull when no paper_ids ---

@pytest.mark.anyio
@patch("routers.ai._humanize_pass", side_effect=_noop_humanize)
@patch("routers.ai.get_provider")
async def test_full_essay_auto_pull_when_no_paper_ids(mock_provider, mock_humanize, client):
    """Sections without paper_ids get auto-matched papers in prompt."""
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=MOCK_SECTION_TEXT)
    mock_provider.return_value = provider

    essay_id = "full_auto_pull"
    _create_essay(essay_id, topic="Climate Change")
    _create_profile("prof1")

    # Papers linked to essay but NOT manually assigned to sections
    _create_saved_paper("climate_paper", "Climate Change and Ocean Warming",
                        essay_ids=[essay_id])

    _create_outline(essay_id, [
        {"id": "s1", "title": "Ocean Temperature Rise", "notes": "Climate effects on ocean warming"},
        {"id": "s2", "title": "Conclusion", "notes": "Summary"},
    ])

    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": essay_id,
        "profile_id": "prof1",
    })
    assert resp.status_code == 200

    # The ocean section should have the climate paper auto-matched into its prompt
    first_prompt = provider.generate.call_args_list[0][0][0]
    # Should appear as auto-matched section research AND as essay-level research
    assert "Climate Change and Ocean Warming" in first_prompt
