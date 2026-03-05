"""
Path sandboxing — all file ops must go through these functions.
No path ever escapes DATA_ROOT.
"""
import os
from pathlib import Path
from typing import Optional
from fastapi import HTTPException

_data_root: Optional[Path] = None

WRITE_ALLOWED_DIRS = {"essays", "samples", "profiles", "textbooks", "evidence", "research"}


def set_data_root(path: str) -> None:
    global _data_root
    _data_root = Path(path).resolve()
    for d in WRITE_ALLOWED_DIRS:
        (_data_root / d).mkdir(parents=True, exist_ok=True)
    (_data_root / "samples" / "files").mkdir(parents=True, exist_ok=True)
    (_data_root / "textbooks" / "files").mkdir(parents=True, exist_ok=True)
    (_data_root / "evidence").mkdir(parents=True, exist_ok=True)
    (_data_root / "research" / "papers").mkdir(parents=True, exist_ok=True)


def data_root() -> Path:
    if _data_root is None:
        raise RuntimeError("sandbox not initialised")
    return _data_root


def resolve_safe(rel_path: str) -> Path:
    root = data_root()
    try:
        target = (root / rel_path).resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not str(target).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Path traversal denied")
    return target


def resolve_read_safe(rel_path: str) -> Path:
    target = resolve_safe(rel_path)
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Not found: {rel_path}")
    return target


def resolve_write_safe(rel_path: str) -> Path:
    target = resolve_safe(rel_path)
    root = data_root()
    rel = target.relative_to(root)
    top_dir = rel.parts[0] if rel.parts else ""
    if top_dir not in WRITE_ALLOWED_DIRS:
        raise HTTPException(
            status_code=403,
            detail=f"Writes only allowed in {WRITE_ALLOWED_DIRS}, got: {top_dir!r}",
        )
    return target


def atomic_write(path: Path, content: str) -> None:
    """Write to temp file then atomically rename to prevent corruption."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(str(tmp), str(path))
