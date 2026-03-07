#!/usr/bin/env python3
"""Shared EssayBuddy context/prompt utilities for CLI skills."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from io_utils import read_json_file, read_text_file, resolve_repo_root, write_json_atomic

CITATION_STYLE_LABELS = {
    "apa7": "APA 7th Edition",
    "mla9": "MLA 9th Edition",
    "chicago-notes": "Chicago Manual of Style (Notes-Bibliography)",
    "chicago-author": "Chicago Manual of Style (Author-Date)",
    "ieee": "IEEE",
    "harvard": "Harvard",
}


def _coerce_scalar(value: str) -> Any:
    value = value.strip()
    if not value:
        return ""

    if (value.startswith("\"") and value.endswith("\"")) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]

    lowered = value.lower()
    if lowered in {"null", "none", "~"}:
        return None
    if lowered == "true":
        return True
    if lowered == "false":
        return False

    if re.fullmatch(r"[+-]?\d+", value):
        try:
            return int(value)
        except ValueError:
            pass

    if re.fullmatch(r"[+-]?\d+\.\d+", value):
        try:
            return float(value)
        except ValueError:
            pass

    return value


def _parse_simple_yaml(blob: str) -> Dict[str, Any]:
    meta: Dict[str, Any] = {}
    current_key: Optional[str] = None
    multiline_mode: Dict[str, str] = {}

    for raw_line in blob.splitlines():
        line = raw_line.rstrip("\n")
        if not line.strip():
            continue

        if line.startswith((" ", "\t")) and current_key:
            continuation = line.strip()
            if not continuation:
                continue
            existing = meta.get(current_key)
            if existing is None:
                existing = ""
            if not isinstance(existing, str):
                existing = str(existing)

            joiner = "\n" if multiline_mode.get(current_key) == "|" else " "
            meta[current_key] = (existing + joiner + continuation).strip()
            continue

        match = re.match(r"^([A-Za-z0-9_]+):(?:\s*(.*))?$", line)
        if not match:
            current_key = None
            continue

        key = match.group(1)
        value = (match.group(2) or "").strip()
        current_key = key

        if value in {"", "|", ">"}:
            meta[key] = ""
            multiline_mode[key] = value
            continue

        meta[key] = _coerce_scalar(value)
        multiline_mode.pop(key, None)

    return meta


def parse_markdown_frontmatter(markdown: str) -> Tuple[Dict[str, Any], str]:
    try:
        import frontmatter  # type: ignore

        post = frontmatter.loads(markdown)
        return dict(post.metadata), post.content
    except Exception:
        pass

    match = re.match(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", markdown, re.DOTALL)
    if not match:
        return {}, markdown

    meta_blob = match.group(1)
    content = markdown[match.end() :]
    return _parse_simple_yaml(meta_blob), content


def load_profile(data_root: Path, profile_id: str) -> Dict[str, Any]:
    path = data_root / "profiles" / f"{profile_id}.json"
    if not path.exists():
        raise ValueError(f"Profile not found: {profile_id}")
    payload = read_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError(f"Profile payload is not a JSON object: {path}")
    return payload


def load_essay(data_root: Path, essay_id: str) -> Dict[str, Any]:
    md_path = data_root / "essays" / f"{essay_id}.md"
    if md_path.exists():
        raw = read_text_file(md_path)
        meta, content = parse_markdown_frontmatter(raw)
        return {
            "id": essay_id,
            "path": md_path,
            "meta": meta,
            "content": content,
        }

    legacy_path = data_root / "essays" / f"{essay_id}.json"
    if legacy_path.exists():
        payload = read_json_file(legacy_path)
        if not isinstance(payload, dict):
            raise ValueError(f"Legacy essay payload is invalid: {legacy_path}")
        meta = {
            "title": payload.get("title"),
            "topic": payload.get("topic"),
            "thesis": payload.get("thesis"),
            "profile_id": payload.get("profile_id"),
            "citation_style": payload.get("citation_style"),
            "target_word_count": payload.get("target_word_count"),
            "instructions": payload.get("instructions"),
            "created_at": payload.get("created_at"),
            "updated_at": payload.get("updated_at"),
        }
        return {
            "id": essay_id,
            "path": legacy_path,
            "meta": meta,
            "content": str(payload.get("content", "")),
        }

    raise ValueError(f"Essay not found: {essay_id}")


def load_outline(data_root: Path, essay_id: str) -> List[Dict[str, Any]]:
    path = data_root / "essays" / f"{essay_id}.outline.json"
    if not path.exists():
        return []

    payload = read_json_file(path)
    if not isinstance(payload, list):
        raise ValueError(f"Outline JSON is not an array: {path}")

    normalized: List[Dict[str, Any]] = []
    for item in payload:
        if isinstance(item, dict):
            normalized.append(item)
    return normalized


def save_outline(data_root: Path, essay_id: str, sections: List[Dict[str, Any]]) -> None:
    path = data_root / "essays" / f"{essay_id}.outline.json"
    write_json_atomic(path, sections, indent=2)


def resolve_section_from_outline(outline: List[Dict[str, Any]], selector: str) -> Dict[str, Any]:
    if not outline:
        raise ValueError("Outline is empty; cannot resolve section")

    token = selector.strip()
    try:
        idx = int(token)
        if 0 <= idx < len(outline):
            return outline[idx]
        if 1 <= idx <= len(outline):
            return outline[idx - 1]
        raise ValueError
    except ValueError:
        pass

    needle = token.lower()
    for section in outline:
        title = str(section.get("title", "")).strip()
        if title.lower() == needle:
            return section

    raise ValueError(f"Section not found for selector: {selector}")


def build_metrics_context(metrics: Dict[str, Any]) -> str:
    lines = [
        "## Quantitative Targets",
        f"- Average sentence length: {metrics.get('avg_sentence_length', 'N/A')} words",
        f"- Vocabulary richness (TTR): {metrics.get('type_token_ratio', 'N/A')}",
        f"- Flesch reading ease: {metrics.get('flesch_reading_ease', 'N/A')}",
        f"- Active voice ratio: {metrics.get('active_voice_ratio', 'N/A')}",
        f"- Avg syllables/word: {metrics.get('avg_syllables_per_word', 'N/A')}",
    ]

    top_words = metrics.get("top_words", [])
    if isinstance(top_words, list):
        words: List[str] = []
        for item in top_words[:20]:
            if isinstance(item, (list, tuple)) and item:
                words.append(str(item[0]))
            elif isinstance(item, str):
                words.append(item)
        if words:
            lines.append(f"- Characteristic vocabulary: {', '.join(words)}")

    transitions = metrics.get("transition_words", {})
    if isinstance(transitions, dict) and transitions:
        lines.append(f"- Transition words used: {', '.join(str(k) for k in transitions.keys())}")

    punct = metrics.get("punctuation_per_1k", {})
    if isinstance(punct, dict) and punct:
        notable = []
        for key, value in punct.items():
            try:
                numeric = float(value)
            except (TypeError, ValueError):
                continue
            if numeric > 0.5:
                notable.append(f"{key}: {numeric}/1k")
        if notable:
            lines.append(f"- Punctuation patterns: {', '.join(notable)}")

    return "\n".join(lines)


def build_voice_context(voice_model: Dict[str, Any], metrics: Dict[str, Any]) -> str:
    vp = voice_model.get("voice_profile", {}) if isinstance(voice_model, dict) else {}
    examples = voice_model.get("voice_examples", []) if isinstance(voice_model, dict) else []

    parts: List[str] = []

    profile_lines = ["<voice-profile>", "## Voice Profile (match this writing style exactly)"]
    field_labels = {
        "summary": "Summary",
        "tone": "Tone",
        "sentence_patterns": "Sentence Patterns",
        "argument_style": "Argument Style",
        "vocabulary_level": "Vocabulary Level",
        "transition_patterns": "Transition Patterns",
        "paragraph_structure": "Paragraph Structure",
        "what_to_avoid": "What to Avoid",
    }
    for key, label in field_labels.items():
        value = vp.get(key) if isinstance(vp, dict) else None
        if value:
            profile_lines.append(f"{label}: {value}")

    devices = vp.get("rhetorical_devices", []) if isinstance(vp, dict) else []
    if isinstance(devices, list) and devices:
        profile_lines.append(f"Rhetorical Devices: {', '.join(str(v) for v in devices)}")

    phrases = vp.get("distinctive_phrases", []) if isinstance(vp, dict) else []
    if isinstance(phrases, list) and phrases:
        profile_lines.append(f"Distinctive Phrases: {', '.join(str(v) for v in phrases)}")

    profile_lines.append("</voice-profile>")
    parts.append("\n".join(profile_lines))

    if isinstance(examples, list) and examples:
        example_lines = [
            "<voice-examples>",
            "## Writing Examples (mimic the style, rhythm, and vocabulary in these passages)",
        ]
        for index, example in enumerate(examples, start=1):
            if not isinstance(example, dict):
                continue
            example_lines.append(f"### Example {index}")
            demonstrates = example.get("demonstrates")
            if demonstrates:
                example_lines.append(f"*{demonstrates}*")
            excerpt = example.get("excerpt", "")
            example_lines.append(str(excerpt))
            example_lines.append("")
        example_lines.append("</voice-examples>")
        parts.append("\n".join(example_lines))

    if metrics:
        parts.append(f"<style-metrics>\n{build_metrics_context(metrics)}\n</style-metrics>")

    return "\n\n".join(parts)


def build_style_context(profile: Dict[str, Any]) -> str:
    voice_model = profile.get("voice_model")
    metrics = profile.get("metrics", {})
    if isinstance(voice_model, dict):
        return build_voice_context(voice_model, metrics if isinstance(metrics, dict) else {})
    return build_metrics_context(metrics if isinstance(metrics, dict) else {})


def load_sample_excerpts(data_root: Path, per_sample: int = 2000) -> str:
    samples_dir = data_root / "samples"
    if not samples_dir.exists():
        return ""

    texts: List[str] = []
    for sample_file in sorted(samples_dir.glob("*.json"), key=lambda p: p.stat().st_mtime):
        try:
            payload = read_json_file(sample_file)
        except ValueError:
            continue
        if not isinstance(payload, dict):
            continue

        raw_text = str(payload.get("text", "")).strip()
        if not raw_text:
            continue

        excerpt = raw_text[:per_sample]
        if len(raw_text) > per_sample:
            excerpt = excerpt.rsplit(" ", 1)[0] + "..."

        filename = str(payload.get("filename", "Sample"))
        texts.append(f"### {filename}\n{excerpt}")

    if not texts:
        return ""

    return (
        "<reference-samples>\n"
        "## Uploaded Writing Samples (reference for voice and content)\n\n"
        + "\n\n---\n\n".join(texts)
        + "\n</reference-samples>"
    )


def build_essay_briefing(
    topic: Optional[str] = None,
    thesis: Optional[str] = None,
    target_word_count: Optional[int] = None,
    instructions: Optional[str] = None,
) -> str:
    parts: List[str] = []
    if topic:
        parts.append(f"Topic: {topic}")
    if thesis:
        parts.append(f"Thesis: {thesis}")
    if target_word_count:
        parts.append(f"Target length: ~{target_word_count} words")
    if instructions:
        parts.append(f"Author instructions: {instructions}")
    if not parts:
        return ""
    return "<essay-briefing>\n" + "\n".join(parts) + "\n</essay-briefing>"


def citation_directive(citation_style: Optional[str]) -> str:
    if not citation_style or citation_style not in CITATION_STYLE_LABELS:
        return ""
    label = CITATION_STYLE_LABELS[citation_style]
    return (
        f"\n\nCitation Style: Use {label} format for all citations, references, "
        f"and evidence. Format in-text citations, footnotes, and reference entries "
        f"according to {label} conventions."
    )


def voice_directive(profile: Dict[str, Any]) -> str:
    if isinstance(profile.get("voice_model"), dict):
        return (
            "Write in the exact voice and style shown in the Voice Profile and "
            "Writing Examples above. Mimic the vocabulary, sentence structure, "
            "transition patterns, and argument style from the examples. "
            "Do NOT sound like AI — sound like the human author of those examples."
        )
    return "Match the writing style described above."


def build_outline_prompt(
    *,
    profile: Dict[str, Any],
    samples_ctx: str,
    topic: str,
    thesis: Optional[str],
    citation_style: Optional[str],
    instructions: Optional[str],
    target_word_count: Optional[int],
) -> str:
    style_ctx = build_style_context(profile)
    briefing = build_essay_briefing(topic, thesis, target_word_count, instructions)
    directive = voice_directive(profile) + citation_directive(citation_style)

    thesis_line = f"Thesis: {thesis}" if thesis else ""

    return f"""{style_ctx}

