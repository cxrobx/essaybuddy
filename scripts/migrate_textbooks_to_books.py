#!/usr/bin/env python3
"""Migrate data/textbooks/ to data/books/ and update evidence references.

Idempotent: skips files that already exist at the destination.

Usage:
    python3 scripts/migrate_textbooks_to_books.py [--data-root ./data]
"""
import argparse
import json
import os
import shutil
from pathlib import Path


def migrate(data_root: Path) -> None:
    tb_dir = data_root / "textbooks"
    bk_dir = data_root / "books"
    ev_dir = data_root / "evidence"

    if not tb_dir.exists():
        print(f"No textbooks directory at {tb_dir}, nothing to migrate.")
        return

    # Ensure books dirs exist
    bk_dir.mkdir(parents=True, exist_ok=True)
    (bk_dir / "files").mkdir(parents=True, exist_ok=True)

    # 1. Move textbook JSON metadata files
    moved = 0
    for src in tb_dir.glob("*.json"):
        dst = bk_dir / src.name
        if dst.exists():
            print(f"  SKIP {src.name} (already exists in books/)")
            continue
        shutil.copy2(str(src), str(dst))
        print(f"  COPY {src.name} -> books/{src.name}")
        moved += 1
    print(f"Migrated {moved} textbook metadata files.")

    # 2. Move PDF files
    tb_files = tb_dir / "files"
    if tb_files.exists():
        pdf_moved = 0
        for src in tb_files.glob("*"):
            dst = bk_dir / "files" / src.name
            if dst.exists():
                print(f"  SKIP files/{src.name} (already exists)")
                continue
            shutil.copy2(str(src), str(dst))
            print(f"  COPY files/{src.name} -> books/files/{src.name}")
            pdf_moved += 1
        print(f"Migrated {pdf_moved} PDF files.")

    # 3. Update evidence JSON files: rename textbook_id -> book_id, textbook_title -> source_title
    if ev_dir.exists():
        updated = 0
        for ev_file in ev_dir.glob("*.json"):
            try:
                data = json.loads(ev_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue

            changed = False
            for item in data.get("items", []):
                if "textbook_id" in item and "book_id" not in item:
                    item["book_id"] = item.pop("textbook_id")
                    changed = True
                if "textbook_title" in item and "source_title" not in item:
                    item["source_title"] = item.pop("textbook_title")
                    changed = True
                if "source_type" not in item:
                    item["source_type"] = "book"
                    changed = True

            if changed:
                tmp = ev_file.with_suffix(".json.tmp")
                tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
                os.replace(str(tmp), str(ev_file))
                updated += 1
                print(f"  UPDATED evidence/{ev_file.name}")

        print(f"Updated {updated} evidence files.")

    print("Migration complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate textbooks to books")
    parser.add_argument("--data-root", default="./data", help="Path to data directory")
    args = parser.parse_args()
    migrate(Path(args.data_root))
