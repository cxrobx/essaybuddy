"""AI generation endpoints."""
import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import Optional

import frontmatter
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.sandbox import data_root
from services.ai_provider import get_provider, get_provider_name, set_provider_name
from config.writing_types import get_writing_type

_HUMANIZE_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "humanize.md"

def _extract_json_array(text: str) -> Optional[list]:
    """Try hard to extract a JSON array from AI output that may contain extra text."""
    text = text.strip()
    # Direct parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass
    # Find first [ ... last ]
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        try:
            parsed = json.loads(text[start:end + 1])
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass
    return None

router = APIRouter(prefix="/ai", tags=["ai"])


class GenerateOutlineRequest(BaseModel):
    topic: str
    thesis: Optional[str] = None
    profile_id: str
    citation_style: Optional[str] = None
    instructions: Optional[str] = None
    target_word_count: Optional[int] = None
    essay_id: Optional[str] = None
    writing_type: Optional[str] = None


class ExpandSectionRequest(BaseModel):
    essay_id: str
    section_title: str
    section_notes: Optional[str] = None
    profile_id: str
    citation_style: Optional[str] = None
    evidence_items: Optional[list] = None
    paper_ids: Optional[list[str]] = None
    instructions: Optional[str] = None
    target_word_count: Optional[int] = None


class RephraseRequest(BaseModel):
    text: str
    profile_id: str
    citation_style: Optional[str] = None


class StyleScoreRequest(BaseModel):
    text: str
    profile_id: str


class HumanizeRequest(BaseModel):
    text: str
    profile_id: str


class SentenceStartersRequest(BaseModel):
    essay_id: str
    profile_id: str
    sections: list  # [{title, notes, evidence_items: [{quote, page_number, source_title}]}]
    topic: Optional[str] = None
    thesis: Optional[str] = None
    citation_style: Optional[str] = None
    instructions: Optional[str] = None


class GenerateFullEssayRequest(BaseModel):
    essay_id: str
    profile_id: str
    citation_style: Optional[str] = None
    instructions: Optional[str] = None
    target_word_count: Optional[int] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    essay_id: Optional[str] = None
    essay_content: Optional[str] = None
    profile_id: Optional[str] = None
    topic: Optional[str] = None
    thesis: Optional[str] = None
    outline_summary: Optional[str] = None
    writing_type: Optional[str] = None


class ProviderUpdate(BaseModel):
    provider: str


def _load_profile(profile_id: str) -> dict:
    path = data_root() / "profiles" / f"{profile_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Profile not found. Analyze samples first.")
    return json.loads(path.read_text(encoding="utf-8"))


def _build_style_context(profile: dict) -> str:
    voice_model = profile.get("voice_model")
    metrics = profile.get("metrics", {})

    if voice_model:
        return _build_voice_context(voice_model, metrics)
    else:
        return _build_metrics_context(metrics)


def _build_voice_context(voice_model: dict, metrics: dict) -> str:
    vp = voice_model.get("voice_profile", {})
    examples = voice_model.get("voice_examples", [])

    parts = []

    # Voice profile XML block
    profile_lines = ["<voice-profile>", "## Voice Profile (match this writing style exactly)"]
    field_labels = {
        "summary": "Summary",
        "tone": "Tone",
        "sentence_patterns": "Sentence Patterns",
        "argument_style": "Argument Style",
        "vocabulary_level": "Vocabulary Level",
        "transition_patterns": "Transition Patterns",
        "paragraph_structure": "Paragraph Structure",
        "what_to_avoid": "What to Avoid",
    }
    for key, label in field_labels.items():
        val = vp.get(key)
        if val:
            profile_lines.append(f"{label}: {val}")

    devices = vp.get("rhetorical_devices", [])
    if devices:
        profile_lines.append(f"Rhetorical Devices: {', '.join(devices)}")

    phrases = vp.get("distinctive_phrases", [])
    if phrases:
        profile_lines.append(f"Distinctive Phrases: {', '.join(phrases)}")

    profile_lines.append("</voice-profile>")
    parts.append("\n".join(profile_lines))

    # Voice examples XML block
    if examples:
        example_lines = ["<voice-examples>", "## Writing Examples (mimic the style, rhythm, and vocabulary in these passages)"]
        for i, ex in enumerate(examples, 1):
            example_lines.append(f"### Example {i}")
            if ex.get("demonstrates"):
                example_lines.append(f"*{ex['demonstrates']}*")
            example_lines.append(ex.get("excerpt", ""))
            example_lines.append("")
        example_lines.append("</voice-examples>")
        parts.append("\n".join(example_lines))

    # Quantitative metrics as supplement
    if metrics:
        metrics_ctx = _build_metrics_context(metrics)
        parts.append(f"<style-metrics>\n{metrics_ctx}\n</style-metrics>")

    return "\n\n".join(parts)


