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


class ExpandSectionRequest(BaseModel):
    essay_id: str
    section_title: str
    section_notes: Optional[str] = None
    profile_id: str
    citation_style: Optional[str] = None
    evidence_items: Optional[list] = None
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
    sections: list  # [{title, notes, evidence_items: [{quote, page_number, textbook_title}]}]
    topic: Optional[str] = None
    thesis: Optional[str] = None
    citation_style: Optional[str] = None
    instructions: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    essay_id: Optional[str] = None
    essay_content: Optional[str] = None
    profile_id: Optional[str] = None
    topic: Optional[str] = None
    thesis: Optional[str] = None
    outline_summary: Optional[str] = None


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


def _load_sample_excerpts(per_sample: int = 2000) -> str:
    """Load truncated excerpts from uploaded samples as reference material."""
    samples_dir = data_root() / "samples"
    texts = []
    for f in sorted(samples_dir.glob("*.json"), key=lambda p: p.stat().st_mtime):
        try:
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


def _build_essay_briefing(
    topic: Optional[str] = None,
    thesis: Optional[str] = None,
    target_word_count: Optional[int] = None,
    instructions: Optional[str] = None,
) -> str:
    """Build an essay briefing block to inject into AI prompts."""
    parts = []
    if topic:
        parts.append(f"Topic: {topic}")
    if thesis:
        parts.append(f"Thesis: {thesis}")
    if target_word_count:
        parts.append(f"Target length: ~{target_word_count} words")
    if instructions:
        parts.append(f"Author instructions: {instructions}")
    if not parts:
        return ""
    return "<essay-briefing>\n" + "\n".join(parts) + "\n</essay-briefing>"


@router.post("/generate-outline")
async def generate_outline(body: GenerateOutlineRequest):
    profile = _load_profile(body.profile_id)
    style_ctx = _build_style_context(profile)
    samples_ctx = _load_sample_excerpts()

    briefing = _build_essay_briefing(body.topic, body.thesis, body.target_word_count, body.instructions)
    directive = _voice_directive(profile) + _citation_directive(body.citation_style)
    prompt = f"""{style_ctx}

{samples_ctx}
{briefing}

Generate a detailed essay outline for the following topic. {directive}

Topic: {body.topic}
{f"Thesis: {body.thesis}" if body.thesis else ""}

Return a JSON array of sections. Each section should have:
- "title": section heading
- "notes": brief description of content
- "evidence": key evidence or examples to include

Format: [{{"title": "...", "notes": "...", "evidence": "..."}}]
Return ONLY the JSON array, no other text."""

    provider = get_provider()
    try:
        result = await provider.generate(prompt)
        outline = _extract_json_array(result)
        if outline is not None:
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

    briefing = _build_essay_briefing(
        meta.get("topic"),
        meta.get("thesis"),
        essay_target,
        essay_instructions,
    )

    # Build evidence context if provided
    evidence_ctx = ""
    if body.evidence_items:
        ev_lines = ["<evidence>", "## Textbook Evidence (integrate these quotes naturally with proper citations)"]
        for ev in body.evidence_items:
            quote = ev.get("quote", "")
            page = ev.get("page_number", "")
            title = ev.get("textbook_title", "")
            relevance = ev.get("relevance", "")
            ev_lines.append(f'- "{quote}" (p. {page}, {title})')
            if relevance:
                ev_lines.append(f"  Relevance: {relevance}")
        ev_lines.append("</evidence>")
        evidence_ctx = "\n".join(ev_lines)

    directive = _voice_directive(profile) + _citation_directive(body.citation_style)
    prompt = f"""{style_ctx}

{samples_ctx}
{briefing}
{evidence_ctx}
{essay_context}

Expand the following essay section into well-written paragraphs. {directive}

Section: {body.section_title}
{f"Notes: {body.section_notes}" if body.section_notes else ""}

Write 2-3 paragraphs for this section. Return ONLY the essay text, no headings or metadata."""

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

    briefing = _build_essay_briefing(body.topic, body.thesis, instructions=body.instructions)
    directive = _voice_directive(profile) + _citation_directive(body.citation_style)

    # Build section listing with evidence
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
                tb_title = ev.get("textbook_title", "")
                section_lines.append(f'  - "{quote}" (p. {page}, {tb_title})')
        section_lines.append("")

    sections_block = "\n".join(section_lines)

    prompt = f"""{style_ctx}

{samples_ctx}
{briefing}

Generate 3 sentence starters for each of the following essay sections. {directive}

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
        try:
            parsed = json.loads(result)
            return {"sections": parsed}
        except json.JSONDecodeError:
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

    # System instructions
    parts.append("""You are Zora, an essay writing assistant. The user is asking for help with their essay.

When you suggest edits to the essay, wrap each edit in XML tags like this:
<edit>
<find>exact text to find in the essay</find>
<replace>replacement text</replace>
</edit>

You can include multiple <edit> blocks in a single response. Include them naturally within your prose explanation.
The <find> text must be an exact substring of the current essay content.
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
