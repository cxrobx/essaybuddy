"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { OutlineSection, EvidenceItem, SentenceStarterSection } from "@/lib/types";
import { generateSentenceStarters } from "@/lib/api";
import { useResizablePanel } from "@/lib/useResizablePanel";

export default function StartersPanel({
  open,
  onClose,
  essayId,
  profileId,
  topic,
  thesis,
  citationStyle,
  instructions,
  outlineSections,
  evidenceItems,
  onInsertText,
  sectionNoun = "Section",
}: {
  open: boolean;
  onClose: () => void;
  essayId: string | null;
  profileId: string | null;
  topic: string;
  thesis: string;
  citationStyle?: string;
  instructions?: string;
  outlineSections: OutlineSection[];
  evidenceItems: EvidenceItem[];
  onInsertText: (text: string) => void;
  sectionNoun?: string;
}) {
  const [starters, setStarters] = useState<SentenceStarterSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sectionLoading, setSectionLoading] = useState<Record<number, boolean>>({});
  const [sectionError, setSectionError] = useState<Record<number, string>>({});
  const [regenPopoverIdx, setRegenPopoverIdx] = useState<number | null>(null);
  const { width: panelWidth, handleMouseDown } = useResizablePanel(288, "left");

  if (!open) return null;

  const canGenerate = !!profileId && outlineSections.length > 0;

  const buildSectionPayload = (sec: OutlineSection) => {
    const sectionEvidence = evidenceItems
      .filter((ev) => ev.section_id === sec.id)
      .map((ev) => ({
        quote: ev.quote,
        page_number: ev.page_number,
        source_title: ev.source_title,
      }));
    return {
      title: sec.title,
      notes: sec.notes || "",
      evidence_items: sectionEvidence,
      paper_ids: sec.paper_ids || [],
    };
  };

  const handleGenerate = async () => {
    if (!essayId || !profileId || outlineSections.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const sections = outlineSections.map(buildSectionPayload);
      const result = await generateSentenceStarters({
        essayId,
        profileId,
        sections,
        topic: topic || undefined,
        thesis: thesis || undefined,
        citationStyle,
        instructions,
      });
      setStarters(result.sections);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSection = async (sectionIndex: number, customInstructions?: string) => {
    if (!essayId || !profileId) return;
    const sec = outlineSections[sectionIndex];
    if (!sec) return;

    setRegenPopoverIdx(null);
    setSectionLoading((prev) => ({ ...prev, [sectionIndex]: true }));
    setSectionError((prev) => ({ ...prev, [sectionIndex]: "" }));

    try {
      const result = await generateSentenceStarters({
        essayId,
        profileId,
        sections: [buildSectionPayload(sec)],
        topic: topic || undefined,
        thesis: thesis || undefined,
        citationStyle,
        instructions,
        regenerateInstructions: customInstructions || undefined,
      });
      if (result.sections.length > 0) {
        setStarters((prev) => {
          const updated = [...prev];
          updated[sectionIndex] = result.sections[0];
          return updated;
        });
      }
    } catch (e) {
      setSectionError((prev) => ({
        ...prev,
        [sectionIndex]: e instanceof Error ? e.message : "Regeneration failed",
      }));
    } finally {
      setSectionLoading((prev) => ({ ...prev, [sectionIndex]: false }));
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex-shrink-0 bg-macos-surface border-r border-macos-border flex flex-col overflow-hidden relative" style={{ width: panelWidth }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-macos-border">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-macos-text-secondary">
          Starters
        </span>
        <button
          onClick={onClose}
          className="text-macos-text-secondary hover:text-macos-text text-sm leading-none"
        >
          &times;
        </button>
      </div>

      {/* Generate button */}
      <div className="px-3 py-2 border-b border-macos-border">
        {!canGenerate ? (
          <p className="text-[11px] text-macos-text-secondary">
            {outlineSections.length === 0
              ? `Add ${sectionNoun.toLowerCase()}s first`
              : "No profile assigned"}
          </p>
        ) : loading ? (
          <GeneratingProgress />
        ) : (
          <button
            onClick={handleGenerate}
            className="w-full px-3 py-1.5 rounded text-xs font-medium bg-macos-accent text-white hover:bg-macos-accent/90 transition-colors"
          >
            {starters.length > 0 ? "Regenerate All" : "Generate"}
          </button>
        )}
        {error && (
          <p className="text-[11px] text-macos-error mt-1">{error}</p>
        )}
      </div>

      {/* Starters content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {starters.length === 0 && !loading && (
          <p className="text-[11px] text-macos-text-secondary text-center py-4">
            Click Generate to create sentence starters for each outline section.
          </p>
        )}
        {starters.map((section, sIdx) => (
          <div key={sIdx} className="relative">
            <div className="flex items-center justify-between mb-1.5 gap-1">
              <h4 className="text-[11px] font-semibold text-macos-text truncate flex-1">
                {section.section_title}
              </h4>
              {!loading && !sectionLoading[sIdx] && (
                <button
                  onClick={() => setRegenPopoverIdx(regenPopoverIdx === sIdx ? null : sIdx)}
                  className="flex-shrink-0 p-0.5 rounded text-macos-text-secondary hover:text-macos-accent hover:bg-macos-accent/10 transition-colors"
                  title="Regenerate this section"
                >
                  <RefreshIcon />
                </button>
              )}
            </div>
            {regenPopoverIdx === sIdx && (
              <RegeneratePopover
                onQuickRegen={() => handleRegenerateSection(sIdx)}
                onCustomRegen={(instr) => handleRegenerateSection(sIdx, instr)}
                onClose={() => setRegenPopoverIdx(null)}
              />
            )}
            {sectionLoading[sIdx] ? (
              <SectionRegenerating />
            ) : (
              <div className="space-y-2">
                {section.starters.map((starter, i) => {
                  const starterId = `${sIdx}-${i}`;
                  return (
                    <div
                      key={starterId}
                      className="group bg-macos-bg rounded border border-macos-border p-2 text-[11px] text-macos-text leading-relaxed hover:border-macos-accent/50 transition-colors"
                    >
                      <p className="mb-1.5">{starter}</p>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onInsertText(starter)}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-macos-accent/10 text-macos-accent hover:bg-macos-accent/20 transition-colors"
                        >
                          Insert
                        </button>
                        <button
                          onClick={() => handleCopy(starter, starterId)}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-macos-border/50 text-macos-text-secondary hover:text-macos-text transition-colors"
                        >
                          {copiedId === starterId ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {sectionError[sIdx] && (
              <p className="text-[10px] text-macos-error mt-1">{sectionError[sIdx]}</p>
            )}
          </div>
        ))}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-macos-accent/20 transition-colors"
      />
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v3h3" />
      <path d="M3.51 10a5 5 0 1 0 .49-5.38L1 7" />
    </svg>
  );
}

function RegeneratePopover({
  onQuickRegen,
  onCustomRegen,
  onClose,
}: {
  onQuickRegen: () => void;
  onCustomRegen: (instructions: string) => void;
  onClose: () => void;
}) {
  const [customText, setCustomText] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleSubmit = () => {
    const trimmed = customText.trim();
    if (trimmed) onCustomRegen(trimmed);
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-6 z-20 w-56 bg-macos-surface border border-macos-border rounded-lg shadow-lg p-2 space-y-2"
    >
      <button
        onClick={onQuickRegen}
        className="w-full text-left px-2 py-1.5 rounded text-[11px] text-macos-text hover:bg-macos-accent/10 transition-colors"
      >
        Regenerate based on updates
      </button>
      <div className="border-t border-macos-border" />
      <textarea
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Custom instructions…"
        className="w-full h-14 px-2 py-1 rounded text-[11px] bg-macos-bg border border-macos-border text-macos-text placeholder-macos-text-secondary resize-none focus:outline-none focus:border-macos-accent"
      />
      <button
        onClick={handleSubmit}
        disabled={!customText.trim()}
        className="w-full px-2 py-1 rounded text-[11px] font-medium bg-macos-accent text-white hover:bg-macos-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Regenerate
      </button>
    </div>
  );
}

function SectionRegenerating() {
  return (
    <div className="flex items-center gap-1.5 py-3 justify-center">
      <span className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-macos-accent animate-pulse" style={{ animationDelay: "0ms" }} />
        <span className="w-1 h-1 rounded-full bg-macos-accent animate-pulse" style={{ animationDelay: "150ms" }} />
        <span className="w-1 h-1 rounded-full bg-macos-accent animate-pulse" style={{ animationDelay: "300ms" }} />
      </span>
      <span className="text-[10px] text-macos-text-secondary">Regenerating…</span>
    </div>
  );
}

const DURATION_MS = 60_000;
const TICK_MS = 200;

function GeneratingProgress() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - t0), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min((elapsed / DURATION_MS) * 100, 99);
  const secsLeft = Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000));

  return (
    <div className="w-full space-y-1">
      <div className="w-full h-1.5 rounded-full bg-macos-border overflow-hidden">
        <div
          className="h-full rounded-full bg-macos-accent transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-macos-text-secondary text-center">
        Generating{"\u2026"} usually 60–90s
      </p>
    </div>
  );
}