def _build_metrics_context(metrics: dict) -> str:
    lines = [
        "## Quantitative Targets",
        f"- Average sentence length: {metrics.get('avg_sentence_length', 'N/A')} words",
        f"- Vocabulary richness (TTR): {metrics.get('type_token_ratio', 'N/A')}",
        f"- Flesch reading ease: {metrics.get('flesch_reading_ease', 'N/A')}",
        f"- Active voice ratio: {metrics.get('active_voice_ratio', 'N/A')}",
        f"- Avg syllables/word: {metrics.get('avg_syllables_per_word', 'N/A')}",
    ]
    top_words = metrics.get("top_words", [])
    if top_words:
        words = [w[0] for w in top_words[:20]]
        lines.append(f"- Characteristic vocabulary: {', '.join(words)}")
    transitions = metrics.get("transition_words", {})
    if transitions:
        lines.append(f"- Transition words used: {', '.join(transitions.keys())}")
    punct = metrics.get("punctuation_per_1k", {})
    if punct:
        notable = [f"{k}: {v}/1k" for k, v in punct.items() if v > 0.5]
        if notable:
            lines.append(f"- Punctuation patterns: {', '.join(notable)}")
    return "\n".join(lines)


def _load_sample_excerpts(per_sample: int = 2000, profile_id: Optional[str] = None) -> str:
    """Load truncated excerpts from uploaded samples as reference material.

    If profile_id is given, only load samples that belong to that profile.
    """
    samples_dir = data_root() / "samples"

    # Determine which sample IDs to include
    allowed_ids: Optional[set] = None
    if profile_id:
        profile_path = data_root() / "profiles" / f"{profile_id}.json"
        if profile_path.exists():
            try:
                profile_data = json.loads(profile_path.read_text(encoding="utf-8"))
                sid_list = profile_data.get("sample_ids", [])
                if sid_list:
                    allowed_ids = set(sid_list)
            except (json.JSONDecodeError, KeyError):
                pass

    texts = []
    for f in sorted(samples_dir.glob("*.json"), key=lambda p: p.stat().st_mtime):
        try:
            sample_id = f.stem
            if allowed_ids is not None and sample_id not in allowed_ids:
                continue
            data = json.loads(f.read_text(encoding="utf-8"))
            text = data.get("text", "").strip()
            if text:
                excerpt = text[:per_sample]
                if len(text) > per_sample:
                    excerpt = excerpt.rsplit(" ", 1)[0] + "..."
                texts.append(f"### {data.get('filename', 'Sample')}\n{excerpt}")
        except (json.JSONDecodeError, KeyError):
            continue
    if not texts:
        return ""
    return "<reference-samples>\n## Uploaded Writing Samples (reference for voice and content)\n\n" + "\n\n---\n\n".join(texts) + "\n</reference-samples>"


async def _humanize_pass(text: str, profile: dict) -> str:
    """Second-pass: strip AI patterns using universal rules + profile-specific voice."""
    # Load universal humanize rules
    universal_rules = ""
    if _HUMANIZE_PROMPT_PATH.exists():
        universal_rules = _HUMANIZE_PROMPT_PATH.read_text(encoding="utf-8")

    # Extract profile-specific voice guidance (if available)
    voice_model = profile.get("voice_model")
    vp = voice_model.get("voice_profile", {}) if voice_model else {}
    what_to_avoid = vp.get("what_to_avoid", "")
    phrases = vp.get("distinctive_phrases", [])
    sentence_patterns = vp.get("sentence_patterns", "")
    tone = vp.get("tone", "")

    # Build profile-specific layer
    profile_section = ""
    if any([what_to_avoid, tone, sentence_patterns, phrases]):
        profile_parts = ["<author-profile>", "## Author-Specific Rules (apply on top of universal rules)"]
        if what_to_avoid:
            profile_parts.append(f"What to Avoid: {what_to_avoid}")
        if tone:
            profile_parts.append(f"Tone: {tone}")
        if sentence_patterns:
            profile_parts.append(f"Sentence Patterns: {sentence_patterns}")
        if phrases:
            profile_parts.append(f"Distinctive Phrases the author actually uses: {', '.join(phrases)}")
        profile_parts.append("- Use the author's distinctive phrases and sentence patterns where they fit naturally.")
        profile_parts.append("</author-profile>")
        profile_section = "\n".join(profile_parts)

    prompt = f"""{universal_rules}

{profile_section}

<text>
{text}
</text>

Return ONLY the revised text. No explanations, no commentary."""

    provider = get_provider()
    try:
        return await provider.generate(prompt)
    except RuntimeError:
        return text


