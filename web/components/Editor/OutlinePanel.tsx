"use client";

import { useState, useRef, useEffect } from "react";
import type { OutlineSection, EvidenceItem } from "@/lib/types";
import { uploadOutline } from "@/lib/api";
import EvidenceCard from "@/components/Evidence/EvidenceCard";
import Modal from "@/components/ui/Modal";

export default function OutlinePanel({
  sections,
  onUpdate,
  onSectionClick,
  sampleCount,
  profileId,
  profileName,
  evidenceItems,
  onAssignEvidence,
  onUnassignEvidence,
  onGenerateOutline,
  generating,
  outlineError,
  startersOpen,
  onStartersToggle,
}: {
  sections: OutlineSection[];
  onUpdate: (sections: OutlineSection[]) => void;
  onSectionClick: (section: OutlineSection) => void;
  sampleCount: number;
  profileId: string | null;
  profileName: string | null;
  evidenceItems?: EvidenceItem[];
  onAssignEvidence?: (evidenceId: string, sectionId: string) => void;
  onUnassignEvidence?: (evidenceId: string) => void;
  onGenerateOutline?: (additionalText?: string, existingOutline?: OutlineSection[]) => void;
  generating?: boolean;
  outlineError?: string;
  startersOpen?: boolean;
  onStartersToggle?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignDropdownId, setAssignDropdownId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateMode, setGenerateMode] = useState<"regenerate" | "refine" | "edit">("regenerate");
  const [additionalText, setAdditionalText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadOutline = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = "";

    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadOutline(file);
      onUpdate(result.sections);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const addSection = () => {
    const id = Math.random().toString(36).slice(2, 8);
    onUpdate([...sections, { id, title: "New Section", notes: "", evidence: "" }]);
  };

  const removeSection = (id: string) => {
    onUpdate(sections.filter((s) => s.id !== id));
  };

  const toggleCollapse = (id: string) => {
    onUpdate(
      sections.map((s) =>
        s.id === id ? { ...s, collapsed: !s.collapsed } : s
      )
    );
  };

  const updateField = (
    id: string,
    field: keyof OutlineSection,
    value: string
  ) => {
    onUpdate(
      sections.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  return (
    <aside className="w-72 flex-shrink-0 bg-macos-surface border-r border-macos-border flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-macos-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-macos-text-secondary">
          Outline
        </span>
        {onStartersToggle && (
          <button
            onClick={onStartersToggle}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              startersOpen
                ? "bg-macos-accent/15 text-macos-accent"
                : "text-macos-text-secondary hover:text-macos-text hover:bg-macos-elevated"
            }`}
          >
            Starters
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className="rounded border border-macos-border bg-macos-elevated group"
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-5 h-5 rounded-full bg-macos-accent/15 text-macos-accent text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>
              <button
                onClick={() => toggleCollapse(section.id)}
                className="text-macos-text-secondary hover:text-macos-text text-[10px] transition-transform flex-shrink-0"
                style={{ transform: section.collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              >
                &#9662;
              </button>
              {editingId === section.id ? (
                <input
                  className="flex-1 bg-transparent text-xs text-macos-text outline-none border-b border-macos-accent"
                  value={section.title}
                  onChange={(e) =>
                    updateField(section.id, "title", e.target.value)
                  }
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 text-xs font-medium text-macos-text cursor-pointer truncate"
                  onClick={() => onSectionClick(section)}
                  onDoubleClick={() => setEditingId(section.id)}
                >
                  {section.title}
                </span>
              )}
              {(() => {
                const count = evidenceItems?.filter((e) => e.section_id === section.id).length ?? 0;
                return count > 0 ? (
                  <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
                    {count}
                  </span>
                ) : null;
              })()}
              <button
                onClick={() => removeSection(section.id)}
                className="text-macos-text-secondary hover:text-macos-error text-xs opacity-0 group-hover:opacity-100"
                title="Remove section"
              >
                &times;
              </button>
            </div>

            {!section.collapsed && (
              <div className="px-3 pb-2 space-y-1">
                <div className="w-full text-[11px] text-macos-text-secondary rounded p-1.5 border border-macos-border bg-macos-surface">
                  <textarea
                    className="w-full bg-transparent resize-none outline-none"
                    placeholder="Notes..."
                    rows={2}
                    value={section.notes}
                    onChange={(e) =>
                      updateField(section.id, "notes", e.target.value)
                    }
                  />
                </div>
                <div className="w-full text-[11px] text-macos-text-secondary italic rounded p-1.5 border border-macos-border bg-macos-surface">
                  <textarea
                    className="w-full bg-transparent resize-none outline-none italic"
                    placeholder="Evidence..."
                    rows={2}
                    value={section.evidence}
                    onChange={(e) =>
                      updateField(section.id, "evidence", e.target.value)
                    }
                  />
                </div>
                {evidenceItems && evidenceItems.filter((e) => e.section_id === section.id).length > 0 && (
                  <div className="space-y-1">
                    {evidenceItems
                      .filter((e) => e.section_id === section.id)
                      .map((item) => (
                        <EvidenceCard
                          key={item.id}
                          item={item}
                          sections={sections}
                          compact
                          onUnassign={onUnassignEvidence}
                        />
                      ))}
                  </div>
                )}
                {onAssignEvidence && evidenceItems && evidenceItems.some((e) => !e.section_id) && (
                  <div className="relative">
                    <button
                      onClick={() => setAssignDropdownId(assignDropdownId === section.id ? null : section.id)}
                      className="text-[10px] text-macos-text-secondary hover:text-macos-accent transition-colors"
                    >
                      + Assign Evidence
                    </button>
                    {assignDropdownId === section.id && (
                      <div className="absolute left-0 top-full mt-1 z-10 w-full max-h-32 overflow-y-auto rounded border border-macos-border bg-macos-elevated shadow-lg">
                        {evidenceItems
                          .filter((e) => !e.section_id)
                          .map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                onAssignEvidence(item.id, section.id);
                                setAssignDropdownId(null);
                              }}
                              className="w-full text-left px-2 py-1.5 text-[10px] text-macos-text hover:bg-macos-accent/10 border-b border-macos-border last:border-b-0"
                            >
                              <span className="italic line-clamp-1">
                                &ldquo;{item.quote.length > 60 ? item.quote.slice(0, 60) + "..." : item.quote}&rdquo;
                              </span>
                              <span className="text-macos-text-secondary ml-1 not-italic">
                                — {item.textbook_title}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-macos-border space-y-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="sr-only"
          onChange={handleUploadOutline}
        />
        {onGenerateOutline && (
          generating ? (
            <GeneratingProgress />
          ) : (
            <button
              onClick={() => {
                setGenerateMode(sections.length > 0 ? "refine" : "regenerate");
                setGenerateModalOpen(true);
              }}
              disabled={!profileId}
              className="w-full px-3 py-1.5 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              Generate Outline
            </button>
          )
        )}
        {outlineError && (
          <p className="text-[11px] text-macos-error px-1">{outlineError}</p>
        )}
        <Modal
          open={generateModalOpen}
          onClose={() => setGenerateModalOpen(false)}
          title="Generate Outline"
        >
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setGenerateMode("regenerate")}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                generateMode === "regenerate"
                  ? "border-macos-accent bg-macos-accent/10"
                  : "border-macos-border hover:border-macos-text-secondary"
              }`}
            >
              <div className="text-xs font-medium text-macos-text">Generate from Writing Plan</div>
              <div className="text-[11px] text-macos-text-secondary mt-0.5">
                Create a fresh outline based on your topic, thesis, and instructions
              </div>
            </button>
            <button
              type="button"
              onClick={() => setGenerateMode("edit")}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                generateMode === "edit"
                  ? "border-macos-accent bg-macos-accent/10"
                  : "border-macos-border hover:border-macos-text-secondary"
              }`}
            >
              <div className="text-xs font-medium text-macos-text">Generate with additional input</div>
              <div className="text-[11px] text-macos-text-secondary mt-0.5">
                Start fresh using Writing Plan plus your additional notes below
              </div>
            </button>
            {sections.length > 0 && (
              <button
                type="button"
                onClick={() => setGenerateMode("refine")}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  generateMode === "refine"
                    ? "border-macos-accent bg-macos-accent/10"
                    : "border-macos-border hover:border-macos-text-secondary"
                }`}
              >
                <div className="text-xs font-medium text-macos-text">Refine current outline</div>
                <div className="text-[11px] text-macos-text-secondary mt-0.5">
                  Improve your existing {sections.length}-section outline with optional guidance
                </div>
              </button>
            )}
            {(generateMode === "edit" || generateMode === "refine") && (
              <textarea
                className="w-full rounded-lg border border-macos-border bg-macos-elevated text-xs text-macos-text p-2.5 resize-none outline-none focus:border-macos-accent placeholder:text-macos-text-secondary"
                rows={4}
                placeholder={
                  generateMode === "refine"
                    ? "What should change? e.g. 'Add a counterargument section' or 'Make it 5 paragraphs'..."
                    : "Add extra instructions or notes to guide outline generation..."
                }
                value={additionalText}
                onChange={(e) => setAdditionalText(e.target.value)}
              />
            )}
            <button
              onClick={() => {
                const text = (generateMode === "edit" || generateMode === "refine") ? additionalText : undefined;
                const outline = generateMode === "refine" ? sections : undefined;
                onGenerateOutline?.(text || undefined, outline);
                setGenerateModalOpen(false);
                setAdditionalText("");
                setGenerateMode(sections.length > 0 ? "refine" : "regenerate");
              }}
              disabled={generating || !profileId}
              className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
        </Modal>
        <div className="flex gap-1.5">
          <button
            onClick={addSection}
            className="flex-1 px-3 py-1.5 rounded text-xs font-medium text-macos-text-secondary hover:text-macos-text hover:bg-macos-elevated transition-colors border border-dashed border-macos-border"
          >
            + Add Section
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 rounded text-xs font-medium text-macos-text-secondary hover:text-macos-text hover:bg-macos-elevated transition-colors border border-dashed border-macos-border disabled:opacity-50"
            title="Upload outline from file"
          >
            {uploading ? "..." : "\u2191 Upload"}
          </button>
        </div>
        {uploadError && (
          <p className="text-[11px] text-macos-error px-1">{uploadError}</p>
        )}
      </div>

      <div className="px-3 py-2 border-t border-macos-border text-[11px] text-macos-text-secondary flex items-center gap-3">
        <span>{sampleCount} sample{sampleCount !== 1 ? "s" : ""}</span>
        <span className="flex items-center gap-1 truncate" title={profileName || undefined}>
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              profileId ? "bg-macos-success" : "bg-macos-warning"
            }`}
          />
          {profileId ? (
            <span className="text-macos-success truncate">Voice active</span>
          ) : (
            <span className="text-macos-warning">No voice</span>
          )}
        </span>
      </div>
    </aside>
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
