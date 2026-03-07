// Writing type configuration registry
// Adding a new type requires only a new entry here — zero code changes needed.

export type WritingTypeId =
  | "essay"
  | "research-paper"
  | "lab-report"
  | "short-story"
  | "screenplay"
  | "poetry"
  | "article"
  | "blog-post"
  | "report"
  | "cover-letter"
  | "book";

export type WritingCategory = "academic" | "creative" | "professional" | "long-form";

export type ExtraField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export type WritingPreset = {
  label: string;
  instructions: string;
};

export type WritingTypeConfig = {
  id: WritingTypeId;
  label: string;
  category: WritingCategory;
  icon: string;
  description: string;
  // Editor layout flags
  showOutlinePanel: boolean;
  showResearchPanel: boolean;
  showSourcesPanel: boolean;
  showCitationStyle: boolean;
  showThesis: boolean;
  // Terminology
  contentNoun: string;
  sectionNoun: string;
  outlineNoun: string;
  // Default outline sections (template)
  defaultSections?: { title: string; notes: string }[];
  // Extra metadata fields beyond topic/thesis
  extraFields?: ExtraField[];
  // Sub-type presets that pre-fill instructions
  presets?: WritingPreset[];
};

export const WRITING_TYPES: Record<WritingTypeId, WritingTypeConfig> = {
  // ── Academic ──
  essay: {
    id: "essay",
    label: "Essay",
    category: "academic",
    icon: "A",
    description: "Structured academic essay with thesis and citations",
    showOutlinePanel: true,
    showResearchPanel: true,
    showSourcesPanel: true,
    showCitationStyle: true,
    showThesis: true,
    contentNoun: "essay",
    sectionNoun: "Section",
    outlineNoun: "Outline",
    presets: [
      { label: "Argumentative", instructions: "Write an argumentative essay that takes a clear position on the topic. Present a strong thesis, support it with evidence and logical reasoning, address counterarguments fairly, and refute them. Use a formal academic tone with structured body paragraphs each focused on a single supporting point." },
      { label: "Narrative", instructions: "Write a narrative essay that tells a compelling story related to the topic. Use vivid sensory details, dialogue where appropriate, and a clear narrative arc (setup, conflict, resolution). Weave in reflection and personal insight to connect the story to a broader theme or lesson." },
      { label: "Expository", instructions: "Write an expository essay that explains the topic clearly and objectively. Present factual information, definitions, and examples without personal opinion. Use a logical structure (chronological, cause-effect, or compare-contrast) and transition smoothly between ideas." },
      { label: "Persuasive", instructions: "Write a persuasive essay that convinces the reader to adopt a specific viewpoint. Use emotional appeals (pathos), credibility (ethos), and logical arguments (logos). Include a strong call to action in the conclusion. Anticipate reader objections and address them proactively." },
      { label: "Compare & Contrast", instructions: "Write a compare-and-contrast essay examining similarities and differences between two or more subjects. Use either point-by-point or block structure. Provide balanced analysis with specific examples for each comparison point, and draw meaningful conclusions about what the comparison reveals." },
    ],
  },
  "research-paper": {
    id: "research-paper",
    label: "Research Paper",
    category: "academic",
    icon: "R",
    description: "In-depth academic research with literature review",
    showOutlinePanel: true,
    showResearchPanel: true,
    showSourcesPanel: true,
    showCitationStyle: true,
    showThesis: true,
    contentNoun: "paper",
    sectionNoun: "Section",
    outlineNoun: "Outline",
    presets: [
      { label: "Literature Review", instructions: "Write a literature review that systematically surveys and synthesizes existing research on the topic. Organize sources thematically or chronologically, identify gaps in current knowledge, highlight areas of agreement and debate, and position your contribution within the existing body of work." },
      { label: "Case Study", instructions: "Write a case study that examines a specific instance, event, or subject in depth. Provide background context, describe the case in detail, analyze it using relevant theoretical frameworks, discuss findings and implications, and draw generalizable lessons where appropriate." },
      { label: "Meta-Analysis", instructions: "Write a meta-analysis that synthesizes findings from multiple studies on the topic. Describe your inclusion criteria and search methodology, present aggregated results, discuss heterogeneity between studies, assess publication bias, and draw evidence-based conclusions from the combined data." },
    ],
  },
  "lab-report": {
    id: "lab-report",
    label: "Lab Report",
    category: "academic",
    icon: "L",
    description: "Scientific lab report with IMRaD structure",
    showOutlinePanel: true,
    showResearchPanel: true,
    showSourcesPanel: true,
    showCitationStyle: true,
    showThesis: false,
    contentNoun: "report",
    sectionNoun: "Section",
    outlineNoun: "Outline",
    defaultSections: [
      { title: "Introduction", notes: "Background, purpose, and hypothesis" },
      { title: "Materials and Methods", notes: "Experimental procedures and materials used" },
      { title: "Results", notes: "Data and observations" },
      { title: "Discussion", notes: "Interpretation of results, comparison with literature" },
      { title: "Conclusion", notes: "Summary of findings and implications" },
    ],
  },

  // ── Creative ──
  "short-story": {
    id: "short-story",
    label: "Short Story",
    category: "creative",
    icon: "S",
    description: "Narrative fiction with characters and plot",
    showOutlinePanel: true,
    showResearchPanel: false,
    showSourcesPanel: false,
    showCitationStyle: false,
    showThesis: false,
    contentNoun: "story",
    sectionNoun: "Scene",
    outlineNoun: "Plot Structure",
    extraFields: [
      { key: "genre", label: "Genre", type: "text", placeholder: "e.g. Literary Fiction, Sci-Fi, Horror..." },
    ],
    presets: [
      { label: "Flash Fiction", instructions: "Write flash fiction (under 1,000 words). Every word must earn its place. Open in medias res, focus on a single moment or turning point, and end with a twist or resonant image. Avoid exposition — reveal character through action and dialogue." },
      { label: "Literary Fiction", instructions: "Write literary fiction that prioritizes character depth, thematic richness, and prose quality over plot mechanics. Use subtext, symbolism, and nuanced internal conflict. The story should leave the reader with something to think about long after finishing." },
      { label: "Genre Fiction", instructions: "Write engaging genre fiction with strong pacing, vivid world-building, and satisfying plot mechanics. Follow genre conventions while finding fresh angles. Prioritize tension, stakes, and a compelling hook that pulls the reader through each scene." },
    ],
  },
  screenplay: {
    id: "screenplay",
    label: "Screenplay",
    category: "creative",
    icon: "F",
    description: "Script with scenes, dialogue, and stage directions",
    showOutlinePanel: true,
    showResearchPanel: false,
    showSourcesPanel: false,
    showCitationStyle: false,
    showThesis: false,
    contentNoun: "script",
    sectionNoun: "Scene",
    outlineNoun: "Scene Outline",
    extraFields: [
      { key: "genre", label: "Genre", type: "text", placeholder: "e.g. Drama, Comedy, Thriller..." },
    ],
  },
  poetry: {
    id: "poetry",
    label: "Poetry",
    category: "creative",
    icon: "P",
    description: "Poems with structured or free-form stanzas",
    showOutlinePanel: true,
    showResearchPanel: false,
    showSourcesPanel: false,
    showCitationStyle: false,
    showThesis: false,
    contentNoun: "poem",
    sectionNoun: "Stanza",
    outlineNoun: "Structure",
    extraFields: [
      { key: "genre", label: "Form", type: "text", placeholder: "e.g. Sonnet, Haiku, Free Verse..." },
    ],
    presets: [
      { label: "Sonnet", instructions: "Write a sonnet: 14 lines in iambic pentameter. Use either Shakespearean (ABAB CDCD EFEF GG) or Petrarchan (ABBAABBA CDECDE) rhyme scheme. Develop a central metaphor or argument, with a volta (turn) near the end that shifts perspective or resolves tension." },
      { label: "Haiku", instructions: "Write haiku following the traditional 5-7-5 syllable structure. Each haiku should capture a single moment in nature or human experience. Use concrete imagery, a seasonal reference (kigo), and a cutting word or juxtaposition that creates depth in minimal space." },
      { label: "Free Verse", instructions: "Write free verse poetry without fixed meter or rhyme scheme. Use line breaks, enjambment, and white space deliberately for rhythm and emphasis. Focus on vivid imagery, fresh metaphor, and emotional resonance. Let the form emerge organically from the content." },
      { label: "Narrative Poem", instructions: "Write a narrative poem that tells a story through verse. Include characters, setting, conflict, and resolution. Use rhythm, imagery, and poetic devices (alliteration, assonance, metaphor) to elevate the narrative beyond prose. Balance storytelling momentum with lyrical beauty." },
    ],
  },

  // ── Professional ──
  article: {
    id: "article",
    label: "Article",
    category: "professional",
    icon: "N",
    description: "Journalistic or magazine-style article",
    showOutlinePanel: true,
    showResearchPanel: true,
    showSourcesPanel: true,
    showCitationStyle: true,
    showThesis: false,
    contentNoun: "article",
    sectionNoun: "Section",
    outlineNoun: "Outline",
    extraFields: [
      { key: "audience", label: "Target Audience", type: "text", placeholder: "e.g. General public, industry professionals..." },
    ],
    presets: [
      { label: "Opinion / Editorial", instructions: "Write an opinion piece that takes a clear stance on a current issue. Open with a compelling hook, state your position early, support it with evidence and reasoned arguments, acknowledge opposing views, and close with a strong call to reflection or action. Maintain a confident but respectful tone." },
      { label: "Investigative", instructions: "Write an investigative article that uncovers and explains a complex issue. Use primary sources, data, and expert quotes. Structure the piece to build a compelling narrative around the evidence. Maintain journalistic objectivity while making the significance clear to readers." },
      { label: "How-To", instructions: "Write a practical how-to article with clear, actionable steps. Open by explaining what the reader will achieve and why it matters. Break instructions into numbered steps with enough detail for a beginner to follow. Include tips, common pitfalls, and expected outcomes." },
    ],
  },
  "blog-post": {
    id: "blog-post",
    label: "Blog Post",
    category: "professional",
    icon: "B",
    description: "Casual, SEO-friendly web content",
    showOutlinePanel: true,
    showResearchPanel: true,
    showSourcesPanel: false,
    showCitationStyle: false,
    showThesis: false,
    contentNoun: "post",
    sectionNoun: "Section",
    outlineNoun: "Outline",
    extraFields: [
      { key: "audience", label: "Target Audience", type: "text", placeholder: "e.g. Beginners, developers, marketers..." },
    ],
    presets: [
      { label: "Listicle", instructions: "Write a listicle blog post with a numbered format (e.g. '7 Ways to...'). Each item should have a clear subheading, a concise explanation, and a practical example or tip. Open with a brief intro explaining why the list matters, and close with a summary or next-steps CTA." },
      { label: "Tutorial", instructions: "Write a step-by-step tutorial blog post. Start with prerequisites and what the reader will build/learn. Use numbered steps with code snippets, screenshots descriptions, or examples where helpful. Include troubleshooting tips for common issues. End with next steps or further reading." },
      { label: "Think Piece", instructions: "Write a thought-provoking blog post that explores an idea, trend, or question in depth. Take a clear perspective but invite discussion. Use anecdotes, data, and analogies to make abstract ideas concrete. Keep paragraphs short and punchy for web readability." },
    ],
  },
  report: {
    id: "report",
    label: "Report",
    category: "professional",
    icon: "D",
    description: "Business or technical report with findings",
    showOutlinePanel: true,
    showResearchPanel: true,
    showSourcesPanel: true,
    showCitationStyle: true,
    showThesis: false,
    contentNoun: "report",
    sectionNoun: "Section",
    outlineNoun: "Outline",
    extraFields: [
      { key: "audience", label: "Target Audience", type: "text", placeholder: "e.g. Stakeholders, management, board..." },
    ],
  },
  "cover-letter": {
    id: "cover-letter",
    label: "Cover Letter",
    category: "professional",
    icon: "C",
    description: "Job application cover letter",
    showOutlinePanel: false,
    showResearchPanel: false,
    showSourcesPanel: false,
    showCitationStyle: false,
    showThesis: false,
    contentNoun: "letter",
    sectionNoun: "Paragraph",
    outlineNoun: "Structure",
    extraFields: [
      { key: "audience", label: "Company / Role", type: "text", placeholder: "e.g. Google, Senior Engineer..." },
    ],
  },

  // ── Long-form ──
  book: {
    id: "book",
    label: "Book",
    category: "long-form",
    icon: "K",
    description: "Long-form writing with chapter-level outline",
    showOutlinePanel: true,
    showResearchPanel: true,
    showSourcesPanel: true,
    showCitationStyle: true,
    showThesis: false,
    contentNoun: "book",
    sectionNoun: "Chapter",
    outlineNoun: "Chapter Outline",
    extraFields: [
      { key: "genre", label: "Genre", type: "text", placeholder: "e.g. Non-fiction, Memoir, Fantasy..." },
    ],
  },
};

export const WRITING_TYPE_CATEGORIES: { id: WritingCategory; label: string; types: WritingTypeId[] }[] = [
  {
    id: "academic",
    label: "Academic",
    types: ["essay", "research-paper", "lab-report"],
  },
  {
    id: "creative",
    label: "Creative",
    types: ["short-story", "screenplay", "poetry"],
  },
  {
    id: "professional",
    label: "Professional",
    types: ["article", "blog-post", "report", "cover-letter"],
  },
  {
    id: "long-form",
    label: "Long-form",
    types: ["book"],
  },
];

export function getWritingType(id?: string): WritingTypeConfig {
  if (id && id in WRITING_TYPES) {
    return WRITING_TYPES[id as WritingTypeId];
  }
  return WRITING_TYPES.essay;
}

export function getCategoryForType(id?: string): WritingCategory {
  return getWritingType(id).category;
}
