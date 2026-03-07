import type {
  Essay, EssayListItem, Sample, SampleDetail,
  Profile, ProfileListItem, AIOutlineResult, AITextResult, AIScoreResult,
  AIDetectionRequest, AIDetectionResult, AIDetectionHistoryItem,
  OutlineSection, Book, BookDetail, WebSource, EvidenceStore, EvidenceItem,
  ExtractEvidenceRequest, ResearchPaper, SavedPaper, ResearchSearchResult,
  FormattedCitation, ChatRequest, ChatResponse,
  SentenceStartersResult,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

// Essays
export async function listEssays(): Promise<EssayListItem[]> {
  const res = await fetch(`${BASE}/essays`);
  if (!res.ok) throw new Error("Failed to list essays");
  return res.json();
}

export async function createEssay(title?: string, writingType?: string): Promise<Essay> {
  const res = await fetch(`${BASE}/essays`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: title || "Untitled Essay",
      writing_type: writingType || undefined,
    }),
  });
  if (!res.ok) throw new Error("Failed to create essay");
  return res.json();
}

export async function getEssay(id: string): Promise<Essay> {
  const res = await fetch(`${BASE}/essays/${id}`);
  if (!res.ok) throw new Error("Failed to get essay");
  return res.json();
}

export async function updateEssay(id: string, data: Partial<Essay>): Promise<Essay> {
  const res = await fetch(`${BASE}/essays/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update essay");
  return res.json();
}

export async function deleteEssay(id: string): Promise<void> {
  const res = await fetch(`${BASE}/essays/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete essay");
}

export async function exportEssay(id: string, format: "md" | "html" | "fountain"): Promise<void> {
  const res = await fetch(`${BASE}/essays/${id}/export?format=${format}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Export failed" }));
    throw new Error(err.detail || "Export failed");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || `essay.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function uploadOutline(file: File): Promise<{ sections: OutlineSection[] }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/essays/upload-outline`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Failed to parse outline");
  }
  return res.json();
}

// Samples
export async function listSamples(): Promise<Sample[]> {
  const res = await fetch(`${BASE}/samples`);
  if (!res.ok) throw new Error("Failed to list samples");
  return res.json();
}

export async function uploadSample(file: File): Promise<Sample> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/samples/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function getSample(id: string): Promise<SampleDetail> {
  const res = await fetch(`${BASE}/samples/${id}`);
  if (!res.ok) throw new Error("Failed to get sample");
  return res.json();
}

export async function deleteSample(id: string): Promise<void> {
  const res = await fetch(`${BASE}/samples/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete sample");
}

// Profiles
export async function listProfiles(): Promise<ProfileListItem[]> {
  const res = await fetch(`${BASE}/profiles`);
  if (!res.ok) throw new Error("Failed to list profiles");
  return res.json();
}

export async function analyzeProfile(sampleIds: string[], name?: string): Promise<Profile> {
  const res = await fetch(`${BASE}/profiles/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sample_ids: sampleIds, name }),
  });
  if (!res.ok) throw new Error("Failed to analyze profile");
  return res.json();
}

export async function createVoiceProfile(sampleIds: string[], name: string): Promise<Profile> {
  const res = await fetch(`${BASE}/profiles/create-voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sample_ids: sampleIds, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Profile creation failed" }));
    throw new Error(err.detail || "Profile creation failed");
  }
  return res.json();
}

export async function getProfile(id: string): Promise<Profile> {
  const res = await fetch(`${BASE}/profiles/${id}`);
  if (!res.ok) throw new Error("Failed to get profile");
  return res.json();
}

// AI
export async function generateOutline(
  topic: string,
  thesis: string | undefined,
  profileId: string,
  citationStyle?: string,
  instructions?: string,
  targetWordCount?: number | null,
  essayId?: string,
): Promise<AIOutlineResult> {
  const res = await fetch(`${BASE}/ai/generate-outline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      thesis,
      profile_id: profileId,
      citation_style: citationStyle,
      instructions: instructions || undefined,
      target_word_count: targetWordCount || undefined,
      essay_id: essayId || undefined,
    }),
  });
  if (!res.ok) throw new Error("Failed to generate outline");
  return res.json();
}

export async function expandSection(
  essayId: string,
  sectionTitle: string,
  sectionNotes: string | undefined,
  profileId: string,
  citationStyle?: string,
  evidenceItems?: EvidenceItem[],
  instructions?: string,
  targetWordCount?: number | null,
  paperIds?: string[],
): Promise<AITextResult> {
  const body: Record<string, unknown> = {
    essay_id: essayId,
    section_title: sectionTitle,
    section_notes: sectionNotes,
    profile_id: profileId,
    citation_style: citationStyle,
    instructions: instructions || undefined,
    target_word_count: targetWordCount || undefined,
  };
  if (evidenceItems && evidenceItems.length > 0) {
    body.evidence_items = evidenceItems.map((e) => ({ quote: e.quote, page_number: e.page_number, source_title: e.source_title, context: e.context }));
  }
  if (paperIds && paperIds.length > 0) {
    body.paper_ids = paperIds;
  }
  const res = await fetch(`${BASE}/ai/expand-section`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to expand section");
  return res.json();
}

export async function rephraseText(text: string, profileId: string, citationStyle?: string): Promise<AITextResult> {
  const res = await fetch(`${BASE}/ai/rephrase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, profile_id: profileId, citation_style: citationStyle }),
  });
  if (!res.ok) throw new Error("Failed to rephrase");
  return res.json();
}