CITATION_STYLE_LABELS = {
    "apa7": "APA 7th Edition",
    "mla9": "MLA 9th Edition",
    "chicago-notes": "Chicago Manual of Style (Notes-Bibliography)",
    "chicago-author": "Chicago Manual of Style (Author-Date)",
    "ieee": "IEEE",
    "harvard": "Harvard",
}


def _citation_directive(citation_style: Optional[str]) -> str:
    if not citation_style or citation_style not in CITATION_STYLE_LABELS:
        return ""
    label = CITATION_STYLE_LABELS[citation_style]
    return (
        f"\n\nCitation Style: Use {label} format for all citations, references, "
        f"and evidence. Format in-text citations, footnotes, and reference entries "
        f"according to {label} conventions."
    )


def _voice_directive(profile: dict) -> str:
    if profile.get("voice_model"):
        return (
            "Write in the exact voice and style shown in the Voice Profile and "
            "Writing Examples above. Mimic the vocabulary, sentence structure, "
            "transition patterns, and argument style from the examples. "
            "Do NOT sound like AI — sound like the human author of those examples."
        )
    return "Match the writing style described above."


def _build_writing_briefing(
    topic: Optional[str] = None,
    thesis: Optional[str] = None,
    target_word_count: Optional[int] = None,
    instructions: Optional[str] = None,
    writing_type: str = "essay",
    extra_fields: Optional[dict] = None,
) -> str:
    """Build a writing briefing block to inject into AI prompts."""
    type_cfg = get_writing_type(writing_type)
    parts = []
    if topic:
        parts.append(f"Topic: {topic}")
    if thesis and type_cfg.has_thesis:
        parts.append(f"Thesis: {thesis}")
    if target_word_count:
        parts.append(f"Target length: ~{target_word_count} words")
    if instructions:
        parts.append(f"Author instructions: {instructions}")
    if extra_fields and type_cfg.extra_briefing_fields:
        for field_name in type_cfg.extra_briefing_fields:
            val = extra_fields.get(field_name)
            if val:
                parts.append(f"{field_name.capitalize()}: {val}")
    if not parts:
        return ""
    tag = f"{type_cfg.content_noun}-briefing"
    return f"<{tag}>\n" + "\n".join(parts) + f"\n</{tag}>"


@router.post("/generate-outline")
async def generate_outline(body: GenerateOutlineRequest):
    profile = _load_profile(body.profile_id)
    style_ctx = _build_style_context(profile)
    samples_ctx = _load_sample_excerpts()

    # Load paper catalog if essay_id provided
    essay_papers: list[dict] = []
    paper_catalog_block = ""
    if body.essay_id:
        essay_papers = _load_linked_research_papers_raw(body.essay_id)
        if essay_papers:
            catalog_lines = [
                "<available-papers>",
                "Assign relevant paper_ids to each outline section from this list.",
            ]
            for p in essay_papers:
                pid = p.get("paper_id", "")
                title = p.get("title", "Untitled")
                summary = p.get("tldr") or (p.get("abstract", "") or "")[:150]
                catalog_lines.append(f'- "{pid}": "{title}" — {summary}')
            catalog_lines.append("</available-papers>")
            paper_catalog_block = "\n".join(catalog_lines)

    # Resolve writing type: request > essay frontmatter > default
    writing_type = body.writing_type
    extra_fields = None
    if not writing_type and body.essay_id:
        essay_path = data_root() / "essays" / f"{body.essay_id}.md"
        if essay_path.exists():
            _meta = frontmatter.loads(essay_path.read_text(encoding="utf-8")).metadata
            writing_type = _meta.get("writing_type", "essay")
            extra_fields = _meta.get("extra_fields")
    type_cfg = get_writing_type(writing_type)

    briefing = _build_writing_briefing(body.topic, body.thesis, body.target_word_count, body.instructions, writing_type=writing_type or "essay", extra_fields=extra_fields)
    directive = _voice_directive(profile) + _citation_directive(body.citation_style)

    # Build schema instruction — include paper_ids field if papers available
    schema_fields = """- "title": section heading
- "notes": brief description of content
- "evidence": key evidence or examples to include"""
    if essay_papers:
        schema_fields += '\n- "paper_ids": array of paper_id strings from available-papers that are relevant to this section (can be empty)'

    prompt = f"""{style_ctx}

{samples_ctx}
{briefing}
{paper_catalog_block}

{type_cfg.outline_instruction} {directive}

Topic: {body.topic}
{f"Thesis: {body.thesis}" if body.thesis and type_cfg.has_thesis else ""}

Return a JSON array of sections. Each section should have:
{schema_fields}

Format: [{{"title": "...", "notes": "...", "evidence": "..."}}]
Return ONLY the JSON array, no other text."""

    provider = get_provider()
    try:
        result = await provider.generate(prompt)
        outline = _extract_json_array(result)
        if outline is not None:
            # Validate paper_ids: strip any IDs not in the real paper set
            if essay_papers:
                valid_ids = {p.get("paper_id") for p in essay_papers}
                any_assigned = False
                for section in outline:
                    pids = section.get("paper_ids", [])
                    if pids:
                        section["paper_ids"] = [pid for pid in pids if pid in valid_ids]
                        if section["paper_ids"]:
                            any_assigned = True

                # Fallback: if AI didn't assign any paper_ids, use heuristic matcher
                if not any_assigned:
                    from services.paper_matcher import match_papers_to_sections
                    matched = match_papers_to_sections(outline, essay_papers)
                    for section, pids in zip(outline, matched):
                        if pids:
                            section["paper_ids"] = pids

            return {"outline": outline}
        return {"outline": [], "raw": result}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/expand-section")
