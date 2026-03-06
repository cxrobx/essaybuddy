"""Tests for paper_matcher service."""
import os
import tempfile

os.environ.setdefault("DATA_ROOT", tempfile.mkdtemp())

from services.paper_matcher import match_papers_to_section, match_papers_to_sections


def _paper(pid: str, title: str, abstract: str = "", tldr: str = "", fields: list = None):
    return {
        "paper_id": pid,
        "title": title,
        "abstract": abstract,
        "tldr": tldr,
        "fields_of_study": fields or [],
    }


def test_match_returns_relevant_papers():
    papers = [
        _paper("p1", "Climate Change and Rising Sea Levels", tldr="Study on climate change effects on coastal regions"),
        _paper("p2", "Machine Learning in Healthcare", tldr="Neural networks for medical diagnosis"),
        _paper("p3", "Global Warming Impact on Agriculture", tldr="Climate effects on crop yields worldwide"),
    ]
    result = match_papers_to_section("Climate Change Effects", "Impact on environment and ecosystems", papers)
    assert "p1" in result
    assert "p3" in result
    # ML healthcare paper should not match climate change section
    assert "p2" not in result


def test_match_caps_at_max():
    papers = [
        _paper(f"p{i}", f"Climate Paper {i}", tldr=f"Climate change study number {i}")
        for i in range(10)
    ]
    result = match_papers_to_section("Climate Change", "Global warming effects", papers, max_papers=3)
    assert len(result) <= 3


def test_match_threshold_filters_irrelevant():
    papers = [
        _paper("p1", "Quantum Computing Advances", tldr="Quantum bit error correction in superconductors"),
    ]
    result = match_papers_to_section("Climate Change Effects", "Impact on environment", papers, threshold=0.1)
    assert result == []


def test_match_empty_papers_list():
    result = match_papers_to_section("Some Title", "Some notes", [])
    assert result == []


def test_match_no_abstract_uses_title():
    papers = [
        _paper("p1", "Climate Change and Environmental Policy"),
    ]
    result = match_papers_to_section("Environmental Policy", "Climate regulations", papers, threshold=0.05)
    assert "p1" in result


def test_match_papers_to_sections_batch():
    papers = [
        _paper("p1", "Climate Change Impacts", tldr="Effects of global warming"),
        _paper("p2", "Economic Policy Reform", tldr="Fiscal policy changes in developing nations"),
        _paper("p3", "Renewable Energy Sources", tldr="Solar and wind energy adoption"),
    ]
    sections = [
        {"title": "Climate Effects", "notes": "Global warming impact"},
        {"title": "Economic Implications", "notes": "Policy and fiscal effects"},
        {"title": "Energy Solutions", "notes": "Renewable and solar energy"},
    ]
    result = match_papers_to_sections(sections, papers, threshold=0.05)
    assert len(result) == 3
    # Each section should match its corresponding paper
    assert "p1" in result[0]
    assert "p2" in result[1]
    assert "p3" in result[2]


def test_match_empty_section_text():
    papers = [_paper("p1", "Some Paper", tldr="Some content")]
    result = match_papers_to_section("", "", papers)
    assert result == []