export async function humanizeText(text: string, profileId: string): Promise<AITextResult> {
  const res = await fetch(`${BASE}/ai/humanize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, profile_id: profileId }),
  });
  if (!res.ok) throw new Error("Failed to humanize");
  return res.json();
}

export async function generateSentenceStarters(params: {
  essayId: string;
  profileId: string;
  sections: { title: string; notes: string; evidence_items: { quote: string; page_number: number; source_title: string }[]; paper_ids?: string[] }[];
  topic?: string;
  thesis?: string;
  citationStyle?: string;
  instructions?: string;
}): Promise<SentenceStartersResult> {
  const res = await fetch(`${BASE}/ai/sentence-starters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      essay_id: params.essayId,
      profile_id: params.profileId,
      sections: params.sections,
      topic: params.topic,
      thesis: params.thesis,
      citation_style: params.citationStyle,
      instructions: params.instructions,
    }),
  });
  if (!res.ok) throw new Error("Failed to generate sentence starters");
  return res.json();
}

export async function generateFullEssay(
  essayId: string,
  profileId: string,
  citationStyle?: string,
  instructions?: string,
  targetWordCount?: number | null,
): Promise<{ text: string; sections_generated: number; total_sections: number; partial: boolean; error?: string }> {
  const res = await fetch(`${BASE}/ai/generate-full-essay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      essay_id: essayId,
      profile_id: profileId,
      citation_style: citationStyle || undefined,
      instructions: instructions || undefined,
      target_word_count: targetWordCount || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Generation failed" }));
    throw new Error(err.detail || "Failed to generate full essay");
  }
  return res.json();
}

export async function rewriteText(
  text: string, profileId: string, instructions: string, citationStyle?: string
): Promise<AITextResult> {
  const res = await fetch(`${BASE}/ai/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, profile_id: profileId, instructions, citation_style: citationStyle }),
  });
  if (!res.ok) throw new Error("Failed to rewrite");
  return res.json();
}