async def expand_section(body: ExpandSectionRequest):
    profile = _load_profile(body.profile_id)
    style_ctx = _build_style_context(profile)
    samples_ctx = _load_sample_excerpts()

    # Load essay for context
    essay_path = data_root() / "essays" / f"{body.essay_id}.md"
    essay_context = ""
    essay_instructions = body.instructions
    essay_target = body.target_word_count
    meta = {}
    if essay_path.exists():
        post = frontmatter.loads(essay_path.read_text(encoding="utf-8"))
        meta = post.metadata
        essay_context = f"\nEssay title: {meta.get('title', '')}\nThesis: {meta.get('thesis', '')}"
        if not essay_instructions:
            essay_instructions = meta.get("instructions")
        if not essay_target:
            essay_target = meta.get("target_word_count")

    writing_type = meta.get("writing_type", "essay")
    extra_fields = meta.get("extra_fields")
    type_cfg = get_writing_type(writing_type)

    briefing = _build_writing_briefing(
        meta.get("topic"),
        meta.get("thesis"),
        essay_target,
        essay_instructions,
        writing_type=writing_type,
        extra_fields=extra_fields,
    )

    # Build evidence context if provided
    evidence_ctx = ""
    if body.evidence_items:
        ev_lines = ["<evidence>", "## Source Evidence (integrate these quotes naturally with proper citations)"]
        for ev in body.evidence_items:
            quote = ev.get("quote", "")
            page = ev.get("page_number", "")
            title = ev.get("source_title", "") or ev.get("textbook_title", "")
            relevance = ev.get("relevance", "")
            ev_lines.append(f'- "{quote}" (p. {page}, {title})')
            if relevance:
                ev_lines.append(f"  Relevance: {relevance}")
        ev_lines.append("</evidence>")
        evidence_ctx = "\n".join(ev_lines)

    # Build research context from section-level paper IDs
    research_ctx = ""
    if body.paper_ids:
        research_ctx = _load_research_papers_by_ids(body.paper_ids)

    directive = _voice_directive(profile) + _citation_directive(body.citation_style)
    prompt = f"""{style_ctx}

{samples_ctx}
{briefing}
{evidence_ctx}
{research_ctx}
{essay_context}

{type_cfg.expand_instruction} {directive}

{type_cfg.section_noun.capitalize()}: {body.section_title}
{f"Notes: {body.section_notes}" if body.section_notes else ""}

Write 2-3 paragraphs for this {type_cfg.section_noun}. Return ONLY the text, no headings or metadata."""

    provider = get_provider()
    try:
        result = await provider.generate(prompt)
        result = await _humanize_pass(result, profile)
        return {"text": result}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/sentence-starters")
