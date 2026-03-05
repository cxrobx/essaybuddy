"use client";

import { useState, useCallback, useEffect } from "react";
import type { OutlineSection, EvidenceItem, SentenceStarterSection } from "@/lib/types";
import { generateSentenceStarters } from "@/lib/api";

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
}) {
  const [starters, setStarters] = useState<SentenceStarterSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!open) return null;

  const canGenerate = !!profileId && outlineSections.length > 0;

  const handleGenerate = async () => {
    if (!essayId || !profileId || outlineSections.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const sections = outlineSections.map((sec) => {
        const sectionEvidence = evidenceItems
          .filter((ev) => ev.section_id === sec.id)
          .map((ev) => ({
            quote: ev.quote,
            page_number: ev.page_number,
            textbook_title: ev.textbook_title,
          }));
        return {
          title: sec.title,
          notes: sec.notes || "",
          evidence_items: sectionEvidence,
        };
      });
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

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="w-72 flex-shrink-0 bg-macos-surface border-r border-macos-border flex flex-col overflow-hidden">
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
              ? "Add outline sections first"
              : "No profile assigned"}
          </p>
        ) : loading ? (
          <GeneratingProgress />
        ) : (
          <button
            onClick={handleGenerate}
            className="w-full px-3 py-1.5 rounded text-xs font-medium bg-macos-accent text-white hover:bg-macos-accent/90 transition-colors"
          >
            {starters.length > 0 ? "Regenerate" : "Generate"}
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
          <div key={sIdx}>
            <h4 className="text-[11px] font-semibold text-macos-text mb-1.5 truncate">
              {section.section_title}
            </h4>
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
          </div>
        ))}
      </div>
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
        Generating{"\u2026"} ~{secsLeft}s remaining
      </p>
    </div>
  );
}
