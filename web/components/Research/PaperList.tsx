"use client";

import type { ResearchPaper } from "@/lib/types";
import PaperCard from "./PaperCard";

export default function PaperList({
  papers,
  savedIds,
  loading,
  hasMore,
  compact,
  onLoadMore,
  onSave,
  onRemove,
  onCite,
}: {
  papers: ResearchPaper[];
  savedIds: Set<string>;
  loading: boolean;
  hasMore: boolean;
  compact?: boolean;
  onLoadMore?: () => void;
  onSave?: (paper: ResearchPaper) => void;
  onRemove?: (paperId: string) => void;
  onCite?: (paperId: string) => void;
}) {
  if (loading && papers.length === 0) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded border border-macos-border bg-macos-elevated p-3 animate-pulse space-y-2">
            <div className="h-3 bg-macos-border rounded w-3/4" />
            <div className="h-2 bg-macos-border rounded w-1/2" />
            <div className="h-2 bg-macos-border rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="text-xs text-macos-text-secondary py-8 text-center">
        No results. Try different search terms.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {papers.map((paper) => (
        <PaperCard
          key={paper.paper_id}
          paper={paper}
          saved={savedIds.has(paper.paper_id)}
          compact={compact}
          onSave={onSave}
          onRemove={onRemove}
          onCite={onCite}
        />
      ))}
      {loading && (
        <div className="text-center text-[11px] text-macos-text-secondary py-2">Loading more...</div>
      )}
      {hasMore && !loading && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="w-full text-center text-[11px] text-macos-accent hover:underline py-2"
        >
          Load more results
        </button>
      )}
    </div>
  );
}
