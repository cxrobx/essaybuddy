"""Deterministic confidence scoring for AI detection results.

Confidence answers: "How much evidence did we have to assess this text?"
-- not certainty about authorship. Five factors, 100 points max.
"""

from typing import Any, Dict, List, Optional


CATEGORY_KEYWORDS = {
    1: ["repetit", "syntactic", "uniform", "template", "sentence start", "opening", "parallel"],
    2: ["hedg", "generic", "generali", "vague", "abstract claim", "qualifier"],
    3: ["transition", "moreover", "furthermore", "connector"],
    4: ["rhythm", "sentence length", "variance", "monoton", "flat"],
    5: ["concrete", "detail", "abstraction", "specific", "entity", "example", "grounding"],
    6: ["meta-ai", "boilerplate", "ai-like", "formulaic", "clich"],
}

DISTANCE_KEYS = {
    "avg_sentence_length":    {"range": 30.0},
    "stddev_sentence_length": {"range": 15.0},
    "type_token_ratio":       {"range": 0.8},
    "flesch_reading_ease":    {"range": 100.0},
    "avg_syllables_per_word": {"range": 2.0},
    "active_voice_ratio":     {"range": 1.0},
}


def _text_length_score(nlp_metrics: dict) -> int:
    """Factor 1: Text length (0-25). More text = more signal."""
    wc = nlp_metrics.get("word_count", 0)
    if wc >= 800:
        return 25
    if wc >= 400:
        return 20
    if wc >= 200:
        return 15
    if wc >= 100:
        return 10
    if wc >= 50:
        return 5
    return 0


def _decisiveness_score(risk_score: int) -> int:
    """Factor 2: Risk score decisiveness (0-20). Distance from ambiguous center."""
    return min(20, abs(risk_score - 45) * 20 // 55)


def _flag_quantity_score(flags: List[dict]) -> int:
    """Factor 3a: Flag quantity (0-10). More flags = more evidence."""
    n = len(flags)
    if n >= 5:
        return 10
    if n >= 3:
        return 7
    if n >= 1:
        return 5
    return 2


def _classify_flag(label: str) -> Optional[int]:
    """Map a flag label to a rubric category (1-6) via keyword matching."""
    label_lower = label.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in label_lower:
                return cat
    return None


def _category_spread_score(flags: List[dict]) -> int:
    """Factor 3b: Category spread (0-15). Flags across multiple rubric categories."""
    categories = set()
    for f in flags:
        cat = _classify_flag(f.get("label", ""))
        if cat is not None:
            categories.add(cat)
    n = len(categories)
    if n >= 5:
        return 15
    if n >= 4:
        return 12
    if n >= 3:
        return 9
    if n >= 2:
        return 6
    if n >= 1:
        return 3
    return 0


def _nlp_measurability_score(nlp_metrics: dict) -> int:
    """Factor 4: NLP measurability (0-15). Did the text have enough structure?"""
    total = 0

    sc = nlp_metrics.get("sentence_count", 0)
    if sc >= 5:
        total += 3
    elif sc >= 3:
        total += 1

    stddev = nlp_metrics.get("stddev_sentence_length", 0)
    if stddev > 3.0:
        total += 3
    elif stddev > 1.0:
        total += 2
    elif stddev > 0:
        total += 1

    pc = nlp_metrics.get("paragraph_count", 0)
    if pc >= 3:
        total += 3
    elif pc >= 2:
        total += 2

    ttr = nlp_metrics.get("type_token_ratio", 0)
    if 0.1 < ttr < 0.95:
        total += 3
    elif ttr > 0:
        total += 1

    tw = nlp_metrics.get("transition_words", {})
    tw_total = sum(tw.values()) if isinstance(tw, dict) else 0
    if tw_total >= 3:
        total += 3
    elif tw_total >= 1:
        total += 1

    return min(15, total)


def _profile_context_score(nlp_metrics: dict, profile_metrics: Optional[dict]) -> int:
    """Factor 5: Profile context (0-15). Having a writing profile adds information."""
    if not profile_metrics:
        return 0

    populated = 0
    for key in DISTANCE_KEYS:
        val = profile_metrics.get(key)
        if val is not None and val != 0:
            populated += 1

    if populated < 3:
        return 2

    distances = []
    for key, meta in DISTANCE_KEYS.items():
        prof_val = profile_metrics.get(key)
        text_val = nlp_metrics.get(key)
        if prof_val is None or text_val is None:
            continue
        try:
            dist = abs(float(text_val) - float(prof_val)) / meta["range"]
            distances.append(min(dist, 1.0))
        except (TypeError, ValueError, ZeroDivisionError):
            continue

    if not distances:
        return 2

    mean_dist = sum(distances) / len(distances)
    if mean_dist < 0.1:
        return 15
    if mean_dist < 0.2:
        return 12
    if mean_dist < 0.35:
        return 9
    if mean_dist < 0.5:
        return 7
    return 5


def compute_confidence(
    risk_score: int,
    flags: List[dict],
    nlp_metrics: dict,
    profile_metrics: Optional[dict] = None,
) -> int:
    """Compute deterministic confidence (evidence strength) from measurable data.

    Returns an integer 0-100 representing how much evidence was available
    to assess the text -- not certainty about authorship.
    """
    total = (
        _text_length_score(nlp_metrics)
        + _decisiveness_score(risk_score)
        + _flag_quantity_score(flags)
        + _category_spread_score(flags)
        + _nlp_measurability_score(nlp_metrics)
        + _profile_context_score(nlp_metrics, profile_metrics)
    )
    return max(0, min(100, total))
