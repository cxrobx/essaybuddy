"""Tests for essay CRUD endpoints."""
import json
import os
import tempfile
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport

# Set DATA_ROOT before importing app
_tmpdir = tempfile.mkdtemp()
os.environ["DATA_ROOT"] = _tmpdir

from main import app  # noqa: E402
from services.sandbox import data_root  # noqa: E402


def _essays_dir() -> Path:
    d = data_root() / "essays"
    d.mkdir(parents=True, exist_ok=True)
    return d


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_create_and_get_essay(client):
    # Create
    resp = await client.post("/essays", json={"title": "Test Essay"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test Essay"
    essay_id = data["id"]

    # Get
    resp = await client.get(f"/essays/{essay_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test Essay"


@pytest.mark.anyio
async def test_update_essay(client):
    resp = await client.post("/essays", json={"title": "Original"})
    essay_id = resp.json()["id"]

    resp = await client.put(f"/essays/{essay_id}", json={"title": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated"


@pytest.mark.anyio
async def test_delete_essay(client):
    resp = await client.post("/essays", json={"title": "To Delete"})
    essay_id = resp.json()["id"]

    resp = await client.delete(f"/essays/{essay_id}")
    assert resp.status_code == 200

    resp = await client.get(f"/essays/{essay_id}")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_list_essays(client):
    await client.post("/essays", json={"title": "Essay 1"})
    await client.post("/essays", json={"title": "Essay 2"})

    resp = await client.get("/essays")
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


@pytest.mark.anyio
async def test_get_nonexistent_essay(client):
    resp = await client.get("/essays/nonexistent")
    assert resp.status_code == 404


# --- Outline sidecar tests ---

@pytest.mark.anyio
async def test_outline_create_and_update(client):
    resp = await client.post("/essays", json={"title": "Outline Test"})
    essay_id = resp.json()["id"]

    outline = [{"id": "s1", "title": "Intro", "notes": "Opening"}]
    resp = await client.put(f"/essays/{essay_id}", json={"outline": outline})
    assert resp.status_code == 200
    assert resp.json()["outline"] == outline

    # Verify sidecar file exists on disk
    sidecar = _essays_dir() / f"{essay_id}.outline.json"
    assert sidecar.exists()
    assert json.loads(sidecar.read_text()) == outline

    # Update outline
    outline2 = [{"id": "s1", "title": "Intro", "notes": "Revised"}, {"id": "s2", "title": "Body", "notes": "Main"}]
    resp = await client.put(f"/essays/{essay_id}", json={"outline": outline2})
    assert resp.json()["outline"] == outline2


@pytest.mark.anyio
async def test_outline_delete_removes_sidecar(client):
    resp = await client.post("/essays", json={"title": "Outline Delete"})
    essay_id = resp.json()["id"]

    # Create outline
    outline = [{"id": "s1", "title": "Section", "notes": ""}]
    await client.put(f"/essays/{essay_id}", json={"outline": outline})
    sidecar = _essays_dir() / f"{essay_id}.outline.json"
    assert sidecar.exists()

    # Clear outline (empty list removes sidecar)
    resp = await client.put(f"/essays/{essay_id}", json={"outline": []})
    assert resp.json()["outline"] == []
    assert not sidecar.exists()

    # Delete essay should also clean up sidecar
    await client.put(f"/essays/{essay_id}", json={"outline": [{"id": "s1", "title": "Back", "notes": ""}]})
    assert sidecar.exists()
    await client.delete(f"/essays/{essay_id}")
    assert not sidecar.exists()


@pytest.mark.anyio
async def test_corrupt_sidecar_returns_empty_outline(client):
    resp = await client.post("/essays", json={"title": "Corrupt Sidecar"})
    essay_id = resp.json()["id"]

    # Write corrupt JSON to sidecar
    sidecar = _essays_dir() / f"{essay_id}.outline.json"
    sidecar.write_text("{invalid json!!!", encoding="utf-8")

    resp = await client.get(f"/essays/{essay_id}")
    assert resp.status_code == 200
    assert resp.json()["outline"] == []


# --- Content round-trip ---

@pytest.mark.anyio
async def test_content_roundtrip(client):
    md_content = "# Introduction\n\nThis is a **bold** claim with *italic* emphasis.\n\n## Body\n\n- Point one\n- Point two"
    resp = await client.post("/essays", json={"title": "Roundtrip"})
    essay_id = resp.json()["id"]

    resp = await client.put(f"/essays/{essay_id}", json={"content": md_content})
    assert resp.status_code == 200

    resp = await client.get(f"/essays/{essay_id}")
    assert resp.json()["content"] == md_content


# --- Legacy .json fallback ---

@pytest.mark.anyio
async def test_legacy_json_fallback_read(client):
    # Manually create a legacy .json essay file
    essay_id = "legacy01"
    essays_dir = _essays_dir()
    legacy_data = {
        "title": "Legacy Essay",
        "topic": "Testing",
        "thesis": "Legacy works",
        "content": "Some old content",
        "outline": [{"id": "s1", "title": "Old Section", "notes": ""}],
        "profile_id": None,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }
    (essays_dir / f"{essay_id}.json").write_text(json.dumps(legacy_data), encoding="utf-8")

    # Should be readable via API
    resp = await client.get(f"/essays/{essay_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Legacy Essay"
    assert data["content"] == "Some old content"
    assert data["thesis"] == "Legacy works"


@pytest.mark.anyio
async def test_delete_removes_legacy_json(client):
    essay_id = "legacy02"
    essays_dir = _essays_dir()
    legacy_data = {"title": "To Delete Legacy", "content": ""}
    legacy_path = essays_dir / f"{essay_id}.json"
    legacy_path.write_text(json.dumps(legacy_data), encoding="utf-8")

    resp = await client.delete(f"/essays/{essay_id}")
    assert resp.status_code == 200
    assert not legacy_path.exists()
