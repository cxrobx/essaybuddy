"use client";

import { useState, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { extractEvidence } from "@/lib/api";
import type { Textbook, EvidenceItem } from "@/lib/types";

type Step = "select" | "chapter" | "params" | "extracting" | "results";

export default function ExtractionModal({
  open,
  onClose,
  essayId,
  textbooks,
  topic,
  thesis,
  profileId,
  citationStyle,
  onExtracted,
}: {
  open: boolean;
  onClose: () => void;
  essayId: string;
  textbooks: Textbook[];
  topic?: string;
  thesis?: string;
  profileId?: string;
  citationStyle?: string;
  onExtracted: (items: EvidenceItem[]) => void;
}) {
  const [step, setStep] = useState<Step>("select");
  const [selectedTextbook, setSelectedTextbook] = useState<string>("");
  const [pageStart, setPageStart] = useState<string>("");
  const [pageEnd, setPageEnd] = useState<string>("");
  const [chapterRef, setChapterRef] = useState<string>("");
  const [numQuotes, setNumQuotes] = useState(5);
  const [error, setError] = useState("");
  const [extractedItems, setExtractedItems] = useState<EvidenceItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const reset = useCallback(() => {
    setStep("select");
    setSelectedTextbook("");
    setPageStart("");
    setPageEnd("");
    setChapterRef("");
    setNumQuotes(5);
    setError("");
    setExtractedItems([]);
    setSelectedIds(new Set());
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const hasChapterInput = pageStart || pageEnd || chapterRef.trim();

  const handleExtract = async () => {
    setStep("extracting");
    setError("");
    try {
      const result = await extractEvidence({
        essay_id: essayId,
        textbook_id: selectedTextbook,
        chapter: {
          page_start: pageStart ? Number(pageStart) : undefined,
          page_end: pageEnd ? Number(pageEnd) : undefined,
          chapter_ref: chapterRef.trim() || undefined,
        },
        topic,
        thesis,
        num_quotes: numQuotes,
        profile_id: profileId,
        citation_style: citationStyle,
      });
      setExtractedItems(result.items);
      setSelectedIds(new Set(result.items.map((i) => i.id)));
      setStep("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
      setStep("params");
    }
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    const saved = extractedItems.filter((i) => selectedIds.has(i.id));
    onExtracted(saved);
    handleClose();
  };

  const selectedBook = textbooks.find((t) => t.id === selectedTextbook);

  return (
    <Modal
      open={open}
      onClose={step === "extracting" ? () => {} : handleClose}
      title="Extract Evidence"
    >
      {step === "select" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-macos-text mb-1.5">
              Select Textbook
            </label>
            {textbooks.length === 0 ? (
              <div className="text-xs text-macos-text-secondary py-2">
                No textbooks uploaded. Upload a textbook PDF first.
              </div>
            ) : (
              <div className="space-y-1">
                {textbooks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTextbook(t.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs text-left transition-colors ${
                      selectedTextbook === t.id
                        ? "bg-macos-accent/20 border border-macos-accent/40 text-macos-text"
                        : "bg-macos-bg border border-macos-border text-macos-text-secondary hover:bg-macos-elevated"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        selectedTextbook === t.id ? "bg-macos-accent" : "bg-macos-border"
                      }`}
                    />
                    <span className="flex-1 truncate">{t.title}</span>
                    <span className="text-[10px] text-macos-text-secondary">
                      {t.page_count} pp
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setStep("chapter")}
            disabled={!selectedTextbook}
            className="w-full py-2 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {step === "chapter" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-macos-text mb-1.5">
              Chapter / Page Range
            </label>
            <div className="text-[11px] text-macos-text-secondary mb-2">
              Specify pages and/or a chapter reference. At least one is required.
            </div>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <label className="block text-[10px] text-macos-text-secondary mb-1">
                  Start Page
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedBook?.page_count}
                  value={pageStart}
                  onChange={(e) => setPageStart(e.target.value)}
                  placeholder="1"
                  className="w-full px-2 py-1.5 rounded text-xs bg-macos-bg border border-macos-border text-macos-text outline-none focus:border-macos-accent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-macos-text-secondary mb-1">
                  End Page
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedBook?.page_count}
                  value={pageEnd}
                  onChange={(e) => setPageEnd(e.target.value)}
                  placeholder={String(selectedBook?.page_count || "")}
                  className="w-full px-2 py-1.5 rounded text-xs bg-macos-bg border border-macos-border text-macos-text outline-none focus:border-macos-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-macos-text-secondary mb-1">
                Chapter Reference (optional)
              </label>
              <input
                type="text"
                value={chapterRef}
                onChange={(e) => setChapterRef(e.target.value)}
                placeholder='e.g., "Chapter 3: Cell Biology"'
                className="w-full px-2 py-1.5 rounded text-xs bg-macos-bg border border-macos-border text-macos-text outline-none focus:border-macos-accent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("select")}
              className="flex-1 py-2 rounded text-xs font-medium border border-macos-border text-macos-text-secondary hover:text-macos-text transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep("params")}
              disabled={!hasChapterInput}
              className="flex-1 py-2 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === "params" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-macos-text mb-1.5">
              Number of Quotes
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={numQuotes}
              onChange={(e) => setNumQuotes(Number(e.target.value) || 5)}
              className="w-full px-2 py-1.5 rounded text-xs bg-macos-bg border border-macos-border text-macos-text outline-none focus:border-macos-accent"
            />
            <div className="text-[10px] text-macos-text-secondary mt-1">
              How many evidence quotes to extract (1-20)
            </div>
          </div>

          {error && (
            <div className="p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep("chapter")}
              className="flex-1 py-2 rounded text-xs font-medium border border-macos-border text-macos-text-secondary hover:text-macos-text transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleExtract}
              className="flex-1 py-2 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors"
            >
              Extract
            </button>
          </div>
        </div>
      )}

      {step === "extracting" && (
        <div className="py-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-macos-border border-t-macos-accent rounded-full animate-spin" />
          </div>
          <div className="text-sm text-macos-text">
            Extracting evidence...
          </div>
          <div className="text-xs text-macos-text-secondary">
            Analyzing textbook content for relevant quotes
          </div>
          <div className="text-[11px] text-macos-text-secondary/50">
            This may take up to 2 minutes
          </div>
        </div>
      )}

      {step === "results" && (
        <div className="space-y-3">
          <div className="text-xs text-macos-text-secondary">
            Found {extractedItems.length} quote{extractedItems.length !== 1 ? "s" : ""}. Select which to save.
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {extractedItems.map((item) => (
              <label
                key={item.id}
                className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                  selectedIds.has(item.id)
                    ? "border-macos-accent/40 bg-macos-accent/5"
                    : "border-macos-border bg-macos-bg"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="mt-0.5 accent-[var(--macos-accent)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-macos-text italic">
                    &ldquo;{item.quote.length > 150 ? item.quote.slice(0, 150) + "..." : item.quote}&rdquo;
                  </div>
                  <div className="text-[10px] text-macos-text-secondary mt-0.5">
                    p. {item.page_number} &middot; {item.relevance}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {extractedItems.length === 0 && (
            <div className="text-xs text-macos-text-secondary py-2">
              No relevant quotes found. Try a different chapter or page range.
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep("params")}
              className="flex-1 py-2 rounded text-xs font-medium border border-macos-border text-macos-text-secondary hover:text-macos-text transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={selectedIds.size === 0}
              className="flex-1 py-2 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save {selectedIds.size} Quote{selectedIds.size !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
