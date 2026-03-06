"""Codex headless AI pattern detection service."""

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Optional

DETECT_TIMEOUT = 120


class DetectionError(RuntimeError):
    """Raised when skill-based detection fails."""


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _detect_script_path() -> Path:
    script = _project_root() / "skills" / "ai-essay-detector" / "scripts" / "detect.py"
    if not script.exists():
        raise DetectionError(f"Detector script not found: {script}")
    return script


def detect_ai_patterns(
    text: str,
    scope: str,
    profile_metrics: Optional[Dict[str, Any]] = None,
    timeout: int = DETECT_TIMEOUT,
) -> Dict[str, Any]:
    script = _detect_script_path()

    cmd = [sys.executable, str(script), "--stdin", "--scope", scope, "--timeout", str(timeout)]

    if profile_metrics:
        cmd.extend(["--profile-json", json.dumps(profile_metrics, ensure_ascii=False)])

    env = os.environ.copy()

    try:
        proc = subprocess.run(
            cmd,
            input=text,
            text=True,
            capture_output=True,
            timeout=timeout + 5,
            env=env,
        )
    except subprocess.TimeoutExpired as exc:
        raise DetectionError(f"Detector timed out after {timeout}s") from exc

    stdout = proc.stdout.strip()
    stderr = proc.stderr.strip()

    if proc.returncode != 0:
        detail = stderr or stdout or f"Detector exited with code {proc.returncode}"
        raise DetectionError(detail)

    if not stdout:
        raise DetectionError("Detector returned empty output")

    try:
        parsed = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise DetectionError("Detector returned invalid JSON") from exc

    if not isinstance(parsed, dict):
        raise DetectionError("Detector output must be a JSON object")

    return parsed