export async function getStyleScore(text: string, profileId: string): Promise<AIScoreResult> {
  const res = await fetch(`${BASE}/ai/style-score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, profile_id: profileId }),
  });
  if (!res.ok) throw new Error("Failed to get style score");
  return res.json();
}

export async function getAIProvider(): Promise<{ provider: string }> {
  const res = await fetch(`${BASE}/ai/provider`);
  if (!res.ok) throw new Error("Failed to get provider");
  return res.json();
}

export async function setAIProvider(provider: string): Promise<{ provider: string }> {
  const res = await fetch(`${BASE}/ai/provider`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) throw new Error("Failed to set provider");
  return res.json();
}

export async function detectAIPatterns(request: AIDetectionRequest): Promise<AIDetectionResult> {
  // Proxy through Next.js to avoid browser timeout on long-running cross-origin requests
  const res = await fetch("/api/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Detection failed" }));
    throw new Error(err.detail || "Detection failed");
  }
  return res.json();
}

export async function getAIDetectionHistory(essayId: string): Promise<AIDetectionHistoryItem> {
  const res = await fetch(`${BASE}/ai/detect-patterns/history/${essayId}`);
  if (!res.ok) throw new Error("Failed to fetch detection history");
  return res.json();
}

// Books
export async function listBooks(): Promise<Book[]> {
  const res = await fetch(`${BASE}/books`);
  if (!res.ok) throw new Error("Failed to list books");
  return res.json();
}

export async function uploadBook(file: File): Promise<Book> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/books/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function getBook(id: string): Promise<BookDetail> {
  const res = await fetch(`${BASE}/books/${id}`);
  if (!res.ok) throw new Error("Failed to get book");
  return res.json();
}

export async function updateBook(id: string, data: Partial<Book>): Promise<Book> {
  const res = await fetch(`${BASE}/books/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update book");
  return res.json();
}

export async function deleteBook(id: string): Promise<void> {
  const res = await fetch(`${BASE}/books/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete book");
}

export async function getBookPages(id: string, start: number, end: number): Promise<{ pages: { page: number; text: string }[] }> {
  const res = await fetch(`${BASE}/books/${id}/pages?start=${start}&end=${end}`);
  if (!res.ok) throw new Error("Failed to get book pages");
  return res.json();
}

export async function lookupISBN(isbn: string): Promise<Partial<Book>> {
  const res = await fetch(`${BASE}/books/isbn-lookup/${isbn}`);
  if (!res.ok) throw new Error("Failed to look up ISBN");
  return res.json();
}

export async function getBookCitation(id: string, style: string): Promise<FormattedCitation> {
  const res = await fetch(`${BASE}/books/${id}/citation?style=${style}`);
  if (!res.ok) throw new Error("Failed to get book citation");
  return res.json();
}

// Web Sources
export async function createWebSource(data: { url: string; title?: string; essay_id?: string }): Promise<WebSource> {
  const res = await fetch(`${BASE}/web-sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create web source" }));
    throw new Error(err.detail || "Failed to create web source");
  }
  return res.json();
}

export async function listWebSources(): Promise<WebSource[]> {
  const res = await fetch(`${BASE}/web-sources`);
  if (!res.ok) throw new Error("Failed to list web sources");
  return res.json();
}

export async function getWebSource(id: string): Promise<WebSource> {
  const res = await fetch(`${BASE}/web-sources/${id}`);
  if (!res.ok) throw new Error("Failed to get web source");
  return res.json();
}

export async function updateWebSource(id: string, data: Partial<WebSource>): Promise<WebSource> {
  const res = await fetch(`${BASE}/web-sources/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update web source");
  return res.json();
}

export async function deleteWebSource(id: string): Promise<void> {
  const res = await fetch(`${BASE}/web-sources/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete web source");
}

export async function linkWebSourceToEssay(id: string, essayId: string, action: "link" | "unlink" = "link"): Promise<WebSource> {
  const res = await fetch(`${BASE}/web-sources/${id}/link`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ essay_id: essayId, action }),
  });
  if (!res.ok) throw new Error("Failed to link web source");
  return res.json();
}

export async function getWebSourceCitation(id: string, style: string): Promise<FormattedCitation> {
  const res = await fetch(`${BASE}/web-sources/${id}/citation?style=${style}`);
  if (!res.ok) throw new Error("Failed to get web source citation");
  return res.json();
}

