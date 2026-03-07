export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type CitationStyle = "apa7" | "mla9" | "chicago-notes" | "chicago-author" | "ieee" | "harvard";

export const CITATION_STYLES: { value: CitationStyle; label: string }[] = [
  { value: "apa7", label: "APA (7th Ed.)" },
  { value: "mla9", label: "MLA (9th Ed.)" },
  { value: "chicago-notes", label: "Chicago (Notes)" },
  { value: "chicago-author", label: "Chicago (Author-Date)" },
  { value: "ieee", label: "IEEE" },
  { value: "harvard", label: "Harvard" },
];

export type Essay = {
  id: string;
  title: string;
  topic?: string;
  thesis?: string;
  content: string;
  outline: OutlineSection[];
  profile_id?: string;
  citation_style?: CitationStyle;
  target_word_count?: number | null;
  instructions?: string;
  writing_type?: string;
  extra_fields?: Record<string, string>;
  ai_checks?: AIDetectionResult[];
  created_at: string;
  updated_at: string;
};

export type EssayListItem = {
  id: string;
  title: string;
  topic?: string;
  writing_type?: string;
  word_count: number;
  updated_at: string;
  created_at: string;
};

export type OutlineSection = {
  id: string;
  title: string;
  notes: string;
  evidence: string;
  collapsed?: boolean;
  paper_ids?: string[];
};

export type Sample = {
  id: string;
  filename: string;
  char_count: number;
  created_at: string;
};

export type SampleDetail = Sample & {
  text: string;
  content_type: string;
};

export type Profile = {
  id: string;
  name: string;
  sample_ids: string[];
  metrics: StyleMetrics;
  created_at: string;
};

export type ProfileListItem = {
  id: string;
  name: string;
  sample_ids: string[];
  created_at: string;
  bundled?: boolean;
};

export type StyleMetrics = {
  word_count: number;
  sentence_count: number;
  paragraph_count: number;
  avg_sentence_length: number;
  stddev_sentence_length: number;
  min_sentence_length: number;
  max_sentence_length: number;
  avg_sentences_per_paragraph: number;
  type_token_ratio: number;
  top_words: [string, number][];
  transition_words: Record<string, number>;
  punctuation_per_1k: Record<string, number>;
  flesch_reading_ease: number;
  avg_syllables_per_word: number;
  active_voice_ratio: number;
};

export type AIOutlineResult = {
  outline: OutlineSection[];
  raw?: string;
};

export type AITextResult = {
  text: string;
};

export type AIScoreResult = {
  score: number | null;
  feedback: string;
};

export type AIDetectionScope = "essay" | "selection";

export type AIDetectionFlag = {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
  reason: string;
  start_char: number;
  end_char: number;
  excerpt: string;
};

export type AIDetectionRequest = {
  essay_id?: string;
  text?: string;
  scope: AIDetectionScope;
  selection_label?: string;
  profile_id?: string;
};

export type AIDetectionResult = {
  check_id: string;
  essay_id?: string;
  scope: AIDetectionScope;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  verdict: "likely_human" | "mixed" | "likely_ai";
  confidence: number;
  flags: AIDetectionFlag[];
  evidence_summary: string;
  suggestions: string[];
  provider: "codex";
  created_at: string;
  selection_label?: string;
  profile_context_provided?: boolean;
  degraded?: boolean;
};

export type AIDetectionHistoryItem = {
  essay_id: string;
  checks: AIDetectionResult[];
};

export type Book = {
  id: string;
  filename: string;
  title: string;
  author?: string;
  publisher?: string;
  year?: number;
  edition?: string;
  isbn?: string;
  editors?: string;
  city?: string;
  page_count: number;
  total_chars: number;
  created_at: string;
};

export type BookDetail = Book & {
  pages: { page: number; text: string }[];
  raw_file: string;
};

export type WebSource = {
  id: string;
  url: string;
  title: string;
  author?: string;
  date_published?: string;
  site_name?: string;
  description?: string;
  accessed_at: string;
  essay_ids: string[];
};

export type EvidenceItem = {
  id: string;
  book_id: string;
  source_title: string;
  quote: string;
  page_number: number;
  context: string;
  relevance: string;
  section_id: string | null;
  created_at: string;
};

export type EvidenceStore = {
  essay_id: string;
  items: EvidenceItem[];
};

export type ChapterSpec = {
  page_start?: number;
  page_end?: number;
  chapter_ref?: string;
};

export type ExtractEvidenceRequest = {
  essay_id: string;
  book_id: string;
  chapter: ChapterSpec;
  topic?: string;
  thesis?: string;
  num_quotes?: number;
  profile_id?: string;
  citation_style?: string;
};

export type ResearchPaper = {
  paper_id: string;
  title: string;
  authors: { name: string; authorId?: string }[];
  year: number | null;
  abstract: string | null;
  tldr: string | null;
  doi: string | null;
  citation_count: number | null;
  fields_of_study: string[];
  is_open_access: boolean;
  pdf_url: string | null;
};

export type SavedPaper = ResearchPaper & {
  notes: string | null;
  essay_ids: string[];
  saved_at: string;
  has_local_pdf?: boolean;
};

export type ResearchSearchResult = {
  papers: ResearchPaper[];
  total: number;
  offset: number;
  next_offset: number | null;
};

export type FormattedCitation = {
  paper_id: string;
  style: CitationStyle;
  citation: string;
};

export type SentenceStarterSection = {
  section_title: string;
  starters: string[];
};

export type SentenceStartersResult = {
  sections: SentenceStarterSection[];
  raw?: string;
};

// Custom actions
export type CustomAction = {
  id: string;
  name: string;
  instructions: string;
};

// Chat types
export type ChatEdit = {
  id: string;
  find: string;
  replace: string;
  applied: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  edits?: ChatEdit[];
  timestamp: number;
};

export type ChatRequest = {
  message: string;
  session_id?: string;
  essay_id?: string;
  essay_content?: string;
  profile_id?: string;
  topic?: string;
  thesis?: string;
  outline_summary?: string;
};

export type ChatResponse = {
  reply: string;
  session_id?: string;
};
