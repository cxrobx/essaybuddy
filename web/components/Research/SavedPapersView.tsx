"use client";

import { useState, useCallback } from "react";
import type { SavedPaper } from "@/lib/types";
import PaperCard from "./PaperCard";

type FilterTab = "all" | "linked" | "unlinked";

export default function SavedPapersView({
  papers,
  essayId,
  onRemove,
  onCite,
  onPaperUpdate,
}: {
  papers: SavedPaper[];
  essayId?: string;
  onRemove?: (paperId: string) => void;
  onCite?: (paperId: string) => void;
  onPaperUpdate?: (paper: SavedPaper) => void;
}) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = papers.filter((p) => {
    if (!essayId) return true;
    if (filter === "linked") return p.essay_ids.includes(essayId);
    if (filter === "unlinked") return !p.essay_ids.includes(essayId);
    return true;
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: papers.length },
    ...(essayId
      ? [
          { key: "linked" as FilterTab, label: "Linked", count: papers.filter((p) => p.essay_ids.includes(essayId)).length },
          { key: "unlinked" as FilterTab, label: "Unlinked", count: papers.filter((p) => !p.essay_ids.includes(essayId)).length },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col h-full">
      {tabs.length > 1 && (
        <div className="flex border-b border-macos-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 px-2 py-1.5 text-[11px] transition-colors ${
                filter === tab.key
                  ? "text-macos-accent border-b-2 border-macos-accent"
                  : "text-macos-text-secondary hover:text-macos-text"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-xs text-macos-text-secondary py-4 text-center">
            {papers.length === 0 ? "No saved papers yet." : "No papers match this filter."}
          </div>
        ) : (
          filtered.map((paper) => (
            <PaperCard
              key={paper.paper_id}
              paper={paper}
              saved
              compact
              onRemove={onRemove}
              onCite={onCite}
              onPaperUpdate={onPaperUpdate}
            />
          ))
        )}
      </div>
    </div>
  );
}