{samples_ctx}
{briefing}

Generate a detailed essay outline for the following topic. {directive}

Topic: {topic}
{thesis_line}

Return a JSON array of sections. Each section should have:
- \"title\": section heading
- \"notes\": brief description of content
- \"evidence\": key evidence or examples to include

Format: [{{\"title\": \"...\", \"notes\": \"...\", \"evidence\": \"...\"}}]
Return ONLY the JSON array, no other text."""


def _build_evidence_context(evidence_items: Optional[List[Dict[str, Any]]]) -> str:
    if not evidence_items:
        return ""

    lines = [
        "<evidence>",
        "## Source Evidence (integrate these quotes naturally with proper citations)",
    ]
    for item in evidence_items:
        quote = str(item.get("quote", ""))
        page = item.get("page_number", "")
        title = str(item.get("source_title", "") or item.get("textbook_title", ""))
        relevance = str(item.get("relevance", "")).strip()
        lines.append(f'- "{quote}" (p. {page}, {title})')
        if relevance:
            lines.append(f"  Relevance: {relevance}")
    lines.append("</evidence>")
    return "\n".join(lines)


def build_expand_prompt(
    *,
    profile: Dict[str, Any],
    samples_ctx: str,
    section_title: str,
    section_notes: Optional[str],
    citation_style: Optional[str],
    topic: Optional[str],
    thesis: Optional[str],
    target_word_count: Optional[int],
    instructions: Optional[str],
    essay_title: Optional[str],
    evidence_items: Optional[List[Dict[str, Any]]],
) -> str:
    style_ctx = build_style_context(profile)
    briefing = build_essay_briefing(topic, thesis, target_word_count, instructions)
    directive = voice_directive(profile) + citation_directive(citation_style)
    evidence_ctx = _build_evidence_context(evidence_items)

    essay_context = ""
    if essay_title or thesis:
        essay_context = f"\nEssay title: {essay_title or ''}\nThesis: {thesis or ''}"

    notes_line = f"Notes: {section_notes}" if section_notes else ""

    return f"""{style_ctx}

{samples_ctx}
{briefing}
{evidence_ctx}
{essay_context}

Expand the following essay section into well-written paragraphs. {directive}

Section: {section_title}
{notes_line}

Write 2-3 paragraphs for this section. Return ONLY the essay text, no headings or metadata."""


def build_rephrase_prompt(
    *,
    profile: Dict[str, Any],
    text: str,
    citation_style: Optional[str],
) -> str:
    style_ctx = build_style_context(profile)
    directive = voice_directive(profile) + citation_directive(citation_style)
    return f"""{style_ctx}

Rephrase the following text to match the writing style. {directive} Keep the same meaning but adjust sentence structure, vocabulary, and tone.

Text to rephrase:
{text}

Return ONLY the rephrased text, no explanations."""


def build_score_prompt(*, profile: Dict[str, Any], text: str) -> str:
    style_ctx = build_style_context(profile)
    directive = voice_directive(profile)
    return f"""{style_ctx}

Score the following text on how well it matches the writing style above. {directive} Consider sentence length, vocabulary, tone, and punctuation patterns.

Text to score:
{text}

Return a JSON object with:
- \"score\": integer 0-100
- \"feedback\": brief explanation of what matches and what doesn't

Return ONLY the JSON object."""


def load_humanize_rules() -> str:
    repo = resolve_repo_root()
    primary = repo / "api" / "prompts" / "humanize.md"
    if primary.exists():
        return read_text_file(primary)

    fallback = Path(__file__).resolve().parent.parent / "humanize_rules.md"
    if fallback.exists():
        return read_text_file(fallback)

    return ""


def build_humanize_prompt(*, text: str, profile: Dict[str, Any]) -> str:
    universal_rules = load_humanize_rules()

    voice_model = profile.get("voice_model") if isinstance(profile, dict) else None
    vp = voice_model.get("voice_profile", {}) if isinstance(voice_model, dict) else {}

    what_to_avoid = vp.get("what_to_avoid", "") if isinstance(vp, dict) else ""
    phrases = vp.get("distinctive_phrases", []) if isinstance(vp, dict) else []
    sentence_patterns = vp.get("sentence_patterns", "") if isinstance(vp, dict) else ""
    tone = vp.get("tone", "") if isinstance(vp, dict) else ""

    profile_section = ""
    if any([what_to_avoid, tone, sentence_patterns, phrases]):
        profile_parts = [
            "<author-profile>",
            "## Author-Specific Rules (apply on top of universal rules)",
        ]
        if what_to_avoid:
            profile_parts.append(f"What to Avoid: {what_to_avoid}")
        if tone:
            profile_parts.append(f"Tone: {tone}")
        if sentence_patterns:
            profile_parts.append(f"Sentence Patterns: {sentence_patterns}")
        if isinstance(phrases, list) and phrases:
            profile_parts.append(
                "Distinctive Phrases the author actually uses: " + ", ".join(str(v) for v in phrases)
            )
        profile_parts.append("- Use the author's distinctive phrases and sentence patterns where they fit naturally.")
        profile_parts.append("</author-profile>")
        profile_section = "\n".join(profile_parts)

    return f"""{universal_rules}

{profile_section}

<text>
{text}
</text>

Return ONLY the revised text. No explanations, no commentary."""
