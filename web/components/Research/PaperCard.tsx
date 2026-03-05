"use client";

import { useState } from "react";
import type { ResearchPaper } from "@/lib/types";

export default function PaperCard({
  paper,
  saved,
  compact,
  onSave,
  onRemove,
  onCite,
}: {
  paper: ResearchPaper;
  saved?: boolean;
  compact?: boolean;
  onSave?: (paper: ResearchPaper) => void;
  onRemove?: (paperId: string) => void;
  onCite?: (paperId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const authorStr = paper.authors.length > 3
    ? `${paper.authors.slice(0, 3).map(a => a.name).join(", ")} et al.`
    : paper.authors.map(a => a.name).join(", ");

  const truncate = (text: string, max: number) =>
    text.length <= max ? text : text.slice(0, max) + "...";

  if (compact) {
    return (
      <div className="rounded border border-macos-border bg-macos-elevated p-2 space-y-1">
        <div className="text-[11px] font-medium text-macos-text leading-tight cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {truncate(paper.title, 100)}
        </div>
        <div className="text-[10px] text-macos-text-secondary truncate">{authorStr}</div>
        <div className="flex items-center gap-2 text-[10px] text-macos-text-secondary">
          {paper.year && <span>{paper.year}</span>}
          {paper.citation_count !== null && <span>{paper.citation_count} cites</span>}
          {paper.is_open_access && <span className="text-green-400">OA</span>}
        </div>
        {expanded && paper.tldr && (
          <div className="text-[10px] text-macos-text-secondary italic mt-1">{paper.tldr}</div>
        )}
        <div className="flex items-center gap-1 pt-0.5">
          {onSave && !saved && (
            <button onClick={() => onSave(paper)} className="text-[10px] text-macos-text-secondary hover:text-macos-accent px-1.5 py-0.5 rounded border border-macos-border">
              Save
            </button>
          )}
          {saved && onRemove && (
            <button onClick={() => onRemove(paper.paper_id)} className="text-[10px] text-macos-text-secondary hover:text-macos-error px-1.5 py-0.5 rounded border border-macos-border">
              Remove
            </button>
          )}
          {onCite && (
            <button onClick={() => onCite(paper.paper_id)} className="text-[10px] text-macos-text-secondary hover:text-macos-accent px-1.5 py-0.5 rounded border border-macos-border">
              Cite
            </button>
          )}
          {paper.pdf_url && (
            <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-macos-accent hover:underline px-1.5 py-0.5">
              PDF
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-macos-border bg-macos-elevated p-3 space-y-2">
      <div className="text-xs font-medium text-macos-text leading-snug cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {paper.title}
      </div>
      <div className="text-[11px] text-macos-text-secondary">{authorStr}</div>
      <div className="flex items-center gap-3 text-[11px] text-macos-text-secondary">
        {paper.year && <span>{paper.year}</span>}
        {paper.citation_count !== null && (
          <span>{paper.citation_count.toLocaleString()} citations</span>
        )}
        {paper.is_open_access && (
          <span className="px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px]">Open Access</span>
        )}
        {paper.fields_of_study.length > 0 && (
          <span className="truncate">{paper.fields_of_study.slice(0, 2).join(", ")}</span>
        )}
      </div>
      {paper.tldr && (
        <div className="text-[11px] text-macos-text-secondary italic">
          {expanded ? paper.tldr : truncate(paper.tldr, 150)}
        </div>
      )}
      {expanded && paper.abstract && (
        <div className="text-[11px] text-macos-text-secondary mt-1 leading-relaxed">
          {paper.abstract}
        </div>
      )}
      <div className="flex items-center gap-1.5 pt-1">
        {onSave && !saved && (
          <button onClick={() => onSave(paper)} className="text-[10px] text-macos-text-secondary hover:text-macos-accent px-1.5 py-1 rounded border border-macos-border">
            Save
          </button>
        )}
        {saved && onRemove && (
          <button onClick={() => onRemove(paper.paper_id)} className="text-[10px] text-macos-text-secondary hover:text-macos-error px-1.5 py-1 rounded border border-macos-border">
            Remove
          </button>
        )}
        {onCite && (
          <button onClick={() => onCite(paper.paper_id)} className="text-[10px] text-macos-text-secondary hover:text-macos-accent px-1.5 py-1 rounded border border-macos-border">
            Cite
          </button>
        )}
        {paper.pdf_url && (
          <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-macos-accent hover:underline px-1.5 py-1">
            View PDF
          </a>
        )}
        {paper.doi && (
          <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-macos-text-secondary hover:text-macos-text px-1.5 py-1">
            DOI
          </a>
        )}
      </div>
    </div>
  );
}
