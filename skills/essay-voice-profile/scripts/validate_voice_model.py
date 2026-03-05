#!/usr/bin/env python3
"""Validate EssayBuddy voice model JSON for schema and content quality."""

from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path
import re
import sys
from typing import Any

REQUIRED_PROFILE_STRING_FIELDS = (
    "summary",
    "tone",
    "sentence_patterns",
    "argument_style",
    "vocabulary_level",
    "transition_patterns",
    "paragraph_structure",
    "what_to_avoid",
)
REQUIRED_PROFILE_LIST_FIELDS = ("rhetorical_devices", "distinctive_phrases")
REQUIRED_TOP_LEVEL_FIELDS = ("voice_profile", "voice_examples", "generated_at", "model_used")
WORD_RE = re.compile(r"\b[\w'-]+\b")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate voice_model JSON generated from essay samples."
    )
    parser.add_argument("json_path", help="Path to JSON file containing voice_model data")
    parser.add_argument("--min-examples", type=int, default=5)
    parser.add_argument("--max-examples", type=int, default=8)
    parser.add_argument("--min-excerpt-words", type=int, default=150)
    parser.add_argument("--max-excerpt-words", type=int, default=300)
    parser.add_argument(
        "--strict-excerpt-length",
        action="store_true",
        help="Treat excerpt length violations as errors instead of warnings",
    )
    parser.add_argument(
        "--fail-on-warnings",
        action="store_true",
        help="Return non-zero exit code when warnings are present",
    )
    return parser.parse_args()


def _load_json(path: Path) -> Any:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ValueError(f"Could not read {path}: {exc}") from exc
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc


def _unwrap_voice_model(payload: Any) -> Any:
    if not isinstance(payload, dict):
        return payload
    if isinstance(payload.get("voice_model"), dict):
        return payload["voice_model"]
    return payload


def _is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _validate_timestamp(value: Any) -> bool:
    if not _is_non_empty_string(value):
        return False
    normalized = value.replace("Z", "+00:00")
    try:
        datetime.fromisoformat(normalized)
    except ValueError:
        return False
    return True


def _count_words(text: str) -> int:
    return len(WORD_RE.findall(text))


def _validate(payload: Any, args: argparse.Namespace) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    voice_model = _unwrap_voice_model(payload)
    if not isinstance(voice_model, dict):
        return (["Top-level payload must be an object or contain a `voice_model` object."], [])

    for field in REQUIRED_TOP_LEVEL_FIELDS:
        if field not in voice_model:
            errors.append(f"Missing top-level field: `{field}`")

    voice_profile = voice_model.get("voice_profile")
    if not isinstance(voice_profile, dict):
        errors.append("`voice_profile` must be an object.")
    else:
        for field in REQUIRED_PROFILE_STRING_FIELDS:
            if not _is_non_empty_string(voice_profile.get(field)):
                errors.append(f"`voice_profile.{field}` must be a non-empty string.")
        for field in REQUIRED_PROFILE_LIST_FIELDS:
            list_value = voice_profile.get(field)
            if not isinstance(list_value, list) or not list_value:
                errors.append(f"`voice_profile.{field}` must be a non-empty array.")
                continue
            if any(not _is_non_empty_string(item) for item in list_value):
                errors.append(f"`voice_profile.{field}` must contain only non-empty strings.")

    examples = voice_model.get("voice_examples")
    if not isinstance(examples, list):
        errors.append("`voice_examples` must be an array.")
    else:
        count = len(examples)
        if count < args.min_examples or count > args.max_examples:
            errors.append(
                f"`voice_examples` must contain between {args.min_examples} and {args.max_examples} items; found {count}."
            )
        for index, example in enumerate(examples, start=1):
            label = f"voice_examples[{index - 1}]"
            if not isinstance(example, dict):
                errors.append(f"`{label}` must be an object.")
                continue
            excerpt = example.get("excerpt")
            demonstrates = example.get("demonstrates")
            if not _is_non_empty_string(excerpt):
                errors.append(f"`{label}.excerpt` must be a non-empty string.")
            if not _is_non_empty_string(demonstrates):
                errors.append(f"`{label}.demonstrates` must be a non-empty string.")
            if _is_non_empty_string(excerpt):
                word_count = _count_words(excerpt)
                if word_count < args.min_excerpt_words or word_count > args.max_excerpt_words:
                    message = (
                        f"`{label}.excerpt` has {word_count} words; expected {args.min_excerpt_words}-{args.max_excerpt_words}."
                    )
                    if args.strict_excerpt_length:
                        errors.append(message)
                    else:
                        warnings.append(message)

    if not _validate_timestamp(voice_model.get("generated_at")):
        errors.append("`generated_at` must be a valid ISO-8601 timestamp.")
    if not _is_non_empty_string(voice_model.get("model_used")):
        errors.append("`model_used` must be a non-empty string.")

    return errors, warnings


def main() -> int:
    args = _parse_args()
    json_path = Path(args.json_path).expanduser()
    payload: Any
    try:
        payload = _load_json(json_path)
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 2

    errors, warnings = _validate(payload, args)

    if errors:
        print("Validation failed:")
        for error in errors:
            print(f"- {error}")
    if warnings:
        print("Validation warnings:")
        for warning in warnings:
            print(f"- {warning}")

    if errors:
        return 1
    if warnings and args.fail_on_warnings:
        return 1

    print("Voice model is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
