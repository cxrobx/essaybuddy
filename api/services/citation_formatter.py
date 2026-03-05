from enum import Enum
from typing import Optional


class CitationStyle(str, Enum):
    APA7 = "apa7"
    MLA9 = "mla9"
    CHICAGO_NOTES = "chicago-notes"
    CHICAGO_AUTHOR = "chicago-author"
    IEEE = "ieee"
    HARVARD = "harvard"


def format_citation(metadata: dict, style: str) -> str:
    """Format a citation from CrossRef metadata or S2 paper data."""
    # Extract common fields
    authors = _get_authors(metadata)
    title = _get_title(metadata)
    year = _get_year(metadata)
    journal = _get_journal(metadata)
    volume = metadata.get("volume", "")
    issue = metadata.get("issue", "")
    pages = _get_pages(metadata)
    doi = _get_doi(metadata)

    formatter = {
        "apa7": _format_apa7,
        "mla9": _format_mla9,
        "chicago-notes": _format_chicago_notes,
        "chicago-author": _format_chicago_author,
        "ieee": _format_ieee,
        "harvard": _format_harvard,
    }.get(style, _format_apa7)

    return formatter(authors, title, year, journal, volume, issue, pages, doi)


def _get_authors(meta: dict) -> list[str]:
    """Extract author names from CrossRef or S2 format."""
    # CrossRef format
    if "author" in meta:
        names = []
        for a in meta["author"]:
            given = a.get("given", "")
            family = a.get("family", "")
            if family:
                names.append(f"{family}, {given}".strip(", "))
            elif a.get("name"):
                names.append(a["name"])
        return names
    # S2 format
    if "authors" in meta:
        return [a.get("name", "") for a in meta["authors"] if a.get("name")]
    return []


def _get_title(meta: dict) -> str:
    if "title" in meta:
        t = meta["title"]
        if isinstance(t, list):
            return t[0] if t else ""
        return t
    return ""


def _get_year(meta: dict) -> str:
    if "year" in meta and meta["year"]:
        return str(meta["year"])
    if "published" in meta:
        parts = meta["published"].get("date-parts", [[]])
        if parts and parts[0]:
            return str(parts[0][0])
    if "issued" in meta:
        parts = meta["issued"].get("date-parts", [[]])
        if parts and parts[0]:
            return str(parts[0][0])
    return "n.d."


def _get_journal(meta: dict) -> str:
    if "container-title" in meta:
        ct = meta["container-title"]
        if isinstance(ct, list):
            return ct[0] if ct else ""
        return ct
    if "journal" in meta:
        return meta["journal"]
    return ""


def _get_pages(meta: dict) -> str:
    return meta.get("page", "")


def _get_doi(meta: dict) -> str:
    if "DOI" in meta:
        return meta["DOI"]
    if "doi" in meta and meta["doi"]:
        return meta["doi"]
    return ""


def _format_author_list_apa(authors: list[str]) -> str:
    if not authors:
        return ""
    if len(authors) == 1:
        return authors[0]
    if len(authors) == 2:
        return f"{authors[0]} & {authors[1]}"
    if len(authors) <= 20:
        return ", ".join(authors[:-1]) + ", & " + authors[-1]
    return ", ".join(authors[:19]) + ", ... " + authors[-1]


def _format_apa7(authors, title, year, journal, volume, issue, pages, doi) -> str:
    parts = []
    author_str = _format_author_list_apa(authors)
    if author_str:
        parts.append(f"{author_str}")
    parts.append(f"({year}).")
    parts.append(f"{title}.")
    if journal:
        j = f"*{journal}*"
        if volume:
            j += f", *{volume}*"
        if issue:
            j += f"({issue})"
        if pages:
            j += f", {pages}"
        j += "."
        parts.append(j)
    if doi:
        parts.append(f"https://doi.org/{doi}")
    return " ".join(parts)


