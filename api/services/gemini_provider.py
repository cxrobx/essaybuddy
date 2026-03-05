"""Gemini CLI subprocess wrapper."""
import asyncio
import os
import re
import tempfile

from services.ai_provider import AIProvider

GEMINI_TIMEOUT = 120


class GeminiProvider(AIProvider):
    def name(self) -> str:
        return "gemini"

    async def generate(self, prompt: str) -> str:
        with tempfile.TemporaryDirectory() as tmpdir:
            env = {
                "PATH": os.environ.get("PATH", ""),
                "HOME": tmpdir,
                "GOOGLE_API_KEY": os.environ.get("GOOGLE_API_KEY", ""),
            }

            proc = await asyncio.create_subprocess_exec(
                "gemini", "--sandbox",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=tmpdir,
                env=env,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(input=prompt.encode("utf-8")),
                    timeout=GEMINI_TIMEOUT,
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                raise RuntimeError(f"Gemini timed out after {GEMINI_TIMEOUT}s")

            output = stdout.decode("utf-8", errors="replace")
            output = _strip_ansi(output).strip()

            if proc.returncode != 0 and not output:
                err = stderr.decode("utf-8", errors="replace").strip()
                raise RuntimeError(f"Gemini failed: {err}")

            return _extract_content(output)


def _strip_ansi(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*m", "", text)


def _extract_content(text: str) -> str:
    match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text
