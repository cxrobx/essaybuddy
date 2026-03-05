#!/usr/bin/env python3
"""Score style match for text against an EssayBuddy profile."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SHARED_DIR = Path(__file__).resolve().parents[2] / "_shared" / "scripts"
if str(SHARED_DIR) not in sys.path:
    sys.path.insert(0, str(SHARED_DIR))

from codex_exec import run_codex
from essay_context import build_score_prompt, load_essay, load_profile
from io_utils import (
    EXIT_INVALID_INPUT,
    EXIT_RUNTIME_FAILURE,
    clamp_int,
    extract_json_object,
    read_input_text,
    resolve_data_root,
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score style match against a profile")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--stdin", action="store_true", help="Read text from stdin")
    group.add_argument("--text", type=str, help="Direct text input")
    group.add_argument("--essay-id", type=str, help="Load text from essay markdown")

    parser.add_argument("--profile-id", type=str, default=None, help="Profile ID override")
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--data-root", type=str, default=None)
    return parser.parse_args()


def main() -> int:
    try:
        args = _parse_args()
        data_root = resolve_data_root(args.data_root)

        profile_id = args.profile_id
        if args.essay_id:
            essay = load_essay(data_root, args.essay_id)
            text = str(essay.get("content") or "").strip()
            if not text:
                raise ValueError("Essay content is empty")

            if not profile_id:
                meta = essay.get("meta", {})
                profile_id = str(meta.get("profile_id") or "").strip() or None
        else:
            text = read_input_text(use_stdin=args.stdin, direct_text=args.text)

        if not profile_id:
            raise ValueError("Profile ID is required (from --profile-id or essay frontmatter)")

        profile = load_profile(data_root, profile_id)
        prompt = build_score_prompt(profile=profile, text=text)

        raw = run_codex(prompt, timeout=args.timeout)
        parsed = extract_json_object(raw)

        if "score" not in parsed or "feedback" not in parsed:
            raise ValueError("Score response must include keys: score, feedback")

        score = clamp_int(parsed["score"], 0, 100)
        feedback = str(parsed["feedback"] or "").strip()
        if not feedback:
            raise ValueError("Score response feedback is empty")

        output = {"score": score, "feedback": feedback}
        sys.stdout.write(json.dumps(output, ensure_ascii=False))
        return 0
    except ValueError as exc:
        sys.stderr.write(f"Invalid input: {exc}\n")
        return EXIT_INVALID_INPUT
    except Exception as exc:
        sys.stderr.write(f"Style score failed: {exc}\n")
        return EXIT_RUNTIME_FAILURE


if __name__ == "__main__":
    raise SystemExit(main())
