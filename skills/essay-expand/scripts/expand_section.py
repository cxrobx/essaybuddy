#!/usr/bin/env python3
"""Expand an outline section into draft paragraphs."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

SHARED_DIR = Path(__file__).resolve().parents[2] / "_shared" / "scripts"
if str(SHARED_DIR) not in sys.path:
    sys.path.insert(0, str(SHARED_DIR))

from codex_exec import run_codex
from essay_context import (
    build_expand_prompt,
    build_humanize_prompt,
    load_essay,
    load_outline,
    load_profile,
    load_sample_excerpts,
    resolve_section_from_outline,
)
from io_utils import EXIT_INVALID_INPUT, EXIT_RUNTIME_FAILURE, resolve_data_root


def _int_or_none(value: object) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _load_evidence_payload(raw: Optional[str]) -> Optional[List[Dict[str, Any]]]:
    if not raw:
        return None

    payload = raw
    if raw.startswith("@"):
        path = Path(raw[1:]).expanduser()
        if not path.exists() or not path.is_file():
            raise ValueError(f"Evidence JSON file not found: {path}")
        payload = path.read_text(encoding="utf-8")

    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid evidence JSON: {exc}") from exc

    if not isinstance(parsed, list):
        raise ValueError("--evidence-json must decode to a JSON array")

    result: List[Dict[str, Any]] = []
    for item in parsed:
        if isinstance(item, dict):
            result.append(item)
    return result


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Expand an essay outline section")
    parser.add_argument("--essay-id", required=True, type=str)
    parser.add_argument("--section", required=True, type=str, help="Section title or index")
    parser.add_argument("--profile-id", type=str, default=None)
    parser.add_argument("--citation-style", type=str, default=None)
    parser.add_argument("--instructions", type=str, default=None)
    parser.add_argument("--target-word-count", type=int, default=None)
    parser.add_argument("--evidence-json", type=str, default=None)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--data-root", type=str, default=None)
    return parser.parse_args()


def main() -> int:
    try:
        args = _parse_args()
        data_root = resolve_data_root(args.data_root)

        essay = load_essay(data_root, args.essay_id)
        meta = essay.get("meta", {})

        profile_id = args.profile_id or (str(meta.get("profile_id") or "").strip() or None)
        if not profile_id:
            raise ValueError("Profile ID is required (from --profile-id or essay frontmatter)")

        profile = load_profile(data_root, profile_id)
        outline = load_outline(data_root, args.essay_id)
        section = resolve_section_from_outline(outline, args.section)

        citation_style = args.citation_style or (str(meta.get("citation_style") or "").strip() or None)
        instructions = args.instructions or (str(meta.get("instructions") or "").strip() or None)
        topic = str(meta.get("topic") or "").strip() or None
        thesis = str(meta.get("thesis") or "").strip() or None
        essay_title = str(meta.get("title") or "").strip() or None

        target_word_count = args.target_word_count
        if target_word_count is None:
            target_word_count = _int_or_none(meta.get("target_word_count"))

        evidence_items = _load_evidence_payload(args.evidence_json)
        samples_ctx = load_sample_excerpts(data_root)

        prompt = build_expand_prompt(
            profile=profile,
            samples_ctx=samples_ctx,
            section_title=str(section.get("title") or "Untitled Section"),
            section_notes=str(section.get("notes") or "").strip() or None,
            citation_style=citation_style,
            topic=topic,
            thesis=thesis,
            target_word_count=target_word_count,
            instructions=instructions,
            essay_title=essay_title,
            evidence_items=evidence_items,
        )

        draft = run_codex(prompt, timeout=args.timeout)
        humanize_prompt = build_humanize_prompt(text=draft, profile=profile)
        final_text = run_codex(humanize_prompt, timeout=args.timeout)

        sys.stdout.write(final_text.strip())
        return 0
    except ValueError as exc:
        sys.stderr.write(f"Invalid input: {exc}\n")
        return EXIT_INVALID_INPUT
    except Exception as exc:
        sys.stderr.write(f"Section expansion failed: {exc}\n")
        return EXIT_RUNTIME_FAILURE


if __name__ == "__main__":
    raise SystemExit(main())
