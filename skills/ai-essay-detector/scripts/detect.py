#!/usr/bin/env python3
"""Headless Codex-based AI pattern detector."""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

EXIT_INVALID_INPUT = 2
EXIT_RUNTIME_FAILURE = 4

SEVERITY_VALUES = {"low", "medium", "high"}
RISK_LEVEL_VALUES = {"low", "medium", "high"}
VERDICT_VALUES = {"likely_human", "mixed", "likely_ai"}


def _normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in text.split("\n")]
    normalized = "\n".join(lines).strip()
    return normalized


def _load_input(args: argparse.Namespace) -> str:
    if args.stdin:
        raw = sys.stdin.read()
    elif args.text is not None:
        raw = args.text
    else:
        path = Path(args.file)
        if not path.exists() or not path.is_file():
            raise ValueError(f"Input file not found: {path}")
        raw = path.read_text(encoding="utf-8", errors="replace")

    text = _normalize_text(raw)
    if not text:
        raise ValueError("Input text is empty")
    return text


def _load_profile_json(value: Optional[str]) -> Optional[Dict[str, Any]]:
    if not value:
        return None
    try:
        data = json.loads(value)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    raise ValueError("profile-json must be a valid JSON object")


def _score_to_level(score: int) -> str:
    if score >= 70:
        return "high"
    if score >= 35:
        return "medium"
    return "low"


def _score_to_verdict(score: int) -> str:
    if score >= 70:
        return "likely_ai"
    if score >= 40:
        return "mixed"
    return "likely_human"


def _clamp_int(value: Any, low: int, high: int, fallback: int) -> int:
    try:
        ivalue = int(round(float(value)))
    except Exception:
        return fallback
    return max(low, min(high, ivalue))


def _extract_json_blob(text: str) -> Dict[str, Any]:
    text = re.sub(r"\x1b\[[0-9;]*m", "", text).strip()

    # Direct JSON
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Markdown fenced JSON
    fenced = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL | re.IGNORECASE)
    if fenced:
        candidate = fenced.group(1).strip()
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed

    # Best-effort object slice
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start : end + 1]
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed

    raise ValueError("Could not parse JSON object from Codex output")


def _normalize_flag(raw: Dict[str, Any], text_len: int, idx: int) -> Dict[str, Any]:
    start = _clamp_int(raw.get("start_char", 0), 0, text_len, 0)
    end = _clamp_int(raw.get("end_char", start), 0, text_len, start)
    if end < start:
        end = start

    severity = str(raw.get("severity", "medium")).lower()
    if severity not in SEVERITY_VALUES:
        severity = "medium"

    excerpt = str(raw.get("excerpt", "")).strip()
    if not excerpt and end > start:
        excerpt = ""

    return {
        "id": str(raw.get("id", f"flag-{idx + 1}")),
        "label": str(raw.get("label", "Pattern signal")),
        "severity": severity,
        "reason": str(raw.get("reason", "Potential AI-like pattern detected.")),
        "start_char": start,
        "end_char": end,
        "excerpt": excerpt,
    }


def _validate_and_normalize(result: Dict[str, Any], text_len: int) -> Dict[str, Any]:
    risk_score = _clamp_int(result.get("risk_score", 50), 0, 100, 50)
    confidence = _clamp_int(result.get("confidence", 50), 0, 100, 50)

    risk_level = str(result.get("risk_level", _score_to_level(risk_score))).lower()
    if risk_level not in RISK_LEVEL_VALUES:
        risk_level = _score_to_level(risk_score)

    verdict = str(result.get("verdict", _score_to_verdict(risk_score))).lower()
    if verdict not in VERDICT_VALUES:
        verdict = _score_to_verdict(risk_score)

    flags_raw = result.get("flags", [])
    flags: List[Dict[str, Any]] = []
    if isinstance(flags_raw, list):
        for idx, item in enumerate(flags_raw):
            if isinstance(item, dict):
                flags.append(_normalize_flag(item, text_len, idx))

    suggestions_raw = result.get("suggestions", [])
    suggestions: List[str] = []
    if isinstance(suggestions_raw, list):
        for s in suggestions_raw:
            if isinstance(s, str):
                value = s.strip()
                if value:
                    suggestions.append(value)

    if not suggestions:
        suggestions = [
            "Increase sentence-structure variation across adjacent paragraphs.",
            "Add concrete examples, named entities, and specific evidence.",
        ]

    summary = str(result.get("evidence_summary", "")).strip()
    if not summary:
        summary = "Pattern signals were detected and scored using a Codex rubric-based pass."

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "verdict": verdict,
        "confidence": confidence,
        "flags": flags,
        "evidence_summary": summary,
        "suggestions": suggestions,
    }


