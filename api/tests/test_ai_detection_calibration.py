"""Calibration tests for the recalibrated AI detection system.

All tests are pure-function tests with no external services.
Verifies threshold parity between detect.py and ai_detection.py,
fallback normalization, flag normalization, prompt construction,
and deterministic confidence scoring.
"""

import sys
from pathlib import Path

import pytest

# Add skills script to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skills" / "ai-essay-detector" / "scripts"))
import detect as detect_script

# API-side functions
from routers.ai_detection import (
    AIDetectionRequest,
    AIDetectionResult,
    _build_result,
    _risk_level,
    _verdict,
)
from services.confidence_scorer import compute_confidence


# ---------------------------------------------------------------------------
# 1. Threshold boundary parity tests
# ---------------------------------------------------------------------------

BOUNDARY_CASES = [
    (0, "low", "likely_human"),
    (29, "low", "likely_human"),
    (30, "medium", "mixed"),
    (59, "medium", "mixed"),
    (60, "high", "likely_ai"),
    (100, "high", "likely_ai"),
]


@pytest.mark.parametrize("score,expected_level,expected_verdict", BOUNDARY_CASES)
def test_threshold_parity_level(score, expected_level, expected_verdict):
    """detect._score_to_level and api._risk_level return identical values at boundaries."""
    detect_level = detect_script._score_to_level(score)
    api_level = _risk_level(score)
    assert detect_level == api_level == expected_level


@pytest.mark.parametrize("score,expected_level,expected_verdict", BOUNDARY_CASES)
def test_threshold_parity_verdict(score, expected_level, expected_verdict):
    """detect._score_to_verdict and api._verdict return identical values at boundaries."""
    detect_verdict = detect_script._score_to_verdict(score)
    api_verdict = _verdict(score)
    assert detect_verdict == api_verdict == expected_verdict


# ---------------------------------------------------------------------------
# 2. Fallback normalization tests
# ---------------------------------------------------------------------------

def test_normalize_missing_risk_score():
    """Missing risk_score defaults to 25, degraded=True."""
    result = detect_script._validate_and_normalize({"confidence": 50}, text_len=100)
    assert result["risk_score"] == 25
    assert result["degraded"] is True


def test_normalize_non_integer_risk_score():
    """Non-integer risk_score (string) defaults to 25, degraded=True."""
    result = detect_script._validate_and_normalize(
        {"risk_score": "abc", "confidence": 50}, text_len=100
    )
    assert result["risk_score"] == 25
    assert result["degraded"] is True


def test_normalize_missing_confidence():
    """Missing confidence results in None, degraded not triggered by confidence."""
    result = detect_script._validate_and_normalize({"risk_score": 40}, text_len=100)
    assert result["confidence"] is None
    assert result["degraded"] is False


def test_normalize_out_of_range_risk_score():
    """Out-of-range risk_score (150) is clamped to 100, degraded=False."""
    result = detect_script._validate_and_normalize(
        {"risk_score": 150, "confidence": 50}, text_len=100
    )
    assert result["risk_score"] == 100
    assert result["degraded"] is False


def test_normalize_missing_flags_not_list():
    """flags that is not a list results in empty flags."""
    result = detect_script._validate_and_normalize(
        {"risk_score": 20, "confidence": 50, "flags": "not a list"}, text_len=100
    )
    assert result["flags"] == []


def test_normalize_valid_input():
    """Valid input with all fields results in degraded=False, confidence=None."""
    result = detect_script._validate_and_normalize(
        {
            "risk_score": 35,
            "confidence": 70,
            "risk_level": "medium",
            "verdict": "mixed",
            "flags": [],
            "evidence_summary": "Some summary.",
            "suggestions": ["Do this."],
        },
        text_len=100,
    )
    assert result["degraded"] is False
    assert result["risk_score"] == 35
    assert result["confidence"] is None


def test_normalize_empty_dict():
    """Empty dict defaults: degraded=True (from risk_score), score=25, confidence=None."""
    result = detect_script._validate_and_normalize({}, text_len=100)
    assert result["degraded"] is True
    assert result["risk_score"] == 25
    assert result["confidence"] is None


# ---------------------------------------------------------------------------
# 3. Flag normalization tests
# ---------------------------------------------------------------------------

def test_flag_missing_severity():
    """Missing severity defaults to 'low'."""
    flag = detect_script._normalize_flag({"label": "Test"}, text_len=100, idx=0)
    assert flag["severity"] == "low"


def test_flag_invalid_severity():
    """Invalid severity 'critical' defaults to 'low'."""
    flag = detect_script._normalize_flag(
        {"severity": "critical", "label": "Test"}, text_len=100, idx=0
    )
    assert flag["severity"] == "low"


