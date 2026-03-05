"""Tests for POST /ai/generate-full-essay endpoint."""
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


def _setup_dirs():
    for d in ("essays", "profiles", "evidence", "research/papers", "samples"):
        (data_root() / d).mkdir(parents=True, exist_ok=True)


def _create_essay(essay_id: str, topic: str = "Test", thesis: str = "Test thesis",
                  citation_style: str = None):
    _setup_dirs()
    meta = {"title": "Test Essay", "topic": topic, "thesis": thesis}
    if citation_style:
        meta["citation_style"] = citation_style
    content = "---\n" + "\n".join(f"{k}: {v}" for k, v in meta.items() if v) + "\n---\n"
    (data_root() / "essays" / f"{essay_id}.md").write_text(content, encoding="utf-8")


def _create_outline(essay_id: str, sections: list):
    (data_root() / "essays" / f"{essay_id}.outline.json").write_text(
        json.dumps(sections), encoding="utf-8"
    )


def _create_profile(profile_id: str, sample_ids=None):
    (data_root() / "profiles" / f"{profile_id}.json").write_text(
        json.dumps({
            "id": profile_id,
            "name": "Test Profile",
            "sample_ids": sample_ids or [],
            "metrics": {"avg_sentence_length": 15},
        }),
        encoding="utf-8",
    )


def _create_evidence(essay_id: str, items: list):
    (data_root() / "evidence" / f"{essay_id}.json").write_text(
        json.dumps({"essay_id": essay_id, "items": items}), encoding="utf-8"
    )


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


@pytest.mark.anyio
@patch("routers.ai._humanize_pass", side_effect=_noop_humanize)
@patch("routers.ai.get_provider")
async def test_success_generates_all_sections(mock_provider, mock_humanize, client):
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=MOCK_SECTION_TEXT)
    mock_provider.return_value = provider

    essay_id = "full_ok"
    _create_essay(essay_id)
    _create_outline(essay_id, [
        {"id": "s1", "title": "Introduction", "notes": "Open strong"},
        {"id": "s2", "title": "Body", "notes": "Main argument"},
        {"id": "s3", "title": "Conclusion", "notes": "Wrap up"},
    ])
    _create_profile("prof1")

    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": essay_id,
        "profile_id": "prof1",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["sections_generated"] == 3
    assert data["total_sections"] == 3
    assert data["partial"] is False
    assert data["error"] is None
    assert "## Introduction" in data["text"]
    assert "## Body" in data["text"]
    assert "## Conclusion" in data["text"]


@pytest.mark.anyio
async def test_missing_essay_returns_404(client):
    _setup_dirs()
    _create_profile("prof1")
    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": "nonexistent",
        "profile_id": "prof1",
    })
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_missing_outline_returns_400(client):
    essay_id = "no_outline"
    _create_essay(essay_id)
    _create_profile("prof1")
    # No outline created
    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": essay_id,
        "profile_id": "prof1",
    })
    assert resp.status_code == 400
    assert "outline" in resp.json()["detail"].lower()


@pytest.mark.anyio
async def test_empty_outline_returns_400(client):
    essay_id = "empty_outline"
    _create_essay(essay_id)
    _create_outline(essay_id, [])
    _create_profile("prof1")
    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": essay_id,
        "profile_id": "prof1",
    })
    assert resp.status_code == 400


@pytest.mark.anyio
async def test_missing_profile_returns_404(client):
    essay_id = "no_prof"
    _create_essay(essay_id)
    _create_outline(essay_id, [{"id": "s1", "title": "Intro", "notes": ""}])
    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": essay_id,
        "profile_id": "nonexistent",
    })
    assert resp.status_code == 404


@pytest.mark.anyio
@patch("routers.ai.get_provider")
async def test_partial_failure_returns_partial(mock_provider, client):
    """If generation fails partway, return what we have."""
    call_count = 0

    async def gen_side_effect(prompt):
        nonlocal call_count
        call_count += 1
        if call_count <= 1:
            return MOCK_SECTION_TEXT
        raise RuntimeError("Provider timeout")

    provider = AsyncMock()
    provider.generate = AsyncMock(side_effect=gen_side_effect)
    mock_provider.return_value = provider

    essay_id = "partial"
    _create_essay(essay_id)
    _create_outline(essay_id, [
        {"id": "s1", "title": "Intro", "notes": ""},
        {"id": "s2", "title": "Body", "notes": ""},
        {"id": "s3", "title": "Conclusion", "notes": ""},
    ])
    _create_profile("prof1")

    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": essay_id,
        "profile_id": "prof1",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["sections_generated"] == 1
    assert data["total_sections"] == 3
    assert data["partial"] is True
    assert data["error"] is not None
    assert "## Intro" in data["text"]


@pytest.mark.anyio
@patch("routers.ai.get_provider")
async def test_all_sections_fail_returns_502(mock_provider, client):
    provider = AsyncMock()
    provider.generate = AsyncMock(side_effect=RuntimeError("Provider down"))
    mock_provider.return_value = provider

    essay_id = "all_fail"
    _create_essay(essay_id)
    _create_outline(essay_id, [{"id": "s1", "title": "Intro", "notes": ""}])
    _create_profile("prof1")

    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": essay_id,
        "profile_id": "prof1",
    })
    assert resp.status_code == 502


@pytest.mark.anyio
@patch("routers.ai.get_provider")
async def test_sections_capped_at_max(mock_provider, client):
    """Outlines with >10 sections should be capped."""
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=MOCK_SECTION_TEXT)
    mock_provider.return_value = provider

    essay_id = "many_sections"
    _create_essay(essay_id)
    _create_outline(essay_id, [
        {"id": f"s{i}", "title": f"Section {i}", "notes": ""}
        for i in range(15)
    ])
    _create_profile("prof1")

    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": essay_id,
        "profile_id": "prof1",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_sections"] == 10
    assert data["sections_generated"] == 10


@pytest.mark.anyio
@patch("routers.ai.get_provider")
async def test_citation_style_fallback_to_frontmatter(mock_provider, client):
    """Citation style should fall back to essay frontmatter when not in request."""
    provider = AsyncMock()
    provider.generate = AsyncMock(return_value=MOCK_SECTION_TEXT)
    mock_provider.return_value = provider

    essay_id = "cite_fallback"
    _create_essay(essay_id, citation_style="apa7")
    _create_outline(essay_id, [{"id": "s1", "title": "Intro", "notes": ""}])
    _create_profile("prof1")

    resp = await client.post("/ai/generate-full-essay", json={
        "essay_id": essay_id,
        "profile_id": "prof1",
        # No citation_style in request — should use essay's apa7
    })
    assert resp.status_code == 200
    # Verify APA was in the prompt
    call_args = provider.generate.call_args_list[0][0][0]
    assert "APA" in call_args
