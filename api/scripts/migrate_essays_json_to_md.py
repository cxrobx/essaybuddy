#!/usr/bin/env python3
"""Migrate legacy .json essay files to .md with YAML frontmatter.

Usage:
    python api/scripts/migrate_essays_json_to_md.py             # real migration
    python api/scripts/migrate_essays_json_to_md.py --dry-run   # report only
"""
import argparse
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

import frontmatter

# Default data root
DATA_ROOT = Path(os.environ.get("DATA_ROOT", Path(__file__).resolve().parent.parent / "data"))


# ---------------------------------------------------------------------------
# TipTap JSON → Markdown conversion
# ---------------------------------------------------------------------------

def _inline_marks(node: dict) -> str:
    """Apply inline marks (bold, italic, strike, code) to text."""
    text = node.get("text", "")
    for mark in node.get("marks", []):
        t = mark.get("type", "")
        if t == "bold":
            text = f"**{text}**"
        elif t == "italic":
            text = f"*{text}*"
        elif t == "strike":
            text = f"~~{text}~~"
        elif t == "code":
            text = f"`{text}`"
    return text


def _render_inline(nodes: list) -> str:
    """Render inline content nodes to markdown text."""
    parts = []
    for node in nodes:
        ntype = node.get("type", "")
        if ntype == "text":
            parts.append(_inline_marks(node))
        elif ntype == "hardBreak":
            parts.append("  \n")
        else:
            parts.append(node.get("text", ""))
    return "".join(parts)


def _convert_node(node: dict, list_indent: int = 0) -> str:
    """Recursively convert a TipTap JSON node to markdown."""
    ntype = node.get("type", "")
    content = node.get("content", [])

    if ntype == "doc":
        return "\n\n".join(_convert_node(c) for c in content).strip()

    if ntype == "heading":
        level = node.get("attrs", {}).get("level", 1)
        text = _render_inline(content)
        return f"{'#' * level} {text}"

    if ntype == "paragraph":
        return _render_inline(content)

    if ntype == "blockquote":
        inner = "\n\n".join(_convert_node(c) for c in content)
        return "\n".join(f"> {line}" for line in inner.splitlines())

    if ntype == "codeBlock":
        lang = node.get("attrs", {}).get("language", "")
        code = _render_inline(content)
        return f"```{lang}\n{code}\n```"

    if ntype == "bulletList":
        items = []
        for child in content:
            items.append(_convert_list_item(child, ordered=False, indent=list_indent))
        return "\n".join(items)

    if ntype == "orderedList":
        items = []
        start = node.get("attrs", {}).get("start", 1)
        for i, child in enumerate(content):
            items.append(_convert_list_item(child, ordered=True, indent=list_indent, number=start + i))
        return "\n".join(items)

    if ntype == "listItem":
        inner = "\n\n".join(_convert_node(c, list_indent=list_indent + 1) for c in content)
        return inner

    if ntype == "horizontalRule":
        return "---"

    # Fallback: render inline content or return empty
    if content:
        return _render_inline(content)
    return ""


def _convert_list_item(node: dict, ordered: bool, indent: int, number: int = 1) -> str:
    """Convert a listItem node to a markdown list entry."""
    prefix_space = "  " * indent
    marker = f"{number}." if ordered else "-"
    parts = []
    for i, child in enumerate(node.get("content", [])):
        if child.get("type") in ("bulletList", "orderedList"):
            parts.append(_convert_node(child, list_indent=indent + 1))
        else:
            text = _convert_node(child, list_indent=indent)
            if i == 0:
                parts.append(f"{prefix_space}{marker} {text}")
            else:
                parts.append(f"{prefix_space}  {text}")
    return "\n".join(parts)