def test_flag_start_greater_than_end():
    """start_char > end_char results in end clamped to start."""
    flag = detect_script._normalize_flag(
        {"start_char": 50, "end_char": 10}, text_len=100, idx=0
    )
    assert flag["end_char"] == flag["start_char"]


def test_flag_negative_char_values():
    """Negative char values are clamped to 0."""
    flag = detect_script._normalize_flag(
        {"start_char": -5, "end_char": -1}, text_len=100, idx=0
    )
    assert flag["start_char"] == 0
    assert flag["end_char"] == 0


def test_flag_missing_fields_defaults():
    """Missing fields get defaults applied."""
    flag = detect_script._normalize_flag({}, text_len=100, idx=3)
    assert flag["id"] == "flag-4"
    assert flag["label"] == "Pattern signal"
    assert flag["severity"] == "low"
    assert flag["reason"] == "Potential AI-like pattern detected."
    assert flag["start_char"] == 0
    assert flag["end_char"] == 0
    assert flag["excerpt"] == ""


# ---------------------------------------------------------------------------
# 4. profile_context_provided propagation
# ---------------------------------------------------------------------------

def test_profile_context_provided_true():
    result = detect_script._validate_and_normalize(
        {"risk_score": 20, "confidence": 50}, text_len=100, had_profile=True
    )
    assert result["profile_context_provided"] is True


def test_profile_context_provided_false():
    result = detect_script._validate_and_normalize(
        {"risk_score": 20, "confidence": 50}, text_len=100, had_profile=False
    )
    assert result["profile_context_provided"] is False


def test_profile_context_provided_default():
    """Default (no had_profile arg) results in profile_context_provided=False."""
    result = detect_script._validate_and_normalize(
        {"risk_score": 20, "confidence": 50}, text_len=100
    )
    assert result["profile_context_provided"] is False


# ---------------------------------------------------------------------------
# 5. Prompt construction tests
# ---------------------------------------------------------------------------

def test_prompt_includes_conservative():
    prompt = detect_script._build_prompt("test", "essay", None)
    assert "conservative" in prompt.lower()


def test_prompt_includes_calibration_examples():
    prompt = detect_script._build_prompt("test", "essay", None)
    assert "Calibration Examples" in prompt


def test_prompt_with_profile_includes_profile_aware():
    prompt = detect_script._build_prompt("test", "essay", {"avg_sentence_length": 15})
    assert "Profile-Aware Analysis" in prompt


def test_prompt_without_profile_excludes_profile_aware():
    prompt = detect_script._build_prompt("test", "essay", None)
    assert "Profile-Aware Analysis" not in prompt


def test_prompt_includes_all_nine_rules():
    prompt = detect_script._build_prompt("test", "essay", None)
    for i in range(1, 10):
        assert f"{i})" in prompt, f"Rule {i} not found in prompt"


# ---------------------------------------------------------------------------
# 6. _build_result propagation tests (ai_detection.py)
# ---------------------------------------------------------------------------

def _make_request(**kwargs) -> AIDetectionRequest:
    defaults = {"scope": "essay", "essay_id": "test-123"}
    defaults.update(kwargs)
    return AIDetectionRequest(**defaults)


def test_build_result_profile_context_provided_true():
    body = _make_request()
    raw = {
        "risk_score": 20,
        "confidence": 50,
        "profile_context_provided": True,
        "degraded": False,
        "flags": [],
        "suggestions": ["A suggestion."],
        "evidence_summary": "Summary.",
    }
    result = _build_result(body, raw)
    assert result.profile_context_provided is True


def test_build_result_degraded_true():
    body = _make_request()
    raw = {
        "risk_score": 25,
        "confidence": 10,
        "profile_context_provided": False,
        "degraded": True,
        "flags": [],
        "suggestions": ["A suggestion."],
        "evidence_summary": "Summary.",
    }
    result = _build_result(body, raw)
    assert result.degraded is True


def test_build_result_defaults_when_missing():
    """profile_context_provided and degraded default to False when absent from raw."""
    body = _make_request()
    raw = {
        "risk_score": 30,
        "confidence": 60,
        "flags": [],
        "suggestions": ["A suggestion."],
        "evidence_summary": "Summary.",
    }
    result = _build_result(body, raw)
    assert result.profile_context_provided is False
    assert result.degraded is False


def test_build_result_risk_level_and_verdict():
    """_build_result computes risk_level and verdict from score."""
    body = _make_request()
    raw = {
        "risk_score": 65,
        "confidence": 80,
        "flags": [],
        "suggestions": ["Fix this."],
        "evidence_summary": "High risk detected.",
    }
    result = _build_result(body, raw)
    assert result.risk_level == "high"
    assert result.verdict == "likely_ai"
    assert result.risk_score == 65


