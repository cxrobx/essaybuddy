"""Tests for the JSON-to-MD migration script."""
import json
import tempfile
from pathlib import Path

import frontmatter
import pytest

from scripts.migrate_essays_json_to_md import migrate, tiptap_to_markdown


@pytest.fixture
def data_root(tmp_path):
    essays_dir = tmp_path / "essays"
    essays_dir.mkdir()
    return tmp_path


def _write_legacy(essays_dir: Path, essay_id: str, data: dict):
    (essays_dir / f"{essay_id}.json").write_text(json.dumps(data), encoding="utf-8")


def test_dry_run_does_not_write(data_root):
    _write_legacy(data_root / "essays", "e1", {
        "title": "Dry Run Essay",
        "content": "Hello world",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    })

    report = migrate(data_root, dry_run=True)
    assert report["status"] == "dry_run"
    assert len(report["migrated"]) == 1
    assert report["migrated"][0]["id"] == "e1"

    # .json should still exist, .md should NOT
    assert (data_root / "essays" / "e1.json").exists()
    assert not (data_root / "essays" / "e1.md").exists()


def test_real_migration(data_root):
    _write_legacy(data_root / "essays", "e1", {
        "title": "Real Essay",
        "topic": "Testing",
        "thesis": "It works",
        "content": "Paragraph one.",
        "outline": [{"id": "s1", "title": "Intro", "notes": ""}],
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    })

    report = migrate(data_root, dry_run=False)
    assert report["status"] == "completed"
    assert len(report["migrated"]) == 1

    # .json removed, .md created
    assert not (data_root / "essays" / "e1.json").exists()
    md_path = data_root / "essays" / "e1.md"
    assert md_path.exists()

    # Verify frontmatter
    post = frontmatter.loads(md_path.read_text(encoding="utf-8"))
    assert post.metadata["title"] == "Real Essay"
    assert post.metadata["thesis"] == "It works"
    assert post.content == "Paragraph one."

    # Outline sidecar created
    outline_path = data_root / "essays" / "e1.outline.json"
    assert outline_path.exists()

    # Backup exists
    backups = list((data_root / "essays").glob("_legacy_json_backup_*"))
    assert len(backups) == 1
    assert (backups[0] / "e1.json").exists()

    # Report file written
    reports = list((data_root / "essays").glob("migration-report-*.json"))
    assert len(reports) == 1


def test_skips_already_migrated(data_root):
    essays_dir = data_root / "essays"
    _write_legacy(essays_dir, "e1", {"title": "Already Done", "content": "Old"})
    # Pre-create .md
    (essays_dir / "e1.md").write_text("---\ntitle: Already Done\n---\nNew content", encoding="utf-8")

    report = migrate(data_root, dry_run=False)
    assert len(report["skipped"]) == 1
    assert len(report["migrated"]) == 0


def test_nothing_to_migrate(data_root):
    report = migrate(data_root, dry_run=False)
    assert report["status"] == "nothing_to_migrate"


def test_ignores_outline_sidecar_files(data_root):
    essays_dir = data_root / "essays"
    # Only an outline sidecar, no legacy essay
    (essays_dir / "e1.outline.json").write_text('[{"id":"s1"}]', encoding="utf-8")

    report = migrate(data_root, dry_run=False)
    assert report["status"] == "nothing_to_migrate"


# --- TipTap JSON conversion ---

def test_tiptap_plain_text_passthrough():
    assert tiptap_to_markdown("Just plain text") == "Just plain text"


def test_tiptap_heading_and_paragraph():
    doc = {
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Title"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Body text."}]},
        ]
    }
    result = tiptap_to_markdown(doc)
    assert "# Title" in result
    assert "Body text." in result


def test_tiptap_inline_marks():
    doc = {
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [
                {"type": "text", "text": "bold", "marks": [{"type": "bold"}]},
                {"type": "text", "text": " and "},
                {"type": "text", "text": "italic", "marks": [{"type": "italic"}]},
            ]}
        ]
    }
    result = tiptap_to_markdown(doc)
    assert "**bold**" in result
    assert "*italic*" in result


def test_tiptap_bullet_list():
    doc = {
        "type": "doc",
        "content": [
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": "Item one"}]}
                ]},
                {"type": "listItem", "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": "Item two"}]}
                ]},
            ]}
        ]
    }
    result = tiptap_to_markdown(doc)
    assert "- Item one" in result
    assert "- Item two" in result


def test_tiptap_blockquote():
    doc = {
        "type": "doc",
        "content": [
            {"type": "blockquote", "content": [
                {"type": "paragraph", "content": [{"type": "text", "text": "Quoted text"}]}
            ]}
        ]
    }
    result = tiptap_to_markdown(doc)
    assert "> Quoted text" in result
