"use client";

import { useState } from "react";
import type { EvidenceItem, OutlineSection } from "@/lib/types";

export default function EvidenceCard({
  item,
  sections,
  compact,
  onAssign,
  onUnassign,
  onDelete,
}: {
  item: EvidenceItem;
  sections: OutlineSection[];
  compact?: boolean;
  onAssign?: (evidenceId: string, sectionId: string) => void;
  onUnassign?: (evidenceId: string) => void;
  onDelete?: (evidenceId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const truncateQuote = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "...";
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.quote);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (compact) {
    return (
      <div className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-macos-bg border border-macos-border text-[11px]">
        <div className="flex-1 min-w-0">
          <span className="text-macos-text italic">
            &ldquo;{truncateQuote(item.quote, 80)}&rdquo;
          </span>
          <span className="text-macos-text-secondary ml-1">(p. {item.page_number})</span>
        </div>
        {onUnassign && (
          <button
            onClick={() => onUnassign(item.id)}
            className="text-macos-text-secondary hover:text-macos-error text-[10px] flex-shrink-0"
            title="Unassign from section"
          >
            &times;
          </button>
        )}
      </div>
    );
  }

  const assignedSection = sections.find((s) => s.id === item.section_id);

  return (
    <div className="rounded border border-macos-border bg-macos-elevated p-2 space-y-1.5">
      <div className="text-[11px] text-macos-text">
        <span
          className="italic cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          &ldquo;{expanded ? item.quote : truncateQuote(item.quote, 120)}&rdquo;
        </span>
        <span className="text-macos-text-secondary ml-1 not-italic">
          (p. {item.page_number})
        </span>
      </div>

      <div className="text-[10px] text-macos-text-secondary truncate">
        {item.textbook_title}
      </div>

      {item.relevance && (
        <div className="text-[10px] text-macos-text-secondary">
          {item.relevance}
        </div>
      )}

      {assignedSection && (
        <div className="text-[10px] text-macos-accent">
          Assigned to: {assignedSection.title}
        </div>
      )}

      <div className="flex items-center gap-1.5 pt-1">
        {onAssign && (
          <select
            className="flex-1 bg-macos-bg text-[10px] text-macos-text-secondary rounded px-1.5 py-1 outline-none border border-macos-border"
            value={item.section_id || ""}
            onChange={(e) => {
              if (e.target.value) {
                onAssign(item.id, e.target.value);
              }
            }}
          >
            <option value="">Assign to section...</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
        {item.section_id && onUnassign && (
          <button
            onClick={() => onUnassign(item.id)}
            className="text-[10px] text-macos-text-secondary hover:text-macos-warning px-1.5 py-1 rounded border border-macos-border"
            title="Unassign"
          >
            Unassign
          </button>
        )}
        <button
          onClick={handleCopy}
          className="text-[10px] text-macos-text-secondary hover:text-macos-text px-1.5 py-1 rounded border border-macos-border"
          title="Copy quote"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {onDelete && (
          <button
            onClick={() => onDelete(item.id)}
            className="text-[10px] text-macos-text-secondary hover:text-macos-error px-1.5 py-1 rounded border border-macos-border"
            title="Delete"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
