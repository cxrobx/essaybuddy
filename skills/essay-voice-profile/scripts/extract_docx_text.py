#!/usr/bin/env python3
"""Extract plain text from DOCX essays without third-party dependencies."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _read_docx_text(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as docx_zip:
            xml_bytes = docx_zip.read("word/document.xml")
    except KeyError as exc:
        raise ValueError(f"{path} is missing word/document.xml") from exc
    except zipfile.BadZipFile as exc:
        raise ValueError(f"{path} is not a valid DOCX archive") from exc

    root = ET.fromstring(xml_bytes)
    paragraphs: list[str] = []
    for paragraph in root.iter(f"{{{W_NS}}}p"):
        fragments: list[str] = []
        for text_node in paragraph.iter(f"{{{W_NS}}}t"):
            if text_node.text:
                fragments.append(text_node.text)
        joined = "".join(fragments).strip()
        if joined:
            paragraphs.append(joined)

    if not paragraphs:
        return ""
    return "\n\n".join(paragraphs) + "\n"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract text from one or more DOCX files into .txt files."
    )
    parser.add_argument("docx_paths", nargs="+", help="Path(s) to .docx files")
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Directory for generated .txt files (default: current directory)",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Print extracted text to stdout (single input only)",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    input_paths = [Path(p).expanduser() for p in args.docx_paths]

    if args.stdout and len(input_paths) != 1:
        print("--stdout supports exactly one input file.", file=sys.stderr)
        return 2

    output_dir = Path(args.output_dir).expanduser()
    if not args.stdout:
        output_dir.mkdir(parents=True, exist_ok=True)

    had_errors = False
    for input_path in input_paths:
        if input_path.suffix.lower() != ".docx":
            print(f"Skipping non-DOCX file: {input_path}", file=sys.stderr)
            had_errors = True
            continue
        if not input_path.exists():
            print(f"File not found: {input_path}", file=sys.stderr)
            had_errors = True
            continue

        try:
            extracted = _read_docx_text(input_path)
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            had_errors = True
            continue

        if args.stdout:
            sys.stdout.write(extracted)
            continue

        out_path = output_dir / f"{input_path.stem}.txt"
        out_path.write_text(extracted, encoding="utf-8")
        print(f"Wrote {out_path}")

    return 1 if had_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
