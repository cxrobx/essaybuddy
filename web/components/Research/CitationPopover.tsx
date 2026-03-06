"use client";

import { useState, useEffect } from "react";
import { CITATION_STYLES } from "@/lib/types";
import type { CitationStyle } from "@/lib/types";
import { getCitation } from "@/lib/api";

export default function CitationPopover({
  paperId,
  defaultStyle,
  onInsert,
  onClose,
}: {
  paperId: string;
  defaultStyle?: CitationStyle;
  onInsert?: (citation: string) => void;
  onClose: () => void;
}) {
  const [style, setStyle] = useState<CitationStyle>(defaultStyle || "apa7");
  const [citation, setCitation] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCitation(paperId, style)
      .then((result) => {
        if (!cancelled) setCitation(result.citation);
      })
      .catch(() => {
        if (!cancelled) setCitation("Failed to generate citation");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [paperId, style]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border border-macos-border bg-macos-surface shadow-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-macos-text">Citation</span>
        <button onClick={onClose} className="text-macos-text-secondary hover:text-macos-text text-sm">&times;</button>
      </div>
      <select
        value={style}
        onChange={(e) => setStyle(e.target.value as CitationStyle)}
        className="w-full bg-macos-bg text-[11px] text-macos-text rounded px-2 py-1 outline-none border border-macos-border"
      >
        {CITATION_STYLES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <div className="bg-macos-bg rounded p-2 text-[11px] text-macos-text min-h-[60px] leading-relaxed">
        {loading ? <span className="text-macos-text-secondary">Loading...</span> : citation}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={handleCopy}
          className="flex-1 text-[10px] text-macos-text-secondary hover:text-macos-text px-2 py-1 rounded border border-macos-border"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        {onInsert && (
          <button
            onClick={() => { onInsert(citation); onClose(); }}
            className="flex-1 text-[10px] text-macos-accent hover:underline px-2 py-1 rounded border border-macos-accent/30"
          >
            Insert
          </button>
        )}
      </div>
    </div>
  );
}