async def sentence_starters(body: SentenceStartersRequest):
    profile = _load_profile(body.profile_id)
    style_ctx = _build_style_context(profile)
    samples_ctx = _load_sample_excerpts()

    # Resolve writing type from essay frontmatter
    writing_type = "essay"
    extra_fields = None
    essay_path = data_root() / "essays" / f"{body.essay_id}.md"
    if essay_path.exists():
        _meta = frontmatter.loads(essay_path.read_text(encoding="utf-8")).metadata
        writing_type = _meta.get("writing_type", "essay")
        extra_fields = _meta.get("extra_fields")
    type_cfg = get_writing_type(writing_type)

    briefing = _build_writing_briefing(body.topic, body.thesis, instructions=body.instructions, writing_type=writing_type, extra_fields=extra_fields)
    directive = _voice_directive(profile) + _citation_directive(body.citation_style)

    # Build section listing with evidence and research papers
    section_lines = []
    for sec in body.sections:
        title = sec.get("title", "Untitled")
        notes = sec.get("notes", "")
        section_lines.append(f"### {title}")
        if notes:
            section_lines.append(f"Notes: {notes}")
        ev_items = sec.get("evidence_items", [])
        if ev_items:
            section_lines.append("Evidence:")
            for ev in ev_items:
                quote = ev.get("quote", "")
                page = ev.get("page_number", "")
                src_title = ev.get("source_title", "") or ev.get("textbook_title", "")
                section_lines.append(f'  - "{quote}" (p. {page}, {src_title})')
        sec_paper_ids = sec.get("paper_ids", [])
        if sec_paper_ids:
            sec_research = _load_research_papers_by_ids(sec_paper_ids)
            if sec_research:
                section_lines.append(sec_research)
        section_lines.append("")

    sections_block = "\n".join(section_lines)

    prompt = f"""{style_ctx}

{samples_ctx}
{briefing}

Generate 3 sentence starters for each of the following {type_cfg.section_noun}s. {directive}

CRITICAL: Each sentence starter must include parenthetical references with the evidence, source info, and any context the writer needs to complete the sentence. For example:
- "While many scholars have debated the causes of X (Smith, p.42 notes that '...'; see also Johnson's analysis of...), "
- "The data suggests a significant correlation between A and B (as demonstrated in Table 3, where...), which implies "
- "Although critics argue that Y is insufficient (Brown, p.15 contends '...'), a closer examination reveals "

The starters should be varied in structure (some beginning with subordinate clauses, some with subject-verb, some with transitional phrases). Include enough context in parentheses that the writer can seamlessly continue the sentence.

Sections:
{sections_block}

Return a JSON array where each element has:
- "section_title": the section title exactly as given
- "starters": array of 3 sentence starter strings

Format: [{{"section_title": "...", "starters": ["...", "...", "..."]}}]
Return ONLY the JSON array, no other text."""

    provider = get_provider()
    try:
        result = await provider.generate(prompt)
        parsed = _extract_json_array(result)
        if parsed is not None:
            return {"sections": parsed}
        return {"sections": [], "raw": result}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/rephrase")
async def rephrase(body: RephraseRequest):
    profile = _load_profile(body.profile_id)
    style_ctx = _build_style_context(profile)

    directive = _voice_directive(profile) + _citation_directive(body.citation_style)
    prompt = f"""{style_ctx}

Rephrase the following text to match the writing style. {directive} Keep the same meaning but adjust sentence structure, vocabulary, and tone.

Text to rephrase:
{body.text}

Return ONLY the rephrased text, no explanations."""

    provider = get_provider()
    try:
        result = await provider.generate(prompt)
        result = await _humanize_pass(result, profile)
        return {"text": result}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/humanize")
async def humanize(body: HumanizeRequest):
    profile = _load_profile(body.profile_id)
    try:
        result = await _humanize_pass(body.text, profile)
        return {"text": result}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


class RewriteRequest(BaseModel):
    text: str
    profile_id: str
    instructions: str
    citation_style: Optional[str] = None


@router.post("/rewrite")
async def rewrite(body: RewriteRequest):
    profile = _load_profile(body.profile_id)
    style_ctx = _build_style_context(profile)

    directive = _voice_directive(profile) + _citation_directive(body.citation_style)
    prompt = f"""{style_ctx}

{directive}

<task-instructions>
{body.instructions}
</task-instructions>

Apply the task instructions above to the following text. Preserve the author's voice and style.

Text:
{body.text}

Return ONLY the rewritten text, no explanations."""

    provider = get_provider()
    try:
        result = await provider.generate(prompt)
        result = await _humanize_pass(result, profile)
        return {"text": result}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/style-score")
async def style_score(body: StyleScoreRequest):
    profile = _load_profile(body.profile_id)
    style_ctx = _build_style_context(profile)

    directive = _voice_directive(profile)
    prompt = f"""{style_ctx}

Score the following text on how well it matches the writing style above. {directive} Consider sentence length, vocabulary, tone, and punctuation patterns.

Text to score:
{body.text}

Return a JSON object with:
- "score": integer 0-100
- "feedback": brief explanation of what matches and what doesn't

Return ONLY the JSON object."""

    provider = get_provider()
    try:
        result = await provider.generate(prompt)
        try:
            parsed = json.loads(result)
            return parsed
        except json.JSONDecodeError:
            return {"score": None, "feedback": result}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


MAX_RESEARCH_PAPERS = 5
MAX_CATALOG_PAPERS = 15


