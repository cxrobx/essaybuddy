#!/usr/bin/env python3
"""Shared Codex CLI subprocess execution helpers."""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from pathlib import Path
import shutil

from io_utils import strip_ansi


def _trim_error(stderr: str) -> str:
    lines = stderr.splitlines()
    useful = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("Reading prompt from stdin"):
            continue
        if stripped.startswith("--------") or stripped.startswith("session id:"):
            break
        useful.append(stripped)
    if useful:
        return " ".join(useful)[:400]
    return stderr.strip()[:400]


def _extract_assistant_content(text: str) -> str:
    cleaned = strip_ansi(text).strip()
    if not cleaned:
        return ""

    matches = list(re.finditer(r"\bassistant\s*\n", cleaned))
    if matches:
        cleaned = cleaned[matches[-1].end() :].strip()

    fenced = re.search(r"```\s*\n(.*?)\n```", cleaned, re.DOTALL)
    if fenced:
        return fenced.group(1).strip()

    return cleaned


def run_codex(prompt: str, *, timeout: int = 120) -> str:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_home = Path(tmpdir)
        codex_dir = tmp_home / ".codex"
        codex_dir.mkdir(parents=True, exist_ok=True)

        # Disable MCP startup overhead for headless script calls.
        (codex_dir / "config.toml").write_text("[mcp_servers]\n", encoding="utf-8")

        # Reuse existing auth if present.
        real_home = Path(os.environ.get("HOME", "")).expanduser()
        real_auth = real_home / ".codex" / "auth.json"
        if real_auth.exists() and real_auth.is_file():
            shutil.copy2(real_auth, codex_dir / "auth.json")

        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": str(tmp_home),
            "CODEX_TOKEN": os.environ.get("CODEX_TOKEN", ""),
            "OPENAI_API_KEY": os.environ.get("OPENAI_API_KEY", ""),
        }

        proc = subprocess.run(
            ["codex", "exec", "--full-auto", "--skip-git-repo-check", "--ephemeral"],
            input=prompt,
            text=True,
            capture_output=True,
            timeout=timeout,
            env=env,
            cwd=tmpdir,
        )

        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()

        if proc.returncode != 0 and not stdout:
            if not stderr:
                stderr = f"codex exited with code {proc.returncode}"
            raise RuntimeError(_trim_error(stderr))

        content = _extract_assistant_content(stdout)
        if not content:
            raise RuntimeError("codex returned empty output")

        return content
