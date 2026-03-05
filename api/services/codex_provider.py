"""Codex CLI subprocess wrapper."""
import asyncio
import os
import re
import signal
import tempfile

from services.ai_provider import AIProvider

CODEX_TIMEOUT = 120  # seconds


class CodexProvider(AIProvider):
    def name(self) -> str:
        return "codex"

    async def generate(self, prompt: str) -> str:
        with tempfile.TemporaryDirectory() as tmpdir:
            env = {
                "PATH": os.environ.get("PATH", ""),
                "HOME": os.environ.get("HOME", tmpdir),
            }
            # Pass explicit keys if set
            for key in ("CODEX_TOKEN", "OPENAI_API_KEY"):
                val = os.environ.get(key)
                if val:
                    env[key] = val

            # Write a minimal config that disables MCP servers to avoid startup latency
            codex_dir = os.path.join(tmpdir, ".codex")
            os.makedirs(codex_dir, exist_ok=True)
            with open(os.path.join(codex_dir, "config.toml"), "w") as cf:
                cf.write('[mcp_servers]\n')  # empty = no MCP servers

            # Copy auth from real home
            real_home = os.environ.get("HOME", "")
            real_auth = os.path.join(real_home, ".codex", "auth.json")
            if os.path.exists(real_auth):
                import shutil
                shutil.copy2(real_auth, os.path.join(codex_dir, "auth.json"))

            env["HOME"] = tmpdir  # use tmpdir HOME with our minimal config

            proc = await asyncio.create_subprocess_exec(
                "codex", "exec", "--full-auto", "--skip-git-repo-check", "--ephemeral",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=tmpdir,
                env=env,
                start_new_session=True,  # new process group for clean kill
            )

            try:
                # Pass prompt via stdin
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(input=prompt.encode("utf-8")),
                    timeout=CODEX_TIMEOUT,
                )
            except asyncio.TimeoutError:
                # Kill entire process group (codex + MCP children)
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    proc.kill()
                try:
                    await asyncio.wait_for(proc.communicate(), timeout=5)
                except (asyncio.TimeoutError, ProcessLookupError):
                    pass
                raise RuntimeError(f"Codex timed out after {CODEX_TIMEOUT}s")

            output = stdout.decode("utf-8", errors="replace")
            output = _strip_ansi(output).strip()

            if proc.returncode != 0 and not output:
                err = stderr.decode("utf-8", errors="replace").strip()
                raise RuntimeError(f"Codex failed: {_truncate_error(err)}")

            return _extract_content(output)


def _strip_ansi(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*m", "", text)


def _truncate_error(err: str) -> str:
    """Extract meaningful error from Codex stderr, stripping session metadata and prompt echo."""
    # Look for the first meaningful error line before session metadata
    lines = err.split("\n")
    error_lines = []
    for line in lines:
        # Stop at session metadata or prompt echo
        if line.startswith("--------") or line.startswith("session id:") or line.startswith("user"):
            break
        stripped = line.strip()
        if stripped and not stripped.startswith("Reading prompt from stdin"):
            error_lines.append(stripped)
    if error_lines:
        return " ".join(error_lines)[:300]
    # Fallback: first 300 chars
    return err[:300]


def _extract_content(text: str) -> str:
    """Extract AI response content, stripping Codex CLI metadata."""
    # Strip Codex CLI session header (everything before the actual response)
    # Codex output format: metadata... -------- user\n<prompt> assistant\n<response>
    # Look for the last "assistant" marker followed by the actual response
    assistant_match = re.search(r"\bassistant\s*\n", text)
    if assistant_match:
        text = text[assistant_match.end():]

    # Try to extract JSON from code fences
    match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()