def _load_linked_research_papers_raw(essay_id: str, limit: int = MAX_CATALOG_PAPERS) -> list[dict]:
    """Load raw paper dicts linked to this essay."""
    papers_dir = data_root() / "research" / "papers"
    if not papers_dir.exists():
        return []
    papers = []
    for f in papers_dir.glob("*.json"):
        try:
            p = json.loads(f.read_text(encoding="utf-8"))
            if essay_id in p.get("essay_ids", []):
                papers.append(p)
        except (json.JSONDecodeError, KeyError):
            continue
    return papers[:limit]


def _format_papers_xml(papers: list[dict], header: str = "Linked Research Papers (cite where relevant)") -> str:
    """Format a list of paper dicts into XML context."""
    if not papers:
        return ""
    lines = ["<research-papers>", f"## {header}"]
    for p in papers:
        lines.append(f"### {p.get('title', 'Untitled')}")
        authors = p.get("authors", [])
        if authors:
            names = [a.get("name", "") for a in authors[:5]]
            lines.append(f"Authors: {', '.join(names)}")
        year = p.get("year")
        if year:
            lines.append(f"Year: {year}")
        tldr = p.get("tldr", "") or p.get("abstract", "") or ""
        if tldr:
            lines.append(f"Summary: {tldr[:500]}")
        doi = p.get("doi")
        if doi:
            lines.append(f"DOI: {doi}")
        lines.append("")
    lines.append("</research-papers>")
    return "\n".join(lines)


def _load_linked_research_papers(essay_id: str) -> str:
    """Load research papers linked to this essay as XML context (max 5)."""
    papers = _load_linked_research_papers_raw(essay_id, limit=MAX_RESEARCH_PAPERS)
    return _format_papers_xml(papers)


def _load_research_papers_by_ids(paper_ids: list[str]) -> str:
    """Load research papers by their IDs as XML context (max MAX_RESEARCH_PAPERS)."""
    papers_dir = data_root() / "research" / "papers"
    if not papers_dir.exists():
        return ""
    papers = []
    for pid in paper_ids[:MAX_RESEARCH_PAPERS]:
        fpath = papers_dir / f"{pid}.json"
        if not fpath.exists():
            continue
        try:
            p = json.loads(fpath.read_text(encoding="utf-8"))
            papers.append(p)
        except (json.JSONDecodeError, KeyError):
            continue
    if not papers:
        return ""
    lines = ["<research-papers>", "## Section Research Papers (cite where relevant)"]
    for p in papers:
        lines.append(f"### {p.get('title', 'Untitled')}")
        authors = p.get("authors", [])
        if authors:
            names = [a.get("name", "") for a in authors[:5]]
            lines.append(f"Authors: {', '.join(names)}")
        year = p.get("year")
        if year:
            lines.append(f"Year: {year}")
        tldr = p.get("tldr", "") or p.get("abstract", "") or ""
        if tldr:
            lines.append(f"Summary: {tldr[:500]}")
        doi = p.get("doi")
        if doi:
            lines.append(f"DOI: {doi}")
        lines.append("")
    lines.append("</research-papers>")
    return "\n".join(lines)


def _load_evidence_for_essay(essay_id: str) -> list:
    """Load evidence items for an essay."""
    path = data_root() / "evidence" / f"{essay_id}.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("items", [])
    except (json.JSONDecodeError, KeyError):
        return []


def _build_evidence_context(items: list) -> str:
    """Build evidence XML block from a list of evidence items."""
    if not items:
        return ""
    lines = ["<evidence>", "## Source Evidence (integrate these quotes naturally with proper citations)"]
    for ev in items:
        quote = ev.get("quote", "")
        page = ev.get("page_number", "")
        title = ev.get("source_title", "") or ev.get("textbook_title", "")
        relevance = ev.get("relevance", "")
        lines.append(f'- "{quote}" (p. {page}, {title})')
        if relevance:
            lines.append(f"  Relevance: {relevance}")
    lines.append("</evidence>")
    return "\n".join(lines)


MAX_SECTIONS = 10
MAX_PREV_SUMMARY_SECTIONS = 3