def tiptap_to_markdown(tiptap_json) -> str:
    """Convert TipTap JSON content to markdown string.

    Args:
        tiptap_json: Either a dict (parsed JSON) or a string.
                     If it's already a plain string (not JSON), return as-is.
    """
    if isinstance(tiptap_json, str):
        try:
            tiptap_json = json.loads(tiptap_json)
        except (json.JSONDecodeError, ValueError):
            # Already plain text / markdown
            return tiptap_json

    if not isinstance(tiptap_json, dict):
        return str(tiptap_json)

    return _convert_node(tiptap_json)


# ---------------------------------------------------------------------------
# Migration logic
# ---------------------------------------------------------------------------

def migrate(data_root: Path, dry_run: bool = False) -> dict:
    essays_dir = data_root / "essays"
    if not essays_dir.exists():
        return {"status": "no_essays_dir", "migrated": [], "skipped": [], "errors": []}

    json_files = sorted(essays_dir.glob("*.json"))
    # Exclude outline sidecars
    json_files = [f for f in json_files if not f.name.endswith(".outline.json")]

    if not json_files:
        return {"status": "nothing_to_migrate", "migrated": [], "skipped": [], "errors": []}

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = essays_dir / f"_legacy_json_backup_{timestamp}"

    migrated = []
    skipped = []
    errors = []

    for jf in json_files:
        essay_id = jf.stem
        md_path = essays_dir / f"{essay_id}.md"

        # Skip if .md already exists
        if md_path.exists():
            skipped.append({"id": essay_id, "reason": ".md already exists"})
            continue

        try:
            data = json.loads(jf.read_text(encoding="utf-8"))

            # Convert content
            raw_content = data.get("content", "")
            content = tiptap_to_markdown(raw_content)

            # Build frontmatter post
            post = frontmatter.Post(content)
            for key in ("title", "topic", "thesis", "profile_id", "citation_style", "created_at", "updated_at"):
                val = data.get(key)
                if val is not None:
                    post.metadata[key] = val

            if not dry_run:
                # Backup original
                backup_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy2(jf, backup_dir / jf.name)

                # Write .md
                md_path.write_text(frontmatter.dumps(post), encoding="utf-8")

                # Migrate outline to sidecar if present
                outline = data.get("outline")
                if outline and isinstance(outline, list) and len(outline) > 0:
                    outline_path = essays_dir / f"{essay_id}.outline.json"
                    if not outline_path.exists():
                        outline_path.write_text(json.dumps(outline, indent=2), encoding="utf-8")

                # Remove legacy .json
                jf.unlink()

            migrated.append({"id": essay_id, "title": data.get("title", "Untitled")})

        except Exception as e:
            errors.append({"id": essay_id, "error": str(e)})
            continue

    report = {
        "status": "dry_run" if dry_run else "completed",
        "timestamp": timestamp,
        "migrated": migrated,
        "skipped": skipped,
        "errors": errors,
    }

    # Write report
    if not dry_run and migrated:
        report_path = essays_dir / f"migration-report-{timestamp}.json"
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    return report


def main():
    parser = argparse.ArgumentParser(description="Migrate legacy .json essays to .md with frontmatter")
    parser.add_argument("--dry-run", action="store_true", help="Report only, no writes")
    parser.add_argument("--data-root", type=str, default=None, help="Override DATA_ROOT")
    args = parser.parse_args()

    root = Path(args.data_root) if args.data_root else DATA_ROOT
    print(f"Data root: {root}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE MIGRATION'}")
    print()

    report = migrate(root, dry_run=args.dry_run)

    print(f"Status: {report['status']}")
    print(f"Migrated: {len(report['migrated'])}")
    for m in report["migrated"]:
        print(f"  - {m['id']}: {m['title']}")
    print(f"Skipped: {len(report['skipped'])}")
    for s in report["skipped"]:
        print(f"  - {s['id']}: {s['reason']}")
    if report["errors"]:
        print(f"Errors: {len(report['errors'])}")
        for e in report["errors"]:
            print(f"  - {e['id']}: {e['error']}")

    if report["errors"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