// Evidence
export async function extractEvidence(request: ExtractEvidenceRequest): Promise<EvidenceStore> {
  const res = await fetch(`${BASE}/evidence/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Extraction failed" }));
    throw new Error(err.detail || "Extraction failed");
  }
  return res.json();
}

export async function getEvidence(essayId: string): Promise<EvidenceStore> {
  const res = await fetch(`${BASE}/evidence/${essayId}`);
  if (!res.ok) throw new Error("Failed to get evidence");
  return res.json();
}

export async function assignEvidence(essayId: string, evidenceId: string, sectionId: string): Promise<void> {
  const res = await fetch(`${BASE}/evidence/${essayId}/assign`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evidence_id: evidenceId, section_id: sectionId }),
  });
  if (!res.ok) throw new Error("Failed to assign evidence");
}

export async function unassignEvidence(essayId: string, evidenceId: string): Promise<void> {
  const res = await fetch(`${BASE}/evidence/${essayId}/unassign/${evidenceId}`, { method: "PUT" });
  if (!res.ok) throw new Error("Failed to unassign evidence");
}

export async function deleteEvidence(essayId: string, evidenceId: string): Promise<void> {
  const res = await fetch(`${BASE}/evidence/${essayId}/${evidenceId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete evidence");
}

// Research
export async function searchResearch(params: {
  q: string; year_min?: number; year_max?: number;
  limit?: number; offset?: number; fields_of_study?: string;
}): Promise<ResearchSearchResult> {
  const query = new URLSearchParams();
  query.set("q", params.q);
  if (params.year_min) query.set("year_min", String(params.year_min));
  if (params.year_max) query.set("year_max", String(params.year_max));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.fields_of_study) query.set("fields_of_study", params.fields_of_study);
  const res = await fetch(`${BASE}/research/search?${query}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail || `Search failed (${res.status})`;
    throw new Error(detail);
  }
  return res.json();
}

export async function getResearchPaper(paperId: string): Promise<ResearchPaper> {
  const res = await fetch(`${BASE}/research/paper/${paperId}`);
  if (!res.ok) throw new Error("Failed to get paper");
  return res.json();
}

export async function saveResearchPaper(paper: ResearchPaper, notes?: string): Promise<SavedPaper> {
  const res = await fetch(`${BASE}/research/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...paper, notes }),
  });
  if (!res.ok) throw new Error("Failed to save paper");
  return res.json();
}

export async function listSavedPapers(essayId?: string): Promise<SavedPaper[]> {
  const url = essayId ? `${BASE}/research/saved?essay_id=${essayId}` : `${BASE}/research/saved`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to list saved papers");
  return res.json();
}

export async function deleteSavedPaper(paperId: string): Promise<void> {
  const res = await fetch(`${BASE}/research/saved/${paperId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete paper");
}

export async function linkPaperToEssay(paperId: string, essayId: string): Promise<SavedPaper> {
  const res = await fetch(`${BASE}/research/saved/${paperId}/link`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ essay_id: essayId, action: "link" }),
  });
  if (!res.ok) throw new Error("Failed to link paper");
  return res.json();
}

export async function unlinkPaperFromEssay(paperId: string, essayId: string): Promise<SavedPaper> {
  const res = await fetch(`${BASE}/research/saved/${paperId}/link`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ essay_id: essayId, action: "unlink" }),
  });
  if (!res.ok) throw new Error("Failed to unlink paper");
  return res.json();
}

export async function downloadPaperPdf(paperId: string): Promise<SavedPaper> {
  const res = await fetch(`${BASE}/research/saved/${paperId}/download-pdf`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Download failed" }));
    throw new Error(err.detail || "Failed to download PDF");
  }
  return res.json();
}

export function getLocalPdfUrl(paperId: string): string {
  return `${BASE}/research/saved/${paperId}/pdf`;
}

export async function getCitation(paperId: string, style: string): Promise<FormattedCitation> {
  const res = await fetch(`${BASE}/research/cite/${paperId}?style=${style}`);
  if (!res.ok) throw new Error("Failed to get citation");
  return res.json();
}

export async function batchCitations(paperIds: string[], style: string): Promise<FormattedCitation[]> {
  const res = await fetch(`${BASE}/research/cite/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_ids: paperIds, style }),
  });
  if (!res.ok) throw new Error("Failed to batch cite");
  return res.json();
}

// Chat
export async function chatWithZora(request: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Chat failed" }));
    throw new Error(err.detail || "Chat failed");
  }
  return res.json();
}
