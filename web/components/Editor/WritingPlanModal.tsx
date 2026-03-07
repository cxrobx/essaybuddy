"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "@/components/ui/Modal";
import type { Essay, CitationStyle, Book, ProfileListItem, Sample } from "@/lib/types";
import { CITATION_STYLES } from "@/lib/types";
import type { WritingTypeConfig } from "@/lib/writingTypes";
import { WRITING_TYPES, WRITING_TYPE_CATEGORIES, getWritingType } from "@/lib/writingTypes";
import { listProfiles, listSamples, uploadSample, deleteSample } from "@/lib/api";

export default function WritingPlanModal({
  open,
  onClose,
  essay,
  onFieldChange,
  activeProfileId,
  books,
  sampleCount,
  writingType,
  onProfileChange,
  onOpenProfileCreator,
  onSampleUploaded,
}: {
  open: boolean;
  onClose: () => void;
  essay: Essay;
  onFieldChange: (field: string, value: unknown) => void;
  activeProfileId: string | null;
  books: Book[];
  sampleCount: number;
  writingType?: WritingTypeConfig;
  onProfileChange: (profileId: string) => void;
  onOpenProfileCreator: () => void;
  onSampleUploaded: () => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const currentType = writingType || getWritingType(essay.writing_type);

  useEffect(() => {
    if (open) {
      Promise.all([listProfiles(), listSamples()])
        .then(([p, s]) => { setProfiles(p); setSamples(s); })
        .catch(() => {});
    }
  }, [open]);

  const handleUploadFile = useCallback(async (file: File) => {
    setUploadError("");
    setUploading(true);
    try {
      const sample = await uploadSample(file);
      setSamples((prev) => [...prev, sample]);
      onSampleUploaded();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [onSampleUploaded]);

  const handleDeleteSample = useCallback(async (id: string) => {
    try {
      await deleteSample(id);
      setSamples((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setUploadError("Failed to delete sample");
    }
  }, []);

  return (
    <Modal open={open} onClose={onClose} title={currentType ? `${currentType.label} Details` : "Writing Plan"} wide>
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        {/* Document Type */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Document Type
          </h3>
          <select
            className="w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent cursor-pointer"
            value={essay.writing_type || "essay"}
            onChange={(e) => onFieldChange("writing_type", e.target.value)}
          >
            {WRITING_TYPE_CATEGORIES.map((cat) => (
              <optgroup key={cat.id} label={cat.label}>
                {cat.types.map((typeId) => {
                  const t = WRITING_TYPES[typeId];
                  return (
                    <option key={typeId} value={typeId}>
                      {t.label}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          <p className="text-[11px] text-macos-text-secondary italic">
            Changing type adjusts the editor layout and AI prompts.
          </p>
        </section>

        {/* Essay Details */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            {currentType ? `${currentType.label} Details` : "Essay Details"}
          </h3>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-macos-text-secondary">Topic</span>
              <input
                type="text"
                className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent"
                placeholder="What is this essay about?"
                value={essay.topic || ""}
                onChange={(e) => onFieldChange("topic", e.target.value)}
              />
            </label>
            {(!writingType || writingType.showThesis) && (
              <label className="block">
                <span className="text-xs text-macos-text-secondary">Thesis</span>
                <textarea
                  className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent resize-none"
                  placeholder="Your central argument or claim..."
                  rows={3}
                  value={essay.thesis || ""}
                  onChange={(e) => onFieldChange("thesis", e.target.value)}
                />
              </label>
            )}
            {writingType?.extraFields?.map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs text-macos-text-secondary">{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent resize-none"
                    placeholder={field.placeholder || ""}
                    rows={3}
                    value={essay.extra_fields?.[field.key] || ""}
                    onChange={(e) =>
                      onFieldChange("extra_fields", {
                        ...essay.extra_fields,
                        [field.key]: e.target.value,
                      })
                    }
                  />
                ) : (
                  <input
                    type="text"
                    className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent"
                    placeholder={field.placeholder || ""}
                    value={essay.extra_fields?.[field.key] || ""}
                    onChange={(e) =>
                      onFieldChange("extra_fields", {
                        ...essay.extra_fields,
                        [field.key]: e.target.value,
                      })
                    }
                  />
                )}
              </label>
            ))}
          </div>
        </section>

        {/* Parameters */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Parameters
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {(!writingType || writingType.showCitationStyle) && (
              <label className="block">
                <span className="text-xs text-macos-text-secondary">Citation Style</span>
                <select
                  className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent cursor-pointer"
                  value={essay.citation_style || ""}
                  onChange={(e) =>
                    onFieldChange(
                      "citation_style",
                      (e.target.value || null) as CitationStyle | null
                    )
                  }
                >
                  <option value="">No citation style</option>
                  {CITATION_STYLES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-xs text-macos-text-secondary">Target Word Count</span>
              <input
                type="number"
                className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent"
                placeholder="e.g. 2500"
                value={essay.target_word_count ?? ""}
                onChange={(e) =>
                  onFieldChange(
                    "target_word_count",
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
              />
            </label>
          </div>
        </section>

        {/* Sources & References */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Sources & References
          </h3>
          <div className="bg-macos-elevated rounded px-3 py-2 text-xs text-macos-text-secondary">
            {books.length > 0 ? (
              <>
                <span className="text-macos-text font-medium">
                  {books.length} book{books.length !== 1 ? "s" : ""} uploaded
                </span>
                <ul className="mt-1 space-y-0.5 pl-3 list-disc">
                  {books.map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
                </ul>
              </>
            ) : (
              <span>No books uploaded yet.</span>
            )}
            <p className="mt-2 text-[11px] italic">
              Manage books from the editor toolbar.
            </p>
          </div>
        </section>

        {/* Voice Profile */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Voice Profile
          </h3>
          <div className="text-xs text-macos-text-secondary mb-1">
            Select the writing voice the AI will mimic when generating or rephrasing text.
          </div>
          {profiles.length === 0 ? (
            <div className="text-xs text-macos-text-secondary py-2">
              No voice profiles available.
            </div>
          ) : (
            <div className="space-y-1">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onProfileChange(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs text-left transition-colors ${
                    activeProfileId === p.id
                      ? "bg-macos-accent/20 border border-macos-accent/40 text-macos-text"
                      : "bg-macos-bg border border-macos-border text-macos-text-secondary hover:bg-macos-elevated"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      activeProfileId === p.id ? "bg-macos-accent" : "bg-macos-border"
                    }`}
                  />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.bundled && (
                    <span className="text-[10px] text-macos-text-secondary px-1.5 py-0.5 rounded bg-macos-elevated">
                      bundled
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={onOpenProfileCreator}
            className="w-full py-2 rounded text-xs font-medium border border-dashed border-macos-border text-macos-text-secondary hover:border-macos-accent hover:text-macos-accent transition-colors"
          >
            + New Profile
          </button>
        </section>

        {/* Writing Samples */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Writing Samples
          </h3>
          <div className="text-xs text-macos-text-secondary mb-1">
            Uploaded samples are used as reference material when the AI generates or rephrases text.
          </div>

          {samples.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {samples.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded bg-macos-bg text-xs"
                >
                  <div>
                    <span className="text-macos-text">{s.filename}</span>
                    <span className="text-macos-text-secondary ml-2">
                      {(s.char_count / 1000).toFixed(1)}k chars
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteSample(s.id)}
                    className="text-macos-text-secondary hover:text-macos-error text-xs"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
              dragging
                ? "border-macos-accent bg-macos-accent/10"
                : "border-macos-border"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleUploadFile(file);
            }}
          >
            <div className="text-macos-text-secondary text-xs mb-1">
              {uploading ? "Uploading..." : "Drag & drop a file here, or click to browse"}
            </div>
            <div className="text-[10px] text-macos-text-secondary mb-2">
              Supported: .pdf, .docx, .txt (max 10MB)
            </div>
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1 rounded text-[11px] font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors disabled:opacity-50"
            >
              Choose File
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {uploadError && (
            <div className="p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error">
              {uploadError}
            </div>
          )}
        </section>

        {/* Instructions for AI */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Instructions for AI
          </h3>
          {currentType.presets && currentType.presets.length > 0 && (
            <label className="block">
              <span className="text-xs text-macos-text-secondary">Style Preset</span>
              <select
                className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent cursor-pointer"
                value={selectedPreset}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedPreset(value);
                  if (value !== "custom") {
                    const preset = currentType.presets?.find((p) => p.label === value);
                    if (preset) {
                      onFieldChange("instructions", preset.instructions);
                    }
                  }
                }}
              >
                <option value="custom">Custom</option>
                {currentType.presets.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <textarea
            className="w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent resize-none"
            placeholder="Custom guidelines for AI — e.g., 'Use formal academic tone, focus on environmental policy, avoid first person...'"
            rows={6}
            value={essay.instructions || ""}
            onChange={(e) => {
              onFieldChange("instructions", e.target.value);
              // If user edits instructions manually, switch preset to custom
              if (currentType.presets) {
                const matchesPreset = currentType.presets.some((p) => p.instructions === e.target.value);
                if (!matchesPreset) {
                  setSelectedPreset("custom");
                }
              }
            }}
          />
          <p className="text-[11px] text-macos-text-secondary italic">
            Included in every AI prompt for this {currentType.contentNoun || "essay"}.
          </p>
        </section>
      </div>
    </Modal>
  );
}
