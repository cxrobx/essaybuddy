#!/usr/bin/env python3
"""Generate an essay outline with Codex headless mode."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

SHARED_DIR = Path(__file__).resolve().parents[2] / "_shared" / "scripts"
if str(SHARED_DIR) not in sys.path:
    sys.path.insert(0, str(SHARED_DIR))

from codex_exec import run_codex
from essay_context import build_outline_prompt, load_essay, load_profile, load_sample_excerpts, save_outline
from io_utils import (
    EXIT_INVALID_INPUT,
    EXIT_RUNTIME_FAILURE,
    extract_json_array,
    normalize_outline_sections,
    resolve_data_root,
)


def _int_or_none(value: object) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate an outline for an EssayBuddy essay")
    parser.add_argument("--essay-id", type=str, help="Essay ID from data/essays/{id}.md")
    parser.add_argument("--topic", type=str, help="Essay topic (manual mode)")
    parser.add_argument("--thesis", type=str, default=None, help="Optional thesis statement")
    parser.add_argument("--profile-id", type=str, default=None, help="Profile ID override")
    parser.add_argument("--citation-style", type=str, default=None)
    parser.add_argument("--instructions", type=str, default=None)
    parser.add_argument("--target-word-count", type=int, default=None)
    parser.add_argument("--write-outline", action="store_true", help="Write sidecar outline JSON")
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--data-root", type=str, default=None)
    return parser.parse_args()


def main() -> int:
    try:
        args = _parse_args()
        data_root = resolve_data_root(args.data_root)

        if not args.essay_id and not args.topic:
            raise ValueError("Provide either --essay-id or --topic")

        if args.write_outline and not args.essay_id:
            raise ValueError("--write-outline requires --essay-id")

        topic = args.topic
        thesis = args.thesis
        profile_id = args.profile_id
        citation_style = args.citation_style
        instructions = args.instructions
        target_word_count = args.target_word_count

        essay_id_for_write: Optional[str] = None
        if args.essay_id:
            essay = load_essay(data_root, args.essay_id)
            meta = essay.get("meta", {})

            essay_id_for_write = args.essay_id
            topic = topic or str(meta.get("topic") or "").strip()
            thesis = thesis or (str(meta.get("thesis") or "").strip() or None)
            profile_id = profile_id or (str(meta.get("profile_id") or "").strip() or None)
            citation_style = citation_style or (str(meta.get("citation_style") or "").strip() or None)
            instructions = instructions or (str(meta.get("instructions") or "").strip() or None)
            if target_word_count is None:
                target_word_count = _int_or_none(meta.get("target_word_count"))

        if not topic:
            raise ValueError("Topic is required (from --topic or essay frontmatter)")
        if not profile_id:
            raise ValueError("Profile ID is required (from --profile-id or essay frontmatter)")

        profile = load_profile(data_root, profile_id)
        samples_ctx = load_sample_excerpts(data_root)

        prompt = build_outline_prompt(
            profile=profile,
            samples_ctx=samples_ctx,
            topic=topic,
            thesis=thesis,
            citation_style=citation_style,
            instructions=instructions,
            target_word_count=target_word_count,
        )

        raw = run_codex(prompt, timeout=args.timeout)
        parsed = extract_json_array(raw)
        sections = normalize_outline_sections(parsed)

        if args.write_outline and essay_id_for_write:
            save_outline(data_root, essay_id_for_write, sections)

        sys.stdout.write(json.dumps(sections, ensure_ascii=False))
        return 0
    except ValueError as exc:
        sys.stderr.write(f"Invalid input: {exc}\n")
        return EXIT_INVALID_INPUT
    except Exception as exc:
        sys.stderr.write(f"Outline generation failed: {exc}\n")
        return EXIT_RUNTIME_FAILURE


if __name__ == "__main__":
    raise SystemExit(main())