# ---------------------------------------------------------------------------
# 7. Fix 1: risk_level/verdict always recomputed from score (detect.py)
# ---------------------------------------------------------------------------

def test_normalize_overrides_contradictory_risk_level():
    """risk_score=80 with risk_level='low' → output risk_level='high'."""
    result = detect_script._validate_and_normalize(
        {"risk_score": 80, "confidence": 70, "risk_level": "low", "verdict": "likely_human"},
        text_len=100,
    )
    assert result["risk_level"] == "high"
    assert result["verdict"] == "likely_ai"


# ---------------------------------------------------------------------------
# 8. Fix 4: boolean scores treated as degraded
# ---------------------------------------------------------------------------

def test_boolean_true_risk_score_is_degraded():
    """Boolean True as risk_score → degraded=True, score=25."""
    result = detect_script._validate_and_normalize(
        {"risk_score": True, "confidence": 50}, text_len=100
    )
    assert result["degraded"] is True
    assert result["risk_score"] == 25


def test_boolean_false_confidence_not_degraded():
    """Boolean False as confidence → confidence=None, degraded not triggered."""
    result = detect_script._validate_and_normalize(
        {"risk_score": 40, "confidence": False}, text_len=100
    )
    assert result["degraded"] is False
    assert result["confidence"] is None


# ---------------------------------------------------------------------------
# 9. Fix 4: boolean scores in _build_result (ai_detection.py)
# ---------------------------------------------------------------------------

def test_build_result_boolean_risk_score_is_degraded():
    """Boolean True as risk_score in _build_result → degraded=True, score=25."""
    body = _make_request()
    raw = {
        "risk_score": True,
        "confidence": 50,
        "flags": [],
        "suggestions": ["A suggestion."],
        "evidence_summary": "Summary.",
    }
    result = _build_result(body, raw)
    assert result.degraded is True
    assert result.risk_score == 25


def test_build_result_confidence_is_placeholder():
    """Confidence in _build_result is a placeholder (0), overridden by scorer at endpoint level."""
    body = _make_request()
    raw = {
        "risk_score": 40,
        "confidence": False,
        "flags": [],
        "suggestions": ["A suggestion."],
        "evidence_summary": "Summary.",
    }
    result = _build_result(body, raw)
    assert result.degraded is False
    assert result.confidence == 0


# ---------------------------------------------------------------------------
# 10. Deterministic confidence scorer tests
# ---------------------------------------------------------------------------

def _make_nlp_metrics(
    word_count=0,
    sentence_count=0,
    paragraph_count=0,
    stddev_sentence_length=0,
    type_token_ratio=0,
    transition_words=None,
    avg_sentence_length=15.0,
    flesch_reading_ease=60.0,
    avg_syllables_per_word=1.5,
    active_voice_ratio=0.8,
):
    return {
        "word_count": word_count,
        "sentence_count": sentence_count,
        "paragraph_count": paragraph_count,
        "stddev_sentence_length": stddev_sentence_length,
        "type_token_ratio": type_token_ratio,
        "transition_words": transition_words or {},
        "avg_sentence_length": avg_sentence_length,
        "flesch_reading_ease": flesch_reading_ease,
        "avg_syllables_per_word": avg_syllables_per_word,
        "active_voice_ratio": active_voice_ratio,
    }


def test_confidence_tiny_text():
    """30 words, score 25, no flags, no profile → very low confidence."""
    nlp = _make_nlp_metrics(word_count=30, sentence_count=2, paragraph_count=1)
    result = compute_confidence(risk_score=25, flags=[], nlp_metrics=nlp)
    assert 2 <= result <= 10


def test_confidence_short_text_some_flags():
    """150 words, score 15, 2 flags in 1 category → low-mid confidence."""
    flags = [
        {"label": "Repetitive sentence framing", "severity": "medium"},
        {"label": "Repetition in openings", "severity": "low"},
    ]
    nlp = _make_nlp_metrics(
        word_count=150, sentence_count=8, paragraph_count=2,
        stddev_sentence_length=4.0, type_token_ratio=0.6,
    )
    result = compute_confidence(risk_score=15, flags=flags, nlp_metrics=nlp)
    assert 30 <= result <= 45


def test_confidence_full_essay_decisive_low():
    """600 words, score 8, 1 flag → good length, decisive low score."""
    flags = [{"label": "Generic hedging phrase", "severity": "low"}]
    nlp = _make_nlp_metrics(
        word_count=600, sentence_count=25, paragraph_count=5,
        stddev_sentence_length=5.0, type_token_ratio=0.55,
        transition_words={"however": 2, "therefore": 1},
    )
    result = compute_confidence(risk_score=8, flags=flags, nlp_metrics=nlp)
    assert 50 <= result <= 60