@router.post("/generate-full-essay")
async def generate_full_essay(body: GenerateFullEssayRequest):
    """Generate a complete essay section-by-section using all available context."""
    # 1. Load essay
    essay_path = data_root() / "essays" / f"{body.essay_id}.md"
    if not essay_path.exists():
        raise HTTPException(status_code=404, detail="Essay not found")
    post = frontmatter.loads(essay_path.read_text(encoding="utf-8"))
    meta = post.metadata
    topic = meta.get("topic", "")
    thesis = meta.get("thesis", "")
    instructions = body.instructions or meta.get("instructions", "")
    target_word_count = body.target_word_count or meta.get("target_word_count")

    # Citation style: request value first, else essay frontmatter
    citation_style = body.citation_style or meta.get("citation_style")

    # 2. Load outline
    outline_path = data_root() / "essays" / f"{body.essay_id}.outline.json"
    if not outline_path.exists():
        raise HTTPException(status_code=400, detail="No outline found. Generate an outline first.")
    outline = json.loads(outline_path.read_text(encoding="utf-8"))
    if not outline:
        raise HTTPException(status_code=400, detail="Outline is empty. Add sections first.")

    # Cap sections to prevent unbounded runtime
    if len(outline) > MAX_SECTIONS:
        outline = outline[:MAX_SECTIONS]

    # 3. Load profile, samples (scoped to profile), research, evidence
    profile = _load_profile(body.profile_id)
    style_ctx = _build_style_context(profile)
    samples_ctx = _load_sample_excerpts(per_sample=1500, profile_id=body.profile_id)
    all_essay_papers = _load_linked_research_papers_raw(body.essay_id)
    research_ctx = _format_papers_xml(all_essay_papers[:MAX_RESEARCH_PAPERS])
    all_evidence = _load_evidence_for_essay(body.essay_id)

    writing_type = meta.get("writing_type", "essay")
    extra_fields = meta.get("extra_fields")
    type_cfg = get_writing_type(writing_type)

    briefing = _build_writing_briefing(topic, thesis, target_word_count, instructions, writing_type=writing_type, extra_fields=extra_fields)
    directive = _voice_directive(profile) + _citation_directive(citation_style)

    # Full outline overview
    outline_overview = "\n".join(
        f"{i+1}. {s.get('title', 'Untitled')}" + (f" — {s.get('notes', '')}" if s.get('notes') else "")
        for i, s in enumerate(outline)
    )

    # 4. Generate section by section (no per-section humanize — single pass at end)
    provider = get_provider()
    generated_sections = []
    total = len(outline)
    error_msg = None

    for i, section in enumerate(outline):
        section_id = section.get("id", "")
        section_title = section.get("title", f"{type_cfg.section_noun.capitalize()} {i+1}")
        section_notes = section.get("notes", "")

        # Filter evidence for this section
        section_evidence = [e for e in all_evidence if e.get("section_id") == section_id]
        evidence_ctx = _build_evidence_context(section_evidence)

        # Section-level research papers augment essay-level papers
        section_paper_ids = section.get("paper_ids", [])
        if section_paper_ids:
            section_research = _load_research_papers_by_ids(section_paper_ids)
            effective_research = (section_research + "\n" + research_ctx).strip() if section_research else research_ctx
        elif all_essay_papers:
            # Auto-match relevant papers for sections without explicit paper_ids
            from services.paper_matcher import match_papers_to_section
            matched_ids = match_papers_to_section(section_title, section_notes, all_essay_papers)
            if matched_ids:
                section_research = _load_research_papers_by_ids(matched_ids)
                effective_research = (section_research + "\n" + research_ctx).strip() if section_research else research_ctx
            else:
                effective_research = research_ctx
        else:
            effective_research = research_ctx

        # Rolling window: only last N sections for continuity context
        prev_summary = ""
        recent = generated_sections[-MAX_PREV_SUMMARY_SECTIONS:]
        if recent:
            summary_lines = []
            for prev_title, prev_text in recent:
                sentences = [s.strip() for s in prev_text.split(".") if s.strip()]
                if sentences:
                    first = sentences[0] + "."
                    last = (sentences[-1] + ".") if len(sentences) > 1 else ""
                    summary_lines.append(f"{prev_title}: {first}" + (f" ... {last}" if last else ""))
            prev_summary = "<previous-sections>\n" + "\n".join(summary_lines) + "\n</previous-sections>"

        # Section position guidance
        position_guidance = ""
        if i == 0:
            position_guidance = type_cfg.intro_guidance
        elif i == total - 1:
            position_guidance = type_cfg.conclusion_guidance

        prompt = f"""{style_ctx}

{samples_ctx}
{briefing}
{effective_research}
{evidence_ctx}
{prev_summary}

<outline-overview>
Full {type_cfg.content_noun} structure:
{outline_overview}
</outline-overview>

Write {type_cfg.section_noun} {i+1} of {total}: "{section_title}"
Notes: {section_notes}

{directive}

Write 2-4 paragraphs. Maintain continuity with previous {type_cfg.section_noun}s.
{position_guidance}
Return ONLY the text, no headings or metadata."""

        try:
            result = await provider.generate(prompt)
            generated_sections.append((section_title, result))
        except (RuntimeError, asyncio.TimeoutError) as e:
            error_msg = f"Failed at section {i+1} ({section_title}): {str(e)}"
            break

    if not generated_sections:
        raise HTTPException(status_code=502, detail=error_msg or "Generation failed entirely")

    # 5. Stitch with markdown headings
    parts = []
    for title, text in generated_sections:
        parts.append(f"## {title}\n\n{text}")
    full_text = "\n\n".join(parts)

    # 6. Single humanize pass on the full essay (cheaper than N passes)
    try:
        full_text = await _humanize_pass(full_text, profile)
    except RuntimeError:
        pass  # Use unhumanized text rather than failing

    return {
        "text": full_text,
        "sections_generated": len(generated_sections),
        "total_sections": total,
        "partial": len(generated_sections) < total,
        "error": error_msg,
    }


