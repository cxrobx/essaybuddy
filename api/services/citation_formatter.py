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


# ---------------------------------------------------------------------------
# Book citation formatting
# ---------------------------------------------------------------------------

def _parse_book_authors(metadata: dict) -> list[str]:
    """Extract author names from book metadata."""
    author = metadata.get("author", "")
    if not author:
        return []
    # Split on semicolons or " and "
    if ";" in author:
        return [a.strip() for a in author.split(";") if a.strip()]
    if " and " in author.lower():
        import re
        return [a.strip() for a in re.split(r"\s+and\s+", author, flags=re.IGNORECASE) if a.strip()]
    return [author.strip()] if author.strip() else []


def _book_year(metadata: dict) -> str:
    year = metadata.get("year")
    if year:
        return str(year)
    return "n.d."


def format_book_citation(metadata: dict, style: str) -> str:
    """Format a citation for a book source."""
    authors = _parse_book_authors(metadata)
    title = metadata.get("title", "Untitled")
    year = _book_year(metadata)
    publisher = metadata.get("publisher", "")
    edition = metadata.get("edition", "")
    city = metadata.get("city", "")
    editors = metadata.get("editors", "")

    formatter = {
        "apa7": _format_book_apa7,
        "mla9": _format_book_mla9,
        "chicago-notes": _format_book_chicago_notes,
        "chicago-author": _format_book_chicago_author,
        "ieee": _format_book_ieee,
        "harvard": _format_book_harvard,
    }.get(style, _format_book_apa7)

    return formatter(authors, title, year, publisher, edition, city, editors)


def _format_book_apa7(authors, title, year, publisher, edition, city, editors) -> str:
    parts = []
    author_str = _format_author_list_apa(authors)
    if author_str:
        parts.append(f"{author_str}")
    parts.append(f"({year}).")
    t = f"*{title}*"
    if edition:
        t += f" ({edition})"
    parts.append(f"{t}.")
    if publisher:
        parts.append(f"{publisher}.")
    return " ".join(parts)


def _format_book_mla9(authors, title, year, publisher, edition, city, editors) -> str:
    parts = []
    if authors:
        if len(authors) == 1:
            parts.append(f"{authors[0]}.")
        elif len(authors) == 2:
            parts.append(f"{authors[0]}, and {authors[1]}.")
        else:
            parts.append(f"{authors[0]}, et al.")
    t = f"*{title}*."
    parts.append(t)
    if edition:
        parts.append(f"{edition},")
    if publisher:
        pub = f"{publisher},"
        parts.append(pub)
    if year:
        parts.append(f"{year}.")
    return " ".join(parts)


def _format_book_chicago_notes(authors, title, year, publisher, edition, city, editors) -> str:
    parts = []
    if authors:
        names = []
        for i, a in enumerate(authors):
            if i == 0:
                names.append(a)
            else:
                name_parts = a.split(", ", 1)
                if len(name_parts) == 2:
                    names.append(f"{name_parts[1]} {name_parts[0]}")
                else:
                    names.append(a)
        if len(names) <= 3:
            parts.append(", ".join(names[:-1]) + " and " + names[-1] if len(names) > 1 else names[0])
        else:
            parts.append(f"{names[0]} et al.")
        parts[-1] += ","
    t = f"*{title}*"
    if edition:
        t += f", {edition}"
    parts.append(t)
    location = []
    if city:
        location.append(city)
    if publisher:
        location.append(publisher)
    if location:
        parts.append(f"({', '.join(location)}, {year})." if year else f"({', '.join(location)}).")
    elif year:
        parts.append(f"({year}).")
    return " ".join(parts)


def _format_book_chicago_author(authors, title, year, publisher, edition, city, editors) -> str:
    parts = []
    if authors:
        if len(authors) <= 3:
            parts.append(", ".join(authors) + ".")
        else:
            parts.append(f"{authors[0]}, et al.")
    parts.append(f"{year}.")
    t = f"*{title}*."
    if edition:
        t = f"*{title}*, {edition}."
    parts.append(t)
    location = []
    if city:
        location.append(city)
    if publisher:
        location.append(publisher)
    if location:
        parts.append(f"{': '.join(location)}.")
    return " ".join(parts)


def _format_book_ieee(authors, title, year, publisher, edition, city, editors) -> str:
    parts = []
    if authors:
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
    parts.append(f"*{title}*" + (f", {edition}" if edition else "") + ".")
    location = []
    if city:
        location.append(city)
    if publisher:
        location.append(publisher)
    if location:
        parts.append(f"{': '.join(location)},")
    if year:
        parts.append(f"{year}.")
    return " ".join(parts)


def _format_book_harvard(authors, title, year, publisher, edition, city, editors) -> str:
    parts = []
    if authors:
        if len(authors) <= 3:
            parts.append(", ".join(authors))
        else:
            parts.append(f"{authors[0]} et al.")
    parts.append(f"({year})")
    t = f"*{title}*"
    if edition:
        t += f", {edition}"
    parts.append(f"{t}.")
    location = []
    if city:
        location.append(city)
    if publisher:
        location.append(publisher)
    if location:
        parts.append(f"{': '.join(location)}.")
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Web source citation formatting
# ---------------------------------------------------------------------------