def test_confidence_full_essay_high_evidence():
    """800 words, score 80, 5 flags across 4 categories → strong evidence."""
    flags = [
        {"label": "Repetitive syntactic template", "severity": "high"},
        {"label": "Generic hedging overuse", "severity": "medium"},
        {"label": "Transition word density", "severity": "medium"},
        {"label": "Low sentence length variance", "severity": "high"},
        {"label": "Boilerplate AI-like phrasing", "severity": "high"},
    ]
    nlp = _make_nlp_metrics(
        word_count=800, sentence_count=35, paragraph_count=6,
        stddev_sentence_length=6.0, type_token_ratio=0.5,
        transition_words={"however": 3, "moreover": 2, "furthermore": 1},
    )
    result = compute_confidence(risk_score=80, flags=flags, nlp_metrics=nlp)
    assert 72 <= result <= 85


def test_confidence_full_essay_ambiguous():
    """700 words, score 42, 3 flags in 2 categories → ambiguous middle."""
    flags = [
        {"label": "Repetitive sentence framing", "severity": "medium"},
        {"label": "Uniform opening pattern", "severity": "low"},
        {"label": "Generic hedging phrase", "severity": "low"},
    ]
    nlp = _make_nlp_metrics(
        word_count=700, sentence_count=30, paragraph_count=5,
        stddev_sentence_length=4.5, type_token_ratio=0.55,
        transition_words={"however": 2},
    )
    result = compute_confidence(risk_score=42, flags=flags, nlp_metrics=nlp)
    assert 40 <= result <= 55


def test_confidence_with_profile_close():
    """700 words, score 12, profile with close distance → high confidence."""
    flags = [
        {"label": "Transition word density", "severity": "low"},
        {"label": "Generic abstraction", "severity": "low"},
    ]
    nlp = _make_nlp_metrics(
        word_count=700, sentence_count=30, paragraph_count=5,
        stddev_sentence_length=5.0, type_token_ratio=0.55,
        transition_words={"however": 2, "therefore": 1},
        avg_sentence_length=16.0,
        flesch_reading_ease=58.0,
        avg_syllables_per_word=1.6,
        active_voice_ratio=0.75,
    )
    profile = {
        "avg_sentence_length": 15.5,
        "stddev_sentence_length": 5.2,
        "type_token_ratio": 0.54,
        "flesch_reading_ease": 60.0,
        "avg_syllables_per_word": 1.55,
        "active_voice_ratio": 0.78,
    }
    result = compute_confidence(risk_score=12, flags=flags, nlp_metrics=nlp, profile_metrics=profile)
    assert 60 <= result <= 80


def test_confidence_deterministic():
    """Same inputs twice → identical output."""
    flags = [{"label": "Repetitive sentence framing", "severity": "medium"}]
    nlp = _make_nlp_metrics(word_count=500, sentence_count=20, paragraph_count=4,
                            stddev_sentence_length=4.0, type_token_ratio=0.6)
    a = compute_confidence(risk_score=30, flags=flags, nlp_metrics=nlp)
    b = compute_confidence(risk_score=30, flags=flags, nlp_metrics=nlp)
    assert a == b


def test_confidence_bounded():
    """Extreme inputs always produce 0-100."""
    # Minimal input
    low = compute_confidence(risk_score=0, flags=[], nlp_metrics={})
    assert 0 <= low <= 100

    # Maximal input
    flags = [{"label": f"Flag {i}", "severity": "high"} for i in range(20)]
    nlp = _make_nlp_metrics(
        word_count=5000, sentence_count=200, paragraph_count=30,
        stddev_sentence_length=10.0, type_token_ratio=0.7,
        transition_words={"however": 10, "moreover": 5},
    )
    profile = {k: 15.0 for k in ["avg_sentence_length", "stddev_sentence_length",
               "type_token_ratio", "flesch_reading_ease", "avg_syllables_per_word",
               "active_voice_ratio"]}
    high = compute_confidence(risk_score=100, flags=flags, nlp_metrics=nlp, profile_metrics=profile)
    assert 0 <= high <= 100


def test_confidence_monotonic_length():
    """Increasing word_count with everything else fixed → non-decreasing confidence."""
    base_flags = [{"label": "Repetitive pattern", "severity": "medium"}]
    prev = -1
    for wc in [30, 50, 100, 200, 400, 800, 1200]:
        nlp = _make_nlp_metrics(word_count=wc, sentence_count=5, paragraph_count=3,
                                stddev_sentence_length=4.0, type_token_ratio=0.6)
        score = compute_confidence(risk_score=30, flags=base_flags, nlp_metrics=nlp)
        assert score >= prev, f"Confidence decreased at word_count={wc}: {score} < {prev}"
        prev = score
