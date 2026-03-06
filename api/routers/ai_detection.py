"""AI pattern detection endpoints."""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from functools import partial
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from routers import essays as essays_router
from services.ai_pattern_detector import DetectionError, detect_ai_patterns
from services.confidence_scorer import compute_confidence
from services.sandbox import atomic_write, data_root

router = APIRouter(prefix="/ai", tags=["ai-detection"])

MAX_CHECK_HISTORY = 50


class AIDetectionRequest(BaseModel):
    essay_id: Optional[str] = None
    text: Optional[str] = None
    scope: Literal["essay", "selection"]
    selection_label: Optional[str] = None
    profile_id: Optional[str] = None


class DetectionFlag(BaseModel):
    id: str
    label: str
    severity: Literal["low", "medium", "high"]
    reason: str
    start_char: int = Field(ge=0)
    end_char: int = Field(ge=0)
    excerpt: str = ""


class AIDetectionResult(BaseModel):
    check_id: str
    essay_id: Optional[str] = None
    scope: Literal["essay", "selection"]
    risk_score: int = Field(ge=0, le=100)
    risk_level: Literal["low", "medium", "high"]
    verdict: Literal["likely_human", "mixed", "likely_ai"]
    confidence: int = Field(ge=0, le=100)
    flags: List[DetectionFlag]
    evidence_summary: str
    suggestions: List[str]
    provider: Literal["codex"]
    created_at: str
    selection_label: Optional[str] = None
    profile_context_provided: Optional[bool] = False
    degraded: Optional[bool] = False


class DetectionHistoryResponse(BaseModel):
    essay_id: str
    checks: List[AIDetectionResult]


def _profiles_dir() -> Path:
    return data_root() / "profiles"


def _ai_checks_path(essay_id: str) -> Path:
    return essays_router._essays_dir() / f"{essay_id}.ai-checks.json"


def _load_ai_checks(essay_id: str) -> List[Dict[str, Any]]:
    path = _ai_checks_path(essay_id)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]
    except json.JSONDecodeError:
        pass
    return []


def _persist_ai_checks(essay_id: str, checks: List[Dict[str, Any]]) -> None:
    path = _ai_checks_path(essay_id)
    atomic_write(path, json.dumps(checks[-MAX_CHECK_HISTORY:], indent=2))


def _load_profile_metrics(profile_id: str) -> Dict[str, Any]:
    path = _profiles_dir() / f"{profile_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
    profile = json.loads(path.read_text(encoding="utf-8"))
    return profile.get("metrics", {})


def _risk_level(score: int) -> str:
    if score >= 60:
        return "high"
    if score >= 30:
        return "medium"
    return "low"


def _verdict(score: int) -> str:
    if score >= 60:
        return "likely_ai"
    if score >= 30:
        return "mixed"
    return "likely_human"


def _build_result(body: AIDetectionRequest, raw: Dict[str, Any]) -> AIDetectionResult:
    degraded = raw.get("degraded", False)

    raw_score = raw.get("risk_score", 25)
    try:
        if isinstance(raw_score, bool):
            score = 25
            degraded = True
        else:
            score = int(raw_score)
    except Exception:
        score = 25
        degraded = True

    # Confidence is computed deterministically by the scorer; placeholder here.
    confidence = 0

    suggestions = raw.get("suggestions") if isinstance(raw.get("suggestions"), list) else []
    suggestions = [s for s in suggestions if isinstance(s, str) and s.strip()]

    flags_in = raw.get("flags") if isinstance(raw.get("flags"), list) else []
    flags: List[DetectionFlag] = []
    for idx, item in enumerate(flags_in):
        if not isinstance(item, dict):
            continue
        try:
            start_char = int(item.get("start_char", 0))
        except Exception:
            start_char = 0
        try:
            end_char = int(item.get("end_char", start_char))
        except Exception:
            end_char = start_char
        if end_char < start_char:
            end_char = start_char
        severity = str(item.get("severity", "low")).lower()
        if severity not in {"low", "medium", "high"}:
            severity = "low"

        flags.append(
            DetectionFlag(
                id=str(item.get("id", f"flag-{idx + 1}")),
                label=str(item.get("label", "Pattern signal")),
                severity=severity,
                reason=str(item.get("reason", "Potential AI-like pattern detected.")),
                start_char=max(start_char, 0),
                end_char=max(end_char, 0),
                excerpt=str(item.get("excerpt", "")),
            )
        )

    result = AIDetectionResult(
        check_id=str(uuid.uuid4())[:8],
        essay_id=body.essay_id,
        scope=body.scope,
        risk_score=max(0, min(score, 100)),
        risk_level=_risk_level(max(0, min(score, 100))),
        verdict=_verdict(max(0, min(score, 100))),
        confidence=max(0, min(confidence, 100)),
        flags=flags,
        evidence_summary=str(raw.get("evidence_summary", "No evidence summary returned.")).strip(),
        suggestions=suggestions,
        provider="codex",
        created_at=datetime.now(timezone.utc).isoformat(),
        selection_label=body.selection_label,
        profile_context_provided=raw.get("profile_context_provided", False),
        degraded=degraded,
    )

    if not result.suggestions:
        result.suggestions = [
            "Increase variation in sentence openings and paragraph cadence.",
            "Replace generic statements with concrete examples and named references.",
        ]

    if not result.evidence_summary:
        result.evidence_summary = "Pattern signals were detected using Codex rubric scoring."

    return result


@router.post("/detect-patterns", response_model=AIDetectionResult)
async def detect_patterns(body: AIDetectionRequest):
    text = (body.text or "").strip()

    if body.essay_id:
        essay = essays_router._load_essay(body.essay_id)
        if not text:
            text = (essay.get("content") or "").strip()

    if not text:
        raise HTTPException(status_code=422, detail="No text available for detection")

    if body.scope == "selection" and len(text) < 20:
        raise HTTPException(status_code=422, detail="Selection text is too short")

    profile_metrics = None
    if body.profile_id:
        profile_metrics = _load_profile_metrics(body.profile_id)

    try:
        loop = asyncio.get_running_loop()
        raw = await loop.run_in_executor(
            None,
            partial(detect_ai_patterns, text=text, scope=body.scope, profile_metrics=profile_metrics),
        )
    except DetectionError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    result = _build_result(body, raw)

    # Compute deterministic confidence from normalized data
    try:
        from services.style_analyzer import analyze_style
        nlp_metrics = analyze_style(text)
    except Exception:
        nlp_metrics = {"word_count": len(text.split())}

    result.confidence = compute_confidence(
        risk_score=result.risk_score,
        flags=[f.model_dump() for f in result.flags],
        nlp_metrics=nlp_metrics,
        profile_metrics=profile_metrics,
    )

    if body.essay_id and not result.degraded:
        checks = _load_ai_checks(body.essay_id)
        checks.append(result.model_dump())
        _persist_ai_checks(body.essay_id, checks)

    return result


@router.get("/detect-patterns/history/{essay_id}", response_model=DetectionHistoryResponse)
async def detect_patterns_history(essay_id: str):
    essays_router._load_essay(essay_id)
    checks_raw = _load_ai_checks(essay_id)

    checks: List[AIDetectionResult] = []
    for item in checks_raw:
        try:
            checks.append(AIDetectionResult.model_validate(item))
        except Exception:
            continue

    checks.sort(key=lambda item: item.created_at, reverse=True)
    return DetectionHistoryResponse(essay_id=essay_id, checks=checks)
