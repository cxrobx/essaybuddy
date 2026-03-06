"use client";

import { useState, useCallback, useEffect } from "react";
import type { ResearchPaper, SavedPaper, CitationStyle } from "@/lib/types";
import { searchResearch, saveResearchPaper, listSavedPapers, deleteSavedPaper, linkPaperToEssay, getCitation } from "@/lib/api";
import SearchBar from "@/components/Research/SearchBar";
import PaperList from "@/components/Research/PaperList";
import SavedPapersView from "@/components/Research/SavedPapersView";
import CitationPopover from "@/components/Research/CitationPopover";
import { useResizablePanel } from "@/lib/useResizablePanel";

type Tab = "search" | "saved";

export default function ResearchPanel({
  open,
  onClose,
  essayId,
  citationStyle,
  onInsertCitation,
  onPaperSaved,
  onPaperDeleted,
}: {
  open: boolean;
  onClose: () => void;
  essayId: string | null;
  citationStyle?: CitationStyle;
  onInsertCitation: (text: string) => void;
  onPaperSaved?: (paper: SavedPaper) => void;
  onPaperDeleted?: (paperId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("search");
  const [results, setResults] = useState<ResearchPaper[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [lastFilters, setLastFilters] = useState<Record<string, unknown>>({});
  const [searchError, setSearchError] = useState("");
  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [citingPaperId, setCitingPaperId] = useState<string | null>(null);
  const { width: panelWidth, handleMouseDown } = useResizablePanel(320, "right");

  // Load saved papers on mount and when tab changes
  useEffect(() => {
    if (!open) return;
    listSavedPapers().then((papers) => {
      setSavedPapers(papers);
      setSavedIds(new Set(papers.map((p) => p.paper_id)));
    }).catch(() => {});
  }, [open, tab]);

  const handleSearch = useCallback(
    async (query: string, filters: { year_min?: number; year_max?: number; fields_of_study?: string }) => {
      setSearchLoading(true);
      setSearchError("");
      setLastQuery(query);
      setLastFilters(filters);
      try {
        const result = await searchResearch({ q: query, ...filters, limit: 10, offset: 0 });
        setResults(result.papers);
        setNextOffset(result.next_offset);
        setHasMore(result.next_offset !== null);
      } catch (e) {
        setResults([]);
        const msg = e instanceof Error ? e.message : "Search failed";
        setSearchError(msg.includes("429") ? "Rate limited. Wait a moment and try again." : msg);
      } finally {
        setSearchLoading(false);
      }
    },
    []
  );

  const handleLoadMore = useCallback(async () => {
    if (nextOffset === null) return;
    setSearchLoading(true);
    try {
      const result = await searchResearch({ q: lastQuery, ...lastFilters, limit: 10, offset: nextOffset });
      setResults((prev) => [...prev, ...result.papers]);
      setNextOffset(result.next_offset);
      setHasMore(result.next_offset !== null);
    } catch {} finally {
      setSearchLoading(false);
    }
  }, [nextOffset, lastQuery, lastFilters]);

  const handleSave = useCallback(async (paper: ResearchPaper) => {
    try {
      const saved = await saveResearchPaper(paper);
      // Link to current essay if available
      if (essayId) {
        await linkPaperToEssay(saved.paper_id, essayId);
        saved.essay_ids = [...(saved.essay_ids || []), essayId];
      }
      setSavedPapers((prev) => [saved, ...prev]);
      setSavedIds((prev) => new Set([...prev, saved.paper_id]));
      onPaperSaved?.(saved);
    } catch {}
  }, [essayId, onPaperSaved]);

  const handleRemove = useCallback(async (paperId: string) => {
    try {
      await deleteSavedPaper(paperId);
      setSavedPapers((prev) => prev.filter((p) => p.paper_id !== paperId));
      setSavedIds((prev) => { const next = new Set(prev); next.delete(paperId); return next; });
      onPaperDeleted?.(paperId);
    } catch {}
  }, [onPaperDeleted]);

  const handlePaperUpdate = useCallback((updated: SavedPaper) => {
    setSavedPapers((prev) => prev.map((p) => p.paper_id === updated.paper_id ? updated : p));
  }, []);

  const handleCite = useCallback(async (paperId: string) => {
    setCitingPaperId(paperId);
  }, []);

  const handleInsertCitation = useCallback((citation: string) => {
    onInsertCitation(citation);
    setCitingPaperId(null);
  }, [onInsertCitation]);

  if (!open) return null;

  return (
    <div className="flex-shrink-0 bg-macos-surface border-l border-macos-border flex flex-col overflow-hidden relative" style={{ width: panelWidth }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-macos-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-macos-accent">Research</span>
        <button onClick={onClose} className="text-macos-text-secondary hover:text-macos-text text-sm">&times;</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-macos-border">
        {(["search", "saved"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-2 py-1.5 text-[11px] capitalize transition-colors ${
              tab === t ? "text-macos-accent border-b-2 border-macos-accent" : "text-macos-text-secondary hover:text-macos-text"
            }`}
          >
            {t}{t === "saved" ? ` (${savedPapers.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "search" ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-2">
            <SearchBar onSearch={handleSearch} loading={searchLoading} />
            {searchError && (
              <div className="mt-1.5 p-2 rounded bg-macos-error/10 border border-macos-error/30 text-[11px] text-macos-error">
                {searchError}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <PaperList
              papers={results}
              savedIds={savedIds}
              loading={searchLoading}
              hasMore={hasMore}
              compact
              onLoadMore={handleLoadMore}
              onSave={handleSave}
              onRemove={handleRemove}
              onCite={handleCite}
            />
          </div>
        </div>
      ) : (
        <SavedPapersView
          papers={savedPapers}
          essayId={essayId || undefined}
          onRemove={handleRemove}
          onCite={handleCite}
          onPaperUpdate={handlePaperUpdate}
        />
      )}

      <div className="px-3 py-2 border-t border-macos-border text-[11px] text-macos-text-secondary">
        {savedPapers.length} saved paper{savedPapers.length !== 1 ? "s" : ""}
      </div>

      {/* Citation Popover */}
      {citingPaperId && (
        <div className="absolute bottom-12 left-2 right-2 z-50">
          <CitationPopover
            paperId={citingPaperId}
            defaultStyle={citationStyle}
            onInsert={handleInsertCitation}
            onClose={() => setCitingPaperId(null)}
          />
        </div>
      )}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-macos-accent/20 transition-colors"
      />
    </div>
  );
}
