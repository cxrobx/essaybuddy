"""Tests for style analyzer."""
from services.style_analyzer import analyze_style


SAMPLE_TEXT = """The morning light filtered through the curtains, casting long shadows across the room.
She sat at her desk, contemplating the weight of the decision before her. It was not a simple choice;
rather, it demanded careful consideration of multiple factors.

Furthermore, the implications extended beyond her immediate circumstances. The community would feel
the effects for years to come. However, she remained determined to act with integrity, regardless
of the political pressures bearing down on her.

In conclusion, the path forward required both courage and wisdom. She understood that leadership
meant making difficult decisions, even when the outcome remained uncertain."""


def test_analyze_returns_metrics():
    result = analyze_style(SAMPLE_TEXT)
    assert "word_count" in result
    assert "sentence_count" in result
    assert "avg_sentence_length" in result
    assert "type_token_ratio" in result
    assert "top_words" in result
    assert "flesch_reading_ease" in result
    assert result["word_count"] > 50
    assert result["sentence_count"] > 3


def test_transition_words_detected():
    result = analyze_style(SAMPLE_TEXT)
    transitions = result["transition_words"]
    assert "furthermore" in transitions or "however" in transitions


def test_punctuation_patterns():
    result = analyze_style(SAMPLE_TEXT)
    punct = result["punctuation_per_1k"]
    assert "semicolons" in punct
    assert punct["semicolons"] > 0
