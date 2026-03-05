#!/usr/bin/env python3
"""Validate detector JSON fixtures against the required schema keys."""

import json
import sys
from pathlib import Path

REQUIRED_KEYS = {
    "risk_score",
    "risk_level",
    "verdict",
    "confidence",
    "flags",
    "evidence_summary",
    "suggestions",
}


def validate_path(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    missing = REQUIRED_KEYS - set(data.keys())
    if missing:
        print(f"{path}: missing keys: {sorted(missing)}")
        return 1
    print(f"{path}: ok")
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: fixtures_validate.py <json-file> [<json-file> ...]")
        return 2

    failures = 0
    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"{path}: not found")
            failures += 1
            continue
        try:
            failures += validate_path(path)
        except Exception as exc:
            print(f"{path}: invalid ({exc})")
            failures += 1
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
