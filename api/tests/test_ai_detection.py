"""Tests for AI pattern detection endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from routers.ai_detection import DetectionError


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_detect_patterns_persists_history(client, monkeypatch):
    async def _create_essay():
        resp = await client.post("/essays", json={"title": "Detection Essay"})
        assert resp.status_code == 201
        return resp.json()["id"]

    essay_id = await _create_essay()

    await client.put(
        f"/essays/{essay_id}",
        json={
            "content": "This is a long enough essay paragraph with repetitive framing. " * 8,
        },
    )

    fake_result = {
        "risk_score": 74,
        "risk_level": "high",
        "verdict": "likely_ai",
        "confidence": 82,
        "flags": [
            {
                "id": "flag-1",
                "label": "Repetition",
                "severity": "high",
                "reason": "Repeated structure",
                "start_char": 0,
                "end_char": 40,
                "excerpt": "This is a long enough essay",
            }
        ],
        "evidence_summary": "Multiple AI-like patterns detected.",
        "suggestions": ["Vary sentence structures."],
    }

    def _mock_detect(*args, **kwargs):
        return fake_result

    monkeypatch.setattr("routers.ai_detection.detect_ai_patterns", _mock_detect)

    resp = await client.post(
        "/ai/detect-patterns",
        json={
            "essay_id": essay_id,
            "scope": "essay",
        },
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["provider"] == "codex"
    assert payload["risk_level"] == "high"
    assert payload["verdict"] == "likely_ai"
    assert payload["essay_id"] == essay_id

    essay_resp = await client.get(f"/essays/{essay_id}")
    assert essay_resp.status_code == 200
    essay_payload = essay_resp.json()
    assert "ai_checks" in essay_payload
    assert len(essay_payload["ai_checks"]) == 1

    hist = await client.get(f"/ai/detect-patterns/history/{essay_id}")
    assert hist.status_code == 200
    hist_payload = hist.json()
    assert hist_payload["essay_id"] == essay_id
    assert len(hist_payload["checks"]) == 1


@pytest.mark.anyio
async def test_detect_patterns_selection_requires_text(client):
    resp = await client.post(
        "/ai/detect-patterns",
        json={
            "scope": "selection",
            "text": "short",
        },
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_detect_patterns_returns_502_on_detector_failure(client, monkeypatch):
    def _mock_detect(*args, **kwargs):
        raise DetectionError("codex failed")

    monkeypatch.setattr("routers.ai_detection.detect_ai_patterns", _mock_detect)

    resp = await client.post(
        "/ai/detect-patterns",
        json={
            "scope": "essay",
            "text": "This is enough text to pass the minimum validation threshold for the endpoint.",
        },
    )
    assert resp.status_code == 502
    assert "codex failed" in resp.json()["detail"]