def _load_rubric() -> str:
    rubric_path = Path(__file__).resolve().parent.parent / "references" / "rubric.md"
    if rubric_path.exists():
        return rubric_path.read_text(encoding="utf-8")
    return "Use the default rubric for AI-like writing pattern detection."


def _build_prompt(text: str, scope: str, profile: Optional[Dict[str, Any]]) -> str:
    rubric = _load_rubric()
    payload: Dict[str, Any] = {
        "scope": scope,
        "text": text,
    }
    if profile:
        payload["profile_metrics"] = profile

    schema = {
        "risk_score": "integer 0-100",
        "risk_level": "low|medium|high",
        "verdict": "likely_human|mixed|likely_ai",
        "confidence": "integer 0-100",
        "flags": [
            {
                "id": "string",
                "label": "string",
                "severity": "low|medium|high",
                "reason": "string",
                "start_char": "integer >= 0",
                "end_char": "integer >= start_char",
                "excerpt": "string",
            }
        ],
        "evidence_summary": "string",
        "suggestions": ["string"],
    }

    return (
        "You are an AI writing-pattern detector. "
        "Return ONLY one valid JSON object. No markdown, no prose outside JSON.\n\n"
        "Use this rubric:\n"
        f"{rubric}\n\n"
        "Analyze the input and produce JSON with EXACT keys shown in this schema contract:\n"
        f"{json.dumps(schema, indent=2)}\n\n"
        "Rules:\n"
        "1) risk_score and confidence must be integers from 0 to 100.\n"
        "2) Use precise flags with char spans based on provided text indices when possible.\n"
        "3) Keep evidence_summary concise (1-3 sentences).\n"
        "4) Provide 2-6 actionable suggestions.\n"
        "5) Never include extra keys.\n\n"
        "Input payload:\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )


def _run_codex(prompt: str, timeout: int) -> str:
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "CODEX_TOKEN": os.environ.get("CODEX_TOKEN", ""),
        "OPENAI_API_KEY": os.environ.get("OPENAI_API_KEY", ""),
    }
    proc = subprocess.run(
        ["codex", "exec", "--full-auto", "--skip-git-repo-check"],
        input=prompt,
        text=True,
        capture_output=True,
        timeout=timeout,
        env=env,
    )

    stdout = proc.stdout.strip()
    stderr = proc.stderr.strip()

    if proc.returncode != 0 and not stdout:
        if not stderr:
            stderr = f"codex exited with code {proc.returncode}"
        raise RuntimeError(stderr)

    if not stdout:
        raise RuntimeError("codex returned empty output")

    return stdout


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect AI-like patterns in essay text using Codex")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--stdin", action="store_true", help="Read text from stdin")
    group.add_argument("--text", type=str, help="Direct text input")
    group.add_argument("--file", type=str, help="Path to text file")

    parser.add_argument("--scope", choices=["essay", "selection"], required=True)
    parser.add_argument("--profile-json", type=str, default=None, help="Optional style metrics JSON object")
    parser.add_argument("--timeout", type=int, default=120, help="Codex timeout seconds")
    return parser.parse_args()


def main() -> int:
    try:
        args = _parse_args()
        text = _load_input(args)
        profile = _load_profile_json(args.profile_json)
        prompt = _build_prompt(text=text, scope=args.scope, profile=profile)
        raw = _run_codex(prompt=prompt, timeout=args.timeout)
        parsed = _extract_json_blob(raw)
        normalized = _validate_and_normalize(parsed, text_len=len(text))
        sys.stdout.write(json.dumps(normalized, ensure_ascii=False))
        return 0
    except ValueError as exc:
        sys.stderr.write(f"Invalid input: {exc}\n")
        return EXIT_INVALID_INPUT
    except Exception as exc:
        sys.stderr.write(f"Detection failed: {exc}\n")
        return EXIT_RUNTIME_FAILURE


if __name__ == "__main__":
    raise SystemExit(main())