def _format_mla9(authors, title, year, journal, volume, issue, pages, doi) -> str:
    parts = []
    if authors:
        if len(authors) == 1:
            parts.append(f"{authors[0]}.")
        elif len(authors) == 2:
            parts.append(f"{authors[0]}, and {authors[1]}.")
        else:
            parts.append(f"{authors[0]}, et al.")
    parts.append(f'"{title}."')
    if journal:
        j = f"*{journal}*"
        if volume:
            j += f", vol. {volume}"
        if issue:
            j += f", no. {issue}"
        if year:
            j += f", {year}"
        if pages:
            j += f", pp. {pages}"
        j += "."
        parts.append(j)
    if doi:
        parts.append(f"https://doi.org/{doi}")
    return " ".join(parts)


def _format_chicago_notes(authors, title, year, journal, volume, issue, pages, doi) -> str:
    parts = []
    if authors:
        names = []
        for i, a in enumerate(authors):
            if i == 0:
                names.append(a)
            else:
                # Reverse "Last, First" to "First Last" for subsequent authors
                name_parts = a.split(", ", 1)
                if len(name_parts) == 2:
                    names.append(f"{name_parts[1]} {name_parts[0]}")
                else:
                    names.append(a)
        if len(names) <= 3:
            parts.append(", ".join(names[:-1]) + " and " + names[-1] if len(names) > 1 else names[0])
        else:
            parts.append(f"{names[0]} et al.")
    parts[-1] = parts[-1] + "," if parts else ""
    parts.append(f'"{title},"')
    if journal:
        j = f"*{journal}*"
        if volume:
            j += f" {volume}"
        if issue:
            j += f", no. {issue}"
        if year:
            j += f" ({year})"
        if pages:
            j += f": {pages}"
        j += "."
        parts.append(j)
    if doi:
        parts.append(f"https://doi.org/{doi}")
    return " ".join(parts)


def _format_chicago_author(authors, title, year, journal, volume, issue, pages, doi) -> str:
    parts = []
    if authors:
        if len(authors) <= 3:
            parts.append(", ".join(authors) + ".")
        else:
            parts.append(f"{authors[0]}, et al.")
    parts.append(f"{year}.")
    parts.append(f'"{title}."')
    if journal:
        j = f"*{journal}*"
        if volume:
            j += f" {volume}"
        if issue:
            j += f", no. {issue}"
        if pages:
            j += f": {pages}"
        j += "."
        parts.append(j)
    if doi:
        parts.append(f"https://doi.org/{doi}")
    return " ".join(parts)


def _format_ieee(authors, title, year, journal, volume, issue, pages, doi) -> str:
    parts = []
    if authors:
        # IEEE uses initials: "J. Smith"
        ieee_names = []
        for a in authors:
            name_parts = a.split(", ", 1)
            if len(name_parts) == 2:
                initials = ". ".join(w[0] for w in name_parts[1].split() if w) + "."
                ieee_names.append(f"{initials} {name_parts[0]}")
            else:
                ieee_names.append(a)
        if len(ieee_names) <= 6:
            parts.append(", ".join(ieee_names[:-1]) + " and " + ieee_names[-1] if len(ieee_names) > 1 else ieee_names[0])
        else:
            parts.append(", ".join(ieee_names[:6]) + ", et al.")
        parts[-1] += ","
    parts.append(f'"{title},"')
    if journal:
        j = f"*{journal}*"
        if volume:
            j += f", vol. {volume}"
        if issue:
            j += f", no. {issue}"
        if pages:
            j += f", pp. {pages}"
        if year:
            j += f", {year}"
        j += "."
        parts.append(j)
    if doi:
        parts.append(f"doi: {doi}.")
    return " ".join(parts)


def _format_harvard(authors, title, year, journal, volume, issue, pages, doi) -> str:
    parts = []
    if authors:
        if len(authors) <= 3:
            parts.append(", ".join(authors))
        else:
            parts.append(f"{authors[0]} et al.")
    parts.append(f"({year})")
    parts.append(f"'{title}',")
    if journal:
        j = f"*{journal}*"
        if volume:
            j += f", {volume}"
        if issue:
            j += f"({issue})"
        if pages:
            j += f", pp. {pages}"
        j += "."
        parts.append(j)
    if doi:
        parts.append(f"doi: {doi}.")
    return " ".join(parts)
