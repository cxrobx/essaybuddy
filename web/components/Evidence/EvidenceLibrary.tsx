"use client";

import { useState } from "react";
import type { EvidenceItem, OutlineSection } from "@/lib/types";
import EvidenceCard from "./EvidenceCard";

type FilterTab = "all" | "unassigned" | "assigned";

export default function EvidenceLibrary({
  open,
  onClose,
  items,
  sections,
  onAssign,
  onUnassign,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  items: EvidenceItem[];
  sections: OutlineSection[];
  onAssign: (evidenceId: string, sectionId: string) => void;
  onUnassign: (evidenceId: string) => void;
  onDelete: (evidenceId: string) => void;
}) {
  const [filter, setFilter] = useState<FilterTab>("all");

  if (!open) return null;

  const filtered = items.filter((item) => {
    if (filter === "unassigned") return !item.section_id;
    if (filter === "assigned") return !!item.section_id;
    return true;
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "unassigned", label: "Unassigned", count: items.filter((i) => !i.section_id).length },
    { key: "assigned", label: "Assigned", count: items.filter((i) => !!i.section_id).length },
  ];

  return (
    <div className="w-80 flex-shrink-0 bg-macos-surface border-l border-macos-border flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-macos-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-macos-accent">
          Evidence
        </span>
        <button
          onClick={onClose}
          className="text-macos-text-secondary hover:text-macos-text text-sm"
        >
          &times;
        </button>
      </div>

      {/* Filter tabs */}
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

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-xs text-macos-text-secondary py-4 text-center">
            {items.length === 0
              ? "No evidence extracted yet. Use \"Extract\" to pull quotes from textbooks."
              : "No items match this filter."}
          </div>
        ) : (
          filtered.map((item) => (
            <EvidenceCard
              key={item.id}
              item={item}
              sections={sections}
              onAssign={onAssign}
              onUnassign={onUnassign}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-macos-border text-[11px] text-macos-text-secondary">
        {items.length} quote{items.length !== 1 ? "s" : ""} total
      </div>
    </div>
  );
}
