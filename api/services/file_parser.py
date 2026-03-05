"""Extract plain text from uploaded documents."""
from pathlib import Path


def extract_text(file_path: Path, content_type: str) -> str:
    if content_type == "text/plain":
        return file_path.read_text(encoding="utf-8", errors="replace")

    if content_type == "application/pdf":
        return _extract_pdf(file_path)

    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _extract_docx(file_path)

    raise ValueError(f"Unsupported content type: {content_type}")


def _extract_pdf(file_path: Path) -> str:
    from PyPDF2 import PdfReader

    try:
        reader = PdfReader(str(file_path))
    except Exception as e:
        if "encrypted" in str(e).lower() or "password" in str(e).lower():
            raise ValueError("Encrypted PDFs are not supported")
        raise ValueError(f"Failed to read PDF: {e}")

    if reader.is_encrypted:
        raise ValueError("Encrypted PDFs are not supported")

    if len(reader.pages) > 100:
        raise ValueError("PDF too large (max 100 pages)")

    text_parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)
    return "\n\n".join(text_parts)


def extract_pdf_pages(file_path: Path) -> list[dict]:
    """Extract text from each page of a PDF, returning list of {page, text}."""
    from PyPDF2 import PdfReader

    try:
        reader = PdfReader(str(file_path))
    except Exception as e:
        if "encrypted" in str(e).lower() or "password" in str(e).lower():
            raise ValueError("Encrypted PDFs are not supported")
        raise ValueError(f"Failed to read PDF: {e}")

    if reader.is_encrypted:
        raise ValueError("Encrypted PDFs are not supported")

    if len(reader.pages) > 500:
        raise ValueError("PDF too large (max 500 pages)")

    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        pages.append({"page": i + 1, "text": text})
    return pages


def _extract_docx(file_path: Path) -> str:
    from docx import Document

    doc = Document(str(file_path))
    return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
