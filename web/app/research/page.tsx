"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import type { ResearchPaper, SavedPaper, EssayListItem } from "@/lib/types";
import {
  searchResearch, saveResearchPaper, listSavedPapers, deleteSavedPaper,
  linkPaperToEssay, unlinkPaperFromEssay, listEssays,
} from "@/lib/api";
import SearchBar from "@/components/Research/SearchBar";
import PaperList from "@/components/Research/PaperList";
import SavedPapersView from "@/components/Research/SavedPapersView";
import CitationPopover from "@/components/Research/CitationPopover";

export default function ResearchPage() {
  const [results, setResults] = useState<ResearchPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [lastFilters, setLastFilters] = useState<Record<string, unknown>>({});
  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [essays, setEssays] = useState<EssayListItem[]>([]);
  const [selectedEssayId, setSelectedEssayId] = useState<string>("");
  const [citingPaperId, setCitingPaperId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    listSavedPapers().then((papers) => {
      setSavedPapers(papers);
      setSavedIds(new Set(papers.map((p) => p.paper_id)));
    }).catch(() => {});
    listEssays().then(setEssays).catch(() => {});
  }, []);

  const handleSearch = useCallback(
    async (query: string, filters: { year_min?: number; year_max?: number; fields_of_study?: string }) => {
      setLoading(true);
      setLastQuery(query);
      setLastFilters(filters);
      try {
        const result = await searchResearch({ q: query, ...filters, limit: 20, offset: 0 });
        setResults(result.papers);
        setTotal(result.total);
        setNextOffset(result.next_offset);
        setHasMore(result.next_offset !== null);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleLoadMore = useCallback(async () => {
    if (nextOffset === null) return;
    setLoading(true);
    try {
      const result = await searchResearch({ q: lastQuery, ...lastFilters, limit: 20, offset: nextOffset });
      setResults((prev) => [...prev, ...result.papers]);
      setNextOffset(result.next_offset);
      setHasMore(result.next_offset !== null);
    } catch {} finally {
      setLoading(false);
    }
  }, [nextOffset, lastQuery, lastFilters]);

  const handleSave = useCallback(async (paper: ResearchPaper) => {
    try {
      const saved = await saveResearchPaper(paper);
      if (selectedEssayId) {
        await linkPaperToEssay(saved.paper_id, selectedEssayId);
        saved.essay_ids = [...(saved.essay_ids || []), selectedEssayId];
      }
      setSavedPapers((prev) => [saved, ...prev]);
      setSavedIds((prev) => new Set([...prev, saved.paper_id]));
    } catch {}
  }, [selectedEssayId]);

  const handleRemove = useCallback(async (paperId: string) => {
    try {
      await deleteSavedPaper(paperId);
      setSavedPapers((prev) => prev.filter((p) => p.paper_id !== paperId));
      setSavedIds((prev) => { const next = new Set(prev); next.delete(paperId); return next; });
    } catch {}
  }, []);

  return (
    <div className="flex flex-col h-screen bg-macos-bg text-macos-text overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-macos-surface border-b border-macos-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-serif font-semibold text-sm tracking-tight text-macos-text">
            &#9998; Zora
          </span>
          <span className="text-xs text-macos-text-secondary">Research</span>
        </div>
        <div className="flex items-center gap-3">
          {essays.length > 0 && (
            <select
              value={selectedEssayId}
              onChange={(e) => setSelectedEssayId(e.target.value)}
              className="bg-macos-bg text-xs text-macos-text rounded px-2 py-1 outline-none border border-macos-border"
            >
              <option value="">Link to essay...</option>
              {essays.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          )}
          <Link
            href="/editor"
            className="px-3 py-1 rounded-full text-xs font-medium border border-macos-border hover:border-macos-accent text-macos-text-secondary hover:text-macos-text transition-colors"
          >
            Back to Editor
          </Link>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Search results */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-macos-border">
          <div className="p-4">
            <SearchBar onSearch={handleSearch} loading={loading} />
            {total > 0 && (
              <div className="text-[11px] text-macos-text-secondary mt-2">
                {total.toLocaleString()} results found
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <PaperList
              papers={results}
              savedIds={savedIds}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              onSave={handleSave}
              onRemove={handleRemove}
              onCite={(id) => setCitingPaperId(id)}
            />
          </div>
        </div>

        {/* Saved papers sidebar */}
        <div className="w-96 flex-shrink-0 bg-macos-surface flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-macos-border">
            <span className="text-xs font-semibold uppercase tracking-widest text-macos-accent">
              Saved Papers
            </span>
          </div>
          <SavedPapersView
            papers={savedPapers}
            essayId={selectedEssayId || undefined}
            onRemove={handleRemove}
            onCite={(id) => setCitingPaperId(id)}
          />
          <div className="px-3 py-2 border-t border-macos-border text-[11px] text-macos-text-secondary">
            {savedPapers.length} saved paper{savedPapers.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Citation Popover */}
      {citingPaperId && (
        <div className="fixed bottom-8 right-8 z-50">
          <CitationPopover
            paperId={citingPaperId}
            onClose={() => setCitingPaperId(null)}
          />
        </div>
      )}
    </div>
  );
}
