"""AI provider abstraction."""
import os
from abc import ABC, abstractmethod

_current_provider: str = os.environ.get("AI_PROVIDER", "codex")


class AIProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str) -> str:
        """Send prompt and return generated text."""
        ...

    @abstractmethod
    def name(self) -> str: ...


def get_provider_name() -> str:
    return _current_provider


def set_provider_name(name: str) -> None:
    global _current_provider
    if name not in ("codex", "gemini"):
        raise ValueError(f"Unknown provider: {name}")
    _current_provider = name


def get_provider() -> AIProvider:
    if _current_provider == "codex":
        from services.codex_provider import CodexProvider
        return CodexProvider()
    elif _current_provider == "gemini":
        from services.gemini_provider import GeminiProvider
        return GeminiProvider()
    raise ValueError(f"Unknown provider: {_current_provider}")