def _parse_web_date(date_str: str) -> tuple[str, str, str]:
    """Parse a date string into (year, month_name, day). Returns 'n.d.' for year if unparseable."""
    if not date_str:
        return ("n.d.", "", "")
    # Try ISO format: 2024-01-15 or 2024-01-15T...
    import re
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", date_str)
    if m:
        months = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
        yr = m.group(1)
        mo_idx = int(m.group(2)) - 1
        day = m.group(3).lstrip("0")
        mo = months[mo_idx] if 0 <= mo_idx < 12 else ""
        return (yr, mo, day)
    # Try just year
    m = re.match(r"(\d{4})", date_str)
    if m:
        return (m.group(1), "", "")
    return ("n.d.", "", "")


def _format_accessed_date(accessed_at: str) -> str:
    """Format accessed_at ISO timestamp to readable date."""
    yr, mo, day = _parse_web_date(accessed_at)
    if mo and day:
        return f"{mo} {day}, {yr}"
    return yr


def format_web_citation(metadata: dict, style: str) -> str:
    """Format a citation for a web source."""
    author = metadata.get("author", "")
    title = metadata.get("title", "Untitled")
    site_name = metadata.get("site_name", "")
    date_published = metadata.get("date_published", "")
    url = metadata.get("url", "")
    accessed_at = metadata.get("accessed_at", "")

    year, month, day = _parse_web_date(date_published)

    formatter = {
        "apa7": _format_web_apa7,
        "mla9": _format_web_mla9,
        "chicago-notes": _format_web_chicago_notes,
        "chicago-author": _format_web_chicago_author,
        "ieee": _format_web_ieee,
        "harvard": _format_web_harvard,
    }.get(style, _format_web_apa7)

    return formatter(author, title, site_name, year, month, day, url, accessed_at)


def _format_web_apa7(author, title, site_name, year, month, day, url, accessed_at) -> str:
    parts = []
    if author:
        parts.append(f"{author}.")
    date_str = f"({year}"
    if month:
        date_str += f", {month}"
        if day:
            date_str += f" {day}"
    date_str += ")."
    parts.append(date_str)
    parts.append(f"*{title}*.")
    if site_name:
        parts.append(f"{site_name}.")
    if url:
        parts.append(url)
    return " ".join(parts)


def _format_web_mla9(author, title, site_name, year, month, day, url, accessed_at) -> str:
    parts = []
    if author:
        parts.append(f"{author}.")
    parts.append(f'"{title}."')
    if site_name:
        site_part = f"*{site_name}*"
        if day and month:
            site_part += f", {day} {month} {year}"
        elif year != "n.d.":
            site_part += f", {year}"
        site_part += ","
        parts.append(site_part)
    if url:
        parts.append(f"{url}.")
    if accessed_at:
        parts.append(f"Accessed {_format_accessed_date(accessed_at)}.")
    return " ".join(parts)


def _format_web_chicago_notes(author, title, site_name, year, month, day, url, accessed_at) -> str:
    parts = []
    if author:
        parts.append(f"{author},")
    parts.append(f'"{title},"')
    if site_name:
        parts.append(f"{site_name},")
    if month and day:
        parts.append(f"{month} {day}, {year},")
    elif year != "n.d.":
        parts.append(f"{year},")
    if url:
        parts.append(f"{url}.")
    return " ".join(parts)


def _format_web_chicago_author(author, title, site_name, year, month, day, url, accessed_at) -> str:
    parts = []
    if author:
        parts.append(f"{author}.")
    parts.append(f"{year}.")
    parts.append(f'"{title}."')
    if site_name:
        parts.append(f"{site_name}.")
    if month and day:
        parts.append(f"{month} {day}.")
    if url:
        parts.append(url)
    return " ".join(parts)


def _format_web_ieee(author, title, site_name, year, month, day, url, accessed_at) -> str:
    parts = []
    if author:
        parts.append(f"{author},")
    parts.append(f'"{title},"')
    if site_name:
        parts.append(f"*{site_name}*.")
    parts.append("[Online].")
    if url:
        parts.append(f"Available: {url}.")
    if accessed_at:
        parts.append(f"[Accessed: {_format_accessed_date(accessed_at)}].")
    return " ".join(parts)


def _format_web_harvard(author, title, site_name, year, month, day, url, accessed_at) -> str:
    parts = []
    if author:
        parts.append(author)
    parts.append(f"({year})")
    parts.append(f"'{title}',")
    if site_name:
        parts.append(f"*{site_name}*,")
    if month and day:
        parts.append(f"{day} {month},")
    if url:
        url_part = f"Available at: {url}"
        if accessed_at:
            url_part += f" (Accessed: {_format_accessed_date(accessed_at)})"
        url_part += "."
        parts.append(url_part)
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Dispatcher for any source type
# ---------------------------------------------------------------------------

def format_source_citation(source_type: str, metadata: dict, style: str) -> str:
    """Format a citation based on source type."""
    if source_type == "book":
        return format_book_citation(metadata, style)
    elif source_type == "web":
        return format_web_citation(metadata, style)
    else:
        # Fall back to research paper formatter
        return format_citation(metadata, style)