def _build_chat_prompt(body: ChatRequest) -> str:
    """Build the prompt for a chat turn. First turn includes full context."""
    if body.session_id:
        return body.message

    parts = []

    # Style context
    if body.profile_id:
        try:
            profile = _load_profile(body.profile_id)
            style_ctx = _build_style_context(profile)
            parts.append(style_ctx)
            samples_ctx = _load_sample_excerpts(per_sample=1000)
            if samples_ctx:
                parts.append(samples_ctx)
        except HTTPException:
            pass

    # Essay metadata
    meta_lines = []
    if body.topic:
        meta_lines.append(f"Topic: {body.topic}")
    if body.thesis:
        meta_lines.append(f"Thesis: {body.thesis}")
    if body.outline_summary:
        meta_lines.append(f"Outline:\n{body.outline_summary}")
    if meta_lines:
        parts.append("<essay-metadata>\n" + "\n".join(meta_lines) + "\n</essay-metadata>")

    # Essay content (truncate to ~8000 chars)
    if body.essay_content:
        content = body.essay_content[:8000]
        if len(body.essay_content) > 8000:
            content = content.rsplit(" ", 1)[0] + "\n[...truncated]"
        parts.append(f"<current-essay>\n{content}\n</current-essay>")

    # Resolve writing type for chat system role
    type_cfg = get_writing_type(body.writing_type)

    # System instructions
    parts.append(f"""{type_cfg.chat_system_role} The user is asking for help with their {type_cfg.content_noun}.

When you suggest edits, wrap each edit in XML tags like this:
<edit>
<find>exact text to find in the {type_cfg.content_noun}</find>
<replace>replacement text</replace>
</edit>

You can include multiple <edit> blocks in a single response. Include them naturally within your prose explanation.
The <find> text must be an exact substring of the current content.
Keep your responses concise and helpful. Focus on the user's specific request.""")

    parts.append(body.message)
    return "\n\n".join(parts)


@router.post("/chat")
async def chat(body: ChatRequest):
    """Chat with AI using Codex sessions for persistent conversation."""
    prompt = _build_chat_prompt(body)

    with tempfile.TemporaryDirectory() as tmpdir:
        reply_file = Path(tmpdir) / "reply.txt"
        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": os.environ.get("HOME", tmpdir),
        }
        for key in ("CODEX_TOKEN", "OPENAI_API_KEY"):
            val = os.environ.get(key)
            if val:
                env[key] = val

        cmd = ["codex", "exec"]
        if body.session_id:
            cmd.extend(["resume", body.session_id])
        cmd.extend([
            "--full-auto", "--skip-git-repo-check",
            "--json", "-o", str(reply_file),
        ])

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=tmpdir,
            env=env,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=prompt.encode("utf-8")),
                timeout=120,
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            raise HTTPException(status_code=504, detail="Chat timed out")

        if proc.returncode != 0 and not reply_file.exists():
            err = stderr.decode("utf-8", errors="replace").strip()
            short = err[:300].split("--------")[0].strip()
            raise HTTPException(status_code=502, detail=f"Codex failed: {short}")

        # Parse session_id from JSONL stdout
        session_id = body.session_id
        for line in stdout.decode("utf-8", errors="replace").splitlines():
            if "thread.started" in line:
                try:
                    event = json.loads(line)
                    session_id = event.get("thread_id", session_id)
                except json.JSONDecodeError:
                    pass
                break

        reply = ""
        if reply_file.exists():
            reply = reply_file.read_text(encoding="utf-8").strip()

        if not reply:
            raise HTTPException(status_code=502, detail="Codex returned empty response")

        return {"reply": reply, "session_id": session_id}


@router.get("/provider")
async def get_current_provider():
    return {"provider": get_provider_name()}


@router.put("/provider")
async def set_current_provider(body: ProviderUpdate):
    try:
        set_provider_name(body.provider)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"provider": get_provider_name()}
