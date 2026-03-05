#!/usr/bin/env python3
"""Shared I/O and parsing helpers for EssayBuddy CLI skills."""

from __future__ import annotations

import json
import os
import re
import string
from pathlib import Path
from secrets import choice
from typing import Any, Dict, List, Optional

EXIT_INVALID_INPUT = 2
EXIT_RUNTIME_FAILURE = 4

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*\n(.*?)\n```", re.DOTALL | re.IGNORECASE)
_SECTION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{3,32}$")


def resolve_repo_root() -> Path:
    """Resolve the repository root from shared script location."""
    return Path(__file__).resolve().parents[3]


def resolve_data_root(explicit: Optional[str] = None) -> Path:
    """Resolve DATA_ROOT from explicit arg, env, or repo-local default."""
    if explicit:
        base = Path(explicit).expanduser()
    else:
        env_value = os.environ.get("DATA_ROOT", "").strip()
        if env_value:
            base = Path(env_value).expanduser()
        else:
            base = resolve_repo_root() / "data"

    if not base.is_absolute():
        base = resolve_repo_root() / base

    root = base.resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError(f"Data root does not exist or is not a directory: {root}")
    return root


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in text.split("\n")]
    return "\n".join(lines).strip()


def strip_ansi(text: str) -> str:
    return _ANSI_RE.sub("", text)


def unwrap_markdown_fence(text: str) -> str:
    stripped = strip_ansi(text).strip()
    match = _JSON_FENCE_RE.search(stripped)
    if match:
        return match.group(1).strip()

    plain_fence = re.search(r"```\s*\n(.*?)\n```", stripped, re.DOTALL)
    if plain_fence:
        return plain_fence.group(1).strip()

    return stripped


def read_text_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        raise ValueError(f"Could not read {path}: {exc}") from exc


def read_json_file(path: Path) -> Any:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ValueError(f"Could not read {path}: {exc}") from exc
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc


def write_text_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def write_json_atomic(path: Path, payload: Any, *, indent: int = 2) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=indent)
    write_text_atomic(path, rendered + "\n")


def _extract_json_candidate(text: str, start_token: str, end_token: str) -> str:
    start = text.find(start_token)
    end = text.rfind(end_token)
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Could not find JSON payload in model output")
    return text[start : end + 1]


def extract_json_array(text: str) -> List[Any]:
    cleaned = strip_ansi(text).strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    fenced = _JSON_FENCE_RE.search(cleaned)
    if fenced:
        parsed = json.loads(fenced.group(1).strip())
        if isinstance(parsed, list):
            return parsed

    parsed = json.loads(_extract_json_candidate(cleaned, "[", "]"))
    if not isinstance(parsed, list):
        raise ValueError("Expected JSON array")
    return parsed


def extract_json_object(text: str) -> Dict[str, Any]:
    cleaned = strip_ansi(text).strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    fenced = _JSON_FENCE_RE.search(cleaned)
    if fenced:
        parsed = json.loads(fenced.group(1).strip())
        if isinstance(parsed, dict):
            return parsed

    parsed = json.loads(_extract_json_candidate(cleaned, "{", "}"))
    if not isinstance(parsed, dict):
        raise ValueError("Expected JSON object")
    return parsed


def clamp_int(value: Any, low: int, high: int) -> int:
    ivalue = int(round(float(value)))
    return max(low, min(high, ivalue))


def new_outline_id(length: int = 6) -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(choice(alphabet) for _ in range(length))


def normalize_outline_sections(raw: List[Any]) -> List[Dict[str, str]]:
    sections: List[Dict[str, str]] = []

    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            continue

        title = str(item.get("title", "")).strip() or f"Section {index + 1}"
        notes = str(item.get("notes", "")).strip()
        evidence = str(item.get("evidence", "")).strip()

        section_id = str(item.get("id", "")).strip()
        if not _SECTION_ID_RE.match(section_id):
            section_id = new_outline_id()

        sections.append(
            {
                "id": section_id,
                "title": title,
                "notes": notes,
                "evidence": evidence,
            }
        )

    if not sections:
        raise ValueError("Outline output did not contain any usable sections")

    return sections


def read_input_text(*, use_stdin: bool, direct_text: Optional[str]) -> str:
    if use_stdin:
        raw = os.sys.stdin.read()
    else:
        raw = direct_text or ""

    text = normalize_text(raw)
    if not text:
        raise ValueError("Input text is empty")
    return text
