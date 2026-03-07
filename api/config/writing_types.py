"""Writing type configuration registry for AI prompt parameterization.

Adding a new type requires only a new entry here — zero code changes needed.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WritingTypeConfig:
    id: str
    content_noun: str  # "essay", "story", "script", etc.
    section_noun: str  # "Section", "Scene", "Stanza", etc.
    has_thesis: bool
    has_citations: bool
    # Prompt templates
    outline_instruction: str
    expand_instruction: str
    intro_guidance: str
    conclusion_guidance: str
    chat_system_role: str
    # Extra briefing fields to include from metadata
    extra_briefing_fields: list[str] = field(default_factory=list)


WRITING_TYPES: dict[str, WritingTypeConfig] = {
    # ── Academic ──
    "essay": WritingTypeConfig(
        id="essay",
        content_noun="essay",
        section_noun="section",
        has_thesis=True,
        has_citations=True,
        outline_instruction="Generate a detailed essay outline for the following topic.",
        expand_instruction="Expand the following essay section into well-written paragraphs.",
        intro_guidance="This is the INTRODUCTION. Open with a hook, introduce the topic, and present the thesis.",
        conclusion_guidance="This is the CONCLUSION. Summarize key arguments, restate the thesis in a new way, and end with a compelling closing thought.",
        chat_system_role="You are Zora, an essay writing assistant.",
    ),
    "research-paper": WritingTypeConfig(
        id="research-paper",
        content_noun="paper",
        section_noun="section",
        has_thesis=True,
        has_citations=True,
        outline_instruction="Generate a detailed research paper outline with literature review sections.",
        expand_instruction="Expand the following section of this research paper into well-written academic prose.",
        intro_guidance="This is the INTRODUCTION. Establish the research context, review key literature, identify the gap, and present the research question or thesis.",
        conclusion_guidance="This is the CONCLUSION. Summarize findings, discuss implications, acknowledge limitations, and suggest future research directions.",
        chat_system_role="You are Zora, a research paper writing assistant.",
    ),
    "lab-report": WritingTypeConfig(
        id="lab-report",
        content_noun="report",
        section_noun="section",
        has_thesis=False,
        has_citations=True,
        outline_instruction="Generate a lab report outline following IMRaD structure (Introduction, Materials and Methods, Results, Discussion).",
        expand_instruction="Expand the following section of this lab report with precise, scientific language.",
        intro_guidance="This is the INTRODUCTION. State the purpose of the experiment, provide background, and present the hypothesis.",
        conclusion_guidance="This is the CONCLUSION. Summarize the key findings, state whether the hypothesis was supported, and discuss significance.",
        chat_system_role="You are Zora, a scientific writing assistant for lab reports.",
    ),

    # ── Creative ──
    "short-story": WritingTypeConfig(
        id="short-story",
        content_noun="story",
        section_noun="scene",
        has_thesis=False,
        has_citations=False,
        outline_instruction="Generate a plot structure for the following story concept. Include rising action, climax, and resolution.",
        expand_instruction="Write this scene with vivid description, dialogue, and narrative tension.",
        intro_guidance="This is the OPENING SCENE. Hook the reader, establish the setting, introduce the protagonist, and hint at the central conflict.",
        conclusion_guidance="This is the FINAL SCENE. Resolve the central conflict and deliver the emotional payoff. End with resonance.",
        chat_system_role="You are Zora, a creative writing assistant for fiction.",
        extra_briefing_fields=["genre"],
    ),
    "screenplay": WritingTypeConfig(
        id="screenplay",
        content_noun="script",
        section_noun="scene",
        has_thesis=False,
        has_citations=False,
        outline_instruction="Generate a scene-by-scene outline for this screenplay concept. Include act structure and key beats.",
        expand_instruction="Write this scene with action lines, character dialogue, and visual direction.",
        intro_guidance="This is the OPENING SCENE. Establish the world, introduce the protagonist, and set up the inciting incident.",
        conclusion_guidance="This is the FINAL SCENE. Deliver the climactic resolution and closing image.",
        chat_system_role="You are Zora, a screenwriting assistant.",
        extra_briefing_fields=["genre"],
    ),
    "poetry": WritingTypeConfig(
        id="poetry",
        content_noun="poem",
        section_noun="stanza",
        has_thesis=False,
        has_citations=False,
        outline_instruction="Generate a structural outline for this poem, including stanza themes and imagery patterns.",
        expand_instruction="Write this stanza with attention to rhythm, imagery, and emotional resonance.",
        intro_guidance="This is the OPENING STANZA. Establish the central image or emotion and set the tonal register.",
        conclusion_guidance="This is the CLOSING STANZA. Bring the poem to a resonant close with a final image or turn.",
        chat_system_role="You are Zora, a poetry writing assistant.",
        extra_briefing_fields=["genre"],
    ),

    # ── Professional ──
    "article": WritingTypeConfig(
        id="article",
        content_noun="article",
        section_noun="section",
        has_thesis=False,
        has_citations=True,
        outline_instruction="Generate an article outline with a compelling angle and logical flow.",
        expand_instruction="Expand this section into engaging, well-structured prose suitable for publication.",
        intro_guidance="This is the INTRODUCTION. Open with a hook that grabs the reader, introduce the subject, and preview the key points.",
        conclusion_guidance="This is the CONCLUSION. Synthesize the key points and leave the reader with a memorable takeaway.",
        chat_system_role="You are Zora, a writing assistant for articles.",
        extra_briefing_fields=["audience"],
    ),
    "blog-post": WritingTypeConfig(
        id="blog-post",
        content_noun="post",
        section_noun="section",
        has_thesis=False,
        has_citations=False,
        outline_instruction="Generate a blog post outline that's scannable with clear headings and a strong hook.",
        expand_instruction="Write this section in a conversational, engaging tone. Use short paragraphs suitable for web reading.",
        intro_guidance="This is the INTRODUCTION. Hook the reader with a relatable problem or question, and preview what they'll learn.",
        conclusion_guidance="This is the CONCLUSION. Summarize the key takeaways and include a call to action.",
        chat_system_role="You are Zora, a blog writing assistant.",
        extra_briefing_fields=["audience"],
    ),
    "report": WritingTypeConfig(
        id="report",
        content_noun="report",
        section_noun="section",
        has_thesis=False,
        has_citations=True,
        outline_instruction="Generate a report outline with an executive summary, findings, and recommendations.",
        expand_instruction="Write this section with clear, professional language. Use data and evidence to support each point.",
        intro_guidance="This is the EXECUTIVE SUMMARY. Provide a concise overview of the report's purpose, key findings, and recommendations.",
        conclusion_guidance="This is the CONCLUSION. Summarize key findings and present actionable recommendations.",
        chat_system_role="You are Zora, a professional report writing assistant.",
        extra_briefing_fields=["audience"],
    ),
    "cover-letter": WritingTypeConfig(
        id="cover-letter",
        content_noun="letter",
        section_noun="paragraph",
        has_thesis=False,
        has_citations=False,
        outline_instruction="Generate a cover letter structure with opening, qualifications, and closing paragraphs.",
        expand_instruction="Write this paragraph in a professional, personable tone that connects qualifications to the role.",
        intro_guidance="This is the OPENING PARAGRAPH. State the position you're applying for and capture interest with your strongest qualification.",
        conclusion_guidance="This is the CLOSING PARAGRAPH. Express enthusiasm, summarize your fit, and include a call to action.",
        chat_system_role="You are Zora, a cover letter writing assistant.",
        extra_briefing_fields=["audience"],
    ),

    # ── Long-form ──
    "book": WritingTypeConfig(
        id="book",
        content_noun="book",
        section_noun="chapter",
        has_thesis=False,
        has_citations=True,
        outline_instruction="Generate a chapter-level outline for this book. Each chapter should have a clear purpose and narrative arc.",
        expand_instruction="Write this chapter section with depth, coherence, and proper pacing.",
        intro_guidance="This is the OPENING CHAPTER. Establish the premise, hook the reader, and set expectations for what's to come.",
        conclusion_guidance="This is the FINAL CHAPTER. Bring all threads together and deliver a satisfying conclusion.",
        chat_system_role="You are Zora, a book writing assistant.",
        extra_briefing_fields=["genre"],
    ),
}


def get_writing_type(type_id: Optional[str]) -> WritingTypeConfig:
    """Get writing type config, defaulting to essay."""
    if type_id and type_id in WRITING_TYPES:
        return WRITING_TYPES[type_id]
    return WRITING_TYPES["essay"]
