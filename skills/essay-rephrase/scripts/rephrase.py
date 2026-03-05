#!/usr/bin/env python3
"""Rephrase text to match an EssayBuddy profile voice."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SHARED_DIR = Path(__file__).resolve().parents[2] / "_shared" / "scripts"
if str(SHARED_DIR) not in sys.path:
    sys.path.insert(0, str(SHARED_DIR))

from codex_exec import run_codex
from essay_context import build_humanize_prompt, build_rephrase_prompt, load_profile
from io_utils import EXIT_INVALID_INPUT, EXIT_RUNTIME_FAILURE, read_input_text, resolve_data_root


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rephrase text in a profile's writing voice")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--stdin", action="store_true", help="Read input text from stdin")
    group.add_argument("--text", type=str, help="Direct text input")

    parser.add_argument("--profile-id", required=True, type=str)
    parser.add_argument("--citation-style", type=str, default=None)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--data-root", type=str, default=None)
    return parser.parse_args()


def main() -> int:
    try:
        args = _parse_args()
        data_root = resolve_data_root(args.data_root)
        text = read_input_text(use_stdin=args.stdin, direct_text=args.text)

        profile = load_profile(data_root, args.profile_id)
        prompt = build_rephrase_prompt(
            profile=profile,
            text=text,
            citation_style=args.citation_style,
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
        sys.stderr.write(f"Rephrase failed: {exc}\n")
        return EXIT_RUNTIME_FAILURE


if __name__ == "__main__":
    raise SystemExit(main())
